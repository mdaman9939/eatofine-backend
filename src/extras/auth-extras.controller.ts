import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';

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

  @Post('vendor/register')
  @HttpCode(200)
  vendorRegister(@Body() _body: unknown) {
    return { message: 'Vendor registration is disabled in this demo' };
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
