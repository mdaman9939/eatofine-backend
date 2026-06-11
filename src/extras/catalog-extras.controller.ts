import { Body, Controller, Get, Post, Query, Param, HttpCode, Req, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';
import { storageFullUrl } from '../common/storage-url';
import { AuthGuard, RequireAuth } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.guard';

// Public catalog endpoints that aren't under the existing CatalogController.
// These mostly return seeded data or sensible empty arrays for the demo.
//
// Each endpoint that hits a migrated collection branches on `useMongo()` and
// reads from MongoDB; the Prisma path is retained as a fallback so the
// feature flag can be flipped per environment. Response shapes are
// byte-identical between paths because the mobile apps depend on them.
@Controller()
export class CatalogExtrasController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mongo: MongoDataService,
  ) {}

  private useMongo(): boolean {
    // Default-on: production deployments don't run MySQL, so hitting Prisma
    // every request produced noisy "Can't reach database server" errors.
    // Set USE_MONGO_EXTRAS=0 to opt back into Prisma for local dev only.
    const v = (process.env.USE_MONGO_EXTRAS ?? '1').toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }

  /** Best-effort number coercion that mirrors `Number(prismaValue)`. */
  private num(v: unknown): number {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (typeof v === 'string') return Number(v) || 0;
    if (typeof v === 'object' && v !== null && 'toNumber' in v && typeof (v as { toNumber: () => number }).toNumber === 'function') {
      return (v as { toNumber: () => number }).toNumber();
    }
    return Number(v) || 0;
  }

  // ── Coupons ──────────────────────────────────────────────────────
  @Get('coupon/list')
  async couponList() {
    if (this.useMongo()) {
      const rows = await this.mongo.findMany<Record<string, unknown>>('coupons', { status: true }, { sort: { mysql_id: -1 } });
      return rows.map((r) => ({
        ...r,
        id: Number(r.mysql_id),
        restaurant_id: r.restaurant_id !== undefined && r.restaurant_id !== null
          ? Number(r.restaurant_id)
          : (r.mysql_restaurant_id !== undefined && r.mysql_restaurant_id !== null ? Number(r.mysql_restaurant_id) : null),
        min_purchase: this.num(r.min_purchase),
        max_discount: this.num(r.max_discount),
        discount: this.num(r.discount),
        total_uses: r.total_uses !== undefined && r.total_uses !== null ? Number(r.total_uses) : 0,
      }));
    }
    const rows = await this.prisma.coupons.findMany({
      where: { status: true },
      orderBy: { id: 'desc' },
    });
    return rows.map((r) => ({
      ...r,
      id: Number(r.id),
      restaurant_id: r.restaurant_id ? Number(r.restaurant_id) : null,
      min_purchase: Number(r.min_purchase),
      max_discount: Number(r.max_discount),
      discount: Number(r.discount),
      total_uses: r.total_uses ? Number(r.total_uses) : 0,
    }));
  }

  @Get('coupon/apply')
  async couponApply(@Query('code') code?: string, @Query('order_amount') amountStr?: string) {
    if (!code) return { code: 'invalid', message: 'code required' };
    if (this.useMongo()) {
      const c = await this.mongo.findOne<Record<string, unknown>>('coupons', { code, status: true });
      if (!c) return { code: 'invalid', message: 'coupon not found' };
      const amount = parseFloat(amountStr ?? '0');
      const minPurchase = this.num(c.min_purchase);
      if (amount > 0 && amount < minPurchase) {
        return { code: 'minimum', message: `Minimum purchase ₹${minPurchase}` };
      }
      let discount = c.discount_type === 'percentage' ? (amount * this.num(c.discount)) / 100 : this.num(c.discount);
      const maxDiscount = this.num(c.max_discount);
      if (maxDiscount > 0 && discount > maxDiscount) discount = maxDiscount;
      return {
        code: 'valid',
        title: c.title,
        coupon_code: c.code,
        discount,
        min_purchase: minPurchase,
        max_discount: maxDiscount,
      };
    }
    const c = await this.prisma.coupons.findFirst({ where: { code, status: true } });
    if (!c) return { code: 'invalid', message: 'coupon not found' };
    const amount = parseFloat(amountStr ?? '0');
    const minPurchase = Number(c.min_purchase);
    if (amount > 0 && amount < minPurchase) {
      return { code: 'minimum', message: `Minimum purchase ₹${minPurchase}` };
    }
    let discount = c.discount_type === 'percentage' ? (amount * Number(c.discount)) / 100 : Number(c.discount);
    const maxDiscount = Number(c.max_discount);
    if (maxDiscount > 0 && discount > maxDiscount) discount = maxDiscount;
    return {
      code: 'valid',
      title: c.title,
      coupon_code: c.code,
      discount,
      min_purchase: minPurchase,
      max_discount: maxDiscount,
    };
  }

  @Get('coupon/restaurant-wise-coupon')
  async restaurantCoupons(@Query('restaurant_id') idStr?: string) {
    const id = parseInt(idStr ?? '', 10);
    if (!Number.isFinite(id)) return [];
    if (this.useMongo()) {
      // Coupons either belong to this restaurant or are default (no restaurant).
      // Migrated docs may store the FK as either `restaurant_id` or
      // `mysql_restaurant_id`, so we OR-match both.
      const rows = await this.mongo.findMany<Record<string, unknown>>(
        'coupons',
        {
          status: true,
          $or: [
            { restaurant_id: id },
            { mysql_restaurant_id: id },
            { restaurant_id: null, coupon_type: 'default' },
            { mysql_restaurant_id: null, coupon_type: 'default' },
          ],
        },
        { sort: { mysql_id: -1 } },
      );
      return rows.map((r) => ({
        ...r,
        id: Number(r.mysql_id),
        restaurant_id: r.restaurant_id !== undefined && r.restaurant_id !== null
          ? Number(r.restaurant_id)
          : (r.mysql_restaurant_id !== undefined && r.mysql_restaurant_id !== null ? Number(r.mysql_restaurant_id) : null),
        min_purchase: this.num(r.min_purchase),
        max_discount: this.num(r.max_discount),
        discount: this.num(r.discount),
        total_uses: r.total_uses !== undefined && r.total_uses !== null ? Number(r.total_uses) : 0,
      }));
    }
    const rows = await this.prisma.coupons.findMany({
      where: { status: true, OR: [{ restaurant_id: BigInt(id) }, { restaurant_id: null, coupon_type: 'default' }] },
      orderBy: { id: 'desc' },
    });
    return rows.map((r) => ({
      ...r,
      id: Number(r.id),
      restaurant_id: r.restaurant_id ? Number(r.restaurant_id) : null,
      min_purchase: Number(r.min_purchase),
      max_discount: Number(r.max_discount),
      discount: Number(r.discount),
      total_uses: r.total_uses ? Number(r.total_uses) : 0,
    }));
  }

  // ── Cuisines (alias) ─────────────────────────────────────────────
  @Get('cuisine')
  async cuisineAlias() {
    // The customer app's CuisineModel reads `image_full_url` — returning only
    // the raw `image` left every cuisine showing a grey placeholder.
    if (this.useMongo()) {
      const rows = await this.mongo.findMany<Record<string, unknown>>('cuisines', { status: true });
      return rows.map((r) => ({
        id: Number(r.mysql_id),
        name: r.name,
        image: r.image,
        image_full_url: storageFullUrl('cuisine', (r.image as string | null | undefined) ?? null),
        slug: r.slug,
      }));
    }
    const rows = await this.prisma.cuisines.findMany({ where: { status: true } });
    return rows.map((r) => ({
      id: Number(r.id),
      name: r.name,
      image: r.image,
      image_full_url: storageFullUrl('cuisine', r.image ?? null),
      slug: r.slug,
    }));
  }

  @Get('cuisine/get_restaurants')
  async cuisineRestaurants(@Query('cuisine_id') idStr?: string) {
    const id = parseInt(idStr ?? '', 10);
    if (!Number.isFinite(id)) return { restaurants: [], total_size: 0 };
    // We don't ship cuisine_restaurant join data in the demo; return empty.
    return { restaurants: [], total_size: 0 };
  }

  // ── Add-on categories ────────────────────────────────────────────
  @Get('addon-category/list')
  async addonCategoryList() {
    if (this.useMongo()) {
      const rows = await this.mongo.findMany<Record<string, unknown>>('addon_categories', { status: true });
      return rows.map((r) => ({ id: Number(r.mysql_id), name: r.name, status: r.status, slug: r.slug }));
    }
    const rows = await this.prisma.addon_categories.findMany({ where: { status: true } });
    return rows.map((r) => ({ id: Number(r.id), name: r.name, status: r.status, slug: r.slug }));
  }

  // ── Campaigns ────────────────────────────────────────────────────
  @Get('campaigns/basic')
  async basicCampaigns() {
    if (this.useMongo()) {
      const rows = await this.mongo.findMany<Record<string, unknown>>('campaigns', { status: true }, { sort: { mysql_id: -1 } });
      return rows.map((r) => ({
        id: Number(r.mysql_id),
        title: r.title,
        description: r.description,
        image: r.image,
        start_date: r.start_date,
        end_date: r.end_date,
      }));
    }
    const rows = await this.prisma.campaigns.findMany({ where: { status: true }, orderBy: { id: 'desc' } });
    return rows.map((r) => ({ id: Number(r.id), title: r.title, description: r.description, image: r.image, start_date: r.start_date, end_date: r.end_date }));
  }

  @Get('campaigns/basic-campaign-details')
  async basicCampaignDetails(@Query('basic_campaign_id') idStr?: string) {
    const id = parseInt(idStr ?? '', 10);
    if (!Number.isFinite(id)) return { campaign: null, restaurants: [] };
    if (this.useMongo()) {
      const c = await this.mongo.findByMysqlId<Record<string, unknown>>('campaigns', id);
      return { campaign: c ? { ...c, id: Number(c.mysql_id) } : null, restaurants: [] };
    }
    const campaign = await this.prisma.campaigns.findUnique({ where: { id: BigInt(id) } });
    return { campaign: campaign ? { ...campaign, id: Number(campaign.id) } : null, restaurants: [] };
  }

  @Get('campaigns/item')
  itemCampaigns() {
    return { campaigns: [], total_size: 0 };
  }

  // ── Cashback ─────────────────────────────────────────────────────
  @Get('cashback/list')
  async cashbackList() {
    if (this.useMongo()) {
      const rows = await this.mongo.findMany<Record<string, unknown>>('cash_backs', {});
      return rows.map((r) => ({ ...r, id: Number(r.mysql_id) }));
    }
    const rows = await this.prisma.cash_backs.findMany();
    return rows.map((r) => ({ ...r, id: Number(r.id) }));
  }

  @Get('cashback/getCashback')
  getCashback() {
    return { cashback_amount: 0, message: 'no cashback' };
  }

  // ── Offline payment methods (public) ─────────────────────────────
  @Get('offline_payment_method_list')
  async offlinePaymentMethods() {
    if (this.useMongo()) {
      // Accept either a numeric flag (1) or boolean (true) for `status` in Mongo.
      const rows = await this.mongo.findMany<Record<string, unknown>>(
        'offline_payment_methods',
        { $or: [{ status: 1 }, { status: true }] },
      );
      return rows.map((r) => ({
        id: Number(r.mysql_id),
        method_name: r.method_name,
        method_fields: r.method_fields,
        method_informations: r.method_informations,
      }));
    }
    const rows = await this.prisma.offline_payment_methods.findMany({ where: { status: 1 } });
    return rows.map((r) => ({
      id: Number(r.id),
      method_name: r.method_name,
      method_fields: r.method_fields,
      method_informations: r.method_informations,
    }));
  }

  // ── Search ───────────────────────────────────────────────────────
  // Search-as-you-type fires one request per keystroke — exempt the search
  // endpoints from the rate limiter so fast typing never hits "Too Many
  // Requests" (they're read-only and cheap).
  @SkipThrottle()
  @Get('products/food-or-restaurant-search')
  async search(@Query('name') name?: string, @Query('limit') limitStr?: string) {
    const limit = parseInt(limitStr ?? '20', 10);
    const q = (name ?? '').trim();
    if (!q) return { products: { products: [] }, restaurants: { restaurants: [] } };
    if (this.useMongo()) {
      // Case-insensitive contains over indexed `name` fields.
      const escape = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = { $regex: escape, $options: 'i' };
      const [products, restaurants] = await Promise.all([
        this.mongo.findMany<Record<string, unknown>>('foods', { name: re, status: true }, { limit }),
        this.mongo.findMany<Record<string, unknown>>('restaurants', { name: re, status: true }, { limit }),
      ]);
      return {
        products: {
          total_size: products.length,
          limit,
          offset: 1,
          products: products.map((r) => ({
            ...r,
            id: Number(r.mysql_id),
            price: this.num(r.price),
            tax: this.num(r.tax),
            discount: this.num(r.discount),
            restaurant_id: Number(r.mysql_restaurant_id ?? r.restaurant_id ?? 0),
            category_id: r.mysql_category_id !== undefined && r.mysql_category_id !== null
              ? Number(r.mysql_category_id)
              : (r.category_id !== undefined && r.category_id !== null ? Number(r.category_id) : null),
          })),
        },
        restaurants: {
          total_size: restaurants.length,
          limit,
          offset: 1,
          restaurants: restaurants.map((r) => ({
            ...r,
            id: Number(r.mysql_id),
            zone_id: r.mysql_zone_id !== undefined && r.mysql_zone_id !== null
              ? Number(r.mysql_zone_id)
              : (r.zone_id !== undefined && r.zone_id !== null ? Number(r.zone_id) : null),
            vendor_id: Number(r.mysql_vendor_id ?? r.vendor_id ?? 0),
            tax: this.num(r.tax),
            minimum_order: this.num(r.minimum_order),
            minimum_shipping_charge: this.num(r.minimum_shipping_charge),
            comission: r.comission !== undefined && r.comission !== null ? this.num(r.comission) : null,
          })),
        },
      };
    }
    const [products, restaurants] = await Promise.all([
      this.prisma.food.findMany({ where: { name: { contains: q }, status: true }, take: limit }),
      this.prisma.restaurants.findMany({ where: { name: { contains: q }, status: true }, take: limit }),
    ]);
    return {
      products: {
        total_size: products.length,
        limit,
        offset: 1,
        products: products.map((r) => ({ ...r, id: Number(r.id), price: Number(r.price), tax: Number(r.tax), discount: Number(r.discount), restaurant_id: Number(r.restaurant_id), category_id: r.category_id ? Number(r.category_id) : null })),
      },
      restaurants: {
        total_size: restaurants.length,
        limit,
        offset: 1,
        restaurants: restaurants.map((r) => ({ ...r, id: Number(r.id), zone_id: r.zone_id ? Number(r.zone_id) : null, vendor_id: Number(r.vendor_id), tax: Number(r.tax), minimum_order: Number(r.minimum_order), minimum_shipping_charge: Number(r.minimum_shipping_charge), comission: r.comission !== null ? Number(r.comission) : null })),
      },
    };
  }

  @Get('products/set-menu')
  setMenu() {
    return { menus: [], total_size: 0 };
  }

  /** Full product search — invoked from customer app's search results page
   *  with the same query params that Laravel used. Returns the same shape
   *  as `food-or-restaurant-search` but only the products half. */
  @SkipThrottle()
  @Get('products/search')
  async productsSearch(
    @Query('name') name?: string,
    @Query('offset') offsetStr?: string,
    @Query('limit') limitStr?: string,
    @Query('min_price') minPriceStr?: string,
    @Query('max_price') maxPriceStr?: string,
  ) {
    const limit = parseInt(limitStr ?? '10', 10);
    const offset = parseInt(offsetStr ?? '1', 10);
    const minPrice = parseFloat(minPriceStr ?? '0');
    const maxPrice = maxPriceStr ? parseFloat(maxPriceStr) : Infinity;
    const q = (name ?? '').trim();
    const filter: Record<string, unknown> = { status: true };
    if (q) {
      const escape = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.name = { $regex: escape, $options: 'i' };
    }
    if (!this.useMongo()) {
      return { total_size: 0, limit, offset, products: [] };
    }
    const all = await this.mongo.findMany<Record<string, unknown>>('foods', filter);
    const priceFiltered = all.filter((f) => {
      const p = Number(f.price ?? 0);
      return p >= minPrice && p <= maxPrice;
    });
    const start = Math.max(0, (offset - 1) * limit);
    const slice = priceFiltered.slice(start, start + limit);
    return {
      total_size: priceFiltered.length,
      limit, offset,
      products: slice.map((r) => ({
        ...r,
        id: Number(r.mysql_id),
        price: this.num(r.price),
        tax: this.num(r.tax),
        discount: this.num(r.discount),
        restaurant_id: Number(r.mysql_restaurant_id ?? r.restaurant_id ?? 0),
        category_id: r.mysql_category_id !== undefined && r.mysql_category_id !== null
          ? Number(r.mysql_category_id)
          : (r.category_id !== undefined && r.category_id !== null ? Number(r.category_id) : null),
      })),
    };
  }

  /** Full restaurant search — same as above but for restaurants. */
  @SkipThrottle()
  @Get('restaurants/search')
  async restaurantsSearch(
    @Query('name') name?: string,
    @Query('offset') offsetStr?: string,
    @Query('limit') limitStr?: string,
  ) {
    const limit = parseInt(limitStr ?? '10', 10);
    const offset = parseInt(offsetStr ?? '1', 10);
    const q = (name ?? '').trim();
    const filter: Record<string, unknown> = { status: true };
    if (q) {
      const escape = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.name = { $regex: escape, $options: 'i' };
    }
    if (!this.useMongo()) {
      return { total_size: 0, limit, offset, restaurants: [] };
    }
    const all = await this.mongo.findMany<Record<string, unknown>>('restaurants', filter);
    const start = Math.max(0, (offset - 1) * limit);
    const slice = all.slice(start, start + limit);
    return {
      total_size: all.length,
      limit, offset,
      restaurants: slice.map((r) => ({
        ...r,
        id: Number(r.mysql_id),
        zone_id: r.mysql_zone_id !== undefined && r.mysql_zone_id !== null
          ? Number(r.mysql_zone_id)
          : (r.zone_id !== undefined && r.zone_id !== null ? Number(r.zone_id) : null),
        vendor_id: Number(r.mysql_vendor_id ?? r.vendor_id ?? 0),
        tax: this.num(r.tax),
        minimum_order: this.num(r.minimum_order),
        minimum_shipping_charge: this.num(r.minimum_shipping_charge),
        comission: r.comission !== undefined && r.comission !== null ? this.num(r.comission) : null,
      })),
    };
  }

  /** Flutter Food Details → Reviews tab calls /products/reviews/:id and expects
   *  the WRAPPED shape { rating_count, avg_rating, rating[], reviews[] } with
   *  each review enriched (customer name + avatar + order id). The bare list
   *  endpoint below is kept for any caller that wants the flat array. */
  @Get('products/reviews/:id')
  async productReviewsByPath(@Param('id') idStr: string) {
    const id = parseInt(idStr, 10);
    const empty = { rating_count: 0, avg_rating: 0, rating: [0, 0, 0, 0, 0], reviews: [] as unknown[] };
    if (!Number.isFinite(id) || !this.useMongo()) return empty;

    const rows = await this.mongo.findMany<Record<string, unknown>>(
      'reviews',
      { $or: [{ food_id: id }, { mysql_food_id: id }], status: { $ne: false } },
      { sort: { mysql_id: -1 }, limit: 100 },
    );
    if (rows.length === 0) return empty;

    const userIds = Array.from(new Set(rows.map((r) => Number(r.mysql_user_id ?? r.user_id ?? 0)).filter((n) => n > 0)));
    const users = userIds.length
      ? await this.mongo.findMany<{ mysql_id: number; f_name?: string; l_name?: string; phone?: string; image?: string }>('users', { mysql_id: { $in: userIds } })
      : [];
    const userMap = new Map(users.map((u) => [Number(u.mysql_id), u]));

    // Distribution indexed Excellent(5★) → Poor(1★): dist[5 - rating].
    const dist = [0, 0, 0, 0, 0];
    let sum = 0, n = 0;
    for (const r of rows) {
      const rt = Math.max(0, Math.min(5, Math.round(Number(r.rating ?? 0))));
      if (rt >= 1) { dist[5 - rt] += 1; sum += rt; n += 1; }
    }
    const avg = n ? Math.round((sum / n) * 10) / 10 : 0;

    const reviews = rows.map((r) => {
      const uid = Number(r.mysql_user_id ?? r.user_id ?? 0);
      const u = userMap.get(uid);
      const orderId = r.mysql_order_id ?? r.order_id ?? null;
      return {
        id: Number(r.mysql_id),
        comment: r.comment ?? null,
        rating: Number(r.rating ?? 0),
        order_id: orderId != null ? Number(orderId) : null,
        created_at: r.created_at ?? null,
        updated_at: r.updated_at ?? r.created_at ?? null,
        reply: r.reply ?? null,
        customer_name: u ? `${u.f_name ?? ''} ${u.l_name ?? ''}`.trim() || null : null,
        customer_phone: u?.phone ?? null,
        customer: u ? {
          id: uid,
          f_name: u.f_name ?? null,
          l_name: u.l_name ?? null,
          phone: u.phone ?? null,
          image_full_url: storageFullUrl('profile', u.image ?? null),
        } : null,
      };
    });

    return { rating_count: rows.length, avg_rating: avg, rating: dist, reviews };
  }

  @Get('products/reviews')
  async productReviews(@Query('product_id') idStr?: string) {
    const id = parseInt(idStr ?? '', 10);
    if (!Number.isFinite(id)) return [];
    if (this.useMongo()) {
      // Migrated review docs may key the food FK as either `food_id` or
      // `mysql_food_id`. Match both to be safe.
      const rows = await this.mongo.findMany<Record<string, unknown>>(
        'reviews',
        { $or: [{ food_id: id }, { mysql_food_id: id }], status: true },
        { sort: { mysql_id: -1 }, limit: 50 },
      );
      return rows.map((r) => ({
        id: Number(r.mysql_id),
        food_id: Number(r.food_id ?? r.mysql_food_id ?? 0),
        user_id: Number(r.user_id ?? r.mysql_user_id ?? 0),
        comment: r.comment,
        rating: r.rating,
        attachment: r.attachment,
        created_at: r.created_at,
        reply: r.reply,
        reply_at: r.reply_at,
      }));
    }
    const rows = await this.prisma.reviews.findMany({ where: { food_id: BigInt(id), status: true }, orderBy: { id: 'desc' }, take: 50 });
    return rows.map((r) => ({
      id: Number(r.id),
      food_id: Number(r.food_id),
      user_id: Number(r.user_id),
      comment: r.comment,
      rating: r.rating,
      attachment: r.attachment,
      created_at: r.created_at,
      reply: r.reply,
      reply_at: r.reply_at,
    }));
  }

  // Require customer auth so the reviewer is captured (the app doesn't send
  // user_id) — otherwise every review showed "Reviewer Not Found".
  @HttpCode(200)
  @Post('products/reviews/submit')
  @UseGuards(AuthGuard)
  @RequireAuth('customer')
  async submitProductReview(@Req() req: AuthedRequest, @Body() body: Record<string, unknown> = {}) {
    if (!this.useMongo()) return { message: 'review submitted' };
    const foodId = Number(body.food_id ?? body.product_id ?? 0);
    const rating = Math.max(1, Math.min(5, Math.round(Number(body.rating ?? 0))));
    if (!foodId || !rating) return { errors: [{ code: 'input', message: 'food_id and rating are required' }] };
    const food = await this.mongo.findByMysqlId<{ mysql_id: number; mysql_restaurant_id?: number | null }>('foods', foodId);
    if (!food) return { errors: [{ code: 'food', message: 'not found' }] };
    const restId = Number(food.mysql_restaurant_id ?? 0);
    // The app sometimes sends order_id as the string "null" → Number() = NaN.
    // Only keep a real, finite order id.
    const oidRaw = Number(body.order_id);
    const orderId = Number.isFinite(oidRaw) && oidRaw > 0 ? oidRaw : null;
    const userId = Number(req.actor!.id) || (body.user_id ? Number(body.user_id) : null);
    const now = new Date();
    const nextId = await this.mongo.nextMysqlId('reviews');
    await this.mongo.insertOne('reviews', {
      mysql_id: nextId,
      mysql_food_id: foodId,
      food_id: foodId,
      mysql_restaurant_id: restId || null,
      mysql_user_id: userId,
      user_id: userId,
      mysql_order_id: orderId,
      order_id: orderId,
      status: true,
      comment: body.comment ? String(body.comment) : null,
      rating,
      created_at: now,
      updated_at: now,
    });
    await this.recomputeRating('foods', foodId, { mysql_food_id: foodId });
    if (restId) await this.recomputeRating('restaurants', restId, { mysql_restaurant_id: restId });
    return { message: 'review submitted' };
  }

  /** Recompute avg_rating + rating_count for a food or restaurant from its
   *  reviews, so the new rating shows up immediately. */
  private async recomputeRating(collection: string, mysqlId: number, match: Record<string, unknown>) {
    const agg = await this.mongo.aggregate<{ _id: null; avg: number; count: number }>('reviews', [
      { $match: match },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    const avg = agg[0]?.avg ?? 0;
    const count = agg[0]?.count ?? 0;
    await this.mongo.updateOne(collection, { mysql_id: mysqlId }, {
      avg_rating: Math.round(avg * 10) / 10,
      rating_count: count,
      updated_at: new Date(),
    });
  }

  @Get('products/recommended/most-reviewed')
  async recommendedMostReviewed() {
    if (this.useMongo()) {
      // Mongo food docs don't have a `rating_count` field; sort by `order_count`
      // as the closest popularity proxy. Falls back to insertion order for ties.
      const rows = await this.mongo.findMany<Record<string, unknown>>(
        'foods',
        { status: true },
        { sort: { order_count: -1 }, limit: 10 },
      );
      return {
        products: rows.map((r) => ({
          ...r,
          id: Number(r.mysql_id),
          price: this.num(r.price),
          tax: this.num(r.tax),
          discount: this.num(r.discount),
          restaurant_id: Number(r.mysql_restaurant_id ?? r.restaurant_id ?? 0),
          category_id: r.mysql_category_id !== undefined && r.mysql_category_id !== null
            ? Number(r.mysql_category_id)
            : (r.category_id !== undefined && r.category_id !== null ? Number(r.category_id) : null),
        })),
      };
    }
    const rows = await this.prisma.food.findMany({ where: { status: true }, orderBy: { rating_count: 'desc' }, take: 10 });
    return { products: rows.map((r) => ({ ...r, id: Number(r.id), price: Number(r.price), tax: Number(r.tax), discount: Number(r.discount), restaurant_id: Number(r.restaurant_id), category_id: r.category_id ? Number(r.category_id) : null })) };
  }

  @Get('restaurants/reviews')
  async restaurantReviews(@Query('restaurant_id') idStr?: string) {
    const id = parseInt(idStr ?? '', 10);
    if (!Number.isFinite(id)) return [];
    if (this.useMongo()) {
      // status:{$ne:false} keeps reviews migrated/created WITHOUT a status field
      // (status:true silently dropped them → "No review found").
      const rows = await this.mongo.findMany<Record<string, unknown>>(
        'reviews',
        { $or: [{ restaurant_id: id }, { mysql_restaurant_id: id }], status: { $ne: false } },
        { sort: { mysql_id: -1 }, limit: 50 },
      );
      // The customer app's ReviewModel reads customer_name + food_name +
      // food_image_full_url, so enrich each review.
      const foodIds = Array.from(new Set(rows.map((r) => Number(r.mysql_food_id ?? r.food_id ?? 0)).filter((n) => n > 0)));
      const userIds = Array.from(new Set(rows.map((r) => Number(r.mysql_user_id ?? r.user_id ?? 0)).filter((n) => n > 0)));
      const [foods, users] = await Promise.all([
        foodIds.length ? this.mongo.findMany<{ mysql_id: number; name?: string; image?: string }>('foods', { mysql_id: { $in: foodIds } }) : Promise.resolve([]),
        userIds.length ? this.mongo.findMany<{ mysql_id: number; f_name?: string; l_name?: string }>('users', { mysql_id: { $in: userIds } }) : Promise.resolve([]),
      ]);
      const foodMap = new Map(foods.map((f) => [Number(f.mysql_id), f]));
      const userMap = new Map(users.map((u) => [Number(u.mysql_id), u]));
      return rows.map((r) => {
        const food = foodMap.get(Number(r.mysql_food_id ?? r.food_id ?? 0));
        const u = userMap.get(Number(r.mysql_user_id ?? r.user_id ?? 0));
        return {
          id: Number(r.mysql_id),
          food_id: Number(r.food_id ?? r.mysql_food_id ?? 0),
          food_name: food?.name ?? null,
          food_image_full_url: storageFullUrl('product', (food?.image as string | null | undefined) ?? null),
          customer_name: u ? `${u.f_name ?? ''} ${u.l_name ?? ''}`.trim() || 'Customer' : 'Customer',
          comment: r.comment ?? null,
          rating: r.rating ?? 0,
          reply: r.reply ?? null,
          created_at: r.created_at ?? null,
          updated_at: r.updated_at ?? r.created_at ?? null,
        };
      });
    }
    const rows = await this.prisma.reviews.findMany({ where: { restaurant_id: BigInt(id), status: true }, orderBy: { id: 'desc' }, take: 50 });
    return rows.map((r) => ({
      id: Number(r.id),
      food_id: Number(r.food_id),
      user_id: Number(r.user_id),
      comment: r.comment,
      rating: r.rating,
      created_at: r.created_at,
    }));
  }

  @Get('restaurants/dine-in')
  dineInRestaurants() {
    return { restaurants: [], total_size: 0 };
  }

  @Get('restaurants/recently-viewed-restaurants')
  recentlyViewed() {
    return [];
  }

  @Get('advertisement/list')
  async advertisementList() {
    if (this.useMongo()) {
      const rows = await this.mongo.findMany<Record<string, unknown>>(
        'advertisements',
        { status: { $in: ['approved', 'running'] } },
        { sort: { priority: 1 }, limit: 20 },
      );
      const img = (f: unknown) => {
        const s = f && String(f).trim() ? String(f) : '';
        if (!s) return null;
        return /^https?:\/\//i.test(s) ? s : storageFullUrl('advertisement', s);
      };
      // Resolve the linked restaurants so we can (a) drop ads whose restaurant
      // no longer exists — tapping one would 404 — and (b) embed the restaurant
      // name/logo the highlight card shows.
      const restIds = Array.from(new Set(rows
        .map((r) => Number(r.mysql_restaurant_id ?? r.restaurant_id ?? 0))
        .filter((n) => n > 0)));
      const restaurants = restIds.length
        ? await this.mongo.findMany<{ mysql_id: number; name?: string | null; logo?: string | null; cover_photo?: string | null; status?: boolean | null; active?: boolean | null }>(
            'restaurants', { mysql_id: { $in: restIds } })
        : [];
      const restMap = new Map(restaurants.map((r) => [Number(r.mysql_id), r]));
      return rows
        // Only keep ads whose restaurant exists AND is live (status + active) —
        // tapping an ad for an inactive restaurant shows "Restaurant is not
        // available", which is exactly what we want to avoid here.
        .filter((r) => {
          const rest = restMap.get(Number(r.mysql_restaurant_id ?? r.restaurant_id ?? 0));
          return !!rest && rest.status !== false && rest.active !== false;
        })
        .map((r) => {
          const rid = Number(r.mysql_restaurant_id ?? r.restaurant_id ?? 0);
          const rest = restMap.get(rid);
          // Fall back to the restaurant's own cover/logo when the ad has no
          // image of its own, so the highlight card never shows a grey box.
          const coverUrl = img(r.cover_image) ?? storageFullUrl('restaurant/cover', rest?.cover_photo ?? null) ?? storageFullUrl('restaurant', rest?.logo ?? null);
          const profileUrl = img(r.profile_image) ?? storageFullUrl('restaurant', rest?.logo ?? null);
          return {
            ...r,
            id: Number(r.mysql_id),
            restaurant_id: rid,
            restaurant_status: 1,
            restaurant_name: rest?.name ?? null,
            restaurant_logo_full_url: storageFullUrl('restaurant', rest?.logo ?? null),
            created_by_id: Number(r.mysql_created_by_id ?? r.created_by_id ?? 0),
            cover_image_full_url: coverUrl,
            profile_image_full_url: profileUrl,
            video_attachment_full_url: img(r.video_attachment),
          };
        });
    }
    // Prisma fallback: catch the inevitable MySQL-unreachable error so the
    // app keeps working in Mongo-only deployments where USE_MONGO_EXTRAS=1
    // is the expectation, but a misroute lands here anyway.
    try {
      const rows = await this.prisma.advertisements.findMany({ where: { status: 'approved' }, orderBy: { priority: 'asc' }, take: 20 });
      return rows.map((r) => ({ ...r, id: Number(r.id), restaurant_id: Number(r.restaurant_id), created_by_id: Number(r.created_by_id) }));
    } catch {
      return [];
    }
  }

  // ── Misc lookups ─────────────────────────────────────────────────
  @Get('food/get-allergy-name-list')
  async allergies() {
    if (this.useMongo()) {
      const rows = await this.mongo.findMany<Record<string, unknown>>('allergies', {});
      return rows.map((r) => ({ ...r, id: Number(r.mysql_id) }));
    }
    const rows = await this.prisma.allergies.findMany();
    return rows.map((r) => ({ ...r, id: Number(r.id) }));
  }

  @Get('food/get-nutrition-name-list')
  async nutritions() {
    if (this.useMongo()) {
      const rows = await this.mongo.findMany<Record<string, unknown>>('nutritions', {});
      return rows.map((r) => ({ ...r, id: Number(r.mysql_id) }));
    }
    const rows = await this.prisma.nutritions.findMany();
    return rows.map((r) => ({ ...r, id: Number(r.id) }));
  }

  @Get('get-vehicles')
  async vehicles() {
    if (this.useMongo()) {
      const rows = await this.mongo.findMany<Record<string, unknown>>('vehicles', { status: true });
      return rows.map((r) => ({ ...r, id: Number(r.mysql_id) }));
    }
    const rows = await this.prisma.vehicles.findMany({ where: { status: true } });
    return rows.map((r) => ({ ...r, id: Number(r.id) }));
  }

  @Get('vehicle/extra_charge')
  vehicleExtraCharge() {
    return { extra_charges: 0 };
  }

  @Get('most-tips')
  mostTips() {
    return [10, 20, 30, 50, 100];
  }

  @Get('dm-shifts')
  async dmShifts() {
    if (this.useMongo()) {
      const rows = await this.mongo.findMany<Record<string, unknown>>('shifts', { status: true });
      return rows.map((r) => ({ ...r, id: Number(r.mysql_id) }));
    }
    const rows = await this.prisma.shifts.findMany({ where: { status: true } });
    return rows.map((r) => ({ ...r, id: Number(r.id) }));
  }

  @Get('taxvat/get-taxVat-list')
  taxList() {
    return [];
  }

  @HttpCode(200)
  @Post('newsletter/subscribe')
  newsletter() {
    return { message: 'subscribed' };
  }
}
