import { Body, Controller, Delete, Get, Post, Query, Req, UseGuards, HttpCode, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FileFieldsInterceptor, AnyFilesInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as path from 'path';
import { AuthGuard, RequireAuth } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';
import { storageFullUrl } from '../common/storage-url';
import { compressImage } from '../common/image-compress';

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
    const v = (process.env.USE_MONGO_EXTRAS ?? '1').toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }

  /** Shape every delivery-man order row identically. The Flutter
   *  OrderModel uses `!` on detailsCount/orderStatus/orderType/createdAt/
   *  paymentMethod — same crash pattern we hit in the restaurant app. */
  private shapeDmOrder(r: Record<string, unknown>, detailsCount: number, restaurant?: Record<string, unknown> | null, user?: Record<string, unknown> | null) {
    const created = r.created_at as Date | string | null | undefined;
    const updated = r.updated_at as Date | string | null | undefined;
    const rest = restaurant ?? null;
    const restLogo = rest ? (rest.logo as string | null | undefined) : null;
    const u = user ?? null;
    return {
      ...r,
      id: Number(r.mysql_id),
      user_id: r.mysql_user_id !== undefined && r.mysql_user_id !== null
        ? Number(r.mysql_user_id)
        : (r.user_id !== undefined && r.user_id !== null ? Number(r.user_id) : null),
      restaurant_id: Number(r.mysql_restaurant_id ?? r.restaurant_id ?? 0),
      delivery_man_id: r.mysql_delivery_man_id !== undefined && r.mysql_delivery_man_id !== null
        ? Number(r.mysql_delivery_man_id)
        : (r.delivery_man_id !== undefined && r.delivery_man_id !== null ? Number(r.delivery_man_id) : null),
      order_amount: r.order_amount !== undefined && r.order_amount !== null ? Number(r.order_amount) : 0,
      // Crash-proofing defaults
      details_count: detailsCount,
      order_status: (r.order_status as string | undefined) ?? 'pending',
      order_type: (r.order_type as string | undefined) ?? 'delivery',
      payment_method: (r.payment_method as string | undefined) ?? 'cash_on_delivery',
      payment_status: (r.payment_status as string | undefined) ?? 'unpaid',
      delivery_address: r.delivery_address ?? null,
      created_at: created ? new Date(created).toISOString() : new Date().toISOString(),
      updated_at: updated ? new Date(updated).toISOString() : new Date().toISOString(),
      // Flat restaurant fields the DM app's OrderModel reads (without these it
      // shows "No restaurant data found").
      restaurant_name: rest ? (rest.name ?? null) : null,
      restaurant_address: rest ? (rest.address ?? null) : null,
      restaurant_phone: rest ? (rest.phone ?? null) : null,
      restaurant_lat: rest && rest.latitude != null ? String(rest.latitude) : null,
      restaurant_lng: rest && rest.longitude != null ? String(rest.longitude) : null,
      restaurant_logo_full_url: storageFullUrl('restaurant', restLogo ?? null),
      restaurant_delivery_time: rest ? (rest.delivery_time ?? '30-40') : '30-40',
      restaurant_model: rest ? (rest.restaurant_model ?? null) : null,
      // Nested customer object the DM app reads for "Customer Details".
      customer: u
        ? {
            id: Number(u.mysql_id),
            f_name: u.f_name ?? null,
            l_name: u.l_name ?? null,
            phone: u.phone ?? null,
            email: u.email ?? null,
            image_full_url: storageFullUrl('profile', (u.image as string | null | undefined) ?? null),
          }
        : null,
    };
  }

  /** Batch-fetch the customers (users) referenced by a set of orders. */
  private async dmUserMap(orders: Record<string, unknown>[]): Promise<Map<number, Record<string, unknown>>> {
    const ids = Array.from(new Set(
      orders.map((o) => Number(o.mysql_user_id ?? o.user_id ?? 0)).filter((n) => n > 0),
    ));
    if (ids.length === 0) return new Map();
    const rows = await this.mongo.findMany<Record<string, unknown>>('users', { mysql_id: { $in: ids } });
    return new Map(rows.map((u) => [Number(u.mysql_id), u]));
  }

  /** Batch-fetch the restaurants referenced by a set of orders, keyed by id. */
  private async dmRestaurantMap(orders: Record<string, unknown>[]): Promise<Map<number, Record<string, unknown>>> {
    const ids = Array.from(new Set(
      orders.map((o) => Number(o.mysql_restaurant_id ?? o.restaurant_id ?? 0)).filter((n) => n > 0),
    ));
    if (ids.length === 0) return new Map();
    const rows = await this.mongo.findMany<Record<string, unknown>>('restaurants', { mysql_id: { $in: ids } });
    return new Map(rows.map((r) => [Number(r.mysql_id), r]));
  }

  private async dmDetailsCountMap(orderIds: number[]): Promise<Map<number, number>> {
    if (orderIds.length === 0) return new Map();
    const rows = await this.mongo.aggregate<{ _id: number; count: number }>(
      'order_details',
      [
        { $match: { order_id: { $in: orderIds } } },
        { $group: { _id: '$order_id', count: { $sum: 1 } } },
      ],
    );
    return new Map(rows.map((r) => [Number(r._id), r.count]));
  }

  /** Shape a page of order rows (item count + restaurant + customer). */
  private async shapeDmOrderList(rows: Record<string, unknown>[]) {
    const counts = await this.dmDetailsCountMap(rows.map((r) => Number(r.mysql_id)));
    const restMap = await this.dmRestaurantMap(rows);
    const userMap = await this.dmUserMap(rows);
    return rows.map((r) => this.shapeDmOrder(
      r,
      counts.get(Number(r.mysql_id)) ?? 1,
      restMap.get(Number(r.mysql_restaurant_id ?? r.restaurant_id ?? 0)),
      userMap.get(Number(r.mysql_user_id ?? r.user_id ?? 0)),
    ));
  }

  /** Per-status counts across ALL of this rider's orders — feeds the tab
   *  badges (All / Delivered / Cancelled / Refunded + running statuses). */
  private async dmOrderCount(actorId: number) {
    const rows = await this.mongo.aggregate<{ _id: string; count: number }>('orders', [
      { $match: { mysql_delivery_man_id: actorId } },
      { $group: { _id: '$order_status', count: { $sum: 1 } } },
    ]);
    const by: Record<string, number> = {};
    let all = 0;
    for (const r of rows) { by[String(r._id)] = r.count; all += r.count; }
    return {
      all,
      pending: by.pending ?? 0,
      confirmed: by.confirmed ?? 0,
      accepted: by.accepted ?? 0,
      processing: by.processing ?? 0,
      handover: by.handover ?? 0,
      picked_up: by.picked_up ?? 0,
      delivered: by.delivered ?? 0,
      canceled: by.canceled ?? 0,
      refund_requested: by.refund_requested ?? 0,
      refunded: by.refunded ?? 0,
      refund_request_canceled: by.refund_request_canceled ?? 0,
      failed: by.failed ?? 0,
    };
  }

  // ── Profile ──────────────────────────────────────────────────────
  @Get('profile')
  async profile(@Req() req: AuthedRequest) {
    const actorId = Number(req.actor!.id);
    if (this.useMongo()) {
      const d = await this.mongo.findByMysqlId<Record<string, unknown>>('delivery_men', actorId);
      if (!d) return {};

      // Order stats — Today / This Week / All-time counters that the home
      // dashboard tiles read directly. Return real numbers, never null.
      const allOrders = await this.mongo.findMany<Record<string, unknown>>(
        'orders',
        { mysql_delivery_man_id: actorId },
      );
      const now = Date.now();
      const dayMs = 86_400_000;
      let today = 0, week = 0;
      let todayEarn = 0, weekEarn = 0, monthEarn = 0, allEarn = 0;
      for (const o of allOrders) {
        const ts = o.created_at ? new Date(o.created_at as string).getTime() : 0;
        if (!Number.isFinite(ts) || ts === 0) continue;
        const age = now - ts;
        const delivered = o.order_status === 'delivered';
        const dmEarn = Number(o.delivery_charge ?? 0) + Number(o.dm_tips ?? 0);
        if (delivered) allEarn += dmEarn;
        if (age <= dayMs) { today++; if (delivered) todayEarn += dmEarn; }
        if (age <= 7 * dayMs) { week++; if (delivered) weekEarn += dmEarn; }
        if (age <= 30 * dayMs) { if (delivered) monthEarn += dmEarn; }
      }

      // Wallet — match how delivery_man_wallets is shaped (real or zeros)
      const wallet = await this.mongo.findOne<Record<string, unknown>>(
        'delivery_man_wallets',
        { $or: [{ delivery_man_id: actorId }, { mysql_delivery_man_id: actorId }] },
      );

      return {
        id: Number(d.mysql_id),
        f_name: d.f_name ?? null,
        l_name: d.l_name ?? null,
        email: d.email ?? null,
        phone: d.phone ?? null,
        image: d.image ?? null,
        image_full_url: storageFullUrl('delivery-man', (d.image as string | null | undefined) ?? null),
        // The DM app's ProfileModel reads the profile photo from `identity_image`
        // (not image_full_url), so mirror the URL here or the avatar shows blank.
        identity_image: storageFullUrl('delivery-man', (d.image as string | null | undefined) ?? null),
        status: d.status ?? null,
        active: Number(d.active ?? 0) ? 1 : 0,
        application_status: d.application_status ?? null,
        zone_id: d.mysql_zone_id !== undefined && d.mysql_zone_id !== null
          ? Number(d.mysql_zone_id)
          : (d.zone_id !== undefined && d.zone_id !== null ? Number(d.zone_id) : null),
        // Dashboard tiles — always real numbers (no nulls)
        order_count: allOrders.length,
        todays_order_count: today,
        this_week_order_count: week,
        // Earning report
        todays_earning: todayEarn,
        this_week_earning: weekEarn,
        this_month_earning: monthEarn,
        all_time_earning: allEarn,
        // Wallet
        balance: Number(wallet?.balance ?? 0),
        total_earning: Number(wallet?.total_earning ?? allEarn),
        collected_cash: Number(wallet?.collected_cash ?? 0),
        total_withdrawn: Number(wallet?.total_withdrawn ?? 0),
        pending_withdraw: Number(wallet?.pending_withdraw ?? 0),
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
      order_count: 0,
      todays_order_count: 0,
      this_week_order_count: 0,
      todays_earning: 0,
      this_week_earning: 0,
      this_month_earning: 0,
      all_time_earning: 0,
      balance: 0,
      total_earning: 0,
      collected_cash: 0,
      total_withdrawn: 0,
      pending_withdraw: 0,
    };
  }

  /** Save an uploaded image: compress to a small WebP, write to disk
   *  (best-effort) + persist the bytes in Mongo (durable). Returns filename. */
  private async saveImage(file: Express.Multer.File | undefined, folder: string): Promise<string | null> {
    if (!file || !file.buffer || file.buffer.length === 0) return null;
    let data = file.buffer;
    let ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    let contentType = file.mimetype || 'image/png';
    if (/^image\//i.test(contentType) && !/svg/i.test(contentType)) {
      try { const c = await compressImage(file.buffer); if (c) { data = c.buffer; ext = c.ext; contentType = c.contentType; } } catch { /* keep original */ }
    }
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    try {
      const root = process.env.STORAGE_ROOT ?? path.resolve(__dirname, '../../storage/app/public');
      const dir = path.join(root, folder);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, filename), data);
    } catch { /* disk best-effort */ }
    if (data.length < 15 * 1024 * 1024) {
      await this.mongo.insertOne('uploads', { path: `${folder}/${filename}`, content_type: contentType, data, size: data.length, created_at: new Date() }).catch(() => undefined);
    }
    return filename;
  }

  // Edit Profile sends multipart/form-data with an `image` file alongside the
  // text fields — without the interceptor the body is undefined and nothing
  // (name / email / image) updates.
  @HttpCode(200)
  @Post('update-profile')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'image', maxCount: 1 }], { limits: { fileSize: 10 * 1024 * 1024 } }))
  async updateProfile(
    @Req() req: AuthedRequest,
    @Body() body: Record<string, unknown> = {},
    @UploadedFiles() files: { image?: Express.Multer.File[] } = {},
  ) {
    const b = body ?? {};
    const data: Record<string, unknown> = {};
    if (b.f_name !== undefined) data.f_name = String(b.f_name);
    if (b.l_name !== undefined) data.l_name = String(b.l_name);
    if (b.email !== undefined) data.email = String(b.email);
    if (typeof b.password === 'string' && b.password.length > 1) {
      const bcrypt = await import('bcrypt');
      data.password = (await bcrypt.hash(b.password, 10)).replace(/^\$2b\$/, '$2y$');
    }
    const imageName = await this.saveImage(files?.image?.[0], 'delivery-man');
    if (imageName) data.image = imageName;
    if (Object.keys(data).length === 0) return { message: 'nothing to update' };
    data.updated_at = new Date();
    if (this.useMongo()) {
      await this.mongo.updateOne('delivery_men', { mysql_id: Number(req.actor!.id) }, data);
      return { message: 'Profile updated', image: imageName ?? undefined };
    }
    await this.prisma.delivery_men.update({ where: { id: req.actor!.id }, data: data as never });
    return { message: 'Profile updated' };
  }

  @HttpCode(200)
  @HttpCode(200)
  @Post('update-active-status')
  async toggleActive(@Req() req: AuthedRequest, @Body() body: Record<string, unknown> = {}) {
    if (this.useMongo()) {
      const actorId = Number(req.actor!.id);
      const dm = await this.mongo.findByMysqlId<{ mysql_id: number; active?: number | boolean | null }>('delivery_men', actorId);
      if (dm) {
        // The app sends no value — this is a TOGGLE endpoint. Flip the current
        // active flag (or honour an explicit active/status if one is sent) and
        // persist it, so it survives a page refresh.
        const raw = body.active ?? body.status;
        const next = raw !== undefined ? (Number(raw) ? 1 : 0) : (Number(dm.active ?? 0) ? 0 : 1);
        await this.mongo.updateOne('delivery_men', { mysql_id: actorId }, { active: next, updated_at: new Date() });
        return { message: 'updated', active: next };
      }
    }
    return { message: 'updated' };
  }

  @HttpCode(200)
  @Post('update-fcm-token')
  fcmToken() { return { message: 'token-updated' }; }

  @HttpCode(200)
  @Delete('remove-account')
  remove() { return { message: 'Not available in demo' }; }

  // ── Orders ───────────────────────────────────────────────────────
  // The app calls all-orders two ways:
  //   • no query params           → getList(): a BARE ARRAY of orders.
  //   • ?offset&limit&status      → getCompletedOrderList(): a PaginatedOrderModel
  //     { total_size, limit, offset, order_count, orders } with the tab counts.
  @Get('all-orders')
  async allOrders(
    @Req() req: AuthedRequest,
    @Query('offset') offsetQ?: string,
    @Query('limit') limitQ?: string,
    @Query('status') status?: string,
  ) {
    const actorId = Number(req.actor!.id);
    const paginated = offsetQ !== undefined || limitQ !== undefined || status !== undefined;
    if (this.useMongo()) {
      const base = { mysql_delivery_man_id: actorId };
      if (!paginated) {
        const rows = await this.mongo.findMany<Record<string, unknown>>('orders', base, { sort: { mysql_id: -1 }, limit: 50 });
        return this.shapeDmOrderList(rows);
      }
      const limit = parseInt(limitQ ?? '10', 10) || 10;
      const offset = parseInt(offsetQ ?? '1', 10) || 1;
      const filter = status && status !== 'all' ? { ...base, order_status: status } : base;
      const total = await this.mongo.count('orders', filter);
      const rows = await this.mongo.findMany<Record<string, unknown>>('orders', filter, {
        sort: { mysql_id: -1 }, limit, skip: Math.max(0, (offset - 1) * limit),
      });
      return { total_size: total, limit, offset, order_count: await this.dmOrderCount(actorId), orders: await this.shapeDmOrderList(rows) };
    }
    const rows = await this.prisma.orders.findMany({ where: { delivery_man_id: req.actor!.id }, orderBy: { id: 'desc' }, take: 50 });
    const mapped = rows.map((r) => ({ ...r, id: Number(r.id), user_id: r.user_id ? Number(r.user_id) : null, restaurant_id: Number(r.restaurant_id), order_amount: Number(r.order_amount) }));
    return paginated ? { total_size: mapped.length, limit: 10, offset: 1, order_count: { all: mapped.length }, orders: mapped } : mapped;
  }

  /** Active "running" orders — the home "Active Order" card + Running Orders
   *  tab. Returns a PaginatedOrderModel (with order_count for the tab badges). */
  @Get('current-orders')
  async currentOrders(@Req() req: AuthedRequest, @Query('status') status?: string) {
    const actorId = Number(req.actor!.id);
    if (this.useMongo()) {
      const ongoing = ['handover', 'picked_up', 'confirmed', 'processing', 'accepted', 'pending', 'cooking'];
      const filter: Record<string, unknown> = { mysql_delivery_man_id: actorId, order_status: { $in: ongoing } };
      if (status && status !== 'all') filter.order_status = status;
      const rows = await this.mongo.findMany<Record<string, unknown>>('orders', filter, { sort: { mysql_id: -1 } });
      return {
        total_size: rows.length,
        limit: rows.length,
        offset: 1,
        order_count: await this.dmOrderCount(actorId),
        orders: await this.shapeDmOrderList(rows),
      };
    }
    return { total_size: 0, limit: 0, offset: 1, order_count: { all: 0 }, orders: [] };
  }

  /** Latest unassigned orders the rider can accept — drives the Request tab. */
  @Get('latest-orders')
  async latestOrders(@Req() req: AuthedRequest) {
    const actorId = Number(req.actor!.id);
    if (this.useMongo()) {
      const dm = await this.mongo.findByMysqlId<Record<string, unknown>>('delivery_men', actorId);
      const zoneId = dm?.mysql_zone_id ?? dm?.zone_id;
      const rows = await this.mongo.findMany<Record<string, unknown>>(
        'orders',
        {
          mysql_delivery_man_id: { $in: [null, 0] },
          order_status: 'handover',
          ...(zoneId ? { $or: [{ mysql_zone_id: Number(zoneId) }, { zone_id: Number(zoneId) }] } : {}),
        },
        { sort: { mysql_id: -1 }, limit: 20 },
      );
      // The app reads `response.body['orders']`, so wrap the list in an object.
      return { orders: await this.shapeDmOrderList(rows), total_size: rows.length };
    }
    return { orders: [], total_size: 0 };
  }

  @Get('order')
  async order(@Query('order_id') idStr?: string) {
    const id = parseInt(idStr ?? '', 10);
    if (!Number.isFinite(id)) return null;
    if (this.useMongo()) {
      const o = await this.mongo.findByMysqlId<Record<string, unknown>>('orders', id);
      if (!o) return null;
      const counts = await this.dmDetailsCountMap([id]);
      const restId = Number(o.mysql_restaurant_id ?? o.restaurant_id ?? 0);
      const rest = restId > 0 ? await this.mongo.findByMysqlId<Record<string, unknown>>('restaurants', restId) : null;
      const userId = Number(o.mysql_user_id ?? o.user_id ?? 0);
      const user = userId > 0 ? await this.mongo.findByMysqlId<Record<string, unknown>>('users', userId) : null;
      return this.shapeDmOrder(o, counts.get(id) ?? 1, rest, user);
    }
    const o = await this.prisma.orders.findUnique({ where: { id: BigInt(id) } });
    return o ? { ...o, id: Number(o.id), user_id: o.user_id ? Number(o.user_id) : null, restaurant_id: Number(o.restaurant_id), order_amount: Number(o.order_amount) } : null;
  }

  /** Order details — Flutter app hits /delivery-man/order-details?order_id=N
   *  (separate path from `/order`). Returns the same shape as /order plus
   *  the items list, so the order-details screen renders end-to-end. */
  @Get('order-details')
  async orderDetails(@Query('order_id') idStr?: string) {
    const id = parseInt(idStr ?? '', 10);
    if (!Number.isFinite(id)) return [];

    if (this.useMongo()) {
      const items = await this.mongo.findMany<Record<string, unknown>>(
        'order_details',
        { order_id: id },
        { sort: { mysql_id: 1 } },
      );
      // Look up the real foods so item rows show the actual name + image
      // (the stored food_details JSON often lacks them → "Food #id").
      const foodIds = Array.from(new Set(items.map((it) => Number(it.food_id)).filter((n) => n > 0)));
      const foods = foodIds.length
        ? await this.mongo.findMany<Record<string, unknown>>('foods', { mysql_id: { $in: foodIds } })
        : [];
      const foodMap = new Map(foods.map((f) => [Number(f.mysql_id), f]));
      return items.map((it) => {
        // Stored food_details may be a JSON string OR an object — read both.
        let stored: { name?: string; image?: string } = {};
        const raw = it.food_details;
        if (typeof raw === 'string') { try { stored = JSON.parse(raw); } catch { /* ignore */ } }
        else if (raw && typeof raw === 'object') stored = raw as { name?: string; image?: string };
        const food = foodMap.get(Number(it.food_id));
        const name = (food?.name as string | undefined) ?? stored.name ?? `Food #${it.food_id}`;
        const image = (food?.image as string | undefined) ?? stored.image ?? null;
        const imageUrl = storageFullUrl('product', image);
        return {
          id: Number(it.mysql_id),
          order_id: id,
          food_id: it.food_id ?? null,
          item_campaign_id: it.item_campaign_id ?? null,
          price: Number(it.price ?? 0),
          quantity: Number(it.quantity ?? 1),
          tax_amount: Number(it.tax_amount ?? 0),
          discount_on_food: Number(it.discount_on_food ?? 0),
          add_ons: it.add_ons ?? [],
          total_add_on_price: Number(it.total_add_on_price ?? 0),
          variation: it.variation ?? [],
          variant: it.variant ?? null,
          // The DM app parses food_details as an OBJECT (name + image_full_url).
          food_details: {
            id: it.food_id ?? null,
            name,
            image,
            image_full_url: imageUrl,
            price: Number(it.price ?? 0),
            quantity: Number(it.quantity ?? 1),
          },
          food: { id: it.food_id ?? null, name, image, image_full_url: imageUrl },
        };
      });
    }
    return [];
  }

  @HttpCode(200)
  @Post('accept-order')
  async acceptOrder(@Req() req: AuthedRequest, @Body() body: Record<string, unknown> = {}) {
    const orderId = Number(body.order_id ?? body.id ?? 0);
    if (this.useMongo() && orderId > 0) {
      const o = await this.mongo.findByMysqlId<{ mysql_id: number; mysql_delivery_man_id?: number | null; delivery_man_id?: number | null }>('orders', orderId);
      if (!o) return { errors: [{ code: 'order', message: 'Order not found' }] };
      const assigned = Number(o.mysql_delivery_man_id ?? o.delivery_man_id ?? 0);
      // Don't let a second rider grab an order already taken by someone else.
      if (assigned > 0 && assigned !== Number(req.actor!.id)) {
        return { errors: [{ code: 'order', message: 'This order has already been taken by another delivery man' }] };
      }
      await this.mongo.updateOne('orders', { mysql_id: orderId }, {
        mysql_delivery_man_id: Number(req.actor!.id),
        delivery_man_id: Number(req.actor!.id),
        updated_at: new Date(),
      });
      return { message: 'order accepted' };
    }
    return { message: 'order accepted' };
  }

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
  async earningReport(@Req() req: AuthedRequest) {
    if (!this.useMongo()) return { today: 0, this_week: 0, this_month: 0, all_time: 0 };
    const actorId = Number(req.actor!.id);
    const rows = await this.mongo.findMany<Record<string, unknown>>(
      'orders',
      { mysql_delivery_man_id: actorId, order_status: 'delivered' },
    );
    const now = Date.now(), dayMs = 86_400_000;
    let today = 0, week = 0, month = 0, all = 0;
    for (const o of rows) {
      const ts = o.created_at ? new Date(o.created_at as string).getTime() : 0;
      if (!Number.isFinite(ts) || ts === 0) continue;
      const earn = Number(o.delivery_charge ?? 0) + Number(o.dm_tips ?? 0);
      all += earn;
      const age = now - ts;
      if (age <= dayMs) today += earn;
      if (age <= 7 * dayMs) week += earn;
      if (age <= 30 * dayMs) month += earn;
    }
    return { today, this_week: week, this_month: month, all_time: all };
  }

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
      return rows.map((r) => {
        // The app shows the date/time from created_at + updated_at, so they
        // must be returned or the notification cards show no time.
        const created = r.created_at ?? r.created_at_legacy ?? null;
        return {
          id: Number(r.mysql_id),
          title: r.title,
          description: r.description,
          image_full_url: storageFullUrl('notification', (r.image as string | null | undefined) ?? null),
          created_at: created,
          updated_at: r.updated_at ?? created,
        };
      });
    }
    const rows = await this.prisma.notifications.findMany({ where: { status: true }, orderBy: { id: 'desc' }, take: 50 });
    return rows.map((r) => ({ id: Number(r.id), title: r.title, description: r.description, created_at: r.created_at, updated_at: r.updated_at ?? r.created_at }));
  }

  // ── Messaging (real, DB-backed) ───────────────────────────────────
  // The DM is the `delivery_man` counterpart in the shared conversations.
  @Get('message/list')
  async messageList(
    @Req() req: AuthedRequest,
    @Query('type') type?: string,
    @Query('offset') offsetQ?: string,
    @Query('limit') limitQ?: string,
  ) {
    if (!this.useMongo()) return { conversation: [], total_size: 0, limit: 10, offset: 1 };
    const dmId = Number(req.actor!.id);
    const limit = parseInt(limitQ ?? '10', 10) || 10;
    const offset = parseInt(offsetQ ?? '1', 10) || 1;
    const wantVendor = type === 'vendor';
    const rows = await this.mongo.findMany<Record<string, unknown>>(
      'conversations', { counterpart_type: 'delivery_man', counterpart_id: dmId },
      { sort: { last_message_at: -1 }, limit: 200 },
    );
    // The Customer tab shows DM↔customer threads, the Restaurant tab DM↔vendor.
    const ofType = rows.filter((c) => (wantVendor ? String(c.party_type) === 'vendor' : String(c.party_type ?? 'user') !== 'vendor'));

    const dm = await this.mongo.findByMysqlId<{ mysql_id: number; f_name?: string; l_name?: string; phone?: string; email?: string; image?: string }>('delivery_men', dmId);
    const dmUser = {
      id: dmId, f_name: dm?.f_name ?? null, l_name: dm?.l_name ?? null, phone: dm?.phone ?? null, email: dm?.email ?? null,
      image_full_url: storageFullUrl('delivery-man', dm?.image ?? null), deliveryman_id: dmId,
    };
    // Resolve the other party (customer or restaurant) for each thread.
    const partyIds = Array.from(new Set(ofType.map((c) => Number(c.party_id ?? c.user_id ?? 0)).filter((n) => n > 0)));
    const partyMap = new Map<number, Record<string, unknown>>();
    if (wantVendor) {
      const rests = partyIds.length ? await this.mongo.findMany<{ mysql_id: number; name?: string; logo?: string; phone?: string; mysql_vendor_id?: number }>('restaurants', { mysql_id: { $in: partyIds } }) : [];
      for (const r of rests) partyMap.set(Number(r.mysql_id), {
        id: Number(r.mysql_id), f_name: r.name ?? 'Restaurant', l_name: '', phone: r.phone ?? null, email: null,
        image_full_url: storageFullUrl('restaurant', r.logo ?? null), vendor_id: Number(r.mysql_vendor_id ?? r.mysql_id),
      });
    } else {
      const users = partyIds.length ? await this.mongo.findMany<{ mysql_id: number; f_name?: string; l_name?: string; phone?: string; email?: string; image?: string }>('users', { mysql_id: { $in: partyIds } }) : [];
      for (const u of users) partyMap.set(Number(u.mysql_id), {
        id: Number(u.mysql_id), f_name: u.f_name ?? null, l_name: u.l_name ?? null, phone: u.phone ?? null, email: u.email ?? null,
        image_full_url: storageFullUrl('profile', u.image ?? null), user_id: Number(u.mysql_id),
      });
    }
    const paged = ofType.slice((offset - 1) * limit, offset * limit);
    const conversation = paged.map((c) => {
      const pid = Number(c.party_id ?? c.user_id ?? 0);
      const other = partyMap.get(pid) ?? { id: pid, f_name: wantVendor ? 'Restaurant' : 'Customer', l_name: '', image_full_url: null, ...(wantVendor ? { vendor_id: pid } : { user_id: pid }) };
      return {
        id: Number(c.mysql_id),
        sender_id: dmId, sender_type: 'delivery_man',
        receiver_id: pid, receiver_type: wantVendor ? 'vendor' : 'user',
        unread_message_count: Number(c.unread ?? 0),
        last_message_id: null,
        last_message_time: c.last_message_at ?? c.created_at ?? null,
        created_at: c.created_at ?? null,
        updated_at: c.last_message_at ?? null,
        sender: dmUser,
        receiver: other,
        last_message: { id: null, conversation_id: Number(c.mysql_id), sender_id: dmId, message: (c.last_message as string) ?? '', is_seen: 1, files: [] },
      };
    });
    return { conversation, total_size: ofType.length, limit, offset };
  }

  @Get('message/details')
  async messageDetails(
    @Req() req: AuthedRequest,
    @Query('conversation_id') convId?: string,
    @Query('user_id') userId?: string,
    @Query('vendor_id') vendorId?: string,
  ) {
    if (!this.useMongo()) return { messages: [] };
    const dmId = Number(req.actor!.id);
    // The app loads a thread by conversation_id OR (first time) by user_id
    // (customer chat) / vendor_id (restaurant chat).
    let conversationId = convId ? Number(convId) : undefined;
    if (!conversationId && (userId || vendorId)) {
      const partyType = vendorId ? 'vendor' : 'user';
      const partyId = Number(vendorId ?? userId);
      const conv = await this.mongo.findOne<{ mysql_id: number }>('conversations', {
        counterpart_type: 'delivery_man', counterpart_id: dmId, party_type: partyType, party_id: partyId,
      });
      if (conv) conversationId = Number(conv.mysql_id);
    }
    if (!conversationId) return { messages: [] };
    const rows = await this.mongo.findMany<Record<string, unknown>>(
      'messages', { conversation_id: conversationId }, { sort: { mysql_id: 1 }, limit: 100 },
    );
    return {
      messages: rows.map((m) => ({
        id: Number(m.mysql_id),
        conversation_id: conversationId,
        sender_type: m.sender_type,
        sender_id: m.sender_id != null ? Number(m.sender_id) : null,
        // The DM MessageModel reads `message` for text and `file_full_url`
        // for image attachments — and calls `.cast<String>()` on it, so it
        // MUST always be an array (never null) or the chat crashes to empty.
        message: (m.message ?? m.body ?? '') as string,
        body: (m.message ?? m.body ?? '') as string,
        file_full_url: Array.isArray(m.files)
          ? (m.files as string[]).map((f) => storageFullUrl('conversation', f)).filter((u): u is string => !!u)
          : [],
        is_seen: m.is_seen ?? 1,
        sent_by_me: m.sender_type === 'delivery_man' && Number(m.sender_id) === dmId,
        created_at: m.created_at ?? null,
      })),
    };
  }

  @Get('message/search-list')
  async messageSearch(@Req() req: AuthedRequest, @Query('search') q?: string) {
    if (!this.useMongo() || !q?.trim()) return { conversations: [] };
    const dmId = Number(req.actor!.id);
    const rows = await this.mongo.findMany<Record<string, unknown>>('conversations', {
      counterpart_type: 'delivery_man', counterpart_id: dmId, user_name: { $regex: q, $options: 'i' },
    }, { limit: 25 });
    return { conversations: rows.map((c) => ({ id: Number(c.mysql_id), name: c.user_name ?? `Customer #${c.user_id}` })) };
  }

  @HttpCode(200)
  @HttpCode(200)
  @Post('message/send')
  // The chat screen posts multipart/form-data (it can attach images), so
  // without a multipart interceptor @Body() is undefined and the send fails.
  // The text arrives as `message` (not `body`) and the target as `receiver_id`.
  @UseInterceptors(AnyFilesInterceptor({ limits: { fileSize: 10 * 1024 * 1024 } }))
  async messageSend(
    @Req() req: AuthedRequest,
    @UploadedFiles() files: (Express.Multer.File[]) | undefined,
    @Body() rawBody: {
      conversation_id?: number | string; receiver_id?: number | string; user_id?: number | string;
      receiver_type?: string; message?: string; body?: string;
    } | undefined,
  ) {
    if (!this.useMongo()) return { message: 'sent' };
    const dmId = Number(req.actor!.id);
    const body = rawBody ?? {};
    const text = (body.message ?? body.body ?? '').toString();
    // Persist any attached images durably (compress + disk + Mongo uploads).
    const imageNames: string[] = [];
    for (const f of files ?? []) {
      const name = await this.saveImage(f, 'conversation');
      if (name) imageNames.push(name);
    }
    if (!text.trim() && imageNames.length === 0) {
      return { errors: [{ code: 'body', message: 'message body required' }] };
    }
    const counterpartUserId = body.receiver_id ?? body.user_id;
    const partyType = body.receiver_type === 'vendor' ? 'vendor' : 'user';
    let convId = body.conversation_id != null && body.conversation_id !== '' ? Number(body.conversation_id) : undefined;
    if (!convId && counterpartUserId != null && counterpartUserId !== '') {
      const pid = Number(counterpartUserId);
      const existing = await this.mongo.findOne<{ mysql_id: number }>('conversations', {
        counterpart_type: 'delivery_man', counterpart_id: dmId, party_type: partyType, party_id: pid,
      });
      if (existing) convId = Number(existing.mysql_id);
      else {
        convId = await this.mongo.nextMysqlId('conversations');
        await this.mongo.insertOne('conversations', {
          mysql_id: convId, counterpart_type: 'delivery_man', counterpart_id: dmId,
          party_type: partyType, party_id: pid, user_id: partyType === 'user' ? pid : null,
          last_message: text, last_message_at: new Date(), unread: 0, created_at: new Date(),
        });
      }
    }
    if (!convId) return { errors: [{ code: 'conversation', message: 'conversation_id or receiver_id required' }] };
    const msgId = await this.mongo.nextMysqlId('messages');
    await this.mongo.insertOne('messages', {
      mysql_id: msgId, conversation_id: convId, sender_type: 'delivery_man', sender_id: dmId,
      message: text, body: text, files: imageNames, created_at: new Date(),
    });
    await this.mongo.updateOne('conversations', { mysql_id: convId }, {
      last_message: text || (imageNames.length ? 'Photo' : ''), last_message_at: new Date(),
    });
    return { message: 'sent', conversation_id: convId, id: msgId, files: imageNames };
  }
}
