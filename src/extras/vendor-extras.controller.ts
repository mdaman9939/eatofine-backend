import { Body, Controller, Delete, Get, Post, Query, Req, UseGuards, HttpCode } from '@nestjs/common';
import { AuthGuard, RequireAuth } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';

// Vendor (restaurant app) endpoints beyond order management. For the demo
// we expose the resources the app reads and stub the writes/reports so the
// restaurant Flutter app can navigate every screen without 404s.
@Controller('vendor')
@UseGuards(AuthGuard)
@RequireAuth('vendor')
export class VendorExtrasController {
  constructor(private readonly prisma: PrismaService) {}

  // ── Profile ───────────────────────────────────────────────────────
  @Get('profile')
  async profile(@Req() req: AuthedRequest) {
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

  @HttpCode(200)
  @Post('update-profile')
  async updateProfile(@Req() req: AuthedRequest, @Body() body: { f_name?: string; l_name?: string; email?: string; phone?: string }) {
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) if (v !== undefined) data[k] = v;
    if (Object.keys(data).length) {
      await this.prisma.vendors.update({ where: { id: req.actor!.id }, data });
    }
    return { message: 'Profile updated' };
  }

  @HttpCode(200)
  @Post('update-fcm-token')
  fcmToken() { return { message: 'token-updated' }; }

  @HttpCode(200)
  @Post('update-active-status')
  async toggleActive(@Req() req: AuthedRequest, @Body() body: { status?: boolean }) {
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

  @HttpCode(200)
  @Post('update-basic-info')
  basicInfo() { return { message: 'basic info updated' }; }

  @HttpCode(200)
  @Post('update-business-setup')
  businessSetup() { return { message: 'business setup updated' }; }

  @HttpCode(200)
  @Post('add-dine-in-table-number')
  addDineInTable() { return { message: 'added' }; }

  @HttpCode(200)
  @Delete('remove-account')
  remove() { return { message: 'Not available in demo' }; }

  // ── Orders summary ───────────────────────────────────────────────
  @Get('current-orders')
  async currentOrders(@Req() req: AuthedRequest) {
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

  @HttpCode(200)
  @Post('product/store')
  productStore() { return { message: 'product created' }; }

  @HttpCode(200)
  @Post('product/update')
  productUpdate() { return { message: 'product updated' }; }

  @HttpCode(200)
  @Delete('product/delete')
  productDelete() { return { message: 'product deleted' }; }

  @Get('product/reviews')
  async productReviews(@Query('product_id') idStr?: string) {
    const id = parseInt(idStr ?? '', 10);
    if (!Number.isFinite(id)) return [];
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
    const rows = await this.prisma.categories.findMany({ where: { parent_id: 0, status: true } });
    return rows.map((r) => ({ id: Number(r.id), name: r.name, image: r.image, status: r.status }));
  }

  @Get('categories/childes')
  childCategories(@Query('parent_id') idStr?: string) {
    const id = parseInt(idStr ?? '0', 10);
    return this.prisma.categories.findMany({ where: { parent_id: id, status: true } }).then((rows) =>
      rows.map((r) => ({ id: Number(r.id), name: r.name, image: r.image, status: r.status })),
    );
  }

  @Get('categories/category-wise-products')
  categoryProducts() { return { products: [], total_size: 0 }; }

  // ── Add-ons + attributes ─────────────────────────────────────────
  @Get('addon')
  async vendorAddons(@Req() req: AuthedRequest) {
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
    const rows = await this.prisma.attributes.findMany();
    return rows.map((r) => ({ id: Number(r.id), name: r.name }));
  }

  // ── Delivery man (vendor view) ───────────────────────────────────
  @Get('delivery-man/list')
  async vendorDmList(@Req() req: AuthedRequest) {
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
  @Get('earning-report')
  earningReport() { return { total: 0, today: 0, this_week: 0, this_month: 0 }; }
  @Get('get-order-report')
  orderReport() { return { delivered: 0, canceled: 0, returned: 0 }; }
  @Get('get-food-wise-report')
  foodReport() { return { data: [] }; }
  @Get('get-campaign-order-report')
  campaignReport() { return { data: [] }; }
  @Get('get-tax-report')
  taxReport() { return { data: [], total: 0 }; }
  @Get('get-disbursement-report')
  disbursementReport() { return { data: [], total: 0 }; }
  @Get('get-expense')
  expenseReport() { return { data: [], total: 0 }; }
  @Get('get-transaction-report')
  transactionReport() { return { data: [], total: 0 }; }
  @HttpCode(200)
  @Post('generate-transaction-statement')
  generateStatement() { return { message: 'not available in demo' }; }
  @Get('get-searched-food')
  searchedFood() { return { products: [] }; }

  // ── Notifications + messages ─────────────────────────────────────
  @Get('notifications')
  async vendorNotifications() {
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
  businessPlan() { return { commission: 1, subscription: 0 }; }

  @Get('package-view')
  packageView() { return { package: null, transactions: [] }; }
  @HttpCode(200)
  @Post('subscription-transaction')
  subscriptionTransaction() { return { message: 'not available' }; }
  @Get('subscription/payment/api')
  subscriptionPayment() { return { redirect_url: null }; }
  @HttpCode(200)
  @Post('cancel-subscription')
  cancelSubscription() { return { message: 'canceled' }; }

  // ── Schedule + restaurant config ─────────────────────────────────
  @Get('schedule')
  async schedule(@Req() req: AuthedRequest) {
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
