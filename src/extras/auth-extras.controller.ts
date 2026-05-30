import { Body, Controller, HttpCode, Post } from '@nestjs/common';

// All authentication endpoints the apps call beyond login/signup.
// For the demo these are stubs: forgot/verify/reset flows always succeed,
// biometric flows acknowledge, registration endpoints are no-ops.
@Controller('auth')
export class AuthExtrasController {
  @Post('forgot-password')
  @HttpCode(200)
  forgot() { return { message: 'Reset link sent (demo)' }; }

  @Post('reset-password')
  @HttpCode(200)
  reset() { return { message: 'Password reset (demo)' }; }

  @Post('verify-token')
  @HttpCode(200)
  verifyToken() { return { message: 'token verified', otp: '1234' }; }

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
  vendorForgot() { return { message: 'Reset link sent (demo)' }; }

  @Post('vendor/reset-password')
  @HttpCode(200)
  vendorReset() { return { message: 'Password reset (demo)' }; }

  @Post('vendor/verify-token')
  @HttpCode(200)
  vendorVerifyToken() { return { message: 'token verified' }; }

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
  dmForgot() { return { message: 'Reset link sent (demo)' }; }

  @Post('delivery-man/reset-password')
  @HttpCode(200)
  dmReset() { return { message: 'Password reset (demo)' }; }

  @Post('delivery-man/verify-token')
  @HttpCode(200)
  dmVerifyToken() { return { message: 'token verified' }; }

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
