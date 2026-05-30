import { Controller, Get, Post, Query, HttpCode } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Public catalog endpoints that aren't under the existing CatalogController.
// These mostly return seeded data or sensible empty arrays for the demo.
@Controller()
export class CatalogExtrasController {
  constructor(private readonly prisma: PrismaService) {}

  // ── Coupons ──────────────────────────────────────────────────────
  @Get('coupon/list')
  async couponList() {
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
    const rows = await this.prisma.cuisines.findMany({ where: { status: true } });
    return rows.map((r) => ({ id: Number(r.id), name: r.name, image: r.image, slug: r.slug }));
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
    const rows = await this.prisma.addon_categories.findMany({ where: { status: true } });
    return rows.map((r) => ({ id: Number(r.id), name: r.name, status: r.status, slug: r.slug }));
  }

  // ── Campaigns ────────────────────────────────────────────────────
  @Get('campaigns/basic')
  async basicCampaigns() {
    const rows = await this.prisma.campaigns.findMany({ where: { status: true }, orderBy: { id: 'desc' } });
    return rows.map((r) => ({ id: Number(r.id), title: r.title, description: r.description, image: r.image, start_date: r.start_date, end_date: r.end_date }));
  }

  @Get('campaigns/basic-campaign-details')
  async basicCampaignDetails(@Query('basic_campaign_id') idStr?: string) {
    const id = parseInt(idStr ?? '', 10);
    if (!Number.isFinite(id)) return { campaign: null, restaurants: [] };
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
    const rows = await this.prisma.offline_payment_methods.findMany({ where: { status: 1 } });
    return rows.map((r) => ({
      id: Number(r.id),
      method_name: r.method_name,
      method_fields: r.method_fields,
      method_informations: r.method_informations,
    }));
  }

  // ── Search ───────────────────────────────────────────────────────
  @Get('products/food-or-restaurant-search')
  async search(@Query('name') name?: string, @Query('limit') limitStr?: string) {
    const limit = parseInt(limitStr ?? '20', 10);
    const q = (name ?? '').trim();
    if (!q) return { products: { products: [] }, restaurants: { restaurants: [] } };
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

  @Get('products/reviews')
  async productReviews(@Query('product_id') idStr?: string) {
    const id = parseInt(idStr ?? '', 10);
    if (!Number.isFinite(id)) return [];
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

  @HttpCode(200)
  @Post('products/reviews/submit')
  submitProductReview() {
    return { message: 'review submitted' };
  }

  @Get('products/recommended/most-reviewed')
  async recommendedMostReviewed() {
    const rows = await this.prisma.food.findMany({ where: { status: true }, orderBy: { rating_count: 'desc' }, take: 10 });
    return { products: rows.map((r) => ({ ...r, id: Number(r.id), price: Number(r.price), tax: Number(r.tax), discount: Number(r.discount), restaurant_id: Number(r.restaurant_id), category_id: r.category_id ? Number(r.category_id) : null })) };
  }

  @Get('restaurants/reviews')
  async restaurantReviews(@Query('restaurant_id') idStr?: string) {
    const id = parseInt(idStr ?? '', 10);
    if (!Number.isFinite(id)) return [];
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
    const rows = await this.prisma.advertisements.findMany({ where: { status: 'approved' }, orderBy: { priority: 'asc' }, take: 20 });
    return rows.map((r) => ({ ...r, id: Number(r.id), restaurant_id: Number(r.restaurant_id), created_by_id: Number(r.created_by_id) }));
  }

  // ── Misc lookups ─────────────────────────────────────────────────
  @Get('food/get-allergy-name-list')
  async allergies() {
    const rows = await this.prisma.allergies.findMany();
    return rows.map((r) => ({ ...r, id: Number(r.id) }));
  }

  @Get('food/get-nutrition-name-list')
  async nutritions() {
    const rows = await this.prisma.nutritions.findMany();
    return rows.map((r) => ({ ...r, id: Number(r.id) }));
  }

  @Get('get-vehicles')
  async vehicles() {
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
