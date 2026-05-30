import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, RequireAuth } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { CustomerService } from './customer.service';
import type { CartIdentity } from './customer.service';

@Controller('customer')
@UseGuards(AuthGuard)
@RequireAuth('customer')
export class CustomerController {
  constructor(
    private readonly customer: CustomerService,
    private readonly auth: AuthService,
  ) {}

  @Get('info')
  info(@Req() req: AuthedRequest) {
    return this.customer.info(req.actor!.id);
  }

  @Get('address/list')
  addresses(@Req() req: AuthedRequest) {
    return this.customer.listAddresses(req.actor!.id);
  }

  @Post('address/add')
  @HttpCode(200)
  addAddress(@Req() req: AuthedRequest, @Body() body: Parameters<CustomerService['addAddress']>[1]) {
    return this.customer.addAddress(req.actor!.id, body);
  }

  // ── Cart: works for either an authed customer (Bearer) OR a guest
  // (via ?guest_id=). `@RequireAuth()` at the method overrides the
  // class-level guard so anonymous requests get through; we then resolve
  // identity explicitly inside the handler.

  @Get('cart/list')
  @RequireAuth()
  async cart(@Req() req: AuthedRequest, @Query('guest_id') guestIdStr?: string) {
    const id = await this.resolveCartIdentity(req, guestIdStr);
    return this.customer.getCart(id);
  }

  @Post('cart/add')
  @HttpCode(200)
  @RequireAuth()
  async cartAdd(
    @Req() req: AuthedRequest,
    @Body() body: Parameters<CustomerService['addToCart']>[1],
    @Query('guest_id') guestIdStr?: string,
  ) {
    const id = await this.resolveCartIdentity(req, guestIdStr);
    return this.customer.addToCart(id, body);
  }

  @Post('cart/update')
  @HttpCode(200)
  @RequireAuth()
  async cartUpdate(
    @Req() req: AuthedRequest,
    @Body() body: { cart_id?: number; quantity?: number },
    @Query('guest_id') guestIdStr?: string,
  ) {
    const id = await this.resolveCartIdentity(req, guestIdStr);
    return this.customer.updateCart(id, body.cart_id ?? 0, body.quantity ?? 1);
  }

  @Delete('cart/remove-item')
  @HttpCode(200)
  @RequireAuth()
  async cartRemoveItem(
    @Req() req: AuthedRequest,
    @Query('cart_id', ParseIntPipe) cartId: number,
    @Query('guest_id') guestIdStr?: string,
  ) {
    const id = await this.resolveCartIdentity(req, guestIdStr);
    return this.customer.removeCartItem(id, cartId);
  }

  @Delete('cart/remove')
  @HttpCode(200)
  @RequireAuth()
  async cartClear(@Req() req: AuthedRequest, @Query('guest_id') guestIdStr?: string) {
    const id = await this.resolveCartIdentity(req, guestIdStr);
    return this.customer.clearCart(id);
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private async resolveCartIdentity(req: AuthedRequest, guestIdStr?: string): Promise<CartIdentity> {
    const header = req.header('authorization') ?? '';
    const token = header.replace(/^Bearer\s+/i, '').trim();
    if (token) {
      const actor = await this.auth.findActorByToken(token);
      if (actor?.kind === 'customer') {
        req.actor = actor;
        return { id: actor.id, guest: false };
      }
    }
    const gid = parseInt(guestIdStr ?? '', 10);
    if (Number.isFinite(gid) && gid > 0) {
      return { id: BigInt(gid), guest: true };
    }
    throw new UnauthorizedException({
      errors: [{ code: 'auth-001', message: 'either Bearer token or guest_id query required' }],
    });
  }
}
