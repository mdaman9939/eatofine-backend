import { BadRequestException, Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';

// Login + signup routes override the single global `default` bucket with a
// much stricter limit (30 attempts / 5 min by default — see AUTH_THROTTLE_*
// env vars in app.module.ts). This per-route override applies ONLY to auth
// routes, so normal app traffic keeps the generous global limit.
const AUTH_THROTTLE = {
  default: {
    ttl: parseInt(process.env.AUTH_THROTTLE_TTL ?? '300000', 10),
    limit: parseInt(process.env.AUTH_THROTTLE_LIMIT ?? '30', 10),
  },
} as const;

@Controller('auth')
@Throttle(AUTH_THROTTLE)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async customerLogin(
    @Body()
    body: {
      login_type?: string;
      email_or_phone?: string;
      password?: string;
      field_type?: string;
    },
  ) {
    if (body.login_type !== 'manual') {
      throw new BadRequestException({
        errors: [{ code: 'login_type', message: 'Only manual login supported in this demo.' }],
      });
    }
    if (!body.email_or_phone || !body.password) {
      throw new BadRequestException({
        errors: [{ code: 'email_or_phone', message: 'email_or_phone and password required' }],
      });
    }
    if (body.field_type === 'email') {
      return this.auth.customerLoginByEmail(body.email_or_phone, body.password);
    }
    return this.auth.customerLoginByPhone(body.email_or_phone, body.password);
  }

  @Post('sign-up')
  @HttpCode(200)
  async customerRegister(
    @Body() body: { f_name?: string; l_name?: string; phone?: string; email?: string; password?: string },
  ) {
    if (!body.phone || !body.password || !body.f_name) {
      throw new BadRequestException({
        errors: [{ code: 'phone', message: 'f_name, phone, and password are required' }],
      });
    }
    return this.auth.customerRegister({
      f_name: body.f_name,
      l_name: body.l_name,
      phone: body.phone,
      email: body.email,
      password: body.password,
    });
  }

  @Post('vendor/login')
  @HttpCode(200)
  async vendorLogin(@Body() body: { email?: string; password?: string }) {
    if (!body.email || !body.password) {
      throw new BadRequestException({
        errors: [{ code: 'email', message: 'email and password required' }],
      });
    }
    return this.auth.vendorLogin(body.email, body.password);
  }

  @Post('delivery-man/login')
  @HttpCode(200)
  async deliveryManLogin(@Body() body: { phone?: string; password?: string }) {
    if (!body.phone || !body.password) {
      throw new BadRequestException({
        errors: [{ code: 'phone', message: 'phone and password required' }],
      });
    }
    return this.auth.deliveryManLogin(body.phone, body.password);
  }

  @Post('guest/request')
  @HttpCode(200)
  async guestRequest(@Body() body: { fcm_token?: string }) {
    return this.auth.createGuest({ fcm_token: body?.fcm_token });
  }

  @Post('admin/login')
  @HttpCode(200)
  async adminLogin(@Body() body: { email?: string; password?: string }) {
    if (!body.email || !body.password) {
      throw new BadRequestException({
        errors: [{ code: 'email', message: 'email and password required' }],
      });
    }
    return this.auth.adminLogin(body.email, body.password);
  }
}
