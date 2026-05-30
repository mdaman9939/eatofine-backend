import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards, HttpCode } from '@nestjs/common';
import { AuthGuard, RequireAuth } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';

// Mirrors a handful of customer endpoints that the Flutter app calls on
// idle screens (wish-list, notifications, wallet, etc.). For demo purposes
// these return empty / acknowledged shapes so the app never crashes.
@Controller('customer')
@UseGuards(AuthGuard)
@RequireAuth('customer')
export class CustomerExtrasController {
  constructor(private readonly prisma: PrismaService) {}

  // ── Wish list ─────────────────────────────────────────────────────
  @Get('wish-list')
  wishList() {
    return { product: [], restaurant: [] };
  }

  @HttpCode(200)
  @Post('wish-list/add')
  wishAdd() {
    return { message: 'successfully added!' };
  }

  @HttpCode(200)
  @Delete('wish-list/remove')
  wishRemove() {
    return { message: 'successfully removed!' };
  }

  @HttpCode(200)
  @Delete('wish-list/clear-all')
  wishClear() {
    return { message: 'cleared' };
  }

  // ── Notifications (in-app inbox) ──────────────────────────────────
  @Get('notifications')
  async notifications() {
    const rows = await this.prisma.notifications.findMany({
      where: { status: true },
      orderBy: { id: 'desc' },
      take: 50,
    });
    return rows.map((r) => ({
      id: Number(r.id),
      title: r.title,
      description: r.description,
      image: r.image,
      created_at: r.created_at,
    }));
  }

  // ── FCM token (no-op for demo) ────────────────────────────────────
  @HttpCode(200)
  @Post('cm-firebase-token')
  fcmToken() {
    return { message: 'token-updated' };
  }

  // ── Zone update (no-op return ok) ─────────────────────────────────
  @Get('update-zone')
  updateZoneGet() {
    return { ok: true };
  }

  @HttpCode(200)
  @Post('update-zone')
  updateZonePost() {
    return { ok: true };
  }

  // ── Profile update (echo) ─────────────────────────────────────────
  @HttpCode(200)
  @Post('update-profile')
  async updateProfile(@Req() req: AuthedRequest, @Body() body: { f_name?: string; l_name?: string; email?: string; image?: string }) {
    const data: Record<string, unknown> = {};
    if (body.f_name !== undefined) data.f_name = body.f_name;
    if (body.l_name !== undefined) data.l_name = body.l_name;
    if (body.email !== undefined) data.email = body.email;
    if (body.image !== undefined) data.image = body.image;
    if (Object.keys(data).length) {
      await this.prisma.users.update({ where: { id: req.actor!.id }, data });
    }
    return { message: 'Profile updated successfully' };
  }

  // ── Wallet (empty for demo) ───────────────────────────────────────
  @Get('wallet/transactions')
  walletTx() {
    return { data: [], total_size: 0, limit: 25, offset: 1 };
  }

  @Get('wallet/bonuses')
  walletBonuses() {
    return [];
  }

  @HttpCode(200)
  @Post('wallet/add-fund')
  addFund() {
    return { message: 'Not available in demo' };
  }

  // ── Loyalty (empty) ───────────────────────────────────────────────
  @Get('loyalty-point/transactions')
  loyaltyTx() {
    return { data: [], total_size: 0, limit: 25, offset: 1 };
  }

  @HttpCode(200)
  @Post('loyalty-point/point-transfer')
  pointTransfer() {
    return { message: 'Not available in demo' };
  }

  // ── Messages (empty inbox) ────────────────────────────────────────
  @Get('message/list')
  messageList() {
    return { conversations: [], total_size: 0 };
  }

  @Get('message/details')
  messageDetails() {
    return { messages: [] };
  }

  @Get('message/get')
  messageGet() {
    return { messages: [], total_size: 0 };
  }

  @Get('message/search-list')
  messageSearch() {
    return { conversations: [] };
  }

  @HttpCode(200)
  @Post('message/send')
  messageSend() {
    return { message: 'sent' };
  }

  // ── Subscription / interest ───────────────────────────────────────
  @Get('subscription')
  subscription() {
    return { data: [] };
  }

  @HttpCode(200)
  @Post('update-interest')
  updateInterest() {
    return { ok: true };
  }

  // ── Suggested foods / order-again ─────────────────────────────────
  @Get('suggested-foods')
  async suggestedFoods() {
    const rows = await this.prisma.food.findMany({
      where: { status: true },
      orderBy: { avg_rating: 'desc' },
      take: 10,
    });
    return { products: rows.map((r) => ({ ...r, id: Number(r.id), price: Number(r.price), discount: Number(r.discount), tax: Number(r.tax), restaurant_id: Number(r.restaurant_id), category_id: r.category_id ? Number(r.category_id) : null })) };
  }

  @Get('order-again')
  orderAgain() {
    return [];
  }

  // ── Order extras ──────────────────────────────────────────────────
  @Get('order/running-orders')
  async runningOrders(@Req() req: AuthedRequest) {
    const rows = await this.prisma.orders.findMany({
      where: {
        user_id: req.actor!.id,
        order_status: { in: ['pending', 'confirmed', 'accepted', 'processing', 'handover', 'picked_up'] },
      },
      orderBy: { id: 'desc' },
      take: 25,
    });
    return rows.map((r) => ({ ...r, id: Number(r.id), user_id: r.user_id ? Number(r.user_id) : null, restaurant_id: Number(r.restaurant_id), order_amount: Number(r.order_amount) }));
  }

