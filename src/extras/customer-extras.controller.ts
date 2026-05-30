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
import { MongoDataService } from '../mongo/mongo-data.service';

// Local Mongo doc shapes for the collections we touch here. Only the
// fields actually referenced are declared.
interface MongoNotificationDoc {
  mysql_id: number;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  status?: boolean | null;
  created_at?: Date | string | null;
}

interface MongoFoodDoc {
  mysql_id: number;
  name?: string | null;
  description?: string | null;
  image?: string | null;
  price?: number | string | null;
  tax?: number | string | null;
  discount?: number | string | null;
  mysql_restaurant_id?: number | null;
  mysql_category_id?: number | null;
  status?: boolean | null;
  avg_rating?: number | null;
  legacy?: Record<string, unknown>;
}

interface MongoOrderDoc {
  mysql_id: number;
  mysql_user_id?: number | null;
  mysql_restaurant_id?: number | null;
  order_status?: string | null;
  order_amount?: number | string | null;
  legacy?: Record<string, unknown>;
}

interface MongoOrderDetailDoc {
  mysql_id: number;
  mysql_order_id?: number | null;
  mysql_food_id?: number | null;
  price?: number | string | null;
  tax_amount?: number | string | null;
  total_add_on_price?: number | string | null;
  mysql_item_campaign_id?: number | null;
  discount_on_food?: number | string | null;
  legacy?: Record<string, unknown>;
}

interface MongoRefundReasonDoc {
  mysql_id: number;
  reason?: string | null;
  status?: boolean | null;
}

interface MongoAddressDoc {
  mysql_id: number;
  mysql_user_id?: number | null;
  user_id?: number | null;
}

const toNum = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v) || 0;
  return Number(v) || 0;
};

