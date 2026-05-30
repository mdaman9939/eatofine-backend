import { Body, Controller, Delete, Get, Post, Query, Req, UseGuards, HttpCode } from '@nestjs/common';
import { AuthGuard, RequireAuth } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';

// Delivery-man app endpoints beyond the existing core ops. All return
// empty / acknowledged shapes so the DM app navigates without 404s.
//
// Real reads (profile, orders, withdrawal methods, shifts, notifications)
// branch on `USE_MONGO_EXTRAS` and pull from MongoDB; Prisma stays as a
// fallback so the flag can be flipped per environment.
@Controller('delivery-man')
@UseGuards(AuthGuard)
@RequireAuth('deliveryman')
export class DeliveryExtrasController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mongo: MongoDataService,
  ) {}

  private useMongo(): boolean {
    const v = (process.env.USE_MONGO_EXTRAS ?? '').toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }

  // ── Profile ──────────────────────────────────────────────────────
  @Get('profile')
  async profile(@Req() req: AuthedRequest) {
    const actorId = Number(req.actor!.id);
    if (this.useMongo()) {
      const d = await this.mongo.findByMysqlId<Record<string, unknown>>('delivery_men', actorId);
      if (!d) return {};
      return {
        id: Number(d.mysql_id),
        f_name: d.f_name ?? null,
        l_name: d.l_name ?? null,
        email: d.email ?? null,
        phone: d.phone ?? null,
        image: d.image ?? null,
        status: d.status ?? null,
        application_status: d.application_status ?? null,
        zone_id: d.mysql_zone_id !== undefined && d.mysql_zone_id !== null
          ? Number(d.mysql_zone_id)
          : (d.zone_id !== undefined && d.zone_id !== null ? Number(d.zone_id) : null),
      };
    }
    const d = await this.prisma.delivery_men.findUnique({ where: { id: req.actor!.id } });
    if (!d) return {};
    return {
      id: Number(d.id),
      f_name: d.f_name,
      l_name: d.l_name,
      email: d.email,
      phone: d.phone,
      image: d.image,
      status: d.status,
      application_status: d.application_status,
      zone_id: d.zone_id ? Number(d.zone_id) : null,
    };
  }

  @HttpCode(200)
  @Post('update-profile')
  async updateProfile(@Req() req: AuthedRequest, @Body() body: { f_name?: string; l_name?: string; email?: string }) {
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) if (v !== undefined) data[k] = v;
    if (Object.keys(data).length) {
      if (this.useMongo()) {
        await this.mongo.updateOne(
          'delivery_men',
          { mysql_id: Number(req.actor!.id) },
          { ...data, updated_at: new Date() },
        );
        return { message: 'Profile updated' };
      }
      await this.prisma.delivery_men.update({ where: { id: req.actor!.id }, data });
    }
    return { message: 'Profile updated' };
  }

  @HttpCode(200)
  @Post('update-active-status')
  toggleActive() { return { message: 'updated' }; }

  @HttpCode(200)
  @Post('update-fcm-token')
  fcmToken() { return { message: 'token-updated' }; }

  @HttpCode(200)
  @Delete('remove-account')
  remove() { return { message: 'Not available in demo' }; }

  // ── Orders ───────────────────────────────────────────────────────
  @Get('all-orders')
  async allOrders(@Req() req: AuthedRequest) {
    const actorId = Number(req.actor!.id);
    if (this.useMongo()) {
      const rows = await this.mongo.findMany<Record<string, unknown>>(
        'orders',
        { mysql_delivery_man_id: actorId },
        { sort: { mysql_id: -1 }, limit: 50 },
      );
      return rows.map((r) => ({
        ...r,
        id: Number(r.mysql_id),
        user_id: r.mysql_user_id !== undefined && r.mysql_user_id !== null
          ? Number(r.mysql_user_id)
          : (r.user_id !== undefined && r.user_id !== null ? Number(r.user_id) : null),
        restaurant_id: Number(r.mysql_restaurant_id ?? r.restaurant_id ?? 0),
        order_amount: r.order_amount !== undefined && r.order_amount !== null ? Number(r.order_amount) : 0,
      }));
    }
    const rows = await this.prisma.orders.findMany({ where: { delivery_man_id: req.actor!.id }, orderBy: { id: 'desc' }, take: 50 });
    return rows.map((r) => ({ ...r, id: Number(r.id), user_id: r.user_id ? Number(r.user_id) : null, restaurant_id: Number(r.restaurant_id), order_amount: Number(r.order_amount) }));
  }

  @Get('order')
  async order(@Query('order_id') idStr?: string) {
    const id = parseInt(idStr ?? '', 10);
    if (!Number.isFinite(id)) return null;
    if (this.useMongo()) {
      const o = await this.mongo.findByMysqlId<Record<string, unknown>>('orders', id);
      if (!o) return null;
      return {
        ...o,
        id: Number(o.mysql_id),
        user_id: o.mysql_user_id !== undefined && o.mysql_user_id !== null
          ? Number(o.mysql_user_id)
          : (o.user_id !== undefined && o.user_id !== null ? Number(o.user_id) : null),
        restaurant_id: Number(o.mysql_restaurant_id ?? o.restaurant_id ?? 0),
        order_amount: o.order_amount !== undefined && o.order_amount !== null ? Number(o.order_amount) : 0,
      };
    }
    const o = await this.prisma.orders.findUnique({ where: { id: BigInt(id) } });
    return o ? { ...o, id: Number(o.id), user_id: o.user_id ? Number(o.user_id) : null, restaurant_id: Number(o.restaurant_id), order_amount: Number(o.order_amount) } : null;
  }

  @HttpCode(200)
  @Post('accept-order')
  acceptOrder() { return { message: 'order accepted' }; }

  @HttpCode(200)
  @Post('update-payment-status')
  updatePayment() { return { message: 'updated' }; }

  @HttpCode(200)
  @Post('send-order-otp')
  sendOtp() { return { otp: '1234' }; }

  @HttpCode(200)
  @Post('record-location-data')
  recordLocation() { return { ok: true }; }

  @HttpCode(200)
  @Post('last-location')
  lastLocation() { return { ok: true }; }

  // ── Earnings / withdrawals ───────────────────────────────────────
  @Get('earning-report')
  earningReport() { return { today: 0, this_week: 0, this_month: 0, all_time: 0 }; }

  @Get('get-disbursement-report')
  disbursementReport() { return { data: [], total: 0 }; }

  @Get('wallet-payment-list')
  walletPayments() { return { data: [], total_size: 0 }; }

  @HttpCode(200)
  @Post('make-collected-cash-payment')
  collectedCash() { return { message: 'recorded' }; }

  @HttpCode(200)
  @Post('make-wallet-adjustment')
  walletAdjustment() { return { message: 'recorded' }; }

  @Get('withdraw-method/list')
  async withdrawMethods() {
    if (this.useMongo()) {
      const rows = await this.mongo.findMany<Record<string, unknown>>(
        'withdrawal_methods',
        { $or: [{ is_active: 1 }, { is_active: true }] },
      );
      return rows.map((r) => ({
        id: Number(r.mysql_id),
        method_name: r.method_name,
        method_fields: r.method_fields,
        is_default: r.is_default,
      }));
    }
    const rows = await this.prisma.withdrawal_methods.findMany({ where: { is_active: 1 } });
    return rows.map((r) => ({ id: Number(r.id), method_name: r.method_name, method_fields: r.method_fields, is_default: r.is_default }));
  }
  @HttpCode(200)
  @Post('withdraw-method/store')
  withdrawStore() { return { message: 'method added' }; }
  @HttpCode(200)
  @Post('withdraw-method/make-default')
  withdrawDefault() { return { message: 'default set' }; }
  @HttpCode(200)
  @Delete('withdraw-method/delete')
  withdrawDelete() { return { message: 'deleted' }; }

  @Get('get-withdraw-method-list')
  getWithdrawMethods() { return this.withdrawMethods(); }

  // ── Shifts / topics / reviews ────────────────────────────────────
  @Get('dm-shift')
  async dmShift() {
    if (this.useMongo()) {
      const rows = await this.mongo.findMany<Record<string, unknown>>('shifts', { status: true });
      return rows.map((r) => ({
        id: Number(r.mysql_id),
        name: r.name,
        start_time: r.start_time,
        end_time: r.end_time,
        is_full_day: r.is_full_day,
      }));
    }
    const rows = await this.prisma.shifts.findMany({ where: { status: true } });
    return rows.map((r) => ({ id: Number(r.id), name: r.name, start_time: r.start_time, end_time: r.end_time, is_full_day: r.is_full_day }));
  }

  @Get('dm-topic')
  dmTopic(@Req() req: AuthedRequest) {
    return { topic: `zone_${req.actor!.id}_delivery_man` };
  }

  @HttpCode(200)
  @Post('reviews/submit')
  submitReview() { return { message: 'review submitted' }; }

  // ── Notifications + messages ─────────────────────────────────────
  @Get('notifications')
  async notifications() {
    if (this.useMongo()) {
      const rows = await this.mongo.findMany<Record<string, unknown>>(
        'notifications',
        { status: true },
        { sort: { mysql_id: -1 }, limit: 50 },
      );
      return rows.map((r) => ({ id: Number(r.mysql_id), title: r.title, description: r.description }));
    }
    const rows = await this.prisma.notifications.findMany({ where: { status: true }, orderBy: { id: 'desc' }, take: 50 });
    return rows.map((r) => ({ id: Number(r.id), title: r.title, description: r.description }));
  }

  @Get('message/list')
  messageList() { return { conversations: [], total_size: 0 }; }
  @Get('message/details')
  messageDetails() { return { messages: [] }; }
  @Get('message/search-list')
  messageSearch() { return { conversations: [] }; }
  @HttpCode(200)
  @Post('message/send')
  messageSend() { return { message: 'sent' }; }
}
