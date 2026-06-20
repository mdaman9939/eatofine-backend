import { BadRequestException, Body, Controller, HttpCode, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';
import { BusinessSettingsService } from '../business-settings/business-settings.service';
import { compressImage } from '../common/image-compress';

// All authentication endpoints the apps call beyond login/signup.
// For the demo these are stubs: forgot/verify/reset flows always succeed,
// biometric flows acknowledge, registration endpoints are no-ops.
//
// Most of these endpoints touch Laravel framework-internal tables
// (password_resets, phone_verifications, email_verifications) that we don't
// migrate to MongoDB. The stub responses are identical regardless of backend,
// so the `useMongo()` branches simply short-circuit with the same message
// shape. PrismaService and MongoDataService are kept on the constructor so
// individual flows can reach into `users` / `vendors` / `delivery_men` later
// (e.g. to persist a real password reset) without touching the wiring again.
@Controller('auth')
export class AuthExtrasController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mongo: MongoDataService,
    private readonly bs: BusinessSettingsService,
  ) {}

  private useMongo(): boolean {
    const v = (process.env.USE_MONGO_EXTRAS ?? '1').toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }

  // ── Real forgot/verify/reset OTP flow (mock delivery) ─────────────────
  // No SMS/email gateway is wired, so the OTP is generated + stored + LOGGED
  // (and returned as `demo_otp` for testing). Everything else is real: the OTP
  // is validated and the password is actually re-hashed on the account.

  /** Pull a phone/email identifier out of the request body (flexible keys). */
  private identifier(body: Record<string, unknown>): string | null {
    const v = body.phone ?? body.email ?? body.identity ?? body.email_or_phone ?? body.contact;
    return v !== undefined && v !== null && String(v).trim() !== '' ? String(v).trim() : null;
  }

  /** Find the account by phone OR email in the given collection. */
  private async findAccount(collection: string, ident: string) {
    return this.mongo.findOne<{ mysql_id: number }>(collection, { $or: [{ phone: ident }, { email: ident }] });
  }

  /** Generate + store an OTP for a forgot-password request. */
  private async requestOtp(collection: string, body: Record<string, unknown>) {
    const ident = this.identifier(body);
    if (!ident) return { errors: [{ code: 'identity', message: 'Phone or email is required' }] };
    if (!this.useMongo()) return { message: 'OTP sent (demo)' };
    const account = await this.findAccount(collection, ident);
    if (!account) return { errors: [{ code: 'account', message: 'No account found with that phone/email' }] };
    const otp = String(Math.floor(1000 + Math.random() * 9000));
    const now = new Date();
    await this.mongo.deleteMany('password_resets', { collection, identifier: ident });
    await this.mongo.insertOne('password_resets', {
      collection, identifier: ident, mysql_id: account.mysql_id, otp,
      expires_at: new Date(now.getTime() + 10 * 60 * 1000), created_at: now,
    });
    // Mock delivery — in production an SMS/email gateway would send this.
    // eslint-disable-next-line no-console
    console.log(`[OTP] ${collection} ${ident} -> ${otp}`);
    return { message: 'OTP sent', demo_otp: otp };
  }

  /** Verify a submitted OTP without consuming it. */
  private async verifyOtp(collection: string, body: Record<string, unknown>) {
    const ident = this.identifier(body);
    const otp = body.otp ?? body.token ?? body.reset_token;
    if (!ident || otp === undefined) return { errors: [{ code: 'input', message: 'identity and otp required' }] };
    if (!this.useMongo()) return { message: 'token verified' };
    const row = await this.mongo.findOne<{ otp: string; expires_at: Date }>('password_resets', { collection, identifier: ident });
    if (!row || String(row.otp) !== String(otp)) return { errors: [{ code: 'otp', message: 'Invalid OTP' }] };
    if (new Date(row.expires_at) < new Date()) return { errors: [{ code: 'otp', message: 'OTP expired' }] };
    return { message: 'token verified' };
  }

  /** Verify the OTP then actually re-hash the account's password. */
  private async resetPassword(collection: string, body: Record<string, unknown>) {
    const ident = this.identifier(body);
    const otp = body.otp ?? body.token ?? body.reset_token;
    const password = body.password ?? body.new_password;
    if (!ident || otp === undefined || !password) return { errors: [{ code: 'input', message: 'identity, otp and password required' }] };
    if (body.confirm_password !== undefined && String(body.confirm_password) !== String(password)) {
      return { errors: [{ code: 'confirm_password', message: 'Passwords do not match' }] };
    }
    if (!this.useMongo()) return { message: 'Password reset (demo)' };
    const row = await this.mongo.findOne<{ otp: string; expires_at: Date; mysql_id: number }>('password_resets', { collection, identifier: ident });
    if (!row || String(row.otp) !== String(otp)) return { errors: [{ code: 'otp', message: 'Invalid OTP' }] };
    if (new Date(row.expires_at) < new Date()) return { errors: [{ code: 'otp', message: 'OTP expired' }] };
    const bcrypt = await import('bcrypt');
    const hash = (await bcrypt.hash(String(password), 10)).replace(/^\$2b\$/, '$2y$');
    await this.mongo.updateOne(collection, { mysql_id: row.mysql_id }, { password: hash, updated_at: new Date() });
    await this.mongo.deleteMany('password_resets', { collection, identifier: ident });
    return { message: 'Password reset successfully' };
  }

  @Post('forgot-password')
  @HttpCode(200)
  forgot(@Body() body: Record<string, unknown> = {}) { return this.requestOtp('users', body); }

  @Post('reset-password')
  @HttpCode(200)
  reset(@Body() body: Record<string, unknown> = {}) { return this.resetPassword('users', body); }

  @Post('verify-token')
  @HttpCode(200)
  verifyToken(@Body() body: Record<string, unknown> = {}) { return this.verifyOtp('users', body); }

  @Post('verify-email')
  @HttpCode(200)
  verifyEmail() { return { message: 'email verified' }; }

  @Post('verify-phone')
  @HttpCode(200)
  verifyPhone() { return { message: 'phone verified' }; }

  @Post('check-email')
  @HttpCode(200)
  checkEmail() { return { message: 'available' }; }

  @Post('update-info')
  @HttpCode(200)
  updateInfo() { return { message: 'info updated' }; }

  @Post('firebase-verify-token')
  @HttpCode(200)
  firebaseVerify() { return { message: 'verified' }; }

  @Post('firebase-reset-password')
  @HttpCode(200)
  firebaseReset() { return { message: 'password reset (demo)' }; }

  // ── Vendor extras ────────────────────────────────────────────────
  @Post('vendor/forgot-password')
  @HttpCode(200)
  vendorForgot(@Body() body: Record<string, unknown> = {}) { return this.requestOtp('vendors', body); }

  @Post('vendor/reset-password')
  @HttpCode(200)
  vendorReset(@Body() body: Record<string, unknown> = {}) { return this.resetPassword('vendors', body); }

  @Post('vendor/verify-token')
  @HttpCode(200)
  vendorVerifyToken(@Body() body: Record<string, unknown> = {}) { return this.verifyOtp('vendors', body); }

  // ── Restaurant self-registration ─────────────────────────────────────
  // Real implementation of the restaurant-app "Register" flow. The app POSTs
  // multipart/form-data (logo + cover + documents alongside text fields), so
  // AnyFilesInterceptor is required to populate `body` — without it `body` is
  // undefined. Creates the vendor account + restaurant (PENDING admin approval,
  // so it surfaces in admin → Restaurants → Joining Requests) and returns the
  // ids the app needs to continue to the business-plan / success step.
  @Post('vendor/register')
  @HttpCode(200)
  @UseInterceptors(AnyFilesInterceptor({ limits: { fileSize: 10 * 1024 * 1024 } }))
  async vendorRegister(
    @Body() body: Record<string, unknown> = {},
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    // Admin can switch self-registration off (Restaurant Registration settings).
    // ON by default until an admin explicitly disables it.
    const registrationOn = await this.bs.getBoolDefault('toggle_restaurant_registration', true);
    if (!registrationOn) {
      throw new BadRequestException({ errors: [{ code: 'registration', message: 'Restaurant registration is currently disabled' }] });
    }
    if (!this.useMongo()) {
      throw new BadRequestException({ errors: [{ code: 'config', message: 'Restaurant registration requires Mongo' }] });
    }

    const b = body ?? {};
    const str = (k: string) => (b[k] !== undefined && b[k] !== null ? String(b[k]).trim() : '');

    const fName = str('fName') || str('f_name');
    const lName = str('lName') || str('l_name');
    const phone = str('phone');
    const email = str('email');
    const password = str('password');

    // The app sends restaurant name + address as a JSON `translations` array:
    //   [{ locale, key:'name'|'address', value }, ...per language...]
    let translations: Array<{ locale?: string; key?: string; value?: string }> = [];
    if (b.translations) { try { translations = JSON.parse(String(b.translations)) ?? []; } catch { translations = []; } }
    const pick = (key: string) =>
      translations.find((t) => (t?.locale === 'en' || t?.locale === 'default') && t?.key === key)?.value
      ?? translations.find((t) => t?.key === key)?.value;
    const name = pick('name') || str('restaurant_name') || str('name');
    const address = pick('address') || str('restaurant_address') || str('address');

    // ── Validation ───────────────────────────────────────────────────
    if (!name) throw new BadRequestException({ errors: [{ code: 'name', message: 'Restaurant name is required' }] });
    if (!fName) throw new BadRequestException({ errors: [{ code: 'f_name', message: 'First name is required' }] });
    if (!phone) throw new BadRequestException({ errors: [{ code: 'phone', message: 'Phone number is required' }] });
    if (!email) throw new BadRequestException({ errors: [{ code: 'email', message: 'Email is required' }] });
    if (!password || password.length < 8) {
      throw new BadRequestException({ errors: [{ code: 'password', message: 'Password must be at least 8 characters' }] });
    }

    // Duplicate guards — a vendor email/phone must be unique to log in later.
    if (await this.mongo.findOne('vendors', { email })) {
      throw new BadRequestException({ errors: [{ code: 'email', message: 'This email is already registered' }] });
    }
    if (await this.mongo.findOne('vendors', { phone })) {
      throw new BadRequestException({ errors: [{ code: 'phone', message: 'This phone number is already registered' }] });
    }

    const now = new Date();

    // ── Vendor account (Laravel-compatible $2y$ hash so login verifies it) ──
    const bcrypt = await import('bcrypt');
    const passwordHash = (await bcrypt.hash(password, 10)).replace(/^\$2b\$/, '$2y$');
    const vendorId = await this.mongo.nextMysqlId('vendors');
    await this.mongo.insertOne('vendors', {
      mysql_id: vendorId,
      f_name: fName, l_name: lName,
      email, phone, password: passwordHash, image: null,
      status: true, created_at: now, updated_at: now,
    });

    // Cuisines arrive as a JSON-encoded array of string ids (fallback: CSV).
    let cuisineIds: number[] = [];
    if (b.cuisine_ids) {
      try {
        const arr = JSON.parse(String(b.cuisine_ids));
        if (Array.isArray(arr)) cuisineIds = arr.map(Number).filter(Number.isFinite);
      } catch {
        cuisineIds = String(b.cuisine_ids).split(',').map((s) => Number(s.trim())).filter(Number.isFinite);
      }
    }

    // Laravel stores delivery_time as "min-max-type" (e.g. "10-15-minute").
    const minT = str('min_delivery_time');
    const maxT = str('max_delivery_time');
    const unit = str('delivery_time_type') || 'minute';
    const deliveryTime = minT && maxT ? `${minT}-${maxT}-${unit}` : null;

    // ── Uploaded files ───────────────────────────────────────────────
    const fileByField = (field: string) => files.find((f) => f.fieldname === field);
    const logoName = await this.saveUploaded(fileByField('logo'), 'restaurant');
    const coverName = await this.saveUploaded(fileByField('cover_photo'), 'restaurant/cover');
    const tinCert = await this.saveUploaded(fileByField('tin_certificate_image'), 'restaurant');

    // Any remaining files are the "Additional Data" document uploads — their
    // field name is the configured field key (input_data).
    const knownFields = new Set(['logo', 'cover_photo', 'tin_certificate_image']);
    const additionalDocs: Array<{ key: string; file: string }> = [];
    for (const f of files) {
      if (knownFields.has(f.fieldname)) continue;
      const saved = await this.saveUploaded(f, 'restaurant/documents');
      if (saved) additionalDocs.push({ key: f.fieldname, file: saved });
    }

    // Additional Data text/date/checkbox answers (JSON map of field_key → value).
    let additionalData: Record<string, unknown> = {};
    if (b.additional_data) { try { additionalData = JSON.parse(String(b.additional_data)) ?? {}; } catch { additionalData = {}; } }

    // Commission % the admin configured (shown on the "Commission Base" card).
    const commission = await this.bs.getNumber('admin_commission', 0);

    // Business plan: commission (no package) vs subscription (a package id).
    const plan = str('business_plan') === 'subscription' ? 'subscription' : 'commission';
    const packageIdRaw = str('package_id');
    const packageId = plan === 'subscription' && packageIdRaw && Number.isFinite(Number(packageIdRaw))
      ? Number(packageIdRaw) : null;

    const zoneId = Number(str('zone_id')) || 1;

    // ── Restaurant (PENDING admin approval) ──────────────────────────
    const restaurantId = await this.mongo.nextMysqlId('restaurants');
    await this.mongo.insertOne('restaurants', {
      mysql_id: restaurantId,
      name,
      translations,
      address,
      email,
      phone,
      latitude: str('lat') || null,
      longitude: str('lng') || null,
      zone_id: zoneId,
      mysql_zone_id: zoneId,
      mysql_vendor_id: vendorId,
      cuisine_ids: cuisineIds,
      delivery_time: deliveryTime,
      minimum_order: 0,
      tax: 0,
      comission: commission,
      // Seed the standard rating / counters every other restaurant carries, so a
      // freshly-registered restaurant is shaped identically to seeded ones and
      // can't trip up clients that read these fields.
      avg_rating: 0,
      rating_count: 0,
      order_count: 0,
      foods_count: 0,
      minimum_shipping_charge: 0,
      restaurant_model: plan,
      subscription_id: packageId,
      additional_data: additionalData,
      additional_documents: additionalDocs.map((d) => d.file),
      restaurant_documents: additionalDocs,
      tax_registration_number: str('tin') || null,
      tax_registration_expire_date: str('tin_expire_date') || null,
      tin_certificate_image: tinCert,
      logo: logoName,
      cover_photo: coverName,
      delivery: true,
      take_away: true,
      veg: true,
      non_veg: true,
      // Not live yet — admin approves in Restaurants → Joining Requests.
      status: false,
      active: false,
      approval_status: 'pending',
      created_at: now,
      updated_at: now,
    });

    // The app reads `restaurant_id` + `package_id`: a null package routes the
    // commission flow (business-plan confirm → success), a real id routes to
    // the subscription payment screen.
    return {
      restaurant_id: restaurantId,
      package_id: packageId,
      message: 'Restaurant registration submitted. An admin will review and approve your restaurant shortly.',
    };
  }

  /** Storage dir for a folder under storage/app/public (created on demand). */
  private storageDir(folder: string): string {
    const root = process.env.STORAGE_ROOT ?? path.resolve(__dirname, '../../storage/app/public');
    const dir = path.join(root, folder);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  /** Persist an uploaded file to disk + a durable copy in Mongo `uploads`.
   *  Mirrors the vendor/customer/delivery extras helpers. Returns the stored
   *  filename (or null when no file was provided). */
  private async saveUploaded(file: Express.Multer.File | undefined, folder: string): Promise<string | null> {
    if (!file || !file.buffer || file.buffer.length === 0) return null;
    let data = file.buffer;
    let ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    let contentType = file.mimetype || 'image/png';
    if (/^image\//i.test(contentType) && !/svg/i.test(contentType)) {
      const compressed = await compressImage(file.buffer);
      if (compressed) { data = compressed.buffer; ext = compressed.ext; contentType = compressed.contentType; }
    }
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    try { fs.writeFileSync(path.join(this.storageDir(folder), filename), data); } catch { /* disk may be read-only */ }
    if (this.useMongo() && data.length < 15 * 1024 * 1024) {
      this.mongo.insertOne('uploads', {
        path: `${folder}/${filename}`,
        content_type: contentType,
        data,
        size: data.length,
        created_at: new Date(),
      }).catch(() => undefined);
    }
    return filename;
  }

  @Post('vendor/package-renew')
  @HttpCode(200)
  packageRenew() { return { message: 'not available' }; }

  @Post('vendor/subscription/payment/api')
  @HttpCode(200)
  subscriptionPayment() { return { redirect_url: null }; }

  // ── Delivery-man extras ──────────────────────────────────────────
  @Post('delivery-man/forgot-password')
  @HttpCode(200)
  dmForgot(@Body() body: Record<string, unknown> = {}) { return this.requestOtp('delivery_men', body); }

  @Post('delivery-man/reset-password')
  @HttpCode(200)
  dmReset(@Body() body: Record<string, unknown> = {}) { return this.resetPassword('delivery_men', body); }

  @Post('delivery-man/verify-token')
  @HttpCode(200)
  dmVerifyToken(@Body() body: Record<string, unknown> = {}) { return this.verifyOtp('delivery_men', body); }

  @Post('delivery-man/firebase-verify-token')
  @HttpCode(200)
  dmFirebaseVerify() { return { message: 'verified' }; }

  @Post('delivery-man/check-password')
  @HttpCode(200)
  dmCheckPassword() { return { message: 'ok' }; }

  @Post('delivery-man/biometric-login')
  @HttpCode(200)
  dmBiometric() { return { message: 'Biometric login not enabled in demo' }; }

  @Post('delivery-man/enable-biometric')
  @HttpCode(200)
  dmEnableBio() { return { message: 'enabled' }; }

  @Post('delivery-man/disable-biometric')
  @HttpCode(200)
  dmDisableBio() { return { message: 'disabled' }; }

  @Post('delivery-man/store')
  @HttpCode(200)
  dmStore() { return { message: 'DM created (demo)' }; }
}