  @Get('order/order-subscription-list')
  orderSubscriptionList() {
    return { data: [], total_size: 0, limit: 25, offset: 1 };
  }

  @Get('order/details')
  async orderDetails(@Req() req: AuthedRequest, @Query('order_id', ParseIntPipe) orderId: number) {
    const items = await this.prisma.order_details.findMany({ where: { order_id: BigInt(orderId) } });
    return items.map((it) => ({
      ...it,
      id: Number(it.id),
      food_id: it.food_id ? Number(it.food_id) : null,
      order_id: it.order_id ? Number(it.order_id) : null,
      price: Number(it.price),
      tax_amount: Number(it.tax_amount),
      total_add_on_price: Number(it.total_add_on_price),
      item_campaign_id: it.item_campaign_id ? Number(it.item_campaign_id) : null,
      discount_on_food: it.discount_on_food ? Number(it.discount_on_food) : null,
    }));
  }

  @HttpCode(200)
  @Post('order/cancel')
  async cancelOrder(@Req() req: AuthedRequest, @Body() body: { order_id?: number; _method?: string; reason?: string }) {
    const id = body.order_id;
    if (!id) return { message: 'order_id required' };
    const order = await this.prisma.orders.findFirst({ where: { id: BigInt(id), user_id: req.actor!.id } });
    if (!order) return { message: 'order not found' };
    await this.prisma.orders.update({
      where: { id: order.id },
      data: {
        order_status: 'canceled',
        canceled: new Date(),
        canceled_by: 'customer',
        cancellation_reason: body.reason ?? null,
      },
    });
    return { message: 'Order canceled' };
  }

  @HttpCode(200)
  @Post('order/payment-method')
  switchPaymentMethod() {
    return { message: 'Payment method updated' };
  }

  @Get('order/refund-reasons')
  async refundReasons() {
    const rows = await this.prisma.refund_reasons.findMany({ where: { status: true } });
    return rows.map((r) => ({ id: Number(r.id), reason: r.reason }));
  }

  @HttpCode(200)
  @Post('order/refund-request')
  async refundRequest(
    @Req() req: AuthedRequest,
    @Body() body: { order_id?: number; customer_reason?: string; customer_note?: string },
  ) {
    if (!body.order_id) return { message: 'order_id required' };
    const order = await this.prisma.orders.findFirst({ where: { id: BigInt(body.order_id), user_id: req.actor!.id } });
    if (!order) return { message: 'order not found' };
    await this.prisma.refunds.create({
      data: {
        order_id: order.id,
        user_id: req.actor!.id,
        order_status: order.order_status,
        customer_reason: body.customer_reason ?? null,
        customer_note: body.customer_note ?? null,
        refund_amount: order.order_amount,
        refund_status: 'pending',
        refund_method: 'wallet',
      },
    });
    return { message: 'Refund request submitted' };
  }

  @HttpCode(200)
  @Post('order/get-Tax')
  getOrderTax() {
    return { total_tax_amount: 0, tax_amount: 0 };
  }

  @HttpCode(200)
  @Post('order/send-notification')
  sendNotification() {
    return { ok: true };
  }

  @HttpCode(200)
  @Post('order/check-restaurant-validation')
  checkRestaurantValidation() {
    return { message: 'valid' };
  }

  @HttpCode(200)
  @Post('order/offline-payment')
  offlinePayment() {
    return { message: 'recorded' };
  }

  @HttpCode(200)
  @Post('order/offline-payment-update')
  offlinePaymentUpdate() {
    return { message: 'recorded' };
  }

  // ── Food list (for cart re-validation etc) ────────────────────────
  @Get('food-list')
  async foodList(@Query('ids') idsStr?: string) {
    const ids = (idsStr ?? '').split(',').map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n));
    if (!ids.length) return [];
    const rows = await this.prisma.food.findMany({ where: { id: { in: ids.map((n) => BigInt(n)) } } });
    return rows.map((r) => ({ ...r, id: Number(r.id), price: Number(r.price), tax: Number(r.tax), discount: Number(r.discount), restaurant_id: Number(r.restaurant_id), category_id: r.category_id ? Number(r.category_id) : null }));
  }

  @HttpCode(200)
  @Post('cart/add-multiple')
  cartAddMultiple() {
    return { message: 'added' };
  }

  // ── Address extras ────────────────────────────────────────────────
  @HttpCode(200)
  @Delete('address/delete')
  async deleteAddress(
    @Req() req: AuthedRequest,
    @Query('address_id', ParseIntPipe) addressId: number,
  ) {
    await this.prisma.customer_addresses.deleteMany({
      where: { id: BigInt(addressId), user_id: req.actor!.id },
    });
    return { message: 'Address deleted' };
  }

  @HttpCode(200)
  @Post('address/update/:id')
  async updateAddress(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthedRequest,
    @Body() body: { address?: string; contact_person_name?: string; contact_person_number?: string; address_type?: string; latitude?: string; longitude?: string },
  ) {
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined) data[k] = v;
    }
    await this.prisma.customer_addresses.updateMany({
      where: { id: BigInt(id), user_id: req.actor!.id },
      data,
    });
    return { message: 'Address updated' };
  }

  @HttpCode(200)
  @Post('address/set-default')
  setDefaultAddress() {
    return { message: 'default set' };
  }

  // ── Account removal (no-op for demo) ──────────────────────────────
  @HttpCode(200)
  @Delete('remove-account')
  removeAccount() {
    return { message: 'Not available in demo' };
  }
}
