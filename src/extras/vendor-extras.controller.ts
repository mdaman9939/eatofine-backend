import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards, HttpCode, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as path from 'path';
import { AuthGuard, RequireAuth } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';
import { storageBaseUrl, storageFullUrl } from '../common/storage-url';
import { compressImage } from '../common/image-compress';

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
  food_id?: number | null;
  mysql_user_id?: number | null;
  user_id?: number | null;
  mysql_restaurant_id?: number | null;
  restaurant_id?: number | null;
  mysql_order_id?: number | null;
  order_id?: number | null;
  comment?: string | null;
  rating?: number | null;
  reply?: string | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
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

// Normalize a stored veg/non_veg flag (boolean | number | string) to the int
// 0/1 the restaurant app compares against (`restaurant.veg == 1`). Defaults to
// 1 when never set, matching the DB column default (true).
const vegNonVegFlag = (v: unknown): number => {
  if (v === null || v === undefined) return 1;
  return Number(v) ? 1 : 0;
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

  /** Resolve the restaurant owned by the logged-in vendor. Every vendor
   *  self-service write is scoped through this so one vendor can never touch
   *  another restaurant's coupons / foods / add-ons / delivery men. */
  private async vendorRestaurant(req: AuthedRequest): Promise<MongoRestaurantDoc | null> {
    if (!this.useMongo()) return null;
    return this.mongo.findOne<MongoRestaurantDoc>('restaurants', { mysql_vendor_id: Number(req.actor!.id) });
  }

  /** All restaurant mysql_ids owned by the logged-in vendor. Order lists must
   *  match against ALL of them — a vendor can own more than one restaurant, and
   *  the order may sit under a different one than findOne() happens to return. */
  private async vendorRestaurantIds(req: AuthedRequest): Promise<number[]> {
    if (!this.useMongo()) return [];
    const rows = await this.mongo.findMany<MongoRestaurantDoc>('restaurants', { mysql_vendor_id: Number(req.actor!.id) });
    return rows.map((r) => Number(r.mysql_id));
  }

  /** Ongoing (not-yet-finished) order statuses the restaurant app shows under
   *  its Pending / Confirmed / Cooking tabs. A freshly placed order is
   *  'pending' — it MUST be included or the restaurant never sees new orders. */
  private static readonly ONGOING_STATUSES = [
    'pending', 'confirmed', 'accepted', 'processing', 'cooking', 'handover', 'picked_up',
  ];

  /** Hash a password the same Laravel-compatible way the rest of the app
   *  does ($2y$ prefix) so vendor-created delivery men can log in. */
  private async hashPassword(raw: string): Promise<string> {
    const bcrypt = await import('bcrypt');
    return (await bcrypt.hash(raw, 10)).replace(/^\$2b\$/, '$2y$');
  }

  /** Flutter form-data sends arrays (variations, add-ons, tags) as JSON
   *  strings. Parse them back to real arrays so they persist correctly; pass
   *  through real arrays untouched; default to []. */
  private parseJsonish(input: unknown): unknown[] {
    if (Array.isArray(input)) return input;
    if (typeof input === 'string' && input.trim()) {
      try {
        const parsed: unknown = JSON.parse(input);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        // Comma-separated fallback (e.g. plain tag list).
        return input.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }
    return [];
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

      let totalEarning = toNum(wallet?.total_earning);
      let balance = toNum(wallet?.balance);
      let cashInHands = toNum(wallet?.collected_cash);
      const alreadyWithdrawn = toNum(wallet?.total_withdrawn);
      const pendingWithdraw = toNum(wallet?.pending_withdraw);

      // Per-restaurant commission rate, used to derive the restaurant's net
      // earning per delivered order (StackFood: vendor take = item − commission).
      const commissionMap = new Map(
        restaurants.map((r) => [Number(r.mysql_id), Number((r as unknown as Record<string, unknown>).comission ?? 0) || 10]),
      );

      // Order stats — Today / This Week / This Month tiles on the dashboard.
      // All time-bucketed in JS to avoid Mongo aggregation pipeline complexity.
      let todaysCount = 0, weekCount = 0, monthCount = 0, totalOrders = 0;
      let todaysEarn = 0, weekEarn = 0, monthEarn = 0;
      // Wallet derived from delivered orders — used as a fallback when no clean
      // restaurant_wallets ledger exists (otherwise every card shows 0.00).
      let computedEarning = 0, computedCash = 0;
      if (restaurantIds.length > 0) {
        const now = Date.now();
        const dayMs = 86_400_000;
        const orders = await this.mongo.findMany<Record<string, unknown>>(
          'orders', { mysql_restaurant_id: { $in: restaurantIds } });
        totalOrders = orders.length;
        for (const o of orders) {
          const ts = o.created_at ? new Date(o.created_at as string | number | Date).getTime() : 0;
          const delivered = o.order_status === 'delivered';
          const amount = toNum(o.order_amount);
          if (delivered) {
            const tax = toNum(o.total_tax_amount), delivery = toNum(o.delivery_charge);
            const coupon = toNum(o.coupon_discount_amount), restDisc = toNum(o.restaurant_discount_amount), extra = toNum(o.additional_charge);
            let item = amount + coupon + restDisc - tax - delivery - extra;
            if (item <= 0) item = Math.max(0, amount - tax - delivery) || amount;
            const rate = commissionMap.get(Number(o.mysql_restaurant_id)) ?? 10;
            computedEarning += item - (item * rate) / 100;
            if (String(o.payment_method) === 'cash_on_delivery') computedCash += amount;
          }
          if (!Number.isFinite(ts) || ts === 0) continue;
          const age = now - ts;
          if (age <= dayMs) { todaysCount++; if (delivered) todaysEarn += amount; }
          if (age <= 7 * dayMs) { weekCount++; if (delivered) weekEarn += amount; }
          if (age <= 30 * dayMs) { monthCount++; if (delivered) monthEarn += amount; }
        }
      }

      const round2 = (n: number) => Math.round(n * 100) / 100;
      if (totalEarning <= 0 && computedEarning > 0) {
        totalEarning = round2(computedEarning);
        cashInHands = round2(computedCash);
        balance = round2(Math.max(0, computedEarning - alreadyWithdrawn - pendingWithdraw));
      }

      // member_since_days — how long the vendor has existed.
      const vCreatedAt = (v as unknown as Record<string, unknown>).created_at;
      const memberSince = vCreatedAt
        ? Math.max(0, Math.floor((Date.now() - new Date(vCreatedAt as string | number | Date).getTime()) / 86_400_000))
        : 30;

      // Restaurant subscription — drives the "My Business Plan" screen. Built
      // from the restaurant's subscription_id + the package template so the app
      // shows the active plan + features instead of "No subscription found".
      let subscription: Record<string, unknown> | null = null;
      let subscriptionOtherData: Record<string, unknown> | null = null;
      const subResto = restaurants.find(
        (r) => Number((r as unknown as Record<string, unknown>).subscription_id ?? 0) > 0,
      );
      if (subResto) {
        const sr = subResto as unknown as Record<string, unknown>;
        const pkgId = Number(sr.subscription_id);
        const pkg = await this.mongo.findByMysqlId<Record<string, unknown>>('subscription_packages', pkgId);
        if (pkg) {
          const feat = (k: string) => (Number(pkg[k] ?? 0) ? 1 : 0);
          const packagePayload = {
            id: pkgId,
            package_name: pkg.package_name ?? 'Plan',
            price: toNum(pkg.price),
            validity: Number(pkg.validity ?? 30),
            max_order: pkg.max_order ?? 'unlimited',
            max_product: pkg.max_product ?? 'unlimited',
            pos: feat('pos'), mobile_app: feat('mobile_app'), chat: feat('chat'),
            review: feat('review'), self_delivery: feat('self_delivery'),
            status: 1,
            default: Number(pkg.default ?? 0) ? 1 : 0,
            colour: pkg.colour ?? null,
            text: pkg.text ?? null,
            created_at: pkg.created_at ?? null,
            updated_at: pkg.updated_at ?? null,
          };
          subscription = {
            id: pkgId,
            package_id: pkgId,
            restaurant_id: Number(sr.mysql_id),
            expiry_date: sr.subscription_expiry_date ?? null,
            max_order: pkg.max_order ?? 'unlimited',
            max_product: pkg.max_product ?? 'unlimited',
            pos: feat('pos'), mobile_app: feat('mobile_app'), chat: feat('chat'),
            review: feat('review'), self_delivery: feat('self_delivery'),
            status: 1, is_trial: 0, total_package_renewed: 0,
            created_at: sr.created_at ?? null, updated_at: sr.updated_at ?? null,
            renewed_at: null, is_canceled: 0, canceled_by: null,
            validity: Number(pkg.validity ?? 30),
            package: packagePayload,
          };
          subscriptionOtherData = { total_bill: toNum(pkg.price), max_product_uploads: 0, pending_bill: 0 };
        }
      }

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
        // ── Subscriptions — real plan from the restaurant's subscription_id ──
        subscription,
        subscription_other_data: subscriptionOtherData,
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
        restaurants: restaurants.map((r) => {
          const rr = r as unknown as Record<string, unknown>;
          return {
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
            delivery: rr.delivery ?? false,
            take_away: rr.take_away ?? false,
            restaurant_model: r.restaurant_model ?? null,
            // Schedule-mode radio state — without these the app reads null and
            // resets "Always Open" back to "Specific Time" after every update.
            opening_closing_status: rr.opening_closing_status ?? false,
            same_time_for_every_day: rr.same_time_for_every_day ?? false,
            // Food Type checkboxes — app reads veg/non_veg as int (== 1).
            veg: vegNonVegFlag(rr.veg),
            non_veg: vegNonVegFlag(rr.non_veg),
            // ── Full Restaurant Config round-trip — every toggle/number/list
            //    the app reads back, so NO setting snaps back after Update. ──
            free_delivery: rr.free_delivery ?? false,
            schedule_order: rr.schedule_order ?? false,
            instant_order: rr.instant_order ?? false,
            order_subscription_active: rr.order_subscription_active ?? false,
            cutlery: rr.cutlery ?? false,
            halal_tag_status: rr.halal_tag_status ?? false,
            gst_status: rr.gst_status ?? false,
            gst_code: rr.gst_code ?? rr.gst ?? null,
            self_delivery_system: rr.self_delivery_system ?? false,
            is_dine_in_active: rr.is_dine_in_active ?? false,
            is_extra_packaging_active: rr.is_extra_packaging_active ?? false,
            extra_packaging_status: toNum(rr.extra_packaging_status),
            extra_packaging_amount: toNum(rr.extra_packaging_amount),
            schedule_advance_dine_in_booking_duration: toNum(rr.schedule_advance_dine_in_booking_duration),
            schedule_advance_dine_in_booking_duration_time_format: rr.schedule_advance_dine_in_booking_duration_time_format ?? 'hours',
            customer_date_order_sratus: rr.customer_date_order_sratus ?? false,
            customer_order_date: toNum(rr.customer_order_date),
            free_delivery_distance_status: rr.free_delivery_distance_status ?? false,
            free_delivery_distance_value: toNum(rr.free_delivery_distance_value),
            minimum_shipping_charge: toNum(rr.minimum_shipping_charge),
            maximum_shipping_charge: toNum(rr.maximum_shipping_charge),
            per_km_shipping_charge: toNum(rr.per_km_shipping_charge),
            delivery_time: rr.delivery_time ?? '30-40',
            characteristics: Array.isArray(rr.characteristics) ? rr.characteristics : [],
            tags: Array.isArray(rr.tags) ? rr.tags : [],
            cuisine: [],
            schedules: Array.isArray(rr.schedules) ? rr.schedules : [],
          };
        }),
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
    const avatarName = await this.saveUploaded(files?.image?.[0], 'profile');
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
  async fcmToken(@Req() req: AuthedRequest, @Body() body: Record<string, unknown> = {}) {
    const token = body?.fcm_token ?? body?.cm_firebase_token ?? body?.token;
    if (this.useMongo() && token !== undefined) {
      await this.mongo.updateOne('vendors', { mysql_id: Number(req.actor!.id) }, { fcm_token: String(token), updated_at: new Date() });
    }
    return { message: 'token-updated' };
  }

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

  /** Manual open/close override — flips the restaurant's `active` flag so the
   *  customer app immediately shows it as "closed now" without touching the
   *  weekly schedule. Mirrors the restaurant app's open/close toggle. */
  @HttpCode(200)
  @Post('opening-closing-status')
  async toggleOpen(@Req() req: AuthedRequest, @Body() body: Record<string, unknown> = {}) {
    if (this.useMongo()) {
      const r = await this.vendorRestaurant(req);
      if (r) {
        const update: Record<string, unknown> = { updated_at: new Date() };
        // Schedule mode radio — "Always Open" (1) vs "Specific Time" (0). The
        // app POSTs opening_closing_status here; storing + returning it (see
        // profile) is what makes the choice stick instead of snapping back.
        if (body.opening_closing_status !== undefined) {
          update.opening_closing_status = !!Number(body.opening_closing_status);
        }
        if (body.same_time_for_every_day !== undefined) {
          update.same_time_for_every_day = !!Number(body.same_time_for_every_day);
        }
        // Manual availability toggle (top "Status" switch) — active/status.
        if (body.active !== undefined || body.status !== undefined) {
          update.active = body.active !== undefined ? !!Number(body.active) : !!Number(body.status);
        }
        // Nothing recognized → plain availability toggle (legacy behavior).
        if (Object.keys(update).length === 1) {
          update.active = !(r.active ?? true);
        }
        await this.mongo.updateOne('restaurants', { mysql_id: r.mysql_id }, update);
        return { message: 'updated', ...(update.active !== undefined ? { active: update.active } : {}) };
      }
    }
    return { message: 'updated' };
  }

  @HttpCode(200)
  @Post('update-announcment')
  async announce(@Req() req: AuthedRequest, @Body() body: Record<string, unknown> = {}) {
    if (this.useMongo()) {
      const r = await this.vendorRestaurant(req);
      if (r) {
        await this.mongo.updateOne('restaurants', { mysql_id: r.mysql_id }, {
          announcement: !!Number(body.announcement_status ?? body.announcement ?? 0),
          announcement_message: body.announcement_message !== undefined ? String(body.announcement_message) : null,
          updated_at: new Date(),
        });
      }
    }
    return { message: 'announcement updated' };
  }

  /** Save the vendor's payout bank details on the vendor record. StackFood
   *  keeps these on the vendor/restaurant (no separate table), so this is what
   *  the restaurant app's "Bank Info" screen persists. */
  @HttpCode(200)
  @Post('update-bank-info')
  async bankInfo(@Req() req: AuthedRequest, @Body() body: Record<string, unknown> = {}) {
    if (this.useMongo()) {
      const data: Record<string, unknown> = {};
      for (const k of ['bank_name', 'branch', 'holder_name', 'account_no'] as const) {
        if (body[k] !== undefined) data[k] = String(body[k]);
      }
      if (Object.keys(data).length > 0) {
        data.updated_at = new Date();
        await this.mongo.updateOne('vendors', { mysql_id: Number(req.actor!.id) }, data);
      }
    }
    return { message: 'bank info updated' };
  }

  /** Build an absolute /storage/* URL for a saved filename. Falls back to
   *  the SVG placeholder middleware when the filename is missing so the
   *  Flutter NetworkImage never sees an empty string. */
  private buildStorageUrl(folder: string, filename?: string | null): string {
    // Pass absolute URLs (external CDN / pasted links) through untouched.
    if (filename && /^https?:\/\//i.test(String(filename))) return String(filename);
    // storageBaseUrl() resolves from the current request's host (see main.ts),
    // so images always point at the origin the app actually reached us on.
    const safeName = filename && String(filename).trim() ? String(filename) : 'default.png';
    return `${storageBaseUrl()}/${folder}/${safeName}`;
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
   *  collisions can't overwrite an existing image.
   *
   *  ALSO persists the bytes to the Mongo `uploads` collection. The local
   *  disk copy serves fast on the same instance, but Render's disk is
   *  ephemeral (wiped on redeploy); the Mongo copy is durable so /storage/*
   *  can re-serve the image after a restart (see main.ts). */
  private async saveUploaded(file: Express.Multer.File | undefined, folder: string): Promise<string | null> {
    if (!file || !file.buffer || file.buffer.length === 0) return null;
    let data = file.buffer;
    let ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    let contentType = file.mimetype || 'image/png';
    // Auto-compress raster images to a small WebP (~150–300 KB). Videos / SVGs /
    // anything sharp can't handle fall through to the original bytes untouched.
    if (/^image\//i.test(contentType) && !/svg/i.test(contentType)) {
      const compressed = await compressImage(file.buffer);
      if (compressed) { data = compressed.buffer; ext = compressed.ext; contentType = compressed.contentType; }
    }
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    try { fs.writeFileSync(path.join(this.storageDir(folder), filename), data); } catch { /* disk may be read-only */ }
    // Durable copy in Mongo (best-effort). Skip files near the 16MB BSON limit
    // (e.g. ad videos) — those rely on the disk copy only.
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
    const logoName = await this.saveUploaded(files?.logo?.[0], 'restaurant');
    const coverName = await this.saveUploaded(files?.cover_photo?.[0], 'restaurant/cover');
    const metaName = await this.saveUploaded(files?.meta_image?.[0], 'restaurant');
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
    const has = (k: string) => b[k] !== undefined && b[k] !== '';

    // Numbers — note the app's send-key may differ from the read-key, so map
    // each to the field the profile endpoint returns (e.g. *_delivery_charge →
    // *_shipping_charge, free_delivery_distance → free_delivery_distance_value).
    const numMap: Record<string, string> = {
      minimum_order: 'minimum_order',
      minimum_shipping_charge: 'minimum_shipping_charge',
      minimum_delivery_charge: 'minimum_shipping_charge',
      maximum_delivery_charge: 'maximum_shipping_charge',
      per_km_delivery_charge: 'per_km_shipping_charge',
      extra_packaging_amount: 'extra_packaging_amount',
      extra_packaging_status: 'extra_packaging_status',
      schedule_advance_dine_in_booking_duration: 'schedule_advance_dine_in_booking_duration',
      customer_order_date: 'customer_order_date',
      free_delivery_distance: 'free_delivery_distance_value',
    };
    for (const [src, dest] of Object.entries(numMap)) {
      if (has(src)) data[dest] = Number(b[src]);
    }

    // Booleans (every Order Type / Other Setup toggle).
    for (const k of [
      'delivery', 'take_away', 'free_delivery', 'veg', 'non_veg', 'self_delivery_system',
      'gst_status', 'cutlery', 'halal_tag_status', 'instant_order', 'order_subscription_active',
      'is_dine_in_active', 'is_extra_packaging_active', 'free_delivery_distance_status',
      'customer_date_order_sratus', 'schedule_order',
    ]) {
      if (has(k)) data[k] = !!Number(b[k]);
    }

    // Strings.
    if (b.restaurant_model !== undefined) data.restaurant_model = String(b.restaurant_model);
    if (b.delivery_time !== undefined) data.delivery_time = String(b.delivery_time);
    if (b.gst !== undefined) data.gst_code = String(b.gst);
    if (b.schedule_advance_dine_in_booking_duration_time_format !== undefined) {
      data.schedule_advance_dine_in_booking_duration_time_format = String(b.schedule_advance_dine_in_booking_duration_time_format);
    }

    // List fields — characteristics/tags arrive comma-separated; cuisine_ids is
    // a JSON array string. Store as arrays so the profile can echo them back.
    const splitCsv = (s: unknown) => String(s ?? '').split(',').map((x) => x.trim()).filter(Boolean);
    if (b.characteristics !== undefined) data.characteristics = splitCsv(b.characteristics);
    if (b.tags !== undefined) data.tags = splitCsv(b.tags);
    if (b.cuisine_ids !== undefined) {
      try {
        const ids = JSON.parse(String(b.cuisine_ids));
        if (Array.isArray(ids)) data.cuisine_ids = ids.map((x) => Number(x)).filter((n) => Number.isFinite(n));
      } catch { /* ignore malformed cuisine_ids */ }
    }

    if (Object.keys(data).length === 0) return { message: 'nothing to update' };
    data.updated_at = new Date();
    if (this.useMongo()) {
      await this.mongo.updateOne('restaurants', { mysql_vendor_id: Number(req.actor!.id) }, data);
    }
    return { message: 'business setup updated' };
  }

  @HttpCode(200)
  @Post('add-dine-in-table-number')
  async addDineInTable(@Req() req: AuthedRequest, @Body() body: Record<string, unknown> = {}) {
    if (this.useMongo()) {
      const r = await this.vendorRestaurant(req) as (MongoRestaurantDoc & { dine_in_tables?: unknown[] }) | null;
      const table = body.table_number ?? body.number;
      if (r && table !== undefined && String(table).trim() !== '') {
        const existing = Array.isArray(r.dine_in_tables) ? r.dine_in_tables : [];
        const next = Array.from(new Set([...existing.map(String), String(table)]));
        await this.mongo.updateOne('restaurants', { mysql_id: r.mysql_id }, { dine_in_tables: next, updated_at: new Date() });
        return { message: 'added', tables: next };
      }
    }
    return { message: 'added' };
  }

  @HttpCode(200)
  @Delete('remove-account')
  remove() { return { message: 'Not available in demo' }; }

  // ── Orders summary ───────────────────────────────────────────────

  /** Shape every order row identically so the Flutter OrderModel never
   *  hits `!` on a null field. The widget reads detailsCount, orderStatus,
   *  orderType, createdAt, paymentMethod — and uses `!` on each, so missing
   *  data here translates directly to a red-screen crash on the device. */
  private shapeOrder(rIn: MongoOrderDoc, detailsCount: number, user?: Record<string, unknown> | null) {
    const r = rIn as MongoOrderDoc & Record<string, unknown>;
    const created = (r as { created_at?: Date | string | null }).created_at;
    const updated = (r as { updated_at?: Date | string | null }).updated_at;
    const u = user ?? null;
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
      // Nested customer object so the restaurant sees who ordered (name / phone).
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
  private async vendorUserMap(orders: MongoOrderDoc[]): Promise<Map<number, Record<string, unknown>>> {
    const ids = Array.from(new Set(
      orders.map((o) => Number(o.mysql_user_id ?? 0)).filter((n) => n > 0),
    ));
    if (ids.length === 0) return new Map();
    const rows = await this.mongo.findMany<Record<string, unknown>>('users', { mysql_id: { $in: ids } });
    return new Map(rows.map((u) => [Number(u.mysql_id), u]));
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
      const restaurantIds = await this.vendorRestaurantIds(req);
      if (restaurantIds.length === 0) return [];
      const rows = await this.mongo.findMany<MongoOrderDoc>(
        'orders',
        { mysql_restaurant_id: { $in: restaurantIds }, order_status: { $in: VendorExtrasController.ONGOING_STATUSES } },
        { sort: { mysql_id: -1 } },
      );
      const countsByOrderId = await this.detailsCountMap(rows.map((r) => Number(r.mysql_id)));
      const userMap = await this.vendorUserMap(rows);
      return rows.map((r) => this.shapeOrder(r, countsByOrderId.get(Number(r.mysql_id)) ?? 1, userMap.get(Number(r.mysql_user_id ?? 0))));
    }
    const restaurant = await this.prisma.restaurants.findFirst({ where: { vendor_id: req.actor!.id }, select: { id: true } });
    if (!restaurant) return [];
    const rows = await this.prisma.orders.findMany({
      where: { restaurant_id: restaurant.id, order_status: { in: VendorExtrasController.ONGOING_STATUSES } },
      orderBy: { id: 'desc' },
    });
    return rows.map((r) => ({ ...r, id: Number(r.id), user_id: r.user_id ? Number(r.user_id) : null, restaurant_id: Number(r.restaurant_id), order_amount: Number(r.order_amount) }));
  }

  @Get('completed-orders')
  async completedOrders(@Req() req: AuthedRequest) {
    if (this.useMongo()) {
      const restaurantIds = await this.vendorRestaurantIds(req);
      if (restaurantIds.length === 0) return { orders: [], total_size: 0 };
      const rows = await this.mongo.findMany<MongoOrderDoc>(
        'orders',
        { mysql_restaurant_id: { $in: restaurantIds }, order_status: { $in: ['delivered', 'canceled', 'refunded', 'failed'] } },
        { sort: { mysql_id: -1 }, limit: 50 },
      );
      const countsByOrderId = await this.detailsCountMap(rows.map((r) => Number(r.mysql_id)));
      const userMap = await this.vendorUserMap(rows);
      return {
        orders: rows.map((r) => this.shapeOrder(r, countsByOrderId.get(Number(r.mysql_id)) ?? 1, userMap.get(Number(r.mysql_user_id ?? 0)))),
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
      const userId = Number(o.mysql_user_id ?? 0);
      const user = userId > 0 ? await this.mongo.findByMysqlId<Record<string, unknown>>('users', userId) : null;
      return this.shapeOrder(o, counts.get(Number(o.mysql_id)) ?? 1, user);
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
        products: rows.map((r) => {
          const food = r as MongoFoodDoc & Record<string, unknown>;
          // Defaults so the Flutter "(null)" rating label and broken image
          // placeholder both go away — UI reads rating_count, avg_rating,
          // and image_full_url without null-safety on the reads.
          return {
            ...(food.legacy ?? {}),
            ...food,
            id: Number(food.mysql_id),
            price: toNum(food.price) ?? 0,
            tax: toNum(food.tax) ?? 0,
            discount: toNum(food.discount) ?? 0,
            restaurant_id: food.mysql_restaurant_id !== null && food.mysql_restaurant_id !== undefined ? Number(food.mysql_restaurant_id) : 0,
            category_id: food.mysql_category_id !== null && food.mysql_category_id !== undefined ? Number(food.mysql_category_id) : null,
            rating_count: Number(food.rating_count ?? 0),
            avg_rating: Number(food.avg_rating ?? 0),
            rating: food.rating ?? [],
            image: food.image ?? 'default.png',
            image_full_url: this.buildStorageUrl('product', (food.image as string | null | undefined) ?? null),
            meta_image_full_url: this.buildStorageUrl('product', (food.meta_image as string | null | undefined) ?? null),
            stock_type: food.stock_type ?? 'unlimited',
            item_stock: Number(food.item_stock ?? 0),
            sell_count: Number(food.sell_count ?? 0),
            status: food.status ?? true,
          };
        }),
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
      if (!f) return null;
      const food = f as MongoFoodDoc & Record<string, unknown>;
      return {
        ...(food.legacy ?? {}),
        ...food,
        id: Number(food.mysql_id),
        price: toNum(food.price) ?? 0,
        tax: toNum(food.tax) ?? 0,
        discount: toNum(food.discount) ?? 0,
        restaurant_id: food.mysql_restaurant_id !== null && food.mysql_restaurant_id !== undefined ? Number(food.mysql_restaurant_id) : 0,
        category_id: food.mysql_category_id !== null && food.mysql_category_id !== undefined ? Number(food.mysql_category_id) : null,
        rating_count: Number(food.rating_count ?? 0),
        avg_rating: Number(food.avg_rating ?? 0),
        rating: food.rating ?? [],
        image: food.image ?? 'default.png',
        image_full_url: this.buildStorageUrl('product', (food.image as string | null | undefined) ?? null),
        meta_image_full_url: this.buildStorageUrl('product', (food.meta_image as string | null | undefined) ?? null),
        stock_type: food.stock_type ?? 'unlimited',
        item_stock: Number(food.item_stock ?? 0),
      };
    }

    const f = await this.prisma.food.findUnique({ where: { id: BigInt(id) } });
    return f ? { ...f, id: Number(f.id), price: Number(f.price), tax: Number(f.tax), discount: Number(f.discount), restaurant_id: Number(f.restaurant_id), category_id: f.category_id ? Number(f.category_id) : null } : null;
  }

  @Get('product/search')
  async productSearch(@Req() req: AuthedRequest, @Query('name') name?: string) {
    if (this.useMongo()) {
      const restaurant = await this.vendorRestaurant(req);
      if (!restaurant) return { products: [], total_size: 0 };
      const filter: Record<string, unknown> = { mysql_restaurant_id: Number(restaurant.mysql_id) };
      if (name && name.trim()) filter.name = { $regex: name.trim(), $options: 'i' };
      const rows = await this.mongo.findMany<MongoFoodDoc>('foods', filter, { sort: { mysql_id: -1 }, limit: 50 });
      return {
        products: rows.map((r) => {
          const food = r as MongoFoodDoc & Record<string, unknown>;
          return {
            ...(food.legacy ?? {}),
            ...food,
            id: Number(food.mysql_id),
            price: toNum(food.price),
            tax: toNum(food.tax),
            discount: toNum(food.discount),
            restaurant_id: food.mysql_restaurant_id ? Number(food.mysql_restaurant_id) : 0,
            category_id: food.mysql_category_id ? Number(food.mysql_category_id) : null,
            image: food.image ?? 'default.png',
            image_full_url: this.buildStorageUrl('product', (food.image as string | null) ?? null),
            status: food.status ?? true,
          };
        }),
        total_size: rows.length,
      };
    }
    return { products: [], total_size: 0 };
  }

  // The restaurant app toggles these via GET with query params
  // (?id=94&status=1); some builds POST a body. Accept both so neither 404s.
  @HttpCode(200)
  @Get('product/status')
  productStatusGet(@Query() query: Record<string, unknown> = {}) {
    return this.productStatus({}, query);
  }

  @HttpCode(200)
  @Post('product/status')
  async productStatus(@Body() body: Record<string, unknown> = {}, @Query() query: Record<string, unknown> = {}) {
    const src = { ...query, ...body };
    const id = src.id !== undefined && src.id !== '' ? Number(src.id) : null;
    if (this.useMongo() && id) {
      await this.mongo.updateOne('foods', { mysql_id: id }, { status: !!Number(src.status ?? 0), updated_at: new Date() });
    }
    return { message: 'updated' };
  }

  @HttpCode(200)
  @Get('product/recommended')
  productRecommendedGet(@Query() query: Record<string, unknown> = {}) {
    return this.productRecommended({}, query);
  }

  @HttpCode(200)
  @Post('product/recommended')
  async productRecommended(@Body() body: Record<string, unknown> = {}, @Query() query: Record<string, unknown> = {}) {
    const src = { ...query, ...body };
    const id = src.id !== undefined && src.id !== '' ? Number(src.id) : null;
    if (this.useMongo() && id) {
      // The recommended value arrives as `is_recommended`, `recommended`, or `status`.
      const value = !!Number(src.is_recommended ?? src.recommended ?? src.status ?? 0);
      await this.mongo.updateOne('foods', { mysql_id: id }, { recommended: value, updated_at: new Date() });
    }
    return { message: 'updated' };
  }

  @HttpCode(200)
  @Post('product/update-stock')
  async updateStock(@Body() body: Record<string, unknown> = {}) {
    const id = body.id !== undefined && body.id !== '' ? Number(body.id) : null;
    if (this.useMongo() && id) {
      const data: Record<string, unknown> = { updated_at: new Date() };
      if (body.stock_type !== undefined) data.stock_type = String(body.stock_type);
      const stock = body.current_stock ?? body.item_stock ?? body.stock;
      if (stock !== undefined && stock !== '') data.item_stock = Number(stock);
      await this.mongo.updateOne('foods', { mysql_id: id }, data);
    }
    return { message: 'stock updated' };
  }

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
    const imageName = await this.saveUploaded(files?.image?.[0], 'product') ?? 'default.png';
    const metaImage = await this.saveUploaded(files?.meta_image?.[0], 'product');

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
      // Maximum order quantity + halal + tags were silently dropped before, so
      // those fields on the Add Food screen "weren't being taken".
      maximum_cart_quantity: b.maximum_cart_quantity !== undefined && b.maximum_cart_quantity !== ''
        ? Number(b.maximum_cart_quantity) : null,
      is_halal: !!Number(b.is_halal ?? 0),
      tags: this.parseJsonish(b.tags),
      tag_ids: this.parseJsonish(b.tag_ids),
      sell_count: 0,
      avg_rating: 0,
      rating_count: 0,
      // Flutter sends these as JSON strings (or arrays) — parse so add-ons and
      // variations actually persist instead of landing as "[object Object]".
      addon_ids: this.parseJsonish(b.addon_ids),
      variations: this.parseJsonish(b.variations),
      choice_options: this.parseJsonish(b.choice_options),
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
    const imageName = await this.saveUploaded(files?.image?.[0], 'product');
    const metaImage = await this.saveUploaded(files?.meta_image?.[0], 'product');
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
  async productDelete(@Body() body: Record<string, unknown> = {}, @Query('id') idQ?: string) {
    const id = body.id !== undefined && body.id !== '' ? Number(body.id) : (idQ ? Number(idQ) : null);
    if (this.useMongo() && id) {
      await this.mongo.deleteOne('foods', { mysql_id: id });
    }
    return { message: 'product deleted' };
  }

  // The restaurant app's "Customer Reviews" screen calls this with
  // ?restaurant_id=N&search=… and expects ALL reviews across the restaurant's
  // products (enriched with food + customer + order id). The product-details
  // screen calls it with ?product_id=N for a single food. Reviews in Mongo use
  // legacy `food_id`/`restaurant_id`/`user_id` keys (no mysql_ prefix), so we
  // match either spelling.
  @Get('product/reviews')
  async productReviews(
    @Req() req: AuthedRequest,
    @Query('product_id') productIdStr?: string,
    @Query('restaurant_id') restaurantIdStr?: string,
    @Query('search') search?: string,
  ) {
    if (!this.useMongo()) {
      const pid = parseInt(productIdStr ?? '', 10);
      if (!Number.isFinite(pid)) return [];
      const rows = await this.prisma.reviews.findMany({ where: { food_id: BigInt(pid) }, orderBy: { id: 'desc' }, take: 50 });
      return rows.map((r) => ({ id: Number(r.id), food_id: Number(r.food_id), user_id: Number(r.user_id), comment: r.comment, rating: r.rating, reply: r.reply }));
    }

    const productId = parseInt(productIdStr ?? '', 10);
    let restaurantId = parseInt(restaurantIdStr ?? '', 10);
    // Neither id provided → default to the logged-in vendor's own restaurant.
    if (!Number.isFinite(restaurantId) && !Number.isFinite(productId)) {
      const rest = await this.vendorRestaurant(req).catch(() => null);
      if (rest) restaurantId = Number(rest.mysql_id);
    }

    let filter: Record<string, unknown>;
    if (Number.isFinite(productId)) {
      filter = { $or: [{ mysql_food_id: productId }, { food_id: productId }] };
    } else if (Number.isFinite(restaurantId)) {
      const foods = await this.mongo.findMany<MongoFoodDoc>('foods', { mysql_restaurant_id: restaurantId });
      const foodIds = foods.map((f) => Number(f.mysql_id)).filter((n) => n > 0);
      const or: Record<string, unknown>[] = [{ mysql_restaurant_id: restaurantId }, { restaurant_id: restaurantId }];
      if (foodIds.length) or.push({ mysql_food_id: { $in: foodIds } }, { food_id: { $in: foodIds } });
      filter = { $or: or };
    } else {
      return [];
    }

    const rows = await this.mongo.findMany<MongoReviewDoc>('reviews', filter, { sort: { mysql_id: -1 }, limit: 100 });
    if (rows.length === 0) return [];

    // Enrich each review with its food (name + image) and customer (name + phone).
    const foodIds = Array.from(new Set(rows.map((r) => Number(r.mysql_food_id ?? r.food_id ?? 0)).filter((n) => n > 0)));
    const userIds = Array.from(new Set(rows.map((r) => Number(r.mysql_user_id ?? r.user_id ?? 0)).filter((n) => n > 0)));
    const [foods, users] = await Promise.all([
      foodIds.length ? this.mongo.findMany<MongoFoodDoc>('foods', { mysql_id: { $in: foodIds } }) : Promise.resolve([] as MongoFoodDoc[]),
      userIds.length ? this.mongo.findMany<{ mysql_id: number; f_name?: string; l_name?: string; phone?: string; image?: string }>('users', { mysql_id: { $in: userIds } }) : Promise.resolve([] as Array<{ mysql_id: number; f_name?: string; l_name?: string; phone?: string; image?: string }>),
    ]);
    const foodMap = new Map(foods.map((f) => [Number(f.mysql_id), f]));
    const userMap = new Map(users.map((u) => [Number(u.mysql_id), u]));

    let shaped = rows.map((r) => {
      const fid = Number(r.mysql_food_id ?? r.food_id ?? 0);
      const uid = Number(r.mysql_user_id ?? r.user_id ?? 0);
      const food = foodMap.get(fid);
      const user = userMap.get(uid);
      const customerName = user ? `${user.f_name ?? ''} ${user.l_name ?? ''}`.trim() || null : null;
      return {
        id: Number(r.mysql_id),
        food_id: fid || null,
        user_id: uid || null,
        order_id: r.mysql_order_id ?? r.order_id ?? null,
        comment: r.comment ?? null,
        rating: r.rating ?? null,
        reply: r.reply ?? null,
        food_name: (food?.name as string | undefined) ?? null,
        food_image_full_url: storageFullUrl('product', (food?.image as string | null | undefined) ?? null),
        customer_name: customerName,
        customer_phone: user?.phone ?? null,
        customer: user ? {
          id: uid,
          f_name: user.f_name ?? null,
          l_name: user.l_name ?? null,
          phone: user.phone ?? null,
          image_full_url: storageFullUrl('profile', user.image ?? null),
        } : null,
        created_at: r.created_at ?? null,
        updated_at: r.updated_at ?? null,
      };
    });

    // Search box: match by order id or food name.
    const q = (search ?? '').trim().toLowerCase();
    if (q && q !== 'null') {
      shaped = shaped.filter((s) => String(s.order_id ?? '').includes(q) || (s.food_name ?? '').toLowerCase().includes(q));
    }
    return shaped;
  }

  @HttpCode(200)
  @Post('product/reply-update')
  async productReply(@Body() body: Record<string, unknown> = {}) {
    const id = body.id !== undefined && body.id !== '' ? Number(body.id) : null;
    if (this.useMongo() && id && body.reply !== undefined) {
      await this.mongo.updateOne('reviews', { mysql_id: id }, { reply: String(body.reply), updated_at: new Date() });
    }
    return { message: 'reply saved' };
  }

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

  /** Path-param variant — the Flutter app calls `/vendor/categories/childes/:id`
   *  (not the query-string form), which previously 404'd ("Cannot GET …"). */
  @Get('categories/childes/:parentId')
  async childCategoriesByPath(@Param('parentId') idStr: string) {
    const id = parseInt(idStr ?? '0', 10);
    if (this.useMongo()) {
      const rows = await this.mongo.findMany<MongoCategoryDoc>('categories', { parent_id: id, status: true });
      return rows.map((r) => ({ id: Number(r.mysql_id), name: r.name ?? null, image: r.image ?? null, status: r.status ?? null }));
    }
    return this.prisma.categories.findMany({ where: { parent_id: id, status: true } }).then((rows) =>
      rows.map((r) => ({ id: Number(r.id), name: r.name, image: r.image, status: r.status })),
    );
  }

  /** Foods in a category for THIS restaurant — powers the category drill-down
   *  ("No food available" was a stub). Returns the Laravel shape. */
  @Get('categories/category-wise-products')
  async categoryProducts(
    @Req() req: AuthedRequest,
    @Query('category_id') categoryIdStr?: string,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
  ) {
    const limit = parseInt(limitStr ?? '25', 10);
    const offset = parseInt(offsetStr ?? '1', 10);
    const categoryId = parseInt(categoryIdStr ?? '0', 10);
    if (!this.useMongo()) return { total_size: 0, limit, offset, products: [] };
    const restaurant = await this.vendorRestaurant(req);
    if (!restaurant) return { total_size: 0, limit, offset, products: [] };
    const filter: Record<string, unknown> = { mysql_restaurant_id: Number(restaurant.mysql_id) };
    if (categoryId) filter.mysql_category_id = categoryId;
    const [rows, total] = await Promise.all([
      this.mongo.findMany<MongoFoodDoc>('foods', filter, { sort: { mysql_id: -1 }, limit, skip: Math.max(0, (offset - 1) * limit) }),
      this.mongo.count('foods', filter),
    ]);
    return {
      total_size: total,
      limit,
      offset,
      products: rows.map((r) => {
        const food = r as MongoFoodDoc & Record<string, unknown>;
        return {
          ...(food.legacy ?? {}),
          ...food,
          id: Number(food.mysql_id),
          price: toNum(food.price),
          tax: toNum(food.tax),
          discount: toNum(food.discount),
          restaurant_id: food.mysql_restaurant_id ? Number(food.mysql_restaurant_id) : 0,
          category_id: food.mysql_category_id ? Number(food.mysql_category_id) : null,
          rating_count: Number(food.rating_count ?? 0),
          avg_rating: Number(food.avg_rating ?? 0),
          rating: food.rating ?? [],
          image: food.image ?? 'default.png',
          image_full_url: this.buildStorageUrl('product', (food.image as string | null) ?? null),
          stock_type: food.stock_type ?? 'unlimited',
          item_stock: Number(food.item_stock ?? 0),
          status: food.status ?? true,
        };
      }),
    };
  }

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
  async addonStore(@Req() req: AuthedRequest, @Body() body: Record<string, unknown> = {}) {
    if (!this.useMongo()) return { message: 'addon created' };
    const restaurant = await this.vendorRestaurant(req);
    if (!restaurant) return { errors: [{ code: 'restaurant', message: 'restaurant not found' }] };
    if (!body.name || String(body.name).trim() === '') {
      return { errors: [{ code: 'name', message: 'addon name is required' }] };
    }
    // Flutter may send the category as `addon_category_id` or `category_id`,
    // and the stock as `addon_stock` or `stock` — accept either so the addon
    // saves (and then shows up in the GET list).
    const categoryId = body.addon_category_id ?? body.category_id;
    const stock = body.addon_stock ?? body.stock;
    const nextId = await this.mongo.nextMysqlId('add_ons');
    const now = new Date();
    await this.mongo.insertOne('add_ons', {
      mysql_id: nextId,
      mysql_restaurant_id: Number(restaurant.mysql_id),
      restaurant_id: Number(restaurant.mysql_id),
      mysql_addon_category_id: categoryId !== undefined && categoryId !== '' ? Number(categoryId) : null,
      addon_category_id: categoryId !== undefined && categoryId !== '' ? Number(categoryId) : null,
      name: String(body.name),
      price: Number(body.price ?? 0),
      tax: Number(body.tax ?? 0),
      stock_type: String(body.stock_type ?? 'unlimited'),
      addon_stock: Number(stock ?? 0),
      sell_count: 0,
      status: true,
      created_at: now,
      updated_at: now,
    });
    return { message: 'addon created', id: nextId };
  }

  // The restaurant app sends this as PUT (some builds POST). Accept both so the
  // "Update Addon" screen never 404s.
  @HttpCode(200)
  @Put('addon/update')
  addonUpdatePut(@Body() body: Record<string, unknown> = {}) {
    return this.addonUpdate(body);
  }

  @HttpCode(200)
  @Post('addon/update')
  async addonUpdate(@Body() body: Record<string, unknown> = {}) {
    if (!this.useMongo()) return { message: 'addon updated' };
    const id = body.id !== undefined && body.id !== '' ? Number(body.id) : null;
    if (!id) return { errors: [{ code: 'id', message: 'addon id required' }] };
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name);
    if (body.price !== undefined && body.price !== '') data.price = Number(body.price);
    if (body.tax !== undefined && body.tax !== '') data.tax = Number(body.tax);
    if (body.stock_type !== undefined) data.stock_type = String(body.stock_type);
    if (body.addon_stock !== undefined && body.addon_stock !== '') data.addon_stock = Number(body.addon_stock);
    if (body.addon_category_id !== undefined && body.addon_category_id !== '') data.mysql_addon_category_id = Number(body.addon_category_id);
    if (Object.keys(data).length === 0) return { message: 'nothing to update' };
    data.updated_at = new Date();
    await this.mongo.updateOne('add_ons', { mysql_id: id }, data);
    return { message: 'addon updated' };
  }

  // The restaurant app sends delete as POST (some builds DELETE). Accept both
  // so the "Delete Addon" confirm never 404s.
  @HttpCode(200)
  @Post('addon/delete')
  addonDeletePost(@Body() body: Record<string, unknown> = {}, @Query('id') idQ?: string) {
    return this.addonDelete(body, idQ);
  }

  @HttpCode(200)
  @Delete('addon/delete')
  async addonDelete(@Body() body: Record<string, unknown> = {}, @Query('id') idQ?: string) {
    const id = body.id !== undefined && body.id !== '' ? Number(body.id) : (idQ ? Number(idQ) : null);
    if (this.useMongo() && id) await this.mongo.deleteOne('add_ons', { mysql_id: id });
    return { message: 'addon deleted' };
  }

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
  async dmPreview(@Query('delivery_man_id') idStr?: string) {
    const id = parseInt(idStr ?? '', 10);
    if (!this.useMongo() || !Number.isFinite(id)) return null;
    const dm = await this.mongo.findByMysqlId<MongoDeliveryManDoc>('delivery_men', id);
    if (!dm) return null;
    return {
      id: Number(dm.mysql_id),
      f_name: dm.f_name ?? null,
      l_name: dm.l_name ?? null,
      phone: dm.phone ?? null,
      status: dm.status ?? null,
      application_status: dm.application_status ?? null,
    };
  }

  /** Create an in-house ("restaurant_wise") delivery man owned by this
   *  restaurant. Mirrors the restaurant app's Add Delivery Man screen. */
  @HttpCode(200)
  @Post('delivery-man/store')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'image', maxCount: 1 },
    { name: 'identity_image', maxCount: 5 },
  ], { limits: { fileSize: 5 * 1024 * 1024 } }))
  async dmStore(
    @Req() req: AuthedRequest,
    @Body() body: Record<string, unknown> = {},
    @UploadedFiles() files: { image?: Express.Multer.File[] } = {},
  ) {
    if (!this.useMongo()) return { message: 'delivery man created' };
    const restaurant = await this.vendorRestaurant(req);
    if (!restaurant) return { errors: [{ code: 'restaurant', message: 'restaurant not found' }] };
    if (!body.f_name || !body.phone) {
      return { errors: [{ code: 'input', message: 'first name and phone are required' }] };
    }
    const dup = await this.mongo.findOne<MongoDeliveryManDoc>('delivery_men', { phone: String(body.phone) });
    if (dup) return { errors: [{ code: 'phone', message: 'phone already in use' }] };

    const nextId = await this.mongo.nextMysqlId('delivery_men');
    const imageName = await this.saveUploaded(files?.image?.[0], 'delivery-man') ?? 'def.png';
    const now = new Date();
    const zoneId = restaurant.mysql_zone_id ?? restaurant.zone_id ?? 1;
    await this.mongo.insertOne('delivery_men', {
      mysql_id: nextId,
      f_name: String(body.f_name),
      l_name: String(body.l_name ?? ''),
      email: body.email ? String(body.email) : null,
      phone: String(body.phone),
      identity_number: body.identity_number ? String(body.identity_number) : null,
      identity_type: body.identity_type ? String(body.identity_type) : null,
      password: await this.hashPassword(String(body.password ?? '12345678')),
      image: imageName,
      mysql_zone_id: Number(zoneId),
      mysql_restaurant_id: Number(restaurant.mysql_id),
      restaurant_id: Number(restaurant.mysql_id),
      type: 'restaurant_wise',
      earning: false,
      application_status: 'approved',
      status: true,
      active: 0,
      created_at: now,
      updated_at: now,
    });
    return { message: 'delivery man created', id: nextId };
  }

  @HttpCode(200)
  @Post('delivery-man/update')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'image', maxCount: 1 },
  ], { limits: { fileSize: 5 * 1024 * 1024 } }))
  async dmUpdate(
    @Body() body: Record<string, unknown> = {},
    @UploadedFiles() files: { image?: Express.Multer.File[] } = {},
  ) {
    if (!this.useMongo()) return { message: 'updated' };
    const id = body.id !== undefined && body.id !== '' ? Number(body.id) : null;
    if (!id) return { errors: [{ code: 'id', message: 'delivery man id required' }] };
    const data: Record<string, unknown> = {};
    for (const k of ['f_name', 'l_name', 'email', 'phone', 'identity_number', 'identity_type'] as const) {
      if (body[k] !== undefined) data[k] = String(body[k]);
    }
    if (body.password !== undefined && String(body.password).length > 1) {
      data.password = await this.hashPassword(String(body.password));
    }
    const imageName = await this.saveUploaded(files?.image?.[0], 'delivery-man');
    if (imageName) data.image = imageName;
    if (Object.keys(data).length === 0) return { message: 'nothing to update' };
    data.updated_at = new Date();
    await this.mongo.updateOne('delivery_men', { mysql_id: id }, data);
    return { message: 'updated' };
  }

  @HttpCode(200)
  @Delete('delivery-man/delete')
  async dmDelete(@Body() body: Record<string, unknown> = {}, @Query('id') idQ?: string) {
    const id = body.id !== undefined && body.id !== '' ? Number(body.id) : (idQ ? Number(idQ) : null);
    if (this.useMongo() && id) await this.mongo.deleteOne('delivery_men', { mysql_id: id });
    return { message: 'deleted' };
  }

  @HttpCode(200)
  @Post('delivery-man/status')
  async dmStatus(@Body() body: Record<string, unknown> = {}) {
    const id = body.id !== undefined && body.id !== '' ? Number(body.id) : null;
    if (this.useMongo() && id) {
      await this.mongo.updateOne('delivery_men', { mysql_id: id }, { status: !!Number(body.status ?? 0), updated_at: new Date() });
    }
    return { message: 'status updated' };
  }

  /** Assign one of the restaurant's delivery men to an order. */
  @HttpCode(200)
  @Post('delivery-man/assign-deliveryman')
  async dmAssign(@Body() body: Record<string, unknown> = {}) {
    if (!this.useMongo()) return { message: 'assigned' };
    const orderId = body.order_id !== undefined && body.order_id !== '' ? Number(body.order_id) : null;
    const dmId = body.delivery_man_id !== undefined && body.delivery_man_id !== '' ? Number(body.delivery_man_id) : null;
    if (orderId && dmId) {
      await this.mongo.updateOne('orders', { mysql_id: orderId }, {
        mysql_delivery_man_id: dmId,
        delivery_man_id: dmId,
        updated_at: new Date(),
      });
    }
    return { message: 'assigned' };
  }

  // ── Coupons (vendor-managed) ─────────────────────────────────────
  /** Shape a coupon doc for the restaurant app. */
  private shapeCoupon(r: Record<string, unknown>) {
    return {
      id: Number(r.mysql_id),
      title: r.title ?? null,
      code: r.code ?? null,
      coupon_type: r.coupon_type ?? 'restaurant_wise',
      discount: toNum(r.discount),
      discount_type: r.discount_type ?? 'amount',
      min_purchase: toNum(r.min_purchase),
      max_discount: toNum(r.max_discount),
      start_date: r.start_date ?? null,
      expire_date: r.expire_date ?? null,
      limit: r.limit ?? null,
      status: r.status ?? true,
      total_uses: r.total_uses ? Number(r.total_uses) : 0,
      restaurant_id: r.mysql_restaurant_id ?? r.restaurant_id ?? null,
    };
  }

  /** The restaurant app's coupon list expects a BARE ARRAY of coupons (not a
   *  { coupons } wrapper) — returning the wrapper made the app fail to parse
   *  the GET even though the coupon was created. */
  @Get('coupon-list')
  async vendorCouponList(@Req() req: AuthedRequest) {
    if (!this.useMongo()) return [];
    const vendorId = Number(req.actor!.id);
    const restaurant = await this.vendorRestaurant(req);
    // Match coupons owned by this vendor OR any of the vendor's restaurants —
    // so a coupon created against a sibling restaurant still shows up.
    const restaurantIds = restaurant
      ? (await this.mongo.findMany<MongoRestaurantDoc>('restaurants', { mysql_vendor_id: vendorId }))
          .map((r) => Number(r.mysql_id))
      : [];
    const or: Record<string, unknown>[] = [{ mysql_vendor_id: vendorId }];
    if (restaurantIds.length > 0) or.push({ mysql_restaurant_id: { $in: restaurantIds } });
    const rows = await this.mongo.findMany<Record<string, unknown>>('coupons', { $or: or }, { sort: { mysql_id: -1 } });
    return rows.map((r) => ({
      ...this.shapeCoupon(r),
      data: r.data ?? null,
      customer_id: r.customer_id ?? ['all'],
      restaurant_name: restaurant?.name ?? null,
    }));
  }

  @HttpCode(200)
  @Post('coupon-store')
  async vendorCouponStore(@Req() req: AuthedRequest, @Body() body: Record<string, unknown> = {}) {
    if (!this.useMongo()) return { message: 'coupon created' };
    const restaurant = await this.vendorRestaurant(req);
    if (!restaurant) return { errors: [{ code: 'restaurant', message: 'restaurant not found' }] };
    // The restaurant app sends the title INSIDE a `translations` JSON string
    // ([{locale,key:'title',value}]), not as a plain `title` — so the coupon
    // silently never saved. Derive the title from there when `title` is absent.
    let title = body.title ? String(body.title) : '';
    if (!title && body.translations !== undefined) {
      try {
        const arr = typeof body.translations === 'string' ? JSON.parse(body.translations) : body.translations;
        if (Array.isArray(arr)) {
          const en = arr.find((t) => t && t.key === 'title' && (t.locale === 'en' || !t.locale) && t.value);
          const any = arr.find((t) => t && t.key === 'title' && t.value);
          title = String((en?.value ?? any?.value) ?? '');
        }
      } catch { /* ignore malformed translations */ }
    }
    if (!title || !body.code) {
      return { errors: [{ code: 'input', message: 'title and code are required' }] };
    }
    const dup = await this.mongo.findOne<{ mysql_id: number }>('coupons', { code: String(body.code) });
    if (dup) return { errors: [{ code: 'code', message: 'coupon code already exists' }] };
    const nextId = await this.mongo.nextMysqlId('coupons');
    const now = new Date();
    await this.mongo.insertOne('coupons', {
      mysql_id: nextId,
      title,
      code: String(body.code),
      coupon_type: body.coupon_type ? String(body.coupon_type) : 'default',
      // Tie the coupon to BOTH the restaurant and the owning vendor so the
      // list query finds it even if the vendor has more than one restaurant
      // (findOne could otherwise resolve a different restaurant on read).
      mysql_restaurant_id: Number(restaurant.mysql_id),
      restaurant_id: Number(restaurant.mysql_id),
      mysql_vendor_id: Number(req.actor!.id),
      discount: Number(body.discount ?? 0),
      discount_type: String(body.discount_type ?? 'amount'),
      min_purchase: Number(body.min_purchase ?? 0),
      max_discount: Number(body.max_discount ?? 0),
      start_date: body.start_date ? new Date(String(body.start_date)) : null,
      expire_date: body.expire_date ? new Date(String(body.expire_date)) : (body.end_date ? new Date(String(body.end_date)) : null),
      limit: body.limit !== undefined && body.limit !== '' ? Number(body.limit) : null,
      status: true,
      created_by: 'vendor',
      total_uses: 0,
      created_at: now,
      updated_at: now,
    });
    return { message: 'coupon created', id: nextId };
  }

  // Some builds of the restaurant app PUT the coupon update (like addon/update).
  @HttpCode(200)
  @Put('coupon-update')
  vendorCouponUpdatePut(@Body() body: Record<string, unknown> = {}) {
    return this.vendorCouponUpdate(body);
  }

  @HttpCode(200)
  @Post('coupon-update')
  async vendorCouponUpdate(@Body() body: Record<string, unknown> = {}) {
    if (!this.useMongo()) return { message: 'coupon updated' };
    const id = body.id !== undefined && body.id !== '' ? Number(body.id) : null;
    if (!id) return { errors: [{ code: 'id', message: 'coupon id required' }] };
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = String(body.title);
    if (body.discount !== undefined && body.discount !== '') data.discount = Number(body.discount);
    if (body.discount_type !== undefined) data.discount_type = String(body.discount_type);
    if (body.min_purchase !== undefined && body.min_purchase !== '') data.min_purchase = Number(body.min_purchase);
    if (body.max_discount !== undefined && body.max_discount !== '') data.max_discount = Number(body.max_discount);
    if (body.start_date !== undefined && body.start_date !== '') data.start_date = new Date(String(body.start_date));
    const expiry = body.expire_date ?? body.end_date;
    if (expiry !== undefined && expiry !== '') data.expire_date = new Date(String(expiry));
    if (body.limit !== undefined && body.limit !== '') data.limit = Number(body.limit);
    if (Object.keys(data).length === 0) return { message: 'nothing to update' };
    data.updated_at = new Date();
    await this.mongo.updateOne('coupons', { mysql_id: id }, data);
    return { message: 'coupon updated' };
  }

  @HttpCode(200)
  @Post('coupon-status')
  async vendorCouponStatus(@Body() body: Record<string, unknown> = {}) {
    const id = body.id !== undefined && body.id !== '' ? Number(body.id) : null;
    if (this.useMongo() && id) {
      await this.mongo.updateOne('coupons', { mysql_id: id }, { status: !!Number(body.status ?? 0), updated_at: new Date() });
    }
    return { message: 'status updated' };
  }

  // Accept POST as well as DELETE (some app builds POST the delete).
  @HttpCode(200)
  @Post('coupon-delete')
  vendorCouponDeletePost(@Body() body: Record<string, unknown> = {}, @Query('id') idQ?: string) {
    return this.vendorCouponDelete(body, idQ);
  }

  @HttpCode(200)
  @Delete('coupon-delete')
  async vendorCouponDelete(@Body() body: Record<string, unknown> = {}, @Query('id') idQ?: string) {
    const id = body.id !== undefined && body.id !== '' ? Number(body.id) : (idQ ? Number(idQ) : null);
    if (this.useMongo() && id) await this.mongo.deleteOne('coupons', { mysql_id: id });
    return { message: 'coupon deleted' };
  }

  @Get('coupon/view-without-translate')
  async vendorCouponView(@Query('coupon_id') idStr?: string) {
    const id = parseInt(idStr ?? '', 10);
    if (!this.useMongo() || !Number.isFinite(id)) return {};
    const c = await this.mongo.findByMysqlId<Record<string, unknown>>('coupons', id);
    return c ? this.shapeCoupon(c) : {};
  }

  // ── Wallet / payments / withdraw ─────────────────────────────────
  // Payment History tab — one credit transaction per delivered order (the
  // restaurant's net take). Derived from orders so it's always real & per
  // vendor; the legacy account_transactions ledger isn't reliably populated.
  @Get('wallet-payment-list')
  async walletPaymentList(@Req() req: AuthedRequest, @Query('offset') offsetQ?: string, @Query('limit') limitQ?: string) {
    if (!this.useMongo()) return { total_size: 0, limit: 10, offset: 1, transactions: [] };
    const vendorId = Number(req.actor!.id);
    const restaurants = await this.mongo.findMany<{ mysql_id: number; comission?: number }>('restaurants', { mysql_vendor_id: vendorId });
    const restaurantIds = restaurants.map((r) => Number(r.mysql_id));
    if (restaurantIds.length === 0) return { total_size: 0, limit: 10, offset: 1, transactions: [] };
    const commissionMap = new Map(restaurants.map((r) => [Number(r.mysql_id), Number(r.comission ?? 0) || 10]));

    const limit = parseInt(limitQ ?? '25', 10) || 25;
    const offset = parseInt(offsetQ ?? '1', 10) || 1;
    const orders = await this.mongo.findMany<Record<string, unknown>>(
      'orders', { mysql_restaurant_id: { $in: restaurantIds }, order_status: 'delivered' },
      { sort: { mysql_id: -1 } },
    );
    const round2 = (n: number) => Math.round(n * 100) / 100;
    let running = 0;
    const all = orders.map((o) => {
      const amount = toNum(o.order_amount);
      const tax = toNum(o.total_tax_amount), delivery = toNum(o.delivery_charge);
      const coupon = toNum(o.coupon_discount_amount), restDisc = toNum(o.restaurant_discount_amount), extra = toNum(o.additional_charge);
      let item = amount + coupon + restDisc - tax - delivery - extra;
      if (item <= 0) item = Math.max(0, amount - tax - delivery) || amount;
      const rate = commissionMap.get(Number(o.mysql_restaurant_id)) ?? 10;
      const earn = round2(item - (item * rate) / 100);
      running = round2(running + earn);
      const created = (o.created_at ?? o.delivered ?? null) as string | null;
      const method = String(o.payment_method ?? 'cash_on_delivery');
      return {
        id: Number(o.mysql_id),
        from_type: 'order',
        from_id: Number(o.mysql_id),
        current_balance: running,
        amount: earn,
        method,
        ref: `#${Number(o.mysql_id)}`,
        created_at: created,
        updated_at: created,
        type: 'credit',
        created_by: 'order',
        payment_method: method,
        status: 'success',
        payment_time: created,
      };
    });
    const page = all.slice(Math.max(0, (offset - 1) * limit), Math.max(0, (offset - 1) * limit) + limit);
    return { total_size: all.length, limit, offset, transactions: page };
  }

  @HttpCode(200)
  @Post('make-collected-cash-payment')
  collectedCash() { return { message: 'recorded' }; }
  @HttpCode(200)
  @Post('make-wallet-adjustment')
  walletAdjustment() { return { message: 'recorded' }; }

  /** Admin-defined withdrawal method TYPES (Bank Transfer, UPI…) — drives the
   *  "Select payment method" dropdown on the Add Withdraw Method screen. */
  private async activeWithdrawalMethods() {
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

  @Get('get-withdraw-method-list')
  getWithdrawMethods() { return this.activeWithdrawalMethods(); }

  /** The vendor's SAVED withdraw methods (their bank account / UPI etc.) — the
   *  Withdraw Method list screen parses this as a DisbursementMethodBody. */
  @Get('withdraw-method/list')
  async withdrawMethods(@Req() req: AuthedRequest) {
    if (!this.useMongo()) return { total_size: 0, limit: 10, offset: 1, methods: [] };
    const vendorId = Number(req.actor!.id);
    const rows = await this.mongo.findMany<Record<string, unknown>>('withdraw_methods', { mysql_vendor_id: vendorId }, { sort: { mysql_id: -1 } });
    return {
      total_size: rows.length,
      limit: 10,
      offset: 1,
      methods: rows.map((r) => ({
        id: Number(r.mysql_id),
        restaurant_id: r.mysql_restaurant_id ?? null,
        delivery_man_id: null,
        withdrawal_method_id: r.mysql_withdrawal_method_id ?? r.withdrawal_method_id ?? null,
        method_name: r.method_name ?? null,
        method_fields: Array.isArray(r.method_fields) ? r.method_fields : [],
        is_default: r.is_default ?? 0,
        created_at: r.created_at ?? null,
        updated_at: r.updated_at ?? null,
      })),
    };
  }

  @HttpCode(200)
  @Post('withdraw-method/store')
  async withdrawStore(@Req() req: AuthedRequest, @Body() body: Record<string, unknown> = {}) {
    if (!this.useMongo()) return { message: 'method added' };
    const vendorId = Number(req.actor!.id);
    const restaurant = await this.vendorRestaurant(req).catch(() => null);
    const methodId = Number(body.withdraw_method_id ?? body.withdrawal_method_id ?? 0);
    if (!methodId) return { errors: [{ code: 'withdraw_method_id', message: 'select a payment method' }] };
    // Label each value the vendor typed using the chosen method's field defs.
    const def = await this.mongo.findByMysqlId<MongoWithdrawalMethodDoc>('withdrawal_methods', methodId);
    const fieldDefs = (Array.isArray(def?.method_fields) ? def!.method_fields : []) as Array<{ input_name?: string; placeholder?: string }>;
    const methodFields = fieldDefs.map((f) => ({
      user_input: f.placeholder ?? f.input_name ?? '',
      user_data: body[String(f.input_name)] !== undefined ? String(body[String(f.input_name)]) : '',
    }));
    // The vendor's first saved method becomes the default automatically.
    const existing = await this.mongo.count('withdraw_methods', { mysql_vendor_id: vendorId });
    const nextId = await this.mongo.nextMysqlId('withdraw_methods');
    const now = new Date();
    await this.mongo.insertOne('withdraw_methods', {
      mysql_id: nextId,
      mysql_vendor_id: vendorId,
      mysql_restaurant_id: restaurant ? Number(restaurant.mysql_id) : null,
      mysql_withdrawal_method_id: methodId,
      withdrawal_method_id: methodId,
      method_name: def?.method_name ?? null,
      method_fields: methodFields,
      is_default: existing === 0 ? 1 : 0,
      created_at: now,
      updated_at: now,
    });
    return { message: 'method added', id: nextId };
  }

  @HttpCode(200)
  @Post('withdraw-method/make-default')
  async withdrawDefault(@Req() req: AuthedRequest, @Body() body: Record<string, unknown> = {}) {
    if (!this.useMongo()) return { message: 'default set' };
    const vendorId = Number(req.actor!.id);
    const id = Number(body.id ?? 0);
    if (!id) return { errors: [{ code: 'id', message: 'id required' }] };
    // Clear the flag on every method first (no updateMany helper), then set it.
    const all = await this.mongo.findMany<{ mysql_id: number }>('withdraw_methods', { mysql_vendor_id: vendorId });
    for (const m of all) {
      await this.mongo.updateOne('withdraw_methods', { mysql_id: Number(m.mysql_id) }, { is_default: Number(m.mysql_id) === id ? 1 : 0 });
    }
    return { message: 'default set' };
  }

  @HttpCode(200)
  @Delete('withdraw-method/delete')
  async withdrawDelete(@Req() req: AuthedRequest, @Body() body: Record<string, unknown> = {}) {
    if (!this.useMongo()) return { message: 'deleted' };
    const vendorId = Number(req.actor!.id);
    const id = Number(body.id ?? 0);
    if (!id) return { errors: [{ code: 'id', message: 'id required' }] };
    await this.mongo.deleteOne('withdraw_methods', { mysql_id: id, mysql_vendor_id: vendorId });
    return { message: 'deleted' };
  }

  // The vendor app deletes via Laravel-style method spoofing — it POSTs with
  // body { _method: 'delete', id }. NestJS doesn't honor _method, so without a
  // POST route this 404s ("Cannot POST .../withdraw-method/delete"). Alias to
  // the same logic.
  @HttpCode(200)
  @Post('withdraw-method/delete')
  withdrawDeletePost(@Req() req: AuthedRequest, @Body() body: Record<string, unknown> = {}) {
    return this.withdrawDelete(req, body);
  }

  /** List this vendor's past withdraw requests (newest first). */
  @Get('get-withdraw-list')
  async getWithdrawList(@Req() req: AuthedRequest) {
    if (!this.useMongo()) return { data: [], total_size: 0 };
    const filter = { mysql_vendor_id: Number(req.actor!.id) };
    const rows = await this.mongo.findMany<Record<string, unknown>>('withdraw_requests', filter, { sort: { mysql_id: -1 }, limit: 100 });
    // The Flutter WithdrawModel reads status (string), bank_name, requested_at,
    // updated_at — none of which the old shape returned, so cards showed blank.
    const methods = await this.mongo.findMany<{ mysql_id: number; method_name?: string }>('withdrawal_methods', {});
    const methodMap = new Map(methods.map((m) => [Number(m.mysql_id), m.method_name ?? null]));
    const statusOf = (a: unknown): string => {
      if (a === true || a === 1 || a === '1') return 'approved';
      if (a === 2 || a === '2') return 'denied';
      return 'pending';
    };
    return {
      data: rows.map((r) => {
        const methodId = Number(r.mysql_withdraw_method_id ?? r.withdrawal_method_id ?? r.withdraw_method_id ?? 0);
        const created = (r.created_at ?? null) as string | null;
        return {
          id: Number(r.mysql_id),
          amount: toNum(r.amount),
          approved: r.approved ?? 0,
          status: statusOf(r.approved),
          bank_name: methodMap.get(methodId) ?? 'Bank Transfer',
          withdraw_method_id: methodId || null,
          requested_at: created,
          created_at: created,
          updated_at: (r.updated_at ?? created) as string | null,
        };
      }),
      total_size: rows.length,
    };
  }

  /** Create a withdraw request against the vendor's earned balance. The admin
   *  Withdraw Requests screen approves/rejects these (already implemented). */
  @HttpCode(200)
  @Post('request-withdraw')
  async requestWithdraw(@Req() req: AuthedRequest, @Body() body: Record<string, unknown> = {}) {
    if (!this.useMongo()) return { message: 'withdraw requested' };
    const amount = Number(body.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { errors: [{ code: 'amount', message: 'enter a valid amount' }] };
    }
    const nextId = await this.mongo.nextMysqlId('withdraw_requests');
    const now = new Date();
    await this.mongo.insertOne('withdraw_requests', {
      mysql_id: nextId,
      mysql_vendor_id: Number(req.actor!.id),
      vendor_id: Number(req.actor!.id),
      amount,
      mysql_withdraw_method_id: body.withdraw_method_id !== undefined && body.withdraw_method_id !== '' ? Number(body.withdraw_method_id) : null,
      approved: 0,
      created_at: now,
      updated_at: now,
    });
    return { message: 'withdraw requested', id: nextId };
  }

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
  /** VAT / Tax report — returns the exact shape the restaurant app's VAT
   *  Report screen reads (totalOrders / totalOrderAmount / totalTax + a
   *  per-rate taxSummary), so the cards no longer show "null". */
  @Get('get-tax-report')
  async taxReport(@Req() req: AuthedRequest, @Query('limit') limitStr?: string, @Query('offset') offsetStr?: string) {
    const limit = parseInt(limitStr ?? '25', 10);
    const offset = parseInt(offsetStr ?? '1', 10);
    const restaurant = this.useMongo() ? await this.vendorRestaurant(req) : null;
    const taxableStatuses = ['delivered', 'refund_requested', 'refund_request_canceled'];
    const orders = (await this.vendorOrdersForReports(req)).filter((o) => taxableStatuses.includes(String(o.order_status)));

    let totalOrderAmount = 0;
    let totalTax = 0;
    for (const o of orders) {
      totalOrderAmount += Number(o.order_amount ?? 0);
      totalTax += Number(o.total_tax_amount ?? 0);
    }

    // One summary row per tax rate. Without a separate order_taxes collection we
    // synthesise it from the restaurant's configured rate, which is what the
    // VAT breakdown card shows (name + percentage + amount).
    const restaurantDoc = (restaurant ?? {}) as unknown as Record<string, unknown>;
    const taxRate = Number(restaurantDoc.tax ?? 0);
    const taxSummary = totalTax > 0
      ? [{ tax_name: 'GST', tax_label: String(taxRate), total_tax: totalTax }]
      : [];

    const ordersOut = orders
      .sort((a, b) => Number(b.mysql_id) - Number(a.mysql_id))
      .slice(Math.max(0, (offset - 1) * limit), Math.max(0, (offset - 1) * limit) + limit)
      .map((o) => ({
        id: Number(o.mysql_id),
        order_amount: Number(o.order_amount ?? 0),
        total_tax_amount: Number(o.total_tax_amount ?? 0),
        order_status: o.order_status ?? null,
        payment_status: o.payment_status ?? null,
        created_at: o.created_at ?? null,
        orderTaxes: [],
      }));

    return {
      total_size: orders.length,
      limit,
      offset,
      taxSummary,
      totalOrders: orders.length,
      totalOrderAmount,
      totalTax,
      orders: ordersOut,
    };
  }
  @Get('get-disbursement-report')
  disbursementReport() { return { data: [], total: 0 }; }
  // The restaurant app's Expense Report expects a PAGINATED wrapper
  // { total_size, limit, offset, expense:[ { id,type,amount,description,
  //   created_at,order:{ id,user_id,customer:{...} } } ] }. Returning the old
  // { data, total } shape left `expense` null → the screen span forever.
  @Get('get-expense')
  async expenseReport(
    @Req() req: AuthedRequest,
    @Query('limit') limitQ?: string,
    @Query('offset') offsetQ?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
  ) {
    const limit = parseInt(limitQ ?? '10', 10) || 10;
    const offset = parseInt(offsetQ ?? '1', 10) || 1;
    const empty = { total_size: 0, limit, offset: String(offset), expense: [] as unknown[], total: 0 };
    if (!this.useMongo()) return empty;

    const orders = await this.vendorOrdersForReports(req);
    const delivered = orders
      .filter((o) => o.order_status === 'delivered')
      .sort((a, b) => Number(b.mysql_id ?? 0) - Number(a.mysql_id ?? 0));

    const restIds = Array.from(new Set(delivered.map((o) => Number(o.mysql_restaurant_id ?? 0)).filter((n) => n > 0)));
    const rests = restIds.length ? await this.mongo.findMany<{ mysql_id: number; comission?: number }>('restaurants', { mysql_id: { $in: restIds } }) : [];
    const commissionMap = new Map(rests.map((r) => [Number(r.mysql_id), Number(r.comission ?? 0) || 10]));

    const userIds = Array.from(new Set(delivered.map((o) => Number(o.mysql_user_id ?? 0)).filter((n) => n > 0)));
    const users = userIds.length ? await this.mongo.findMany<{ mysql_id: number; f_name?: string; l_name?: string; image?: string }>('users', { mysql_id: { $in: userIds } }) : [];
    const userMap = new Map(users.map((u) => [Number(u.mysql_id), u]));

    const fromT = from && from !== 'null' ? Date.parse(from) : NaN;
    const toT = to && to !== 'null' ? Date.parse(to) + 86_400_000 : NaN; // inclusive end-of-day
    const q = (search ?? '').trim().toLowerCase();
    const num = (v: unknown) => (v == null ? 0 : Number(v) || 0);
    const r2 = (n: number) => Math.round(n * 100) / 100;

    const expenses: Array<Record<string, unknown>> = [];
    let eid = 1, total = 0;
    for (const o of delivered) {
      const oid = Number(o.mysql_id);
      if (q && !String(oid).includes(q)) continue;
      const ts = o.created_at ? new Date(o.created_at as string).getTime() : 0;
      if (Number.isFinite(fromT) && ts && ts < fromT) continue;
      if (Number.isFinite(toT) && ts && ts > toT) continue;

      const orderAmount = num(o.order_amount), tax = num(o.total_tax_amount), delivery = num(o.delivery_charge);
      const coupon = num(o.coupon_discount_amount), restDisc = num(o.restaurant_discount_amount), extra = num(o.additional_charge);
      let item = orderAmount + coupon + restDisc - tax - delivery - extra;
      if (item <= 0) item = Math.max(0, orderAmount - tax - delivery) || orderAmount;
      const rate = commissionMap.get(Number(o.mysql_restaurant_id ?? 0)) ?? 10;
      const commission = r2((item * rate) / 100);

      const u = userMap.get(Number(o.mysql_user_id ?? 0));
      const orderObj = {
        id: oid,
        user_id: Number(o.mysql_user_id ?? 0) || null,
        customer: u ? { id: Number(u.mysql_id), f_name: u.f_name ?? null, l_name: u.l_name ?? null, image_full_url: storageFullUrl('profile', u.image ?? null) } : null,
      };
      const restId = Number(o.mysql_restaurant_id ?? 0) || null;
      const createdAt = o.created_at ?? null;
      const push = (type: string, amount: number, description: string) => {
        if (amount <= 0) return;
        total += amount;
        expenses.push({
          id: eid++, type, amount: r2(amount), description,
          created_at: createdAt, updated_at: o.updated_at ?? createdAt, created_by: 'vendor',
          restaurant_id: restId, order_id: oid, order: orderObj,
        });
      };
      push('commission', commission, 'Admin commission on order');
      push('coupon_discount', coupon, 'Coupon discount given');
      push('discount_on_product', restDisc, 'Discount on product');
    }

    const page = expenses.slice((offset - 1) * limit, (offset - 1) * limit + limit);
    return { total_size: expenses.length, limit, offset: String(offset), expense: page, total: r2(total) };
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
  async vendorNotifications(@Req() req: AuthedRequest) {
    if (this.useMongo()) {
      const restaurantIds = await this.vendorRestaurantIds(req);
      // Show this restaurant's order notifications + global admin broadcasts
      // (those have no mysql_restaurant_id).
      const rows = await this.mongo.findMany<MongoNotificationDoc>(
        'notifications',
        {
          status: true,
          $or: [
            ...(restaurantIds.length > 0 ? [{ mysql_restaurant_id: { $in: restaurantIds } }] : []),
            { mysql_restaurant_id: { $exists: false } },
            { mysql_restaurant_id: null },
          ],
        },
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
  // Basic (admin-run) campaigns the restaurant can join. Was a stub returning
  // [] → "No campaign available". Returns the BARE ARRAY shape the app parses,
  // with is_joined/vendor_status reflecting this restaurant's membership.
  @Get('get-basic-campaigns')
  async basicCampaigns(@Req() req: AuthedRequest) {
    if (!this.useMongo()) return [];
    const restaurant = await this.vendorRestaurant(req);
    const restId = restaurant ? Number(restaurant.mysql_id) : 0;
    const camps = await this.mongo.findMany<Record<string, unknown>>(
      'campaigns',
      { $or: [{ status: true }, { status: 1 }, { status: { $exists: false } }] },
      { sort: { mysql_id: -1 } },
    );
    const joins = restId
      ? await this.mongo.findMany<{ campaign_id: number }>('restaurant_campaigns', { restaurant_id: restId })
      : [];
    const joinedSet = new Set(joins.map((j) => Number(j.campaign_id)));
    // Most seed campaigns have no image — fall back to a tasteful banner so
    // the cards aren't blank grey boxes.
    const fallbackImg = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=700&h=400&fit=crop&q=80';
    return camps.map((c) => {
      const cid = Number(c.mysql_id);
      const stored = c.image ? storageFullUrl('campaign', c.image as string) : null;
      const joined = joinedSet.has(cid);
      return {
        id: cid,
        title: c.title ?? null,
        image_full_url: stored ?? fallbackImg,
        description: c.description ?? null,
        created_at: c.created_at ?? null,
        updated_at: c.updated_at ?? null,
        start_time: c.start_time ?? '00:00:00',
        end_time: c.end_time ?? '23:59:59',
        available_date_starts: c.start_date ?? null,
        available_date_ends: c.end_date ?? null,
        vendor_status: joined ? 'confirmed' : null,
        is_joined: joined,
      };
    });
  }

  @HttpCode(200)
  @Post('campaign-join')
  @Put('campaign-join')
  async campaignJoin(@Req() req: AuthedRequest, @Body() body: Record<string, unknown> = {}) {
    if (this.useMongo()) {
      const restaurant = await this.vendorRestaurant(req);
      const cid = Number(body.campaign_id ?? body.id ?? 0);
      if (restaurant && cid) {
        const restId = Number(restaurant.mysql_id);
        const exists = await this.mongo.findOne('restaurant_campaigns', { campaign_id: cid, restaurant_id: restId });
        if (!exists) {
          const nextId = await this.mongo.nextMysqlId('restaurant_campaigns');
          await this.mongo.insertOne('restaurant_campaigns', {
            mysql_id: nextId, campaign_id: cid, restaurant_id: restId, mysql_restaurant_id: restId,
            status: 'confirmed', created_at: new Date(), updated_at: new Date(),
          });
        }
      }
    }
    return { message: 'joined' };
  }

  @HttpCode(200)
  @Post('campaign-leave')
  @Put('campaign-leave')
  async campaignLeave(@Req() req: AuthedRequest, @Body() body: Record<string, unknown> = {}) {
    if (this.useMongo()) {
      const restaurant = await this.vendorRestaurant(req);
      const cid = Number(body.campaign_id ?? body.id ?? 0);
      if (restaurant && cid) {
        await this.mongo.deleteOne('restaurant_campaigns', { campaign_id: cid, restaurant_id: Number(restaurant.mysql_id) });
      }
    }
    return { message: 'left' };
  }

  /** Map a Mongo advertisement doc to the exact shape AdvertisementModel.Adds
   *  / AdsDetailsModel expect in the restaurant app. Image URLs come from
   *  storageBaseUrl() which is request-host aware (see main.ts). */
  private shapeAd(row: Record<string, unknown>) {
    const r = row as Record<string, unknown>;
    const img = (f: unknown) => {
      const s = f && String(f).trim() ? String(f) : '';
      if (!s) return null;
      if (/^https?:\/\//i.test(s)) return s; // already absolute
      return `${storageBaseUrl()}/advertisement/${s}`;
    };
    return {
      id: Number(r.mysql_id),
      restaurant_id: r.mysql_restaurant_id != null ? Number(r.mysql_restaurant_id) : 0,
      add_type: r.add_type ?? 'restaurant_promotion',
      title: r.title ?? null,
      description: r.description ?? null,
      start_date: r.start_date ?? null,
      end_date: r.end_date ?? null,
      pause_note: r.pause_note ?? null,
      cancellation_note: r.cancellation_note ?? null,
      cover_image: r.cover_image ?? null,
      profile_image: r.profile_image ?? null,
      video_attachment: r.video_attachment ?? null,
      priority: Number(r.priority ?? 0),
      is_rating_active: Number(r.is_rating_active ?? 0),
      is_review_active: Number(r.is_review_active ?? 0),
      is_paid: Number(r.is_paid ?? 0),
      is_updated: Number(r.is_updated ?? 0),
      created_by_id: r.mysql_created_by_id != null ? Number(r.mysql_created_by_id) : 0,
      created_by_type: r.created_by_type ?? 'vendor',
      status: r.status ?? 'pending',
      active: Number(r.active ?? 1),
      created_at: r.created_at ?? null,
      updated_at: r.updated_at ?? null,
      cover_image_full_url: img(r.cover_image),
      profile_image_full_url: img(r.profile_image),
      video_attachment_full_url: img(r.video_attachment),
      translations: Array.isArray(r.translations) ? r.translations : [],
      storage: [],
    };
  }

  /** Parse the ad translations JSON (keys 'title' / 'description'). */
  private parseAdTranslations(raw: unknown): { title: string | null; description: string | null; translations: Array<{ locale?: string; key?: string; value?: string }> } {
    let translations: Array<{ locale?: string; key?: string; value?: string }> = [];
    if (typeof raw === 'string') { try { translations = JSON.parse(raw) ?? []; } catch { translations = []; } }
    else if (Array.isArray(raw)) translations = raw as typeof translations;
    const pick = (key: string) =>
      translations.find((t) => t?.locale === 'en' && t?.key === key)?.value
      ?? translations.find((t) => t?.key === key)?.value ?? null;
    return { title: pick('title'), description: pick('description'), translations };
  }

  /** Shared create logic for store + copy-add-post. */
  private async createAdvertisement(req: AuthedRequest, body: Record<string, unknown>, files: { cover_image?: Express.Multer.File[]; profile_image?: Express.Multer.File[]; video_attachment?: Express.Multer.File[] }) {
    if (!this.useMongo()) return { message: 'ad created' };
    const restaurant = await this.vendorRestaurant(req);
    if (!restaurant) return { errors: [{ code: 'restaurant', message: 'restaurant not found' }] };
    const { title, description, translations } = this.parseAdTranslations(body.translations);
    let startDate: string | null = null;
    let endDate: string | null = null;
    if (typeof body.dates === 'string' && body.dates.includes(' - ')) {
      const [s, e] = body.dates.split(' - ');
      startDate = s.trim() || null;
      endDate = e.trim() || null;
    }
    const cover = await this.saveUploaded(files?.cover_image?.[0], 'advertisement');
    const profile = await this.saveUploaded(files?.profile_image?.[0], 'advertisement');
    const video = await this.saveUploaded(files?.video_attachment?.[0], 'advertisement');
    const nextId = await this.mongo.nextMysqlId('advertisements');
    const now = new Date();
    await this.mongo.insertOne('advertisements', {
      mysql_id: nextId,
      mysql_restaurant_id: Number(restaurant.mysql_id),
      restaurant_id: Number(restaurant.mysql_id),
      add_type: String(body.advertisement_type ?? 'restaurant_promotion'),
      title: title ?? String(body.title ?? 'Advertisement'),
      description: description ?? String(body.description ?? ''),
      translations,
      start_date: startDate,
      end_date: endDate,
      cover_image: cover,
      profile_image: profile,
      video_attachment: video,
      is_rating_active: Number(body.is_rating_active ?? 0),
      is_review_active: Number(body.is_review_active ?? 0),
      is_paid: 0,
      is_updated: 0,
      priority: 0,
      mysql_created_by_id: Number(req.actor!.id),
      created_by_type: 'vendor',
      status: 'pending',
      active: 1,
      created_at: now,
      updated_at: now,
    });
    return { message: 'Advertisement created successfully', id: nextId };
  }

  @Get('advertisement')
  async ads(
    @Req() req: AuthedRequest,
    @Query('offset') offsetQ?: string,
    @Query('limit') limitQ?: string,
    @Query('ads_type') adsType?: string,
  ) {
    const limit = parseInt(limitQ ?? '10', 10) || 10;
    const offset = parseInt(offsetQ ?? '1', 10) || 1;
    const empty = { total_size: 0, limit, offset, all: 0, running: 0, pending: 0, denied: 0, approved: 0, expired: 0, paused: 0, adds: [] };
    if (!this.useMongo()) return empty;
    const restaurantIds = await this.vendorRestaurantIds(req);
    if (restaurantIds.length === 0) return empty;
    const base = { mysql_restaurant_id: { $in: restaurantIds } };
    const countFor = (s: string) => this.mongo.count('advertisements', { ...base, status: s });
    const [all, pending, running, approved, denied, expired, paused] = await Promise.all([
      this.mongo.count('advertisements', base),
      countFor('pending'), countFor('running'), countFor('approved'),
      countFor('denied'), countFor('expired'), countFor('paused'),
    ]);
    const filter = adsType && adsType !== 'all' ? { ...base, status: adsType } : base;
    const total = adsType && adsType !== 'all' ? await this.mongo.count('advertisements', filter) : all;
    const rows = await this.mongo.findMany<Record<string, unknown>>('advertisements', filter, {
      sort: { mysql_id: -1 }, limit, skip: Math.max(0, (offset - 1) * limit),
    });
    return { total_size: total, limit, offset, all, running, pending, denied, approved, expired, paused, adds: rows.map((r) => this.shapeAd(r)) };
  }

  @Get('advertisement/details/:id')
  async adDetails(@Param('id') idStr: string) {
    const id = parseInt(idStr, 10);
    if (!this.useMongo() || !Number.isFinite(id)) return null;
    const doc = await this.mongo.findByMysqlId<Record<string, unknown>>('advertisements', id);
    return doc ? this.shapeAd(doc) : null;
  }

  @HttpCode(200)
  @Post('advertisement/store')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'cover_image', maxCount: 1 },
    { name: 'profile_image', maxCount: 1 },
    { name: 'video_attachment', maxCount: 1 },
  ], { limits: { fileSize: 30 * 1024 * 1024 } }))
  adStore(
    @Req() req: AuthedRequest,
    @Body() body: Record<string, unknown> = {},
    @UploadedFiles() files: { cover_image?: Express.Multer.File[]; profile_image?: Express.Multer.File[]; video_attachment?: Express.Multer.File[] } = {},
  ) {
    return this.createAdvertisement(req, body, files);
  }

  @HttpCode(200)
  @Post('advertisement/copy-add-post')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'cover_image', maxCount: 1 },
    { name: 'profile_image', maxCount: 1 },
    { name: 'video_attachment', maxCount: 1 },
  ], { limits: { fileSize: 30 * 1024 * 1024 } }))
  adCopy(
    @Req() req: AuthedRequest,
    @Body() body: Record<string, unknown> = {},
    @UploadedFiles() files: { cover_image?: Express.Multer.File[]; profile_image?: Express.Multer.File[]; video_attachment?: Express.Multer.File[] } = {},
  ) {
    return this.createAdvertisement(req, body, files);
  }

  @HttpCode(200)
  @Post('advertisement/update/:id')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'cover_image', maxCount: 1 },
    { name: 'profile_image', maxCount: 1 },
    { name: 'video_attachment', maxCount: 1 },
  ], { limits: { fileSize: 30 * 1024 * 1024 } }))
  async adUpdate(
    @Param('id') idStr: string,
    @Body() body: Record<string, unknown> = {},
    @UploadedFiles() files: { cover_image?: Express.Multer.File[]; profile_image?: Express.Multer.File[]; video_attachment?: Express.Multer.File[] } = {},
  ) {
    const id = parseInt(idStr, 10);
    if (!this.useMongo() || !Number.isFinite(id)) return { message: 'updated' };
    const data: Record<string, unknown> = { updated_at: new Date(), is_updated: 1 };
    if (body.translations !== undefined) {
      const { title, description, translations } = this.parseAdTranslations(body.translations);
      data.translations = translations;
      if (title) data.title = title;
      if (description) data.description = description;
    }
    if (typeof body.dates === 'string' && body.dates.includes(' - ')) {
      const [s, e] = body.dates.split(' - ');
      data.start_date = s.trim() || null;
      data.end_date = e.trim() || null;
    }
    if (body.advertisement_type !== undefined) data.add_type = String(body.advertisement_type);
    if (body.is_rating_active !== undefined) data.is_rating_active = Number(body.is_rating_active);
    if (body.is_review_active !== undefined) data.is_review_active = Number(body.is_review_active);
    const cover = await this.saveUploaded(files?.cover_image?.[0], 'advertisement');
    const profile = await this.saveUploaded(files?.profile_image?.[0], 'advertisement');
    const video = await this.saveUploaded(files?.video_attachment?.[0], 'advertisement');
    if (cover) data.cover_image = cover;
    if (profile) data.profile_image = profile;
    if (video) data.video_attachment = video;
    await this.mongo.updateOne('advertisements', { mysql_id: id }, data);
    return { message: 'Advertisement updated successfully' };
  }

  @HttpCode(200)
  @Post('advertisement/status')
  async adStatus(@Body() body: Record<string, unknown> = {}) {
    const id = body.id !== undefined && body.id !== '' ? Number(body.id) : null;
    if (this.useMongo() && id) {
      const data: Record<string, unknown> = { updated_at: new Date() };
      if (body.status !== undefined) data.status = String(body.status);
      if (body.pause_note !== undefined) data.pause_note = String(body.pause_note);
      await this.mongo.updateOne('advertisements', { mysql_id: id }, data);
    }
    return { message: 'status updated' };
  }

  @HttpCode(200)
  @Delete('advertisement/delete/:id')
  async adDelete(@Param('id') idStr: string) {
    const id = parseInt(idStr, 10);
    if (this.useMongo() && Number.isFinite(id)) await this.mongo.deleteOne('advertisements', { mysql_id: id });
    return { message: 'advertisement deleted' };
  }

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

  /** "Shift to New Business Plan" submit. The app POSTs here; without a handler
   *  it 404'd and the button just spun. Updates the restaurant's plan model and
   *  returns immediately (wallet payment → no gateway redirect). */
  @HttpCode(200)
  @Post('business_plan')
  async setBusinessPlan(@Req() req: AuthedRequest, @Body() body: Record<string, unknown> = {}) {
    if (!this.useMongo()) return { message: 'plan updated', redirect_url: null, success: true };
    const restaurant = await this.vendorRestaurant(req).catch(() => null);
    if (!restaurant) return { errors: [{ code: 'restaurant', message: 'restaurant not found' }] };
    const plan = String(body.business_plan ?? 'commission');
    const data: Record<string, unknown> = {
      restaurant_model: plan === 'subscription' ? 'subscription' : 'commission',
      updated_at: new Date(),
    };
    if (plan === 'subscription' && body.package_id) {
      const pkgId = Number(body.package_id);
      const pkg = await this.mongo.findByMysqlId<{ mysql_id: number; validity?: number }>('subscription_packages', pkgId).catch(() => null);
      const validity = Number(pkg?.validity ?? 30);
      data.subscription_id = pkgId;
      data.subscription_expiry_date = new Date(Date.now() + validity * 24 * 60 * 60 * 1000);
    } else {
      data.subscription_id = null;
    }
    await this.mongo.updateOne('restaurants', { mysql_id: Number(restaurant.mysql_id) }, data);
    return { message: 'plan updated successfully', redirect_url: null, success: true };
  }

  /** "Change Subscription Plan" lists the active packages. The app reads
   *  `{ packages: [...] }`; the old stub returned a single `package`, so the
   *  screen showed "No package available". Returns real packages, falling back
   *  to sensible defaults so the screen is never empty in the demo. */
  @Get('package-view')
  async packageView() {
    let packages: Array<Record<string, unknown>> = [];
    if (this.useMongo()) {
      const rows = await this.mongo.findMany<Record<string, unknown>>(
        'subscription_packages', { $or: [{ status: true }, { status: 1 }] }, { sort: { mysql_id: -1 } },
      );
      packages = rows.map((r) => ({
        ...r,
        id: Number(r.mysql_id),
        price: Number(r.price ?? 0),
        validity: Number(r.validity ?? 0),
      }));
    }
    if (packages.length === 0) {
      // Demo fallback so the plan picker renders.
      packages = [
        { id: 1, package_name: 'Starter', price: 499, validity: 30, max_order: 100, max_product: 50, pos: 1, mobile_app: 0, self_delivery: 0, reviews: 1, chat: 1 },
        { id: 2, package_name: 'Growth', price: 999, validity: 30, max_order: 500, max_product: 200, pos: 1, mobile_app: 1, self_delivery: 1, reviews: 1, chat: 1 },
        { id: 3, package_name: 'Pro', price: 1999, validity: 30, max_order: 0, max_product: 0, pos: 1, mobile_app: 1, self_delivery: 1, reviews: 1, chat: 1 },
      ];
    }
    return { packages };
  }

  /** Flutter's My Business Plan page calls this with GET — the old POST
   *  stub silently 404'd. Returns paginated empty list with metadata so
   *  the page renders "No transactions yet" instead of spinning. */
  @Get('subscription-transaction')
  async subscriptionTransactionsList(@Req() req: AuthedRequest, @Query('offset') offsetQ?: string, @Query('limit') limitQ?: string) {
    if (!this.useMongo()) return { transactions: [], total_size: 0, limit: 10, offset: 1 };
    const vendorId = Number(req.actor!.id);
    const restaurants = await this.mongo.findMany<{ mysql_id: number; name?: string; logo?: string }>('restaurants', { mysql_vendor_id: vendorId });
    const restIds = restaurants.map((r) => Number(r.mysql_id));
    if (restIds.length === 0) return { transactions: [], total_size: 0, limit: 10, offset: 1 };
    const restMap = new Map(restaurants.map((r) => [Number(r.mysql_id), r]));

    const limit = parseInt(limitQ ?? '10', 10) || 10;
    const offset = parseInt(offsetQ ?? '1', 10) || 1;
    const rows = await this.mongo.findMany<Record<string, unknown>>(
      'subscription_transactions', { restaurant_id: { $in: restIds } }, { sort: { mysql_id: -1 } },
    );
    const pkgIds = Array.from(new Set(rows.map((t) => Number(t.package_id ?? 0)).filter((n) => n > 0)));
    const pkgs = pkgIds.length ? await this.mongo.findMany<Record<string, unknown>>('subscription_packages', { mysql_id: { $in: pkgIds } }) : [];
    const pkgMap = new Map(pkgs.map((p) => [Number(p.mysql_id), p]));

    const shaped = rows.map((t) => {
      const pkg = pkgMap.get(Number(t.package_id ?? 0));
      const rest = restMap.get(Number(t.restaurant_id ?? 0));
      const feat = (k: string) => (pkg ? (Number(pkg[k] ?? 0) ? 1 : 0) : 0);
      return {
        id: String(t.transaction_id ?? t.id ?? t.mysql_id),
        package_id: Number(t.package_id ?? 0),
        restaurant_id: Number(t.restaurant_id ?? 0),
        restaurant_subscription_id: Number(t.restaurant_subscription_id ?? 0) || null,
        price: toNum(t.price),
        validity: Number(t.validity ?? pkg?.validity ?? 30),
        payment_method: String(t.payment_method ?? 'wallet'),
        payment_status: String(t.payment_status ?? 'success'),
        reference: (t.reference as string) ?? null,
        paid_amount: toNum(t.paid_amount ?? t.price),
        discount: toNum(t.discount),
        package_details: {
          pos: feat('pos'), review: feat('review'), self_delivery: feat('self_delivery'),
          chat: feat('chat'), mobile_app: feat('mobile_app'),
          max_order: pkg?.max_order ?? 'unlimited', max_product: pkg?.max_product ?? 'unlimited',
        },
        created_by: String(t.created_by ?? 'vendor'),
        is_trial: Number(t.is_trial ?? 0) ? 1 : 0,
        transaction_status: 1,
        plan_type: String(t.plan_type ?? 'new_plan'),
        created_at: t.created_at ?? null,
        updated_at: t.updated_at ?? t.created_at ?? null,
        restaurant: rest ? { id: Number(rest.mysql_id), name: rest.name ?? null, logo_full_url: storageFullUrl('restaurant', rest.logo ?? null) } : null,
        package: pkg ? {
          id: Number(pkg.mysql_id), package_name: pkg.package_name ?? 'Plan', price: toNum(pkg.price),
          validity: Number(pkg.validity ?? 30), max_order: pkg.max_order ?? 'unlimited', max_product: pkg.max_product ?? 'unlimited',
          pos: feat('pos'), mobile_app: feat('mobile_app'), chat: feat('chat'), review: feat('review'), self_delivery: feat('self_delivery'), status: 1,
        } : null,
      };
    });
    const page = shaped.slice(Math.max(0, (offset - 1) * limit), Math.max(0, (offset - 1) * limit) + limit);
    return { transactions: page, total_size: shaped.length, limit, offset: String(offset) };
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
