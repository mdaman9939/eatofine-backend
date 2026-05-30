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
    const v = (process.env.USE_MONGO_AUTH ?? '').toLowerCase();
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

  async deliveryManLogin(phone: string, password: string) {
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
    const u = await this.prisma.users.findFirst({ where: { auth_token: token }, select: { id: true } });
    if (u) return { kind: 'customer', id: u.id };
    const v = await this.prisma.vendors.findFirst({ where: { auth_token: token }, select: { id: true } });
    if (v) return { kind: 'vendor', id: v.id };
    const d = await this.prisma.delivery_men.findFirst({ where: { auth_token: token }, select: { id: true } });
    if (d) return { kind: 'deliveryman', id: d.id };
    return null;
  }
}
