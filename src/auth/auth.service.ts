import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';

type Actor = 'customer' | 'vendor' | 'deliveryman' | 'admin';

interface AdminJwtPayload {
  kind: 'admin';
  id: number;
  role_id: number;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mongo: MongoDataService,
  ) {}

  /** Feature flag — when "1", auth lookups read from MongoDB instead of MySQL. */
  private useMongo(): boolean {
    const v = (process.env.USE_MONGO_AUTH ?? '1').toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }

  private generateToken(): string {
    return randomBytes(90).toString('base64url').slice(0, 120);
  }

  async verifyPassword(plain: string, hash: string | null | undefined): Promise<boolean> {
    if (!hash) return false;
    const phpStyle = hash.replace(/^\$2y\$/, '$2b$');
    return bcrypt.compare(plain, phpStyle);
  }

  async customerLoginByEmail(email: string, password: string) {
    if (this.useMongo()) {
      const user = await this.mongo.findOne<{
        mysql_id: number; email: string | null; phone: string | null;
        password: string | null; f_name: string | null; status?: boolean | number;
      }>('users', { email });
      if (!user || !(await this.verifyPassword(password, user.password))) {
        throw new UnauthorizedException({
          errors: [{ code: 'auth-001', message: 'User_credential_does_not_match' }],
        });
      }
      if (user.status === false || user.status === 0) {
        throw new UnauthorizedException({
          errors: [{ code: 'auth-003', message: 'your_account_is_blocked' }],
        });
      }
      const token = this.generateToken();
      await this.mongo.updateOne('users', { mysql_id: user.mysql_id }, { auth_token: token, login_medium: 'manual' });
      return {
        token,
        is_phone_verified: 1,
        is_email_verified: 1,
        is_personal_info: user.f_name ? 1 : 0,
        is_exist_user: null,
        login_type: 'manual',
        email: user.email ?? null,
      };
    }
    const user = await this.prisma.users.findFirst({ where: { email } });
    if (!user || !(await this.verifyPassword(password, user.password))) {
      throw new UnauthorizedException({
        errors: [{ code: 'auth-001', message: 'User_credential_does_not_match' }],
      });
    }
    if (!user.status) {
      throw new UnauthorizedException({
        errors: [{ code: 'auth-003', message: 'your_account_is_blocked' }],
      });
    }
    const token = this.generateToken();
    await this.prisma.users.update({ where: { id: user.id }, data: { auth_token: token, login_medium: 'manual' } });
    return {
      token,
      is_phone_verified: 1,
      is_email_verified: 1,
      is_personal_info: user.f_name ? 1 : 0,
      is_exist_user: null,
      login_type: 'manual',
      email: user.email ?? null,
    };
  }

  async customerLoginByPhone(phone: string, password: string) {
    if (this.useMongo()) {
      const user = await this.mongo.findOne<{
        mysql_id: number; email: string | null; phone: string | null;
        password: string | null; f_name: string | null; status?: boolean | number;
      }>('users', { phone });
      if (!user || !(await this.verifyPassword(password, user.password))) {
        throw new UnauthorizedException({
          errors: [{ code: 'auth-001', message: 'User_credential_does_not_match' }],
        });
      }
      if (user.status === false || user.status === 0) {
        throw new UnauthorizedException({
          errors: [{ code: 'auth-003', message: 'your_account_is_blocked' }],
        });
      }
      const token = this.generateToken();
      await this.mongo.updateOne('users', { mysql_id: user.mysql_id }, { auth_token: token, login_medium: 'manual' });
      return {
        token,
        is_phone_verified: 1,
        is_email_verified: 1,
        is_personal_info: user.f_name ? 1 : 0,
        is_exist_user: null,
        login_type: 'manual',
        email: user.email ?? null,
      };
    }
    const user = await this.prisma.users.findFirst({ where: { phone } });
    if (!user || !(await this.verifyPassword(password, user.password))) {
      throw new UnauthorizedException({
        errors: [{ code: 'auth-001', message: 'User_credential_does_not_match' }],
      });
    }
    if (!user.status) {
      throw new UnauthorizedException({
        errors: [{ code: 'auth-003', message: 'your_account_is_blocked' }],
      });
    }
    const token = this.generateToken();
    await this.prisma.users.update({ where: { id: user.id }, data: { auth_token: token, login_medium: 'manual' } });
    return {
      token,
      is_phone_verified: 1,
      is_email_verified: 1,
      is_personal_info: user.f_name ? 1 : 0,
      is_exist_user: null,
      login_type: 'manual',
      email: user.email ?? null,
    };
  }

  async customerRegister(input: {
    f_name: string;
    l_name?: string;
    phone: string;
    email?: string;
    password: string;
  }) {
    const passwordHash = (await bcrypt.hash(input.password, 10)).replace(/^\$2b\$/, '$2y$');
    if (this.useMongo()) {
      const existing = await this.mongo.findOne<{ mysql_id: number }>('users', { phone: input.phone });
      if (existing) {
        throw new UnauthorizedException({
          errors: [{ code: 'phone', message: 'phone_already_taken' }],
        });
      }
      const token = this.generateToken();
      const nextId = await this.mongo.nextMysqlId('users');
      const now = new Date();
      await this.mongo.insertOne('users', {
        mysql_id: nextId,
        f_name: input.f_name,
        l_name: input.l_name ?? '',
        phone: input.phone,
        email: input.email ?? null,
        password: passwordHash,
        status: true,
        is_phone_verified: true,
        auth_token: token,
        login_medium: 'manual',
        created_at: now,
        updated_at: now,
      });
      return {
        token,
        is_phone_verified: 1,
        is_email_verified: 1,
        is_personal_info: 1,
        is_exist_user: null,
        login_type: 'manual',
        email: input.email ?? null,
      };
    }
    const existing = await this.prisma.users.findFirst({ where: { phone: input.phone } });
    if (existing) {
      throw new UnauthorizedException({
        errors: [{ code: 'phone', message: 'phone_already_taken' }],
      });
    }
    const token = this.generateToken();
    const user = await this.prisma.users.create({
      data: {
        f_name: input.f_name,
        l_name: input.l_name ?? '',
        phone: input.phone,
        email: input.email,
        password: passwordHash,
        status: true,
        is_phone_verified: true,
        auth_token: token,
        login_medium: 'manual',
      },
    });
    return {
      token,
      is_phone_verified: 1,
      is_email_verified: 1,
      is_personal_info: 1,
      is_exist_user: null,
      login_type: 'manual',
      email: user.email ?? null,
    };
  }

  async vendorLogin(email: string, password: string) {
    if (this.useMongo()) {
      const vendor = await this.mongo.findOne<{
        mysql_id: number; email: string | null; password: string | null;
        status?: boolean | number;
      }>('vendors', { email });
      if (!vendor || !(await this.verifyPassword(password, vendor.password))) {
        throw new UnauthorizedException({
          errors: [{ code: 'auth-001', message: 'Credential do not match, please try again' }],
        });
      }
      if (vendor.status === false || vendor.status === 0) {
        throw new UnauthorizedException({
          errors: [{ code: 'auth-003', message: 'your_account_has_been_suspended' }],
        });
      }
      const token = this.generateToken();
      await this.mongo.updateOne('vendors', { mysql_id: vendor.mysql_id }, { auth_token: token });
      const restaurant = await this.mongo.findOne<{ mysql_id: number }>('restaurants', { mysql_vendor_id: vendor.mysql_id });
      return { token, restaurant_id: restaurant?.mysql_id ?? null, role: 'owner' };
    }
    const vendor = await this.prisma.vendors.findFirst({ where: { email } });
    if (!vendor || !(await this.verifyPassword(password, vendor.password))) {
      throw new UnauthorizedException({
        errors: [{ code: 'auth-001', message: 'Credential do not match, please try again' }],
      });
    }
    if (!vendor.status) {
      throw new UnauthorizedException({
        errors: [{ code: 'auth-003', message: 'your_account_has_been_suspended' }],
      });
    }
    const token = this.generateToken();
    await this.prisma.vendors.update({ where: { id: vendor.id }, data: { auth_token: token } });
    const restaurant = await this.prisma.restaurants.findFirst({ where: { vendor_id: vendor.id } });
    return { token, restaurant_id: restaurant?.id ?? null, role: 'owner' };
  }

  /** Look up a delivery man by phone, tolerating stored-format differences.
   *  The apps always send "+91XXXXXXXXXX" (dial code + number, no spaces), but
   *  some admin-entered rows were saved as "XXXXXXXXXX" (no country code) or
   *  "+91 XXXXXXXXXX" (with a space). Try an exact match first, then fall back
   *  to matching the last 10 digits so a pure format mismatch can't 401 a valid
   *  login. */
  private async findDeliveryManByPhone(phone: string): Promise<{
    mysql_id: number; phone: string | null; password: string | null;
    application_status?: string | null; status?: boolean | number;
    zone_id?: number | null; mysql_zone_id?: number | null;
  } | null> {
    type DmAuthDoc = {
      mysql_id: number; phone: string | null; password: string | null;
      application_status?: string | null; status?: boolean | number;
      zone_id?: number | null; mysql_zone_id?: number | null;
    };
    const exact = await this.mongo.findOne<DmAuthDoc>('delivery_men', { phone });
    if (exact) return exact;
    const last10 = (phone ?? '').replace(/\D/g, '').slice(-10);
    if (last10.length !== 10) return null;
    return this.mongo.findOne<DmAuthDoc>('delivery_men', { phone: { $regex: `${last10}$` } });
  }

  async deliveryManLogin(phone: string, password: string) {
    if (this.useMongo()) {
      const dm = await this.findDeliveryManByPhone(phone);
      if (!dm || !(await this.verifyPassword(password, dm.password))) {
        throw new UnauthorizedException({
          errors: [{ code: 'auth-001', message: 'User credentials does not match.' }],
        });
      }
      if (dm.application_status !== 'approved') {
        throw new UnauthorizedException({
          errors: [{ code: 'auth-003', message: 'your_application_is_not_approved_yet' }],
        });
      }
      if (dm.status === false || dm.status === 0) {
        throw new UnauthorizedException({
          errors: [{ code: 'auth-003', message: 'your_account_has_been_suspended' }],
        });
      }
      const token = this.generateToken();
      await this.mongo.updateOne('delivery_men', { mysql_id: dm.mysql_id }, { auth_token: token });
      const zoneId = dm.zone_id ?? dm.mysql_zone_id ?? 'unknown';
      const topic = [`zone_${zoneId}_delivery_man`];
      return { token, topic };
    }
    const dm = await this.prisma.delivery_men.findFirst({ where: { phone } });
    if (!dm || !(await this.verifyPassword(password, dm.password))) {
      throw new UnauthorizedException({
        errors: [{ code: 'auth-001', message: 'User credentials does not match.' }],
      });
    }
    if (dm.application_status !== 'approved') {
      throw new UnauthorizedException({
        errors: [{ code: 'auth-003', message: 'your_application_is_not_approved_yet' }],
      });
    }
    if (!dm.status) {
      throw new UnauthorizedException({
        errors: [{ code: 'auth-003', message: 'your_account_has_been_suspended' }],
      });
    }
    const token = this.generateToken();
    await this.prisma.delivery_men.update({ where: { id: dm.id }, data: { auth_token: token } });
    const topic = [`zone_${dm.zone_id ?? 'unknown'}_delivery_man`];
    return { token, topic };
  }

  async createGuest(input: { ip_address?: string; fcm_token?: string }) {
    if (this.useMongo()) {
      const nextId = await this.mongo.nextMysqlId('guests');
      const now = new Date();
      await this.mongo.insertOne('guests', {
        mysql_id: nextId,
        ip_address: input.ip_address ?? null,
        fcm_token: input.fcm_token ?? null,
        created_at: now,
        updated_at: now,
      });
      return { guest_id: nextId };
    }
    const created = await this.prisma.guests.create({
      data: {
        ip_address: input.ip_address ?? null,
        fcm_token: input.fcm_token ?? null,
      },
    });
    return { guest_id: Number(created.id) };
  }

  async adminLogin(email: string, password: string) {
    let admin: {
      id?: number | bigint; mysql_id?: number;
      f_name: string | null; l_name: string | null;
      email: string; password: string | null;
      image: string | null; role_id: number | bigint | null;
    } | null = null;

    if (this.useMongo()) {
      // Read from MongoDB (`admins` collection)
      const found = await this.mongo.findOne<{
        mysql_id: number; f_name: string | null; l_name: string | null;
        email: string; password: string | null;
        image: string | null; role_id: number | null;
      }>('admins', { email, role_id: 1 });
      admin = found;
    } else {
      const found = await this.prisma.admins.findFirst({ where: { email, role_id: 1n } });
      admin = found;
    }

    if (!admin || !(await this.verifyPassword(password, admin.password))) {
      throw new UnauthorizedException({
        errors: [{ code: 'auth-001', message: 'Credential do not match, please try again' }],
      });
    }

    // mysql_id (Mongo) or id (Prisma) — both resolve to the same numeric admin id
    const adminId = Number(admin.mysql_id ?? admin.id ?? 0);
    const roleId = Number(admin.role_id ?? 1);

    const payload: AdminJwtPayload = {
      kind: 'admin',
      id: adminId,
      role_id: roleId,
      email: admin.email,
    };
    const token = await this.jwt.signAsync(payload);
    return {
      token,
      admin: {
        id: adminId,
        f_name: admin.f_name,
        l_name: admin.l_name,
        email: admin.email,
        image: admin.image,
        role_id: roleId,
      },
    };
  }

  async findActorByToken(token: string): Promise<{ kind: Actor; id: bigint } | null> {
    try {
      const payload = await this.jwt.verifyAsync<AdminJwtPayload>(token);
      if (payload?.kind === 'admin' && typeof payload.id === 'number') {
        return { kind: 'admin', id: BigInt(payload.id) };
      }
    } catch {
      // not a JWT, fall through to opaque-token lookup
    }
    if (this.useMongo()) {
      const u = await this.mongo.findOne<{ mysql_id: number }>('users', { auth_token: token });
      if (u) return { kind: 'customer', id: BigInt(u.mysql_id) };
      const v = await this.mongo.findOne<{ mysql_id: number }>('vendors', { auth_token: token });
      if (v) return { kind: 'vendor', id: BigInt(v.mysql_id) };
      const d = await this.mongo.findOne<{ mysql_id: number }>('delivery_men', { auth_token: token });
      if (d) return { kind: 'deliveryman', id: BigInt(d.mysql_id) };
      return null;
    }
    const u = await this.prisma.users.findFirst({ where: { auth_token: token }, select: { id: true } });
    if (u) return { kind: 'customer', id: u.id };
    const v = await this.prisma.vendors.findFirst({ where: { auth_token: token }, select: { id: true } });
    if (v) return { kind: 'vendor', id: v.id };
    const d = await this.prisma.delivery_men.findFirst({ where: { auth_token: token }, select: { id: true } });
    if (d) return { kind: 'deliveryman', id: d.id };
    return null;
  }
}