// Mirrors a handful of customer endpoints that the Flutter app calls on
// idle screens (wish-list, notifications, wallet, etc.). For demo purposes
// these return empty / acknowledged shapes so the app never crashes.
@Controller('customer')
@UseGuards(AuthGuard)
@RequireAuth('customer')
export class CustomerExtrasController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mongo: MongoDataService,
  ) {}

  /** Feature flag — when set, extras read/write Mongo first. */
  private useMongo(): boolean {
    const v = (process.env.USE_MONGO_EXTRAS ?? '').toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }

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
    if (this.useMongo()) {
      const rows = await this.mongo.findMany<MongoNotificationDoc>(
        'notifications',
        { status: true },
        { sort: { mysql_id: -1 }, limit: 50 },
      );
      return rows.map((r) => ({
        id: Number(r.mysql_id),
        title: r.title ?? null,
        description: r.description ?? null,
        image: r.image ?? null,
        created_at: r.created_at ?? null,
      }));
    }
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

    if (this.useMongo()) {
      if (Object.keys(data).length) {
        await this.mongo.updateOne('users', { mysql_id: Number(req.actor!.id) }, data);
      }
      return { message: 'Profile updated successfully' };
    }

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
    if (this.useMongo()) {
      const rows = await this.mongo.findMany<MongoFoodDoc>(
        'foods',
        { status: true },
        { sort: { avg_rating: -1 }, limit: 10 },
      );
      return {
        products: rows.map((r) => ({
          ...(r.legacy ?? {}),
          ...r,
          id: Number(r.mysql_id),
          price: toNum(r.price),
          discount: toNum(r.discount),
          tax: toNum(r.tax),
          restaurant_id: r.mysql_restaurant_id !== null && r.mysql_restaurant_id !== undefined ? Number(r.mysql_restaurant_id) : null,
          category_id: r.mysql_category_id !== null && r.mysql_category_id !== undefined ? Number(r.mysql_category_id) : null,
        })),
      };
    }
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
    if (this.useMongo()) {
      const rows = await this.mongo.findMany<MongoOrderDoc>(
        'orders',
        {
          mysql_user_id: Number(req.actor!.id),
          order_status: { $in: ['pending', 'confirmed', 'accepted', 'processing', 'handover', 'picked_up'] },
        },
        { sort: { mysql_id: -1 }, limit: 25 },
      );
      return rows.map((r) => ({
        ...(r.legacy ?? {}),
        ...r,
        id: Number(r.mysql_id),
        user_id: r.mysql_user_id !== null && r.mysql_user_id !== undefined ? Number(r.mysql_user_id) : null,
        restaurant_id: r.mysql_restaurant_id !== null && r.mysql_restaurant_id !== undefined ? Number(r.mysql_restaurant_id) : 0,
        order_amount: toNum(r.order_amount),
      }));
    }
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
    if (this.useMongo()) {
      const items = await this.mongo.findMany<MongoOrderDetailDoc>(
        'order_details',
        { mysql_order_id: Number(orderId) },
      );
      return items.map((it) => ({
        ...(it.legacy ?? {}),
        ...it,
        id: Number(it.mysql_id),
        food_id: it.mysql_food_id !== null && it.mysql_food_id !== undefined ? Number(it.mysql_food_id) : null,
        order_id: it.mysql_order_id !== null && it.mysql_order_id !== undefined ? Number(it.mysql_order_id) : null,
        price: toNum(it.price),
        tax_amount: toNum(it.tax_amount),
        total_add_on_price: toNum(it.total_add_on_price),
        item_campaign_id: it.mysql_item_campaign_id !== null && it.mysql_item_campaign_id !== undefined ? Number(it.mysql_item_campaign_id) : null,
        discount_on_food: it.discount_on_food !== null && it.discount_on_food !== undefined ? toNum(it.discount_on_food) : null,
      }));
    }
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

    if (this.useMongo()) {
      const order = await this.mongo.findOne<MongoOrderDoc>('orders', {
        mysql_id: Number(id),
        mysql_user_id: Number(req.actor!.id),
      });
      if (!order) return { message: 'order not found' };
      await this.mongo.updateOne(
        'orders',
        { mysql_id: order.mysql_id },
        {
          order_status: 'canceled',
          canceled: new Date(),
          canceled_by: 'customer',
          cancellation_reason: body.reason ?? null,
        },
      );
      return { message: 'Order canceled' };
    }

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
    if (this.useMongo()) {
      const rows = await this.mongo.findMany<MongoRefundReasonDoc>('refund_reasons', { status: true });
      return rows.map((r) => ({ id: Number(r.mysql_id), reason: r.reason ?? null }));
    }
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

    if (this.useMongo()) {
      const order = await this.mongo.findOne<MongoOrderDoc>('orders', {
        mysql_id: Number(body.order_id),
        mysql_user_id: Number(req.actor!.id),
      });
      if (!order) return { message: 'order not found' };
      const nextId = await this.mongo.nextMysqlId('refunds');
      const now = new Date();
      await this.mongo.insertOne('refunds', {
        mysql_id: nextId,
        mysql_order_id: order.mysql_id,
        mysql_user_id: Number(req.actor!.id),
        order_status: order.order_status ?? null,
        customer_reason: body.customer_reason ?? null,
        customer_note: body.customer_note ?? null,
        refund_amount: toNum(order.order_amount),
        refund_status: 'pending',
        refund_method: 'wallet',
        created_at: now,
        updated_at: now,
      });
      return { message: 'Refund request submitted' };
    }

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

    if (this.useMongo()) {
      const rows = await this.mongo.findMany<MongoFoodDoc>('foods', { mysql_id: { $in: ids } });
      return rows.map((r) => ({
        ...(r.legacy ?? {}),
        ...r,
        id: Number(r.mysql_id),
        price: toNum(r.price),
        tax: toNum(r.tax),
        discount: toNum(r.discount),
        restaurant_id: r.mysql_restaurant_id !== null && r.mysql_restaurant_id !== undefined ? Number(r.mysql_restaurant_id) : 0,
        category_id: r.mysql_category_id !== null && r.mysql_category_id !== undefined ? Number(r.mysql_category_id) : null,
      }));
    }

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
    if (this.useMongo()) {
      // Match either the new `mysql_user_id` convention or legacy `user_id`.
      const doc = await this.mongo.findOne<MongoAddressDoc>('customer_addresses', { mysql_id: Number(addressId) });
      if (doc) {
        const ownerId = (doc.mysql_user_id ?? doc.user_id ?? null);
        if (ownerId !== null && Number(ownerId) === Number(req.actor!.id)) {
          await this.mongo.deleteOne('customer_addresses', { mysql_id: Number(addressId) });
        }
      }
      return { message: 'Address deleted' };
    }
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

    if (this.useMongo()) {
      const doc = await this.mongo.findOne<MongoAddressDoc>('customer_addresses', { mysql_id: Number(id) });
      if (doc) {
        const ownerId = (doc.mysql_user_id ?? doc.user_id ?? null);
        if (ownerId !== null && Number(ownerId) === Number(req.actor!.id)) {
          await this.mongo.updateOne('customer_addresses', { mysql_id: Number(id) }, { ...data, updated_at: new Date() });
        }
      }
      return { message: 'Address updated' };
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
