import { Body, Controller, Delete, Get, Post, Query, Req, UseGuards, HttpCode, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as path from 'path';
import { AuthGuard, RequireAuth } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';

// Mongo doc shapes (only fields we read).
interface MongoVendorDoc {
  mysql_id: number;
  f_name?: string | null;
  l_name?: string | null;
  email?: string | null;
  phone?: string | null;
  image?: string | null;
  status?: boolean | null;
}

interface MongoRestaurantDoc {
  mysql_id: number;
  mysql_vendor_id?: number | null;
  mysql_zone_id?: number | null;
  zone_id?: number | null;
  name?: string | null;
  logo?: string | null;
  status?: boolean | null;
  active?: boolean | null;
  address?: string | null;
  phone?: string | null;
  comission?: number | string | null;
  minimum_order?: number | string | null;
  delivery?: boolean | null;
  take_away?: boolean | null;
  restaurant_model?: string | null;
}

interface MongoOrderDoc {
  mysql_id: number;
  mysql_user_id?: number | null;
  mysql_restaurant_id?: number | null;
  order_status?: string | null;
  order_amount?: number | string | null;
  legacy?: Record<string, unknown>;
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
  legacy?: Record<string, unknown>;
}

interface MongoReviewDoc {
  mysql_id: number;
  mysql_food_id?: number | null;
  mysql_user_id?: number | null;
  comment?: string | null;
  rating?: number | null;
  reply?: string | null;
}

interface MongoCategoryDoc {
  mysql_id: number;
  parent_id?: number | null;
  name?: string | null;
  image?: string | null;
  status?: boolean | null;
}

interface MongoAddonDoc {
  mysql_id: number;
  mysql_restaurant_id?: number | null;
  mysql_addon_category_id?: number | null;
  name?: string | null;
  price?: number | string | null;
  legacy?: Record<string, unknown>;
}

interface MongoAttributeDoc {
  mysql_id: number;
  name?: string | null;
}

interface MongoDeliveryManDoc {
  mysql_id: number;
  mysql_zone_id?: number | null;
  f_name?: string | null;
  l_name?: string | null;
  phone?: string | null;
  status?: boolean | null;
  application_status?: string | null;
}

interface MongoWithdrawalMethodDoc {
  mysql_id: number;
  method_name?: string | null;
  method_fields?: unknown;
  is_default?: boolean | number | null;
  is_active?: boolean | number | null;
}

interface MongoNotificationDoc {
  mysql_id: number;
  title?: string | null;
  description?: string | null;
  status?: boolean | null;
}

interface MongoAdDoc {
  mysql_id: number;
  mysql_restaurant_id?: number | null;
  mysql_created_by_id?: number | null;
  legacy?: Record<string, unknown>;
}

interface MongoScheduleDoc {
  mysql_id: number;
  mysql_restaurant_id?: number | null;
  legacy?: Record<string, unknown>;
}

const toNum = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v) || 0;
  return Number(v) || 0;
};

// Vendor (restaurant app) endpoints beyond order management. For the demo
// we expose the resources the app reads and stub the writes/reports so the
// restaurant Flutter app can navigate every screen without 404s.
@Controller('vendor')
@UseGuards(AuthGuard)
@RequireAuth('vendor')
export class VendorExtrasController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mongo: MongoDataService,
  ) {}

  /** Feature flag — when set, extras read/write Mongo first. */
  private useMongo(): boolean {
    const v = (process.env.USE_MONGO_EXTRAS ?? '1').toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }

  // ── Profile ───────────────────────────────────────────────────────
  @Get('profile')
  async profile(@Req() req: AuthedRequest) {
    if (this.useMongo()) {
      const v = await this.mongo.findByMysqlId<MongoVendorDoc>('vendors', Number(req.actor!.id));
      if (!v) return {};
      const vendorId = Number(v.mysql_id);
      const restaurants = await this.mongo.findMany<MongoRestaurantDoc>(
        'restaurants',
        { mysql_vendor_id: vendorId },
      );
      const restaurantIds = restaurants.map((r) => Number(r.mysql_id));

      // Wallet — fields the Flutter ProfileModel needs to render WalletScreen
      // without crashing on `!` null-check operators. Falls back to zeros if
      // no wallet record exists for this vendor.
      const wallet = await this.mongo.findOne<{
        vendor_id?: number; mysql_vendor_id?: number; mysql_restaurant_id?: number;
        balance?: number | string | null; total_earning?: number | string | null;
        collected_cash?: number | string | null; total_withdrawn?: number | string | null;
        pending_withdraw?: number | string | null;
      }>('restaurant_wallets', { $or: [
        { vendor_id: vendorId },
        { mysql_vendor_id: vendorId },
        ...(restaurantIds.length > 0 ? [{ mysql_restaurant_id: { $in: restaurantIds } }] : []),
      ] });

      const totalEarning = toNum(wallet?.total_earning) ?? 0;
      const balance = toNum(wallet?.balance) ?? 0;
      const cashInHands = toNum(wallet?.collected_cash) ?? 0;
      const alreadyWithdrawn = toNum(wallet?.total_withdrawn) ?? 0;
      const pendingWithdraw = toNum(wallet?.pending_withdraw) ?? 0;

      // Order stats — Today / This Week / This Month tiles on the dashboard.
      // All time-bucketed in JS to avoid Mongo aggregation pipeline complexity.
      let todaysCount = 0, weekCount = 0, monthCount = 0, totalOrders = 0;
      let todaysEarn = 0, weekEarn = 0, monthEarn = 0;
      if (restaurantIds.length > 0) {
        const now = Date.now();
        const dayMs = 86_400_000;
        const orders = await this.mongo.findMany<{
          mysql_restaurant_id?: number; order_status?: string; order_amount?: number | string;
          created_at?: Date | string;
        }>('orders', { mysql_restaurant_id: { $in: restaurantIds } });
        totalOrders = orders.length;
        for (const o of orders) {
          const ts = o.created_at ? new Date(o.created_at).getTime() : 0;
          if (!Number.isFinite(ts)) continue;
          const age = now - ts;
          const amount = toNum(o.order_amount) ?? 0;
          if (age <= dayMs) { todaysCount++; if (o.order_status === 'delivered') todaysEarn += amount; }
          if (age <= 7 * dayMs) { weekCount++; if (o.order_status === 'delivered') weekEarn += amount; }
          if (age <= 30 * dayMs) { monthCount++; if (o.order_status === 'delivered') monthEarn += amount; }
        }
      }

      // member_since_days — how long the vendor has existed.
      const vCreatedAt = (v as unknown as Record<string, unknown>).created_at;
      const memberSince = vCreatedAt
        ? Math.max(0, Math.floor((Date.now() - new Date(vCreatedAt as string | number | Date).getTime()) / 86_400_000))
        : 30;

      return {
        id: vendorId,
        f_name: v.f_name ?? null,
        l_name: v.l_name ?? null,
        email: v.email ?? null,
        phone: v.phone ?? null,
        image: v.image ?? null,
        status: v.status ?? null,
        // ── Wallet (JSON keys MUST match ProfileModel.fromJson in the
        //    Flutter app — `adjust_able` and `Payable_Balance` are
        //    intentionally misnamed there, so we match them here.) ──
        cash_in_hands: cashInHands,
        balance,
        total_earning: totalEarning,
        withdraw_able_balance: balance,
        Payable_Balance: balance,                // sic — capital P in Flutter
        pending_withdraw: pendingWithdraw,
        total_withdrawn: alreadyWithdrawn,       // Flutter maps this → alreadyWithdrawn
        adjust_able: true,                       // sic — Flutter uses adjust_able, not adjustable
        over_flow_warning: false,
        over_flow_block_warning: false,
        dynamic_balance: balance,
        dynamic_balance_type: 'positive',
        show_pay_now_button: false,
        // ── Dashboard stats ──────────────────────────────────────────
        order_count: totalOrders,
        product_count: 0,
        review_count: 0,
        todays_order_count: todaysCount,
        this_week_order_count: weekCount,
        this_month_order_count: monthCount,
        todays_earning: todaysEarn,
        this_week_earning: weekEarn,
        this_month_earning: monthEarn,
        member_since_days: memberSince,
        // ── Subscriptions (defaults — feature not wired up) ──────────
        subscription: null,
        subscription_other_data: null,
        subscription_transactions: false,
        // ── Role / permissions ───────────────────────────────────────
        // CRITICAL: empty roles → ProfileController._allowPermission grants
        // ALL module permissions. If we sent ['owner'] here, the controller
        // tries to look up an 'owner' module key (which doesn't exist) and
        // denies access to every screen ("You have no permission…").
        roles: [],
        employee_info: null,
        // Flutter ProfileModel reads `image_full_url`, `restaurants[].logo_full_url`,
        // and `restaurants[].cover_photo_full_url` — absolute URLs to the images.
        // Without these the avatar + restaurant card stay grey placeholders even
        // when the filename is saved. Build them from STORAGE_BASE_URL.
        image_full_url: this.buildStorageUrl('profile', v.image),
        restaurants: restaurants.map((r) => ({
          id: Number(r.mysql_id),
          name: r.name ?? null,
          logo: r.logo ?? null,
          logo_full_url: this.buildStorageUrl('restaurant', r.logo),
          cover_photo: (r as { cover_photo?: string }).cover_photo ?? null,
          cover_photo_full_url: this.buildStorageUrl('restaurant/cover', (r as { cover_photo?: string }).cover_photo),
          status: r.status ?? null,
          address: r.address ?? null,
          phone: r.phone ?? null,
          comission: r.comission !== null && r.comission !== undefined ? toNum(r.comission) : null,
          minimum_order: toNum(r.minimum_order),
          delivery: r.delivery ?? null,
          take_away: r.take_away ?? null,
          restaurant_model: r.restaurant_model ?? null,
        })),
      };
    }
    const v = await this.prisma.vendors.findUnique({ where: { id: req.actor!.id } });
    if (!v) return {};
    const restaurants = await this.prisma.restaurants.findMany({
      where: { vendor_id: v.id },
      select: { id: true, name: true, logo: true, status: true, address: true, phone: true, comission: true, minimum_order: true, delivery: true, take_away: true, restaurant_model: true },
    });
    return {
      id: Number(v.id),
      f_name: v.f_name,
      l_name: v.l_name,
      email: v.email,
      phone: v.phone,
      image: v.image,
      status: v.status,
      restaurants: restaurants.map((r) => ({ ...r, id: Number(r.id), comission: r.comission !== null ? Number(r.comission) : null, minimum_order: Number(r.minimum_order) })),
    };
  }

  /** Update the logged-in vendor's profile (name, email, phone, avatar).
   *  Flutter sends multipart/form-data with an `image` file alongside text
   *  fields — without FileFieldsInterceptor `body` is undefined and we
   *  500'd with "Cannot convert undefined or null to object" inside
   *  Object.entries(body). */
  @HttpCode(200)
  @Post('update-profile')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'image', maxCount: 1 },
  ], { limits: { fileSize: 5 * 1024 * 1024 } }))
  async updateProfile(
    @Req() req: AuthedRequest,
    @Body() body: Record<string, unknown> = {},
    @UploadedFiles() files: { image?: Express.Multer.File[] } = {},
  ) {
    const b = body ?? {};
    const data: Record<string, unknown> = {};
    for (const k of ['f_name', 'l_name', 'email', 'phone', 'password'] as const) {
      if (b[k] !== undefined) data[k] = String(b[k]);
    }
    const avatarName = this.saveUploaded(files?.image?.[0], 'profile');
    if (avatarName) data.image = avatarName;
    if (Object.keys(data).length === 0) return { message: 'nothing to update' };
    data.updated_at = new Date();

    if (this.useMongo()) {
      await this.mongo.updateOne('vendors', { mysql_id: Number(req.actor!.id) }, data);
      return { message: 'Profile updated' };
    }
    await this.prisma.vendors.update({ where: { id: req.actor!.id }, data: data as never });
    return { message: 'Profile updated' };
  }

  @HttpCode(200)
  @Post('update-fcm-token')
  fcmToken() { return { message: 'token-updated' }; }

  @HttpCode(200)
  @Post('update-active-status')
  async toggleActive(@Req() req: AuthedRequest, @Body() body: { status?: boolean }) {
    if (this.useMongo()) {
      const r = await this.mongo.findOne<MongoRestaurantDoc>('restaurants', { mysql_vendor_id: Number(req.actor!.id) });
      if (r && body.status !== undefined) {
        await this.mongo.updateOne('restaurants', { mysql_id: r.mysql_id }, { active: body.status });
      }
      return { message: 'updated' };
    }
    const r = await this.prisma.restaurants.findFirst({ where: { vendor_id: req.actor!.id }, select: { id: true } });
    if (r && body.status !== undefined) {
      await this.prisma.restaurants.update({ where: { id: r.id }, data: { active: body.status } });
    }
    return { message: 'updated' };
  }

  @HttpCode(200)
  @Post('opening-closing-status')
  toggleOpen() { return { message: 'updated' }; }

  @HttpCode(200)
  @Post('update-announcment')
  announce() { return { message: 'announcement updated' }; }

  @HttpCode(200)
  @Post('update-bank-info')
  bankInfo() { return { message: 'bank info updated' }; }

  /** Build an absolute /storage/* URL for a saved filename. Falls back to
   *  the SVG placeholder middleware when the filename is missing so the
   *  Flutter NetworkImage never sees an empty string. */
  private buildStorageUrl(folder: string, filename?: string | null): string {
    const base = (process.env.STORAGE_BASE_URL ?? 'http://127.0.0.1:3000/storage').replace(/\/$/, '');
    const safeName = filename && String(filename).trim() ? String(filename) : 'default.png';
    return `${base}/${folder}/${safeName}`;
  }

  /** Resolve the on-disk storage folder so uploaded images survive across
   *  worker processes the same way main.ts serves them. */
  private storageDir(folder: string): string {
    const root = process.env.STORAGE_ROOT
      ?? path.resolve(__dirname, '../../storage/app/public');
    const dir = path.join(root, folder);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  /** Save one uploaded file from Multer to /storage/<folder>/, returning
   *  the filename (sans path) for the DB. Renames with a timestamp so
   *  collisions can't overwrite an existing image. */
  private saveUploaded(file: Express.Multer.File | undefined, folder: string): string | null {
    if (!file || !file.buffer || file.buffer.length === 0) return null;
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    fs.writeFileSync(path.join(this.storageDir(folder), filename), file.buffer);
    return filename;
  }

  /** Persist the Edit Restaurant form's "Basic Info" tab. Flutter sends
   *  this as multipart/form-data (logo + cover + meta_image files alongside
   *  text fields), so the FileFieldsInterceptor is required to populate
   *  `body` — without it `body` is undefined and we crash with the famous
   *  "Cannot read properties of undefined (reading 'name')". */
  @HttpCode(200)
  @Post('update-basic-info')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'logo', maxCount: 1 },
    { name: 'cover_photo', maxCount: 1 },
    { name: 'meta_image', maxCount: 1 },
  ], { limits: { fileSize: 5 * 1024 * 1024 } }))
  async basicInfo(
    @Req() req: AuthedRequest,
    @Body() body: Record<string, unknown> = {},
    @UploadedFiles() files: { logo?: Express.Multer.File[]; cover_photo?: Express.Multer.File[]; meta_image?: Express.Multer.File[] } = {},
  ) {
    const b = body ?? {};
    const data: Record<string, unknown> = {};

    // Flutter sends the restaurant *name* and *address* as a JSON-encoded
    // `translations` array, NOT as top-level fields. Shape:
    //   [{ locale: "en", key: "name", value: "Amaan" },
    //    { locale: "en", key: "address", value: "..." },
    //    ...per language...]
    // Parse it, persist the array verbatim for future i18n, and lift the
    // English copy onto the canonical `name` / `address` columns so the
    // dashboard + customer app see the new values.
    if (b.translations !== undefined) {
      let translations: Array<{ locale?: string; key?: string; value?: string }> = [];
      if (typeof b.translations === 'string') {
        try { translations = JSON.parse(b.translations) ?? []; } catch { translations = []; }
      } else if (Array.isArray(b.translations)) {
        translations = b.translations as typeof translations;
      }
      data.translations = translations;
      const pick = (lang: string, key: string) =>
        translations.find((t) => t?.locale === lang && t?.key === key)?.value;
      const enName = pick('en', 'name') ?? pick('default', 'name') ?? translations.find((t) => t?.key === 'name')?.value;
      const enAddress = pick('en', 'address') ?? pick('default', 'address') ?? translations.find((t) => t?.key === 'address')?.value;
      if (enName) data.name = enName;
      if (enAddress) data.address = enAddress;
    }

    // Top-level overrides — Flutter sends some of these too.
    if (b.name !== undefined) data.name = String(b.name);
    if (b.address !== undefined) data.address = String(b.address);
    if (b.contact_number !== undefined) data.phone = String(b.contact_number);
    if (b.phone !== undefined) data.phone = String(b.phone);
    if (b.gst !== undefined) data.gst = String(b.gst);
    if (b.gst_status !== undefined) data.gst_status = !!Number(b.gst_status);
    if (b.minimum_order !== undefined) data.minimum_order = Number(b.minimum_order);
    if (b.meta_title !== undefined) data.meta_title = String(b.meta_title);
    if (b.meta_description !== undefined) data.meta_description = String(b.meta_description);
    if (b.meta_keywords !== undefined) data.meta_keywords = String(b.meta_keywords);

    // Persist uploaded files to disk + record new filenames in the DB.
    const logoName = this.saveUploaded(files?.logo?.[0], 'restaurant');
    const coverName = this.saveUploaded(files?.cover_photo?.[0], 'restaurant/cover');
    const metaName = this.saveUploaded(files?.meta_image?.[0], 'restaurant');
    if (logoName) data.logo = logoName;
    if (coverName) data.cover_photo = coverName;
    if (metaName) data.meta_image = metaName;

    if (Object.keys(data).length === 0) return { message: 'nothing to update' };
    data.updated_at = new Date();

    if (this.useMongo()) {
      await this.mongo.updateOne('restaurants', { mysql_vendor_id: Number(req.actor!.id) }, data);
      return { message: 'basic info updated' };
    }
    const r = await this.prisma.restaurants.findFirst({ where: { vendor_id: req.actor!.id }, select: { id: true } });
    if (r) await this.prisma.restaurants.update({
      where: { id: r.id },
      data: data as never,
    });
    return { message: 'basic info updated' };
  }

  /** Same multipart treatment for the Business Setup tab so it doesn't 500
   *  when Flutter sends form-data with the restaurant_logo file. */
  @HttpCode(200)
  @Post('update-business-setup')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'logo', maxCount: 1 },
    { name: 'cover_photo', maxCount: 1 },
  ], { limits: { fileSize: 5 * 1024 * 1024 } }))
  async businessSetup(@Req() req: AuthedRequest, @Body() body: Record<string, unknown> = {}) {
    const b = body ?? {};
    const data: Record<string, unknown> = {};
    for (const k of ['minimum_order', 'minimum_shipping_charge'] as const) {
      if (b[k] !== undefined) data[k] = Number(b[k]);
    }
    for (const k of ['delivery', 'take_away', 'free_delivery', 'veg', 'non_veg', 'self_delivery_system'] as const) {
      if (b[k] !== undefined) data[k] = !!Number(b[k]);
    }
    if (b.restaurant_model !== undefined) data.restaurant_model = String(b.restaurant_model);
    if (b.delivery_time !== undefined) data.delivery_time = String(b.delivery_time);
    if (Object.keys(data).length === 0) return { message: 'nothing to update' };
    data.updated_at = new Date();
    if (this.useMongo()) {
      await this.mongo.updateOne('restaurants', { mysql_vendor_id: Number(req.actor!.id) }, data);
    }
    return { message: 'business setup updated' };
  }

  @HttpCode(200)
  @Post('add-dine-in-table-number')
  addDineInTable() { return { message: 'added' }; }

  @HttpCode(200)
  @Delete('remove-account')
  remove() { return { message: 'Not available in demo' }; }

  // ── Orders summary ───────────────────────────────────────────────

  /** Shape every order row identically so the Flutter OrderModel never
   *  hits `!` on a null field. The widget reads detailsCount, orderStatus,
   *  orderType, createdAt, paymentMethod — and uses `!` on each, so missing
   *  data here translates directly to a red-screen crash on the device. */
  private shapeOrder(rIn: MongoOrderDoc, detailsCount: number) {
    const r = rIn as MongoOrderDoc & Record<string, unknown>;
    const created = (r as { created_at?: Date | string | null }).created_at;
    const updated = (r as { updated_at?: Date | string | null }).updated_at;
    return {
      ...(r.legacy ?? {}),
      ...r,
      id: Number(r.mysql_id),
      user_id: r.mysql_user_id !== null && r.mysql_user_id !== undefined ? Number(r.mysql_user_id) : null,
      restaurant_id: r.mysql_restaurant_id !== null && r.mysql_restaurant_id !== undefined ? Number(r.mysql_restaurant_id) : 0,
      order_amount: toNum(r.order_amount) ?? 0,
      // Defaults below — Flutter `!` operators on these will not crash.
      details_count: detailsCount,
      order_status: (r.order_status ?? 'pending') as string,
      order_type: ((r as { order_type?: string }).order_type ?? 'delivery') as string,
      payment_method: ((r as { payment_method?: string }).payment_method ?? 'cash_on_delivery') as string,
      payment_status: ((r as { payment_status?: string }).payment_status ?? 'unpaid') as string,
      delivery_address: (r as { delivery_address?: unknown }).delivery_address ?? null,
      created_at: created ? new Date(created).toISOString() : new Date().toISOString(),
      updated_at: updated ? new Date(updated).toISOString() : new Date().toISOString(),
    };
  }

  /** Bulk count items-per-order with one Mongo aggregation. Returns a Map
   *  so callers can do detailsByOrderId.get(orderId) ?? 1 in O(1). Default
   *  of 1 (not 0) matches the assumption "every order has ≥ 1 item" and
   *  keeps Flutter's "item"/"items" pluralization sensible. */
  private async detailsCountMap(orderIds: number[]): Promise<Map<number, number>> {
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

  @Get('current-orders')
  async currentOrders(@Req() req: AuthedRequest) {
    if (this.useMongo()) {
      const restaurant = await this.mongo.findOne<MongoRestaurantDoc>('restaurants', { mysql_vendor_id: Number(req.actor!.id) });
      if (!restaurant) return [];
      const rows = await this.mongo.findMany<MongoOrderDoc>(
        'orders',
        { mysql_restaurant_id: Number(restaurant.mysql_id), order_status: { $in: ['accepted', 'confirmed', 'processing'] } },
        { sort: { mysql_id: -1 } },
      );
      const countsByOrderId = await this.detailsCountMap(rows.map((r) => Number(r.mysql_id)));
      return rows.map((r) => this.shapeOrder(r, countsByOrderId.get(Number(r.mysql_id)) ?? 1));
    }
    const restaurant = await this.prisma.restaurants.findFirst({ where: { vendor_id: req.actor!.id }, select: { id: true } });
    if (!restaurant) return [];
    const rows = await this.prisma.orders.findMany({
      where: { restaurant_id: restaurant.id, order_status: { in: ['accepted', 'confirmed', 'processing'] } },
      orderBy: { id: 'desc' },
    });
    return rows.map((r) => ({ ...r, id: Number(r.id), user_id: r.user_id ? Number(r.user_id) : null, restaurant_id: Number(r.restaurant_id), order_amount: Number(r.order_amount) }));
  }

  @Get('completed-orders')
  async completedOrders(@Req() req: AuthedRequest) {
    if (this.useMongo()) {
      const restaurant = await this.mongo.findOne<MongoRestaurantDoc>('restaurants', { mysql_vendor_id: Number(req.actor!.id) });
      if (!restaurant) return { orders: [], total_size: 0 };
      const rows = await this.mongo.findMany<MongoOrderDoc>(
        'orders',
        { mysql_restaurant_id: Number(restaurant.mysql_id), order_status: { $in: ['delivered', 'canceled', 'refunded'] } },
        { sort: { mysql_id: -1 }, limit: 50 },
      );
      const countsByOrderId = await this.detailsCountMap(rows.map((r) => Number(r.mysql_id)));
      return {
        orders: rows.map((r) => this.shapeOrder(r, countsByOrderId.get(Number(r.mysql_id)) ?? 1)),
        total_size: rows.length,
      };
    }
    const restaurant = await this.prisma.restaurants.findFirst({ where: { vendor_id: req.actor!.id }, select: { id: true } });
    if (!restaurant) return { orders: [], total_size: 0 };
    const rows = await this.prisma.orders.findMany({
      where: { restaurant_id: restaurant.id, order_status: { in: ['delivered', 'canceled', 'refunded'] } },
      orderBy: { id: 'desc' },
      take: 50,
    });
    return { orders: rows.map((r) => ({ ...r, id: Number(r.id), user_id: r.user_id ? Number(r.user_id) : null, restaurant_id: Number(r.restaurant_id), order_amount: Number(r.order_amount) })), total_size: rows.length };
  }

  @Get('order')
  async vendorOrder(@Query('order_id') idStr?: string) {
    const id = parseInt(idStr ?? '', 10);
    if (!Number.isFinite(id)) return null;

    if (this.useMongo()) {
      const o = await this.mongo.findByMysqlId<MongoOrderDoc>('orders', id);
      if (!o) return null;
      const counts = await this.detailsCountMap([Number(o.mysql_id)]);
      return this.shapeOrder(o, counts.get(Number(o.mysql_id)) ?? 1);
    }

    const o = await this.prisma.orders.findUnique({ where: { id: BigInt(id) } });
    return o ? { ...o, id: Number(o.id), user_id: o.user_id ? Number(o.user_id) : null, restaurant_id: Number(o.restaurant_id), order_amount: Number(o.order_amount) } : null;
  }

  @HttpCode(200)
  @Post('update-order')
  updateOrder() { return { message: 'order updated' }; }

  @HttpCode(200)
  @Post('send-order-otp')
  sendOrderOtp() { return { otp: '1234', message: 'otp generated' }; }

  @HttpCode(200)
  @Post('customer-address-update')
  customerAddressUpdate() { return { message: 'address updated' }; }

  // ── Products (read-only views) ───────────────────────────────────
  @Get('get-products-list')
  async products(@Req() req: AuthedRequest, @Query('limit') limitStr?: string, @Query('offset') offsetStr?: string) {
    const limit = parseInt(limitStr ?? '25', 10);
    const offset = parseInt(offsetStr ?? '1', 10);

    if (this.useMongo()) {
      const restaurant = await this.mongo.findOne<MongoRestaurantDoc>('restaurants', { mysql_vendor_id: Number(req.actor!.id) });
      if (!restaurant) return { products: [], total_size: 0, limit, offset };
      const filter = { mysql_restaurant_id: Number(restaurant.mysql_id) };
      const [rows, total] = await Promise.all([
        this.mongo.findMany<MongoFoodDoc>('foods', filter, { sort: { mysql_id: -1 }, limit, skip: Math.max(0, (offset - 1) * limit) }),
        this.mongo.count('foods', filter),
      ]);
      return {
        products: rows.map((r) => ({
          ...(r.legacy ?? {}),
          ...r,
          id: Number(r.mysql_id),
          price: toNum(r.price),
          tax: toNum(r.tax),
          discount: toNum(r.discount),
          restaurant_id: r.mysql_restaurant_id !== null && r.mysql_restaurant_id !== undefined ? Number(r.mysql_restaurant_id) : 0,
          category_id: r.mysql_category_id !== null && r.mysql_category_id !== undefined ? Number(r.mysql_category_id) : null,
        })),
        total_size: total,
        limit,
        offset,
      };
    }

    const restaurant = await this.prisma.restaurants.findFirst({ where: { vendor_id: req.actor!.id }, select: { id: true } });
    if (!restaurant) return { products: [], total_size: 0, limit, offset };
    const [rows, total] = await Promise.all([
      this.prisma.food.findMany({ where: { restaurant_id: restaurant.id }, orderBy: { id: 'desc' }, take: limit, skip: Math.max(0, (offset - 1) * limit) }),
      this.prisma.food.count({ where: { restaurant_id: restaurant.id } }),
    ]);
    return { products: rows.map((r) => ({ ...r, id: Number(r.id), price: Number(r.price), tax: Number(r.tax), discount: Number(r.discount), restaurant_id: Number(r.restaurant_id), category_id: r.category_id ? Number(r.category_id) : null })), total_size: total, limit, offset };
  }

  @Get('product/details')
  async productDetails(@Query('product_id') idStr?: string) {
    const id = parseInt(idStr ?? '', 10);
    if (!Number.isFinite(id)) return null;

    if (this.useMongo()) {
      const f = await this.mongo.findByMysqlId<MongoFoodDoc>('foods', id);
      return f
        ? {
            ...(f.legacy ?? {}),
            ...f,
            id: Number(f.mysql_id),
            price: toNum(f.price),
            tax: toNum(f.tax),
            discount: toNum(f.discount),
            restaurant_id: f.mysql_restaurant_id !== null && f.mysql_restaurant_id !== undefined ? Number(f.mysql_restaurant_id) : 0,
            category_id: f.mysql_category_id !== null && f.mysql_category_id !== undefined ? Number(f.mysql_category_id) : null,
          }
        : null;
    }

    const f = await this.prisma.food.findUnique({ where: { id: BigInt(id) } });
    return f ? { ...f, id: Number(f.id), price: Number(f.price), tax: Number(f.tax), discount: Number(f.discount), restaurant_id: Number(f.restaurant_id), category_id: f.category_id ? Number(f.category_id) : null } : null;
  }

  @Get('product/search')
  productSearch() { return { products: [], total_size: 0 }; }

  @HttpCode(200)
  @Post('product/status')
  productStatus() { return { message: 'updated' }; }

  @HttpCode(200)
  @Post('product/recommended')
  productRecommended() { return { message: 'updated' }; }

  @HttpCode(200)
  @Post('product/update-stock')
  updateStock() { return { message: 'stock updated' }; }

  /** Create a new food item. Flutter's Add Food screen sends this as
   *  multipart/form-data with `image` + `meta_image` files alongside text
   *  fields (`name`, `price`, `description`, `category_id`, `veg`, etc.).
   *  Previously a stub that just returned a success message — the UI showed
   *  "added" but nothing landed in `foods`. Now actually persists. */
  @HttpCode(200)
  @Post('product/store')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'image', maxCount: 1 },
    { name: 'meta_image', maxCount: 1 },
  ], { limits: { fileSize: 5 * 1024 * 1024 } }))
  async productStore(
    @Req() req: AuthedRequest,
    @Body() body: Record<string, unknown> = {},
    @UploadedFiles() files: { image?: Express.Multer.File[]; meta_image?: Express.Multer.File[] } = {},
  ) {
    if (!this.useMongo()) return { message: 'product created' };
    const b = body ?? {};
    const restaurant = await this.mongo.findOne<MongoRestaurantDoc>(
      'restaurants', { mysql_vendor_id: Number(req.actor!.id) },
    );
    if (!restaurant) return { errors: [{ code: 'restaurant', message: 'restaurant not found' }] };

    // Flutter packs name + description inside translations JSON (same pattern
    // as Edit Restaurant). Parse to lift the English copy to top-level fields.
    const { name: trName, description: trDesc, translations } =
      this.parseProductTranslations(b.translations);

    const nextId = await this.mongo.nextMysqlId('foods');
    const imageName = this.saveUploaded(files?.image?.[0], 'product') ?? 'default.png';
    const metaImage = this.saveUploaded(files?.meta_image?.[0], 'product');

    const now = new Date();
    const food: Record<string, unknown> = {
      mysql_id: nextId,
      mysql_restaurant_id: Number(restaurant.mysql_id),
      restaurant_id: Number(restaurant.mysql_id),
      mysql_category_id: b.category_id !== undefined && b.category_id !== '' ? Number(b.category_id) : null,
      category_id: b.category_id !== undefined && b.category_id !== '' ? Number(b.category_id) : null,
      name: trName ?? String(b.name ?? 'Untitled food'),
      description: trDesc ?? String(b.description ?? ''),
      translations,
      price: Number(b.price ?? 0),
      tax: Number(b.tax ?? 0),
      tax_type: String(b.tax_type ?? 'percent'),
      discount: Number(b.discount ?? 0),
      discount_type: String(b.discount_type ?? 'percent'),
      veg: !!Number(b.veg ?? 0),
      status: true,
      image: imageName,
      meta_image: metaImage,
      meta_title: b.meta_title ? String(b.meta_title) : null,
      meta_description: b.meta_description ? String(b.meta_description) : null,
      available_time_starts: b.available_time_starts ? String(b.available_time_starts) : '00:00',
      available_time_ends: b.available_time_ends ? String(b.available_time_ends) : '23:59',
      stock_type: String(b.stock_type ?? 'unlimited'),
      item_stock: Number(b.item_stock ?? 0),
      sell_count: 0,
      avg_rating: 0,
      rating_count: 0,
      addon_ids: b.addon_ids ?? [],
      variations: b.variations ?? [],
      created_at: now,
      updated_at: now,
    };
    await this.mongo.insertOne('foods', food);
    return { message: 'Product added successfully', id: nextId };
  }

  @HttpCode(200)
  @Post('product/update')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'image', maxCount: 1 },
    { name: 'meta_image', maxCount: 1 },
  ], { limits: { fileSize: 5 * 1024 * 1024 } }))
  async productUpdate(
    @Body() body: Record<string, unknown> = {},
    @UploadedFiles() files: { image?: Express.Multer.File[]; meta_image?: Express.Multer.File[] } = {},
  ) {
    if (!this.useMongo()) return { message: 'product updated' };
    const b = body ?? {};
    const foodId = b.id !== undefined && b.id !== '' ? Number(b.id) : null;
    if (!foodId) return { errors: [{ code: 'id', message: 'product id required' }] };

    const data: Record<string, unknown> = {};

    // Name + description live inside translations JSON, not at the top level.
    // Lift the English copy onto the canonical name/description fields so
    // My Foods + product details screens reflect the change.
    if (b.translations !== undefined) {
      const { name: trName, description: trDesc, translations } =
        this.parseProductTranslations(b.translations);
      data.translations = translations;
      if (trName) data.name = trName;
      if (trDesc) data.description = trDesc;
    }
    if (b.name !== undefined) data.name = String(b.name);
    if (b.description !== undefined) data.description = String(b.description);
    if (b.price !== undefined && b.price !== '') data.price = Number(b.price);
    if (b.tax !== undefined && b.tax !== '') data.tax = Number(b.tax);
    if (b.discount !== undefined && b.discount !== '') data.discount = Number(b.discount);
    if (b.discount_type !== undefined) data.discount_type = String(b.discount_type);
    if (b.veg !== undefined) data.veg = !!Number(b.veg);
    if (b.category_id !== undefined && b.category_id !== '') {
      data.category_id = Number(b.category_id);
      data.mysql_category_id = Number(b.category_id);
    }
    if (b.stock_type !== undefined) data.stock_type = String(b.stock_type);
    if (b.item_stock !== undefined && b.item_stock !== '') data.item_stock = Number(b.item_stock);
    if (b.available_time_starts !== undefined) data.available_time_starts = String(b.available_time_starts);
    if (b.available_time_ends !== undefined) data.available_time_ends = String(b.available_time_ends);
    if (b.maximum_cart_quantity !== undefined && b.maximum_cart_quantity !== '') {
      data.maximum_cart_quantity = Number(b.maximum_cart_quantity);
    }
    if (b.is_halal !== undefined) data.is_halal = !!Number(b.is_halal);
    const imageName = this.saveUploaded(files?.image?.[0], 'product');
    const metaImage = this.saveUploaded(files?.meta_image?.[0], 'product');
    if (imageName) data.image = imageName;
    if (metaImage) data.meta_image = metaImage;
    if (Object.keys(data).length === 0) return { message: 'nothing to update' };
    data.updated_at = new Date();
    const result = await this.mongo.updateOne('foods', { mysql_id: foodId }, data);
    return { message: 'Product updated successfully', matched: result?.matchedCount ?? 0, modified: result?.modifiedCount ?? 0 };
  }

  /** Parse the translations array (sent as a JSON string by Flutter) and
   *  pull the English `name` + `description` values for top-level fields. */
  private parseProductTranslations(raw: unknown): {
    name: string | null;
    description: string | null;
    translations: Array<{ locale?: string; key?: string; value?: string }>;
  } {
    let translations: Array<{ locale?: string; key?: string; value?: string }> = [];
    if (typeof raw === 'string') {
      try { translations = JSON.parse(raw) ?? []; } catch { translations = []; }
    } else if (Array.isArray(raw)) {
      translations = raw as typeof translations;
    }
    const pick = (key: string) =>
      translations.find((t) => t?.locale === 'en' && t?.key === key)?.value
      ?? translations.find((t) => t?.key === key)?.value
      ?? null;
    return { name: pick('name'), description: pick('description'), translations };
  }

  @HttpCode(200)
  @Delete('product/delete')
  productDelete() { return { message: 'product deleted' }; }

  @Get('product/reviews')
  async productReviews(@Query('product_id') idStr?: string) {
    const id = parseInt(idStr ?? '', 10);
    if (!Number.isFinite(id)) return [];

    if (this.useMongo()) {
      const rows = await this.mongo.findMany<MongoReviewDoc>(
        'reviews',
        { mysql_food_id: id },
        { sort: { mysql_id: -1 }, limit: 50 },
      );
      return rows.map((r) => ({
        id: Number(r.mysql_id),
        food_id: r.mysql_food_id !== null && r.mysql_food_id !== undefined ? Number(r.mysql_food_id) : 0,
        user_id: r.mysql_user_id !== null && r.mysql_user_id !== undefined ? Number(r.mysql_user_id) : 0,
        comment: r.comment ?? null,
        rating: r.rating ?? null,
        reply: r.reply ?? null,
      }));
    }

    const rows = await this.prisma.reviews.findMany({ where: { food_id: BigInt(id) }, orderBy: { id: 'desc' }, take: 50 });
    return rows.map((r) => ({ id: Number(r.id), food_id: Number(r.food_id), user_id: Number(r.user_id), comment: r.comment, rating: r.rating, reply: r.reply }));
  }

  @HttpCode(200)
  @Post('product/reply-update')
  productReply() { return { message: 'reply saved' }; }

  @Get('check-product-limits')
  productLimits() { return { remaining: 'unlimited' }; }

  // ── Categories ───────────────────────────────────────────────────
  @Get('categories')
  async categories() {
    if (this.useMongo()) {
      const rows = await this.mongo.findMany<MongoCategoryDoc>('categories', { parent_id: 0, status: true });
      return rows.map((r) => ({ id: Number(r.mysql_id), name: r.name ?? null, image: r.image ?? null, status: r.status ?? null }));
    }
    const rows = await this.prisma.categories.findMany({ where: { parent_id: 0, status: true } });
    return rows.map((r) => ({ id: Number(r.id), name: r.name, image: r.image, status: r.status }));
  }

  @Get('categories/childes')
  async childCategories(@Query('parent_id') idStr?: string) {
    const id = parseInt(idStr ?? '0', 10);
    if (this.useMongo()) {
      const rows = await this.mongo.findMany<MongoCategoryDoc>('categories', { parent_id: id, status: true });
      return rows.map((r) => ({ id: Number(r.mysql_id), name: r.name ?? null, image: r.image ?? null, status: r.status ?? null }));
    }
    return this.prisma.categories.findMany({ where: { parent_id: id, status: true } }).then((rows) =>
      rows.map((r) => ({ id: Number(r.id), name: r.name, image: r.image, status: r.status })),
    );
  }

  @Get('categories/category-wise-products')
  categoryProducts() { return { products: [], total_size: 0 }; }

  // ── Add-ons + attributes ─────────────────────────────────────────
  @Get('addon')
  async vendorAddons(@Req() req: AuthedRequest) {
    if (this.useMongo()) {
      const restaurant = await this.mongo.findOne<MongoRestaurantDoc>('restaurants', { mysql_vendor_id: Number(req.actor!.id) });
      if (!restaurant) return { addons: [] };
      const rows = await this.mongo.findMany<MongoAddonDoc>('add_ons', { mysql_restaurant_id: Number(restaurant.mysql_id) });
      return rows.map((r) => ({
        ...(r.legacy ?? {}),
        ...r,
        id: Number(r.mysql_id),
        restaurant_id: r.mysql_restaurant_id !== null && r.mysql_restaurant_id !== undefined ? Number(r.mysql_restaurant_id) : 0,
        addon_category_id: r.mysql_addon_category_id !== null && r.mysql_addon_category_id !== undefined ? Number(r.mysql_addon_category_id) : null,
        price: toNum(r.price),
      }));
    }
    const restaurant = await this.prisma.restaurants.findFirst({ where: { vendor_id: req.actor!.id }, select: { id: true } });
    if (!restaurant) return { addons: [] };
    const rows = await this.prisma.add_ons.findMany({ where: { restaurant_id: restaurant.id } });
    return rows.map((r) => ({ ...r, id: Number(r.id), restaurant_id: Number(r.restaurant_id), addon_category_id: r.addon_category_id ? Number(r.addon_category_id) : null, price: Number(r.price) }));
  }

  @HttpCode(200)
  @Post('addon/store')
  addonStore() { return { message: 'addon created' }; }

  @HttpCode(200)
  @Post('addon/update')
  addonUpdate() { return { message: 'addon updated' }; }

  @HttpCode(200)
  @Delete('addon/delete')
  addonDelete() { return { message: 'addon deleted' }; }

  @Get('attributes')
  async attributes() {
    if (this.useMongo()) {
      const rows = await this.mongo.findMany<MongoAttributeDoc>('attributes', {});
      return rows.map((r) => ({ id: Number(r.mysql_id), name: r.name ?? null }));
    }
    const rows = await this.prisma.attributes.findMany();
    return rows.map((r) => ({ id: Number(r.id), name: r.name }));
  }

  // ── Delivery man (vendor view) ───────────────────────────────────
  @Get('delivery-man/list')
  async vendorDmList(@Req() req: AuthedRequest) {
    if (this.useMongo()) {
      const restaurant = await this.mongo.findOne<MongoRestaurantDoc>('restaurants', { mysql_vendor_id: Number(req.actor!.id) });
      if (!restaurant) return { delivery_men: [], total_size: 0 };
      const zoneId = restaurant.mysql_zone_id ?? restaurant.zone_id ?? null;
      const filter: Record<string, unknown> = zoneId !== null && zoneId !== undefined ? { mysql_zone_id: Number(zoneId) } : {};
      const rows = await this.mongo.findMany<MongoDeliveryManDoc>('delivery_men', filter);
      return rows.map((r) => ({
        id: Number(r.mysql_id),
        f_name: r.f_name ?? null,
        l_name: r.l_name ?? null,
        phone: r.phone ?? null,
        status: r.status ?? null,
        application_status: r.application_status ?? null,
      }));
    }
    const restaurant = await this.prisma.restaurants.findFirst({ where: { vendor_id: req.actor!.id }, select: { id: true, zone_id: true } });
    if (!restaurant) return { delivery_men: [], total_size: 0 };
    const rows = await this.prisma.delivery_men.findMany({ where: { zone_id: restaurant.zone_id ?? undefined } });
    return rows.map((r) => ({ id: Number(r.id), f_name: r.f_name, l_name: r.l_name, phone: r.phone, status: r.status, application_status: r.application_status }));
  }

  @Get('delivery-man/get-delivery-man-list')
  getDmList(@Req() req: AuthedRequest) { return this.vendorDmList(req); }

  @Get('delivery-man/preview')
  dmPreview() { return null; }

  @HttpCode(200)
  @Post('delivery-man/store')
  dmStore() { return { message: 'delivery man created' }; }

  @HttpCode(200)
  @Post('delivery-man/update')
  dmUpdate() { return { message: 'updated' }; }

  @HttpCode(200)
  @Delete('delivery-man/delete')
  dmDelete() { return { message: 'deleted' }; }

  @HttpCode(200)
  @Post('delivery-man/status')
  dmStatus() { return { message: 'status updated' }; }

  @HttpCode(200)
  @Post('delivery-man/assign-deliveryman')
  dmAssign() { return { message: 'assigned' }; }

  // ── Coupons (vendor-managed) ─────────────────────────────────────
  @Get('coupon-list')
  vendorCouponList() { return { coupons: [], total_size: 0 }; }
  @HttpCode(200)
  @Post('coupon-store')
  vendorCouponStore() { return { message: 'coupon created' }; }
  @HttpCode(200)
  @Post('coupon-update')
  vendorCouponUpdate() { return { message: 'coupon updated' }; }
  @HttpCode(200)
  @Post('coupon-status')
  vendorCouponStatus() { return { message: 'status updated' }; }
  @HttpCode(200)
  @Delete('coupon-delete')
  vendorCouponDelete() { return { message: 'coupon deleted' }; }
  @Get('coupon/view-without-translate')
  vendorCouponView() { return {}; }

  // ── Wallet / payments / withdraw ─────────────────────────────────
  @Get('wallet-payment-list')
  walletPaymentList() { return { data: [], total_size: 0 }; }

  @HttpCode(200)
  @Post('make-collected-cash-payment')
  collectedCash() { return { message: 'recorded' }; }
  @HttpCode(200)
  @Post('make-wallet-adjustment')
  walletAdjustment() { return { message: 'recorded' }; }

  @Get('withdraw-method/list')
  async withdrawMethods() {
    if (this.useMongo()) {
      // Original Prisma filter uses `is_active: 1`; in Mongo we accept either
      // the numeric or boolean truthy value.
      const rows = await this.mongo.findMany<MongoWithdrawalMethodDoc>('withdrawal_methods', { $or: [{ is_active: 1 }, { is_active: true }] });
      return rows.map((r) => ({
        id: Number(r.mysql_id),
        method_name: r.method_name ?? null,
        method_fields: r.method_fields ?? null,
        is_default: r.is_default ?? null,
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
  @Get('get-withdraw-list')
  getWithdrawList() { return { data: [], total_size: 0 }; }
  @HttpCode(200)
  @Post('request-withdraw')
  requestWithdraw() { return { message: 'withdraw requested' }; }

  // ── Reports (zeros for demo, real ones would aggregate) ──────────
  /** All the report endpoints below are computed live from the orders
   *  collection — the Flutter UI gets non-empty grids/lines/totals instead
   *  of an infinite spinner. Restaurant-scoped via the logged-in vendor. */
  private async vendorOrdersForReports(req: AuthedRequest) {
    if (!this.useMongo()) return [] as Array<Record<string, unknown>>;
    const r = await this.mongo.findOne<MongoRestaurantDoc>('restaurants', { mysql_vendor_id: Number(req.actor!.id) });
    if (!r) return [] as Array<Record<string, unknown>>;
    return this.mongo.findMany<Record<string, unknown>>('orders', { mysql_restaurant_id: Number(r.mysql_id) });
  }

  @Get('earning-report')
  async earningReport(@Req() req: AuthedRequest) {
    const orders = await this.vendorOrdersForReports(req);
    const now = Date.now(), dayMs = 86_400_000;
    let total = 0, today = 0, week = 0, month = 0;
    for (const o of orders) {
      if (o.order_status !== 'delivered') continue;
      const earn = Number(o.order_amount ?? 0) - Number(o.delivery_charge ?? 0);
      total += earn;
      const ts = o.created_at ? new Date(o.created_at as string).getTime() : 0;
      if (!Number.isFinite(ts) || ts === 0) continue;
      const age = now - ts;
      if (age <= dayMs) today += earn;
      if (age <= 7 * dayMs) week += earn;
      if (age <= 30 * dayMs) month += earn;
    }
    return { total, today, this_week: week, this_month: month };
  }
  @Get('get-order-report')
  async orderReport(@Req() req: AuthedRequest) {
    const orders = await this.vendorOrdersForReports(req);
    let delivered = 0, canceled = 0, returned = 0, totalAmount = 0;
    const byDay: Record<string, number> = {};
    for (const o of orders) {
      if (o.order_status === 'delivered') { delivered++; totalAmount += Number(o.order_amount ?? 0); }
      if (o.order_status === 'canceled') canceled++;
      if (o.order_status === 'refunded') returned++;
      const dt = o.created_at ? new Date(o.created_at as string).toISOString().slice(0, 10) : null;
      if (dt) byDay[dt] = (byDay[dt] || 0) + 1;
    }
    return {
      delivered, canceled, returned, total_orders: orders.length, total_amount: totalAmount,
      data: Object.entries(byDay).sort().map(([day, count]) => ({ day, count })),
    };
  }
  @Get('get-food-wise-report')
  async foodReport(@Req() req: AuthedRequest) {
    const orders = await this.vendorOrdersForReports(req);
    const orderIds = orders.map((o) => Number(o.mysql_id));
    if (!this.useMongo() || orderIds.length === 0) return { data: [], total_data: [] };
    const items = await this.mongo.findMany<Record<string, unknown>>('order_details', { order_id: { $in: orderIds } });
    const byFood: Record<string, { food_id: number; total_sold_quantity: number; total_amount: number }> = {};
    for (const it of items) {
      const fid = Number(it.food_id ?? 0);
      if (!fid) continue;
      const qty = Number(it.quantity ?? 1);
      const price = Number(it.price ?? 0);
      if (!byFood[fid]) byFood[fid] = { food_id: fid, total_sold_quantity: 0, total_amount: 0 };
      byFood[fid].total_sold_quantity += qty;
      byFood[fid].total_amount += qty * price;
    }
    const sorted = Object.values(byFood).sort((a, b) => b.total_sold_quantity - a.total_sold_quantity);
    return { data: sorted, total_data: sorted };
  }
  @Get('get-campaign-order-report')
  campaignReport() { return { data: [], total_amount: 0, total_orders: 0 }; }
  @Get('get-tax-report')
  async taxReport(@Req() req: AuthedRequest) {
    const orders = await this.vendorOrdersForReports(req);
    let total = 0;
    const data = orders
      .filter((o) => o.order_status === 'delivered')
      .map((o) => {
        const tax = Number(o.total_tax_amount ?? 0);
        total += tax;
        return {
          order_id: Number(o.mysql_id),
          order_amount: Number(o.order_amount ?? 0),
          tax_amount: tax,
          created_at: o.created_at ?? null,
        };
      });
    return { data, total };
  }
  @Get('get-disbursement-report')
  disbursementReport() { return { data: [], total: 0 }; }
  @Get('get-expense')
  async expenseReport(@Req() req: AuthedRequest) {
    const orders = await this.vendorOrdersForReports(req);
    let total = 0;
    const data = orders
      .filter((o) => o.order_status === 'delivered')
      .map((o) => {
        const commission = Number(o.order_amount ?? 0) * 0.10; // demo 10%
        total += commission;
        return {
          order_id: Number(o.mysql_id),
          order_amount: Number(o.order_amount ?? 0),
          commission_amount: +commission.toFixed(2),
          created_at: o.created_at ?? null,
        };
      });
    return { data, total: +total.toFixed(2) };
  }
  @Get('get-transaction-report')
  async transactionReport(@Req() req: AuthedRequest) {
    const orders = await this.vendorOrdersForReports(req);
    let total = 0;
    const data = orders.map((o) => {
      const amt = Number(o.order_amount ?? 0);
      total += amt;
      return {
        order_id: Number(o.mysql_id),
        order_amount: amt,
        payment_method: o.payment_method ?? null,
        payment_status: o.payment_status ?? null,
        order_status: o.order_status ?? null,
        created_at: o.created_at ?? null,
      };
    });
    return { data, total };
  }
  @HttpCode(200)
  @Post('generate-transaction-statement')
  generateStatement() { return { message: 'not available in demo' }; }
  @Get('get-searched-food')
  searchedFood() { return { products: [] }; }

  // ── Notifications + messages ─────────────────────────────────────
  @Get('notifications')
  async vendorNotifications() {
    if (this.useMongo()) {
      const rows = await this.mongo.findMany<MongoNotificationDoc>(
        'notifications',
        { status: true },
        { sort: { mysql_id: -1 }, limit: 50 },
      );
      return rows.map((r) => ({ id: Number(r.mysql_id), title: r.title ?? null, description: r.description ?? null }));
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

  // ── Campaigns / advertisements / business plan ───────────────────
  @Get('get-basic-campaigns')
  basicCampaigns() { return []; }
  @HttpCode(200)
  @Post('campaign-join')
  campaignJoin() { return { message: 'joined' }; }
  @HttpCode(200)
  @Post('campaign-leave')
  campaignLeave() { return { message: 'left' }; }

  @Get('advertisement')
  async ads(@Req() req: AuthedRequest) {
    if (this.useMongo()) {
      const r = await this.mongo.findOne<MongoRestaurantDoc>('restaurants', { mysql_vendor_id: Number(req.actor!.id) });
      if (!r) return [];
      const rows = await this.mongo.findMany<MongoAdDoc>('advertisements', { mysql_restaurant_id: Number(r.mysql_id) });
      return rows.map((row) => ({
        ...(row.legacy ?? {}),
        ...row,
        id: Number(row.mysql_id),
        restaurant_id: row.mysql_restaurant_id !== null && row.mysql_restaurant_id !== undefined ? Number(row.mysql_restaurant_id) : 0,
        created_by_id: row.mysql_created_by_id !== null && row.mysql_created_by_id !== undefined ? Number(row.mysql_created_by_id) : 0,
      }));
    }
    const r = await this.prisma.restaurants.findFirst({ where: { vendor_id: req.actor!.id }, select: { id: true } });
    if (!r) return [];
    const rows = await this.prisma.advertisements.findMany({ where: { restaurant_id: r.id } });
    return rows.map((row) => ({ ...row, id: Number(row.id), restaurant_id: Number(row.restaurant_id), created_by_id: Number(row.created_by_id) }));
  }
  @Get('advertisement/details')
  adDetails() { return null; }
  @HttpCode(200)
  @Post('advertisement/store')
  adStore() { return { message: 'ad created' }; }
  @HttpCode(200)
  @Post('advertisement/update')
  adUpdate() { return { message: 'updated' }; }
  @HttpCode(200)
  @Post('advertisement/status')
  adStatus() { return { message: 'status updated' }; }
  @HttpCode(200)
  @Post('advertisement/copy-add-post')
  adCopy() { return { message: 'copied' }; }
  @HttpCode(200)
  @Delete('advertisement/delete')
  adDelete() { return { message: 'deleted' }; }

  @Get('business_plan')
  async businessPlan(@Req() req: AuthedRequest) {
    const r = this.useMongo()
      ? await this.mongo.findOne<MongoRestaurantDoc>('restaurants', { mysql_vendor_id: Number(req.actor!.id) })
      : null;
    return {
      commission: 1,
      subscription: 0,
      commission_rate: r?.comission ?? 0,
      restaurant_id: r ? Number(r.mysql_id) : null,
      restaurant_name: r?.name ?? null,
    };
  }

  @Get('package-view')
  packageView() {
    return {
      package: {
        id: 1, package_name: 'Commission-base Plan',
        commission_status: 1, commission: 0,
        package_type: 'commission', validity: 0,
        price: 0, plan_type: 'free',
      },
      transactions: [],
    };
  }

  /** Flutter's My Business Plan page calls this with GET — the old POST
   *  stub silently 404'd. Returns paginated empty list with metadata so
   *  the page renders "No transactions yet" instead of spinning. */
  @Get('subscription-transaction')
  subscriptionTransactionsList() {
    return { transactions: [], total_size: 0, limit: 10, offset: 1 };
  }
  @HttpCode(200)
  @Post('subscription-transaction')
  subscriptionTransaction() { return { message: 'recorded' }; }
  @Get('subscription/payment/api')
  subscriptionPayment() { return { redirect_url: null }; }
  @HttpCode(200)
  @Post('cancel-subscription')
  cancelSubscription() { return { message: 'canceled' }; }

  // ── Schedule + restaurant config ─────────────────────────────────
  @Get('schedule')
  async schedule(@Req() req: AuthedRequest) {
    if (this.useMongo()) {
      const r = await this.mongo.findOne<MongoRestaurantDoc>('restaurants', { mysql_vendor_id: Number(req.actor!.id) });
      if (!r) return [];
      const rows = await this.mongo.findMany<MongoScheduleDoc>('restaurant_schedule', { mysql_restaurant_id: Number(r.mysql_id) });
      return rows.map((row) => ({
        ...(row.legacy ?? {}),
        ...row,
        id: Number(row.mysql_id),
        restaurant_id: row.mysql_restaurant_id !== null && row.mysql_restaurant_id !== undefined ? Number(row.mysql_restaurant_id) : 0,
      }));
    }
    const r = await this.prisma.restaurants.findFirst({ where: { vendor_id: req.actor!.id }, select: { id: true } });
    if (!r) return [];
    const rows = await this.prisma.restaurant_schedule.findMany({ where: { restaurant_id: r.id } });
    return rows.map((row) => ({ ...row, id: Number(row.id), restaurant_id: Number(row.restaurant_id) }));
  }
  @HttpCode(200)
  @Post('schedule/store')
  scheduleStore() { return { message: 'schedule saved' }; }

  // ── POS ──────────────────────────────────────────────────────────
  @Get('pos/customers')
  posCustomers() { return { users: [], total_size: 0 }; }
  @Get('pos/orders')
  posOrders() { return { orders: [], total_size: 0 }; }
  @HttpCode(200)
  @Post('pos/place-order')
  posPlaceOrder() { return { message: 'pos not available in demo' }; }

  @Get('get-characteristic-suggestion')
  characteristicSuggestions() { return []; }
}
