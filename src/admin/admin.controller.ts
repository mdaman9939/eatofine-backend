import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as path from 'path';
import type { AuthedRequest } from '../auth/auth.guard';

interface MulterFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}
import { RequireAuth } from '../auth/auth.guard';
import { AdminService } from './admin.service';
import { MongoDataService } from '../mongo/mongo-data.service';
import { compressImage } from '../common/image-compress';

// Mirrors main.ts resolution: prefer repo-local storage (deploy-friendly),
// fall back to monorepo project-root storage (local dev). main.ts already
// picked the path that exists on disk; we don't re-check here because both
// admin uploads and customer uploads should land where the static
// middleware is currently serving from.
const STORAGE_ROOT = (() => {
  if (process.env.STORAGE_ROOT) return process.env.STORAGE_ROOT;
  const fs = require('fs') as typeof import('fs');
  const repoLocal = path.resolve(__dirname, '../../storage/app/public');
  const monorepo = path.resolve(__dirname, '../../../../storage/app/public');
  return fs.existsSync(repoLocal) ? repoLocal : monorepo;
})();

const ALLOWED_UPLOAD_DIRS = new Set([
  'banner',
  'restaurant',
  'restaurant/cover',
  'product',
  'category',
  'cuisine',
  'campaign',
  'notification',
  'vendor',
  'delivery-man',
]);

@Controller('admin')
@RequireAuth('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly mongo: MongoDataService,
  ) {}

  // ── Self / profile ────────────────────────────────────────────────────

  @Get('me')
  me(@Req() req: AuthedRequest) {
    return this.admin.getMe(req.actor!.id);
  }

  @Patch('me')
  updateMe(@Req() req: AuthedRequest, @Body() body: Parameters<AdminService['updateMe']>[1]) {
    return this.admin.updateMe(req.actor!.id, body);
  }

  @Patch('me/password')
  changeMyPassword(@Req() req: AuthedRequest, @Body() body: Parameters<AdminService['changeMyPassword']>[1]) {
    return this.admin.changeMyPassword(req.actor!.id, body);
  }

  // ── Dashboard ─────────────────────────────────────────────────────────

  @Get('dashboard/stats')
  stats() {
    return this.admin.dashboardStats();
  }

  // ── Orders ────────────────────────────────────────────────────────────

  @Get('orders')
  orders(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('order_type') orderType?: string,
  ) {
    return this.admin.listOrders(toInt(limit, 50), toInt(offset, 0), status || undefined, q || undefined, orderType || undefined);
  }

  @Get('orders/:id')
  orderDetail(@Param('id', ParseIntPipe) id: number) {
    return this.admin.getOrder(id);
  }

  @Post('pos/place-order')
  @HttpCode(200)
  placePosOrder(@Body() body: Parameters<AdminService['createPosOrder']>[0]) {
    return this.admin.createPosOrder(body);
  }

  @Patch('orders/:id/status')
  updateOrderStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: string; reason?: string },
  ) {
    return this.admin.updateOrderStatus(id, body.status, body.reason);
  }

  // ── Restaurants ───────────────────────────────────────────────────────

  @Get('restaurants')
  restaurants(@Query('limit') limit?: string, @Query('offset') offset?: string, @Query('q') q?: string) {
    return this.admin.listRestaurants(toInt(limit, 50), toInt(offset, 0), q || undefined);
  }

  @Post('restaurants')
  @HttpCode(200)
  createRestaurant(@Body() body: Parameters<AdminService['createRestaurant']>[0]) {
    return this.admin.createRestaurant(body);
  }

  // STATIC sub-paths MUST be declared before `:id` — otherwise Nest matches
  // them as an id and ParseIntPipe throws 400. Same pattern for delivery-men.
  @Get('restaurants/pending')
  restaurantsPending() {
    return this.admin.listPendingRestaurants();
  }

  @Get('restaurants/bulk-export')
  bulkExportRestaurants() {
    return this.admin.bulkExportRestaurants();
  }

  @Post('restaurants/bulk-import')
  @HttpCode(200)
  bulkImportRestaurants(@Body() body: { rows?: Array<Record<string, unknown>> }) {
    return this.admin.bulkImportRestaurants(body.rows ?? []);
  }

  @Patch('restaurants/:id/approve')
  approveRestaurant(@Param('id', ParseIntPipe) id: number) {
    return this.admin.updateRestaurantApproval(id, 'approved');
  }

  @Patch('restaurants/:id/reject')
  rejectRestaurant(@Param('id', ParseIntPipe) id: number, @Body() body: { reason?: string }) {
    return this.admin.updateRestaurantApproval(id, 'rejected', body.reason);
  }

  @Get('restaurants/:id')
  restaurantDetail(@Param('id', ParseIntPipe) id: number) {
    return this.admin.getRestaurant(id);
  }

  @Get('restaurants/:id/tabs')
  restaurantTabs(@Param('id', ParseIntPipe) id: number, @Query('limit') limit?: string) {
    return this.admin.getRestaurantTabs(id, toInt(limit, 50));
  }

  @Patch('restaurants/:id')
  updateRestaurant(@Param('id', ParseIntPipe) id: number, @Body() body: Parameters<AdminService['updateRestaurant']>[1]) {
    return this.admin.updateRestaurant(id, body);
  }

  // ── Users ─────────────────────────────────────────────────────────────

  @Get('users')
  users(@Query('limit') limit?: string, @Query('offset') offset?: string, @Query('q') q?: string) {
    return this.admin.listUsers(toInt(limit, 50), toInt(offset, 0), q || undefined);
  }

  @Get('users/:id')
  userDetail(@Param('id', ParseIntPipe) id: number) {
    return this.admin.getUser(id);
  }

  @Patch('users/:id/status')
  updateUserStatus(@Param('id', ParseIntPipe) id: number, @Body() body: { status: boolean }) {
    return this.admin.updateUserStatus(id, body.status);
  }

  // ── Vendors ───────────────────────────────────────────────────────────

  @Get('vendors')
  vendors(@Query('limit') limit?: string, @Query('offset') offset?: string, @Query('q') q?: string) {
    return this.admin.listVendors(toInt(limit, 50), toInt(offset, 0), q || undefined);
  }

  @Patch('vendors/:id/status')
  updateVendorStatus(@Param('id', ParseIntPipe) id: number, @Body() body: { status: boolean }) {
    return this.admin.updateVendorStatus(id, body.status);
  }

  // ── Delivery men ──────────────────────────────────────────────────────

  @Get('delivery-men')
  deliveryMen(@Query('limit') limit?: string, @Query('offset') offset?: string, @Query('q') q?: string) {
    return this.admin.listDeliveryMen(toInt(limit, 50), toInt(offset, 0), q || undefined);
  }

  @Post('delivery-men')
  @HttpCode(200)
  createDeliveryMan(@Body() body: Parameters<AdminService['createDeliveryMan']>[0]) {
    return this.admin.createDeliveryMan(body);
  }

  // STATIC sub-paths MUST be declared before `:id` — same reason as the
  // restaurants block above.
  @Get('delivery-men/pending')
  deliveryMenPending() {
    return this.admin.listPendingDeliveryMen();
  }

  @Get('delivery-men/:id')
  deliveryManDetail(@Param('id', ParseIntPipe) id: number) {
    return this.admin.getDeliveryMan(id);
  }

  @Patch('delivery-men/:id/approve')
  approveDeliveryMan(@Param('id', ParseIntPipe) id: number) {
    return this.admin.updateDeliveryManApproval(id, 'approved');
  }

  @Patch('delivery-men/:id/reject')
  rejectDeliveryMan(@Param('id', ParseIntPipe) id: number, @Body() body: { reason?: string }) {
    return this.admin.updateDeliveryManApproval(id, 'rejected', body.reason);
  }

  @Patch('delivery-men/:id/status')
  updateDMStatus(@Param('id', ParseIntPipe) id: number, @Body() body: { status: boolean }) {
    return this.admin.updateDeliveryManStatus(id, body.status);
  }

  @Patch('delivery-men/:id')
  updateDeliveryMan(@Param('id', ParseIntPipe) id: number, @Body() body: Parameters<AdminService['updateDeliveryMan']>[1]) {
    return this.admin.updateDeliveryMan(id, body);
  }

  @Patch('delivery-men/:id/approval')
  updateDMApproval(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { approval: 'approved' | 'denied' },
  ) {
    return this.admin.approveDeliveryMan(id, body.approval);
  }

  @Delete('delivery-men/:id')
  deleteDeliveryMan(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteDeliveryMan(id);
  }

  // ── Food ──────────────────────────────────────────────────────────────

  @Get('food')
  food(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('q') q?: string,
    @Query('restaurant_id') restaurantId?: string,
  ) {
    return this.admin.listFood(toInt(limit, 50), toInt(offset, 0), q || undefined, restaurantId ? parseInt(restaurantId, 10) : undefined);
  }

  @Post('food')
  @HttpCode(200)
  createFood(@Body() body: Parameters<AdminService['createFood']>[0]) {
    return this.admin.createFood(body);
  }

  @Post('food/bulk-import')
  @HttpCode(200)
  bulkImportFood(@Body() body: { rows?: Array<Record<string, unknown>> }) {
    return this.admin.bulkImportFood(body.rows ?? []);
  }

  @Get('food/bulk-export')
  bulkExportFood() {
    return this.admin.bulkExportFood();
  }

  @Get('food/:id')
  foodDetail(@Param('id', ParseIntPipe) id: number) {
    return this.admin.getFood(id);
  }

  @Patch('food/:id')
  updateFood(@Param('id', ParseIntPipe) id: number, @Body() body: Parameters<AdminService['updateFood']>[1]) {
    return this.admin.updateFood(id, body);
  }

  @Patch('food/:id/status')
  updateFoodStatus(@Param('id', ParseIntPipe) id: number, @Body() body: { status: boolean }) {
    return this.admin.updateFoodStatus(id, body.status);
  }

  @Patch('food/:id/recommended')
  updateFoodRecommended(@Param('id', ParseIntPipe) id: number, @Body() body: { recommended: boolean }) {
    return this.admin.updateFoodRecommended(id, body.recommended);
  }

  @Delete('food/:id')
  deleteFood(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteFood(id);
  }

  // ── Categories ────────────────────────────────────────────────────────

  @Get('categories')
  categories(@Query('parent_id') parentId?: string) {
    return this.admin.listCategories(parentId !== undefined ? parseInt(parentId, 10) : undefined);
  }

  @Get('categories/bulk-export')
  bulkExportCategories() {
    return this.admin.bulkExportCategories();
  }

  @Post('categories/bulk-import')
  @HttpCode(200)
  bulkImportCategories(@Body() body: { rows?: Array<Record<string, unknown>> }) {
    return this.admin.bulkImportCategories(body.rows ?? []);
  }

  @Post('categories')
  createCategory(@Body() body: Parameters<AdminService['createCategory']>[0]) {
    return this.admin.createCategory(body);
  }

  @Patch('categories/:id')
  updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Parameters<AdminService['updateCategory']>[1],
  ) {
    return this.admin.updateCategory(id, body);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteCategory(id);
  }

  // ── Cuisines ──────────────────────────────────────────────────────────

  @Get('cuisines')
  cuisines() {
    return this.admin.listCuisines();
  }

  @Post('cuisines')
  createCuisine(@Body() body: { name: string }) {
    return this.admin.createCuisine(body);
  }

  @Patch('cuisines/:id')
  updateCuisine(@Param('id', ParseIntPipe) id: number, @Body() body: { name?: string; status?: boolean }) {
    return this.admin.updateCuisine(id, body);
  }

  @Delete('cuisines/:id')
  deleteCuisine(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteCuisine(id);
  }

  // ── Coupons ───────────────────────────────────────────────────────────

  @Get('coupons')
  coupons() {
    return this.admin.listCoupons();
  }

  @Post('coupons')
  createCoupon(@Body() body: Parameters<AdminService['createCoupon']>[0]) {
    return this.admin.createCoupon(body);
  }

  @Patch('coupons/:id/status')
  updateCouponStatus(@Param('id', ParseIntPipe) id: number, @Body() body: { status: boolean }) {
    return this.admin.updateCouponStatus(id, body.status);
  }

  @Patch('coupons/:id')
  updateCoupon(@Param('id', ParseIntPipe) id: number, @Body() body: Parameters<AdminService['updateCoupon']>[1]) {
    return this.admin.updateCoupon(id, body);
  }

  @Delete('coupons/:id')
  deleteCoupon(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteCoupon(id);
  }

  // ── Banners ───────────────────────────────────────────────────────────

  @Get('banners')
  banners() {
    return this.admin.listBanners();
  }

  @Post('banners')
  createBanner(@Body() body: Parameters<AdminService['createBanner']>[0]) {
    return this.admin.createBanner(body);
  }

  @Patch('banners/:id/status')
  updateBannerStatus(@Param('id', ParseIntPipe) id: number, @Body() body: { status: boolean }) {
    return this.admin.updateBannerStatus(id, body.status);
  }

  @Patch('banners/:id')
  updateBanner(@Param('id', ParseIntPipe) id: number, @Body() body: Parameters<AdminService['updateBanner']>[1]) {
    return this.admin.updateBanner(id, body);
  }

  @Delete('banners/:id')
  deleteBanner(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteBanner(id);
  }

  // ── Zones ─────────────────────────────────────────────────────────────

  @Get('zones')
  zones(@Query('zone_for') zoneFor?: string) {
    return this.admin.listZones(zoneFor || undefined);
  }

  @Post('zones')
  @HttpCode(200)
  createZone(@Body() body: Parameters<AdminService['createZone']>[0]) {
    return this.admin.createZone(body);
  }

  @Patch('zones/:id/status')
  updateZoneStatus(@Param('id', ParseIntPipe) id: number, @Body() body: { status: boolean }) {
    return this.admin.updateZoneStatus(id, body.status);
  }

  @Get('zones/:id')
  zoneDetail(@Param('id', ParseIntPipe) id: number) {
    return this.admin.getZone(id);
  }

  @Patch('zones/:id')
  updateZone(@Param('id', ParseIntPipe) id: number, @Body() body: Parameters<AdminService['updateZone']>[1]) {
    return this.admin.updateZone(id, body);
  }

  @Delete('zones/:id')
  deleteZone(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteZone(id);
  }

  // ── Newsletter subscribers ────────────────────────────────────────────

  @Get('newsletter')
  newsletterList(@Query('limit') limit?: string) {
    return this.admin.listNewsletterSubscribers(toInt(limit, 200));
  }

  @Delete('newsletter/:id')
  deleteNewsletterSubscriber(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteNewsletterSubscriber(id);
  }

  // NOTE: Restaurant /pending and /:id approve/reject routes were moved up
  // next to the `/restaurants` GET so static paths win over `:id` matching.
  // See comment near line 110.

  // ── Customer wallet — admin credit ────────────────────────────────────

  @Post('customer-wallet/add-fund')
  @HttpCode(200)
  addCustomerWalletFund(@Body() body: { user_id?: number; amount?: number; reason?: string }) {
    return this.admin.addCustomerWalletFund(body);
  }

  @Get('customer-wallet/add-fund/history')
  customerWalletFundHistory(@Query('limit') limit?: string) {
    return this.admin.listCustomerWalletFundHistory(toInt(limit, 50));
  }

  // ── Public pages (T&C, Privacy, About, etc.) ──────────────────────────

  @Get('pages/:slug')
  getPage(@Param('slug') slug: string) {
    return this.admin.getPublicPage(slug);
  }

  @Patch('pages/:slug')
  updatePage(@Param('slug') slug: string, @Body() body: { content?: string; title?: string }) {
    return this.admin.upsertPublicPage(slug, body);
  }

  // ── Promotional banners ───────────────────────────────────────────────

  @Get('promotional-banners')
  listPromotionalBanners() {
    return this.admin.listPromotionalBanners();
  }

  @Post('promotional-banners')
  @HttpCode(200)
  createPromotionalBanner(@Body() body: { title?: string; subtitle?: string; image?: string; type?: string; target?: string; cta_text?: string; zone_id?: number }) {
    return this.admin.createPromotionalBanner(body);
  }

  @Patch('promotional-banners/:id/status')
  togglePromotionalBanner(@Param('id', ParseIntPipe) id: number, @Body() body: { status: boolean }) {
    return this.admin.togglePromotionalBanner(id, body.status);
  }

  @Delete('promotional-banners/:id')
  deletePromotionalBanner(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deletePromotionalBanner(id);
  }

  // ── Email templates ──────────────────────────────────────────────────

  @Get('email-templates')
  listEmailTemplates() {
    return this.admin.listEmailTemplates();
  }

  @Post('email-templates')
  @HttpCode(200)
  createEmailTemplate(@Body() body: { event?: string; audience?: string; subject?: string; body?: string }) {
    return this.admin.createEmailTemplate(body);
  }

  @Patch('email-templates/:id')
  updateEmailTemplate(@Param('id', ParseIntPipe) id: number, @Body() body: { subject?: string; body?: string; status?: boolean }) {
    return this.admin.updateEmailTemplate(id, body);
  }

  @Delete('email-templates/:id')
  deleteEmailTemplate(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteEmailTemplate(id);
  }

  // ── DM bonuses ───────────────────────────────────────────────────────

  @Get('dm-bonuses')
  listDmBonuses() {
    return this.admin.listDmBonuses();
  }

  @Post('dm-bonuses')
  @HttpCode(200)
  createDmBonus(@Body() body: { name?: string; type?: string; amount?: number; trigger?: string }) {
    return this.admin.createDmBonus(body);
  }

  @Patch('dm-bonuses/:id/status')
  toggleDmBonus(@Param('id', ParseIntPipe) id: number, @Body() body: { status: boolean }) {
    return this.admin.toggleDmBonus(id, body.status);
  }

  @Delete('dm-bonuses/:id')
  deleteDmBonus(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteDmBonus(id);
  }

  // ── DM incentives ────────────────────────────────────────────────────

  @Get('dm-incentives')
  listDmIncentives(@Query('status') status?: string) {
    return this.admin.listDmIncentives(status);
  }

  @Patch('dm-incentives/:id/approve')
  approveDmIncentive(@Param('id', ParseIntPipe) id: number) {
    return this.admin.updateDmIncentiveStatus(id, 'approved');
  }

  @Patch('dm-incentives/:id/reject')
  rejectDmIncentive(@Param('id', ParseIntPipe) id: number, @Body() body: { reason?: string }) {
    return this.admin.updateDmIncentiveStatus(id, 'rejected', body.reason);
  }

  // ── Subscription orders (filter from existing orders) ────────────────

  @Get('subscription-orders')
  subscriptionOrders() {
    return this.admin.listSubscriptionOrders();
  }

  // ── Activity log ─────────────────────────────────────────────────────

  @Get('activity-log')
  activityLog(@Query('limit') limit?: string) {
    return this.admin.listActivityLog(toInt(limit, 100));
  }

  // ── Dispatch (pending pickups) ───────────────────────────────────────

  @Get('dispatch')
  listDispatchOrders(@Query('type') type?: string) {
    return this.admin.listDispatchOrders(type);
  }

  @Patch('dispatch/:order_id/assign')
  assignDispatch(@Param('order_id', ParseIntPipe) orderId: number, @Body() body: { delivery_man_id: number }) {
    return this.admin.assignOrderToDeliveryMan(orderId, body.delivery_man_id);
  }

  // ── Gallery / file listing ───────────────────────────────────────────

  @Get('gallery')
  listGalleryFiles(@Query('folder') folder?: string) {
    return this.admin.listGalleryFiles(folder);
  }

  // ── Clean database ───────────────────────────────────────────────────

  @Post('clean-database')
  @HttpCode(200)
  cleanDatabase(@Body() body: { collections?: string[]; confirm?: string }) {
    return this.admin.cleanDatabaseCollections(body);
  }

  // ── Business settings ─────────────────────────────────────────────────

  @Get('business-settings')
  businessSettings(@Query('prefix') prefix?: string) {
    return this.admin.listBusinessSettings(prefix || undefined);
  }

  @Patch('business-settings')
  upsertBusinessSettings(@Body() body: { settings: Array<{ key: string; value: string | null }> }) {
    return this.admin.upsertBusinessSettings(body);
  }

  // ── Reports ───────────────────────────────────────────────────────────

  @Get('reports/sales-summary')
  salesSummary(
    @Query('days') days?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('zone_id') zoneId?: string,
    @Query('restaurant_id') restaurantId?: string,
  ) {
    return this.admin.salesSummary(toInt(days, 30), {
      from: from || undefined,
      to: to || undefined,
      zoneId: zoneId ? parseInt(zoneId, 10) : undefined,
      restaurantId: restaurantId ? parseInt(restaurantId, 10) : undefined,
    });
  }

  @Get('reports/expense-details')
  expenseDetails(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('zone_id') zoneId?: string,
    @Query('restaurant_id') restaurantId?: string,
  ) {
    return this.admin.expenseDetails({
      from: from || undefined,
      to: to || undefined,
      zoneId: zoneId ? parseInt(zoneId, 10) : undefined,
      restaurantId: restaurantId ? parseInt(restaurantId, 10) : undefined,
    });
  }

  @Get('reports/transaction-details')
  transactionDetails(
    @Query('days') days?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('zone_id') zoneId?: string,
    @Query('restaurant_id') restaurantId?: string,
  ) {
    return this.admin.transactionDetails({
      days: toInt(days, 30),
      from: from || undefined,
      to: to || undefined,
      zoneId: zoneId ? parseInt(zoneId, 10) : undefined,
      restaurantId: restaurantId ? parseInt(restaurantId, 10) : undefined,
    });
  }

  @Get('reports/restaurant-earnings')
  restaurantEarnings(
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('zone_id') zoneId?: string,
    @Query('restaurant_id') restaurantId?: string,
  ) {
    return this.admin.restaurantEarnings(toInt(limit, 10), {
      from: from || undefined,
      to: to || undefined,
      zoneId: zoneId ? parseInt(zoneId, 10) : undefined,
      restaurantId: restaurantId ? parseInt(restaurantId, 10) : undefined,
    });
  }

  @Get('reports/admin-earnings')
  adminEarningReport(
    @Query('days') days?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('zone_id') zoneId?: string,
    @Query('restaurant_id') restaurantId?: string,
  ) {
    return this.admin.adminEarningReport(toInt(days, 30), {
      from: from || undefined,
      to: to || undefined,
      zoneId: zoneId ? parseInt(zoneId, 10) : undefined,
      restaurantId: restaurantId ? parseInt(restaurantId, 10) : undefined,
    });
  }

  @Get('reports/top-customers')
  customerReport(
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('zone_id') zoneId?: string,
    @Query('restaurant_id') restaurantId?: string,
  ) {
    return this.admin.customerReport(toInt(limit, 10), {
      from: from || undefined,
      to: to || undefined,
      zoneId: zoneId ? parseInt(zoneId, 10) : undefined,
      restaurantId: restaurantId ? parseInt(restaurantId, 10) : undefined,
    });
  }

  @Get('reports/top-foods')
  topFoods(
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('zone_id') zoneId?: string,
    @Query('restaurant_id') restaurantId?: string,
  ) {
    return this.admin.topFoods(toInt(limit, 50), {
      from: from || undefined,
      to: to || undefined,
      zoneId: zoneId ? parseInt(zoneId, 10) : undefined,
      restaurantId: restaurantId ? parseInt(restaurantId, 10) : undefined,
    });
  }

  @Get('reports/top-deliverymen')
  deliverymanEarningReport(
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('zone_id') zoneId?: string,
    @Query('restaurant_id') restaurantId?: string,
  ) {
    return this.admin.deliverymanEarningReport(toInt(limit, 10), {
      from: from || undefined,
      to: to || undefined,
      zoneId: zoneId ? parseInt(zoneId, 10) : undefined,
      restaurantId: restaurantId ? parseInt(restaurantId, 10) : undefined,
    });
  }

  // ── Catalog extras ───────────────────────────────────────────────────

  @Get('add-ons')
  addOns(@Query('limit') limit?: string, @Query('offset') offset?: string, @Query('q') q?: string, @Query('restaurant_id') restaurantId?: string) {
    return this.admin.listAddOns({
      limit: toInt(limit, 50),
      offset: toInt(offset, 0),
      q: q || undefined,
      restaurantId: restaurantId ? parseInt(restaurantId, 10) : undefined,
    });
  }
  @Post('add-ons')
  createAddOn(@Body() body: Parameters<AdminService['createAddOn']>[0]) {
    return this.admin.createAddOn(body);
  }
  @Patch('add-ons/:id/status')
  updateAddOnStatus(@Param('id', ParseIntPipe) id: number, @Body() body: { status: boolean }) {
    return this.admin.updateAddOnStatus(id, body.status);
  }
  @Patch('add-ons/:id')
  updateAddOn(@Param('id', ParseIntPipe) id: number, @Body() body: Parameters<AdminService['updateAddOn']>[1]) {
    return this.admin.updateAddOn(id, body);
  }
  @Delete('add-ons/:id')
  deleteAddOn(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteAddOn(id);
  }

  @Get('addon-categories')
  addonCategories(@Query('limit') limit?: string, @Query('offset') offset?: string, @Query('q') q?: string) {
    return this.admin.listAddonCategories({ limit: toInt(limit, 100), offset: toInt(offset, 0), q: q || undefined });
  }
  @Post('addon-categories')
  createAddonCategory(@Body() body: { name: string }) {
    return this.admin.createAddonCategory(body);
  }
  @Patch('addon-categories/:id/status')
  updateAddonCategoryStatus(@Param('id', ParseIntPipe) id: number, @Body() body: { status: boolean }) {
    return this.admin.updateAddonCategoryStatus(id, body.status);
  }
  @Patch('addon-categories/:id')
  updateAddonCategory(@Param('id', ParseIntPipe) id: number, @Body() body: { name?: string }) {
    return this.admin.updateAddonCategory(id, body);
  }
  @Delete('addon-categories/:id')
  deleteAddonCategory(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteAddonCategory(id);
  }

  @Get('attributes')
  attributes() {
    return this.admin.listAttributes();
  }
  @Post('attributes')
  createAttribute(@Body() body: { name: string }) {
    return this.admin.createAttribute(body);
  }
  @Patch('attributes/:id')
  updateAttribute(@Param('id', ParseIntPipe) id: number, @Body() body: { name?: string }) {
    return this.admin.updateAttribute(id, body);
  }
  @Delete('attributes/:id')
  deleteAttribute(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteAttribute(id);
  }

  // ── Marketing ────────────────────────────────────────────────────────

  @Get('campaigns')
  campaigns(@Query('limit') limit?: string, @Query('offset') offset?: string, @Query('q') q?: string, @Query('type') type?: string) {
    return this.admin.listCampaigns({ limit: toInt(limit, 50), offset: toInt(offset, 0), q: q || undefined, type: type || undefined });
  }
  @Post('campaigns')
  createCampaign(@Body() body: Parameters<AdminService['createCampaign']>[0]) {
    return this.admin.createCampaign(body);
  }
  @Patch('campaigns/:id/status')
  updateCampaignStatus(@Param('id', ParseIntPipe) id: number, @Body() body: { status: boolean }) {
    return this.admin.updateCampaignStatus(id, body.status);
  }
  @Patch('campaigns/:id')
  updateCampaign(@Param('id', ParseIntPipe) id: number, @Body() body: Parameters<AdminService['updateCampaign']>[1]) {
    return this.admin.updateCampaign(id, body);
  }
  @Delete('campaigns/:id')
  deleteCampaign(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteCampaign(id);
  }

  @Get('advertisements')
  advertisements(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.admin.listAdvertisements({ limit: toInt(limit, 50), offset: toInt(offset, 0) });
  }
  @Post('advertisements')
  createAdvertisement(@Body() body: Parameters<AdminService['createAdvertisement']>[0]) {
    return this.admin.createAdvertisement(body);
  }
  @Delete('advertisements/:id')
  deleteAdvertisement(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteAdvertisement(id);
  }
  @Patch('advertisements/:id/status')
  updateAdvertisementStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: 'approved' | 'denied' | 'pending' | 'paused' | 'expired' | 'running' },
  ) {
    return this.admin.updateAdvertisementStatus(id, body.status);
  }

  @Get('cash-backs')
  cashBacks() {
    return this.admin.listCashBacks();
  }
  @Post('cash-backs')
  createCashBack(@Body() body: Parameters<AdminService['createCashBack']>[0]) {
    return this.admin.createCashBack(body);
  }
  @Patch('cash-backs/:id/status')
  updateCashBackStatus(@Param('id', ParseIntPipe) id: number, @Body() body: { status: boolean }) {
    return this.admin.updateCashBackStatus(id, body.status);
  }
  @Delete('cash-backs/:id')
  deleteCashBack(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteCashBack(id);
  }

  @Get('wallet-bonuses')
  walletBonuses() {
    return this.admin.listWalletBonuses();
  }
  @Post('wallet-bonuses')
  createWalletBonus(@Body() body: Parameters<AdminService['createWalletBonus']>[0]) {
    return this.admin.createWalletBonus(body);
  }
  @Patch('wallet-bonuses/:id/status')
  updateWalletBonusStatus(@Param('id', ParseIntPipe) id: number, @Body() body: { status: boolean }) {
    return this.admin.updateWalletBonusStatus(id, body.status);
  }
  @Delete('wallet-bonuses/:id')
  deleteWalletBonus(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteWalletBonus(id);
  }

  // ── Finance ──────────────────────────────────────────────────────────

  @Get('account-transactions')
  accountTransactions(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.admin.listAccountTransactions({ limit: toInt(limit, 50), offset: toInt(offset, 0) });
  }

  @Get('wallet-transactions')
  walletTransactions(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.admin.listWalletTransactions({ limit: toInt(limit, 50), offset: toInt(offset, 0) });
  }

  @Get('loyalty-point-transactions')
  loyaltyTransactions(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.admin.listLoyaltyPointTransactions({ limit: toInt(limit, 50), offset: toInt(offset, 0) });
  }

  @Get('cashback-histories')
  cashbackHistories(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.admin.listCashbackHistories({ limit: toInt(limit, 50), offset: toInt(offset, 0) });
  }

  @Get('disbursements')
  disbursements(@Query('limit') limit?: string, @Query('offset') offset?: string, @Query('type') type?: string) {
    return this.admin.listDisbursements({ limit: toInt(limit, 50), offset: toInt(offset, 0), type: type || undefined });
  }
  @Patch('disbursements/:id/status')
  updateDisbursementStatus(@Param('id', ParseIntPipe) id: number, @Body() body: { status: string }) {
    return this.admin.updateDisbursementStatus(id, body.status);
  }

  @Get('withdraw-requests')
  withdrawRequests(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('type') type?: string,
    @Query('approved') approved?: string,
  ) {
    return this.admin.listWithdrawRequests({
      limit: toInt(limit, 50),
      offset: toInt(offset, 0),
      type: type || undefined,
      approved: approved === undefined ? undefined : approved === 'true',
    });
  }

  @Patch('withdraw-requests/:id/approval')
  approveWithdrawRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { approved: boolean },
  ) {
    return this.admin.approveWithdrawRequest(id, body.approved);
  }

  @Get('withdrawal-methods')
  withdrawalMethods() {
    return this.admin.listWithdrawalMethods();
  }

  @Get('offline-payment-methods')
  offlinePaymentMethods() {
    return this.admin.listOfflinePaymentMethods();
  }
  @Post('offline-payment-methods')
  createOfflinePaymentMethod(@Body() body: Parameters<AdminService['createOfflinePaymentMethod']>[0]) {
    return this.admin.createOfflinePaymentMethod(body);
  }
  @Patch('offline-payment-methods/:id')
  updateOfflinePaymentMethod(@Param('id', ParseIntPipe) id: number, @Body() body: Parameters<AdminService['updateOfflinePaymentMethod']>[1]) {
    return this.admin.updateOfflinePaymentMethod(id, body);
  }
  @Patch('offline-payment-methods/:id/status')
  updateOfflinePaymentMethodStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: number },
  ) {
    return this.admin.updateOfflinePaymentMethodStatus(id, body.status);
  }
  @Delete('offline-payment-methods/:id')
  deleteOfflinePaymentMethod(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteOfflinePaymentMethod(id);
  }

  @Get('dm-earnings')
  provideDmEarnings(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.admin.listProvideDMEarnings({ limit: toInt(limit, 50), offset: toInt(offset, 0) });
  }

  // ── Content / comm ───────────────────────────────────────────────────

  @Get('contact-messages')
  contactMessages(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.admin.listContactMessages({ limit: toInt(limit, 50), offset: toInt(offset, 0) });
  }
  @Patch('contact-messages/:id/reply')
  replyContactMessage(@Param('id', ParseIntPipe) id: number, @Body() body: { reply: string }) {
    return this.admin.replyContactMessage(id, body.reply);
  }

  @Get('notifications')
  notifications(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.admin.listNotifications({ limit: toInt(limit, 50), offset: toInt(offset, 0) });
  }
  @Post('notifications')
  createNotification(@Body() body: Parameters<AdminService['createNotification']>[0]) {
    return this.admin.createNotification(body);
  }
  @Patch('notifications/:id')
  updateNotification(@Param('id', ParseIntPipe) id: number, @Body() body: Parameters<AdminService['updateNotification']>[1]) {
    return this.admin.updateNotification(id, body);
  }
  @Delete('notifications/:id')
  deleteNotification(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteNotification(id);
  }

  @Get('reviews')
  reviews(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.admin.listReviews({ limit: toInt(limit, 50), offset: toInt(offset, 0) });
  }
  @Patch('reviews/:id/reply')
  replyReview(@Param('id', ParseIntPipe) id: number, @Body() body: { reply: string }) {
    return this.admin.replyReview(id, body.reply);
  }

  @Get('dm-reviews')
  dmReviews(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.admin.listDMReviews({ limit: toInt(limit, 50), offset: toInt(offset, 0) });
  }

  @Get('faqs')
  faqs() {
    return this.admin.listFAQs();
  }
  @Post('faqs')
  createFAQ(@Body() body: Parameters<AdminService['createFAQ']>[0]) {
    return this.admin.createFAQ(body);
  }
  @Patch('faqs/:id')
  updateFAQ(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { question?: string; answer?: string; status?: boolean },
  ) {
    return this.admin.updateFAQ(id, body);
  }
  @Delete('faqs/:id')
  deleteFAQ(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteFAQ(id);
  }

  @Get('page-seo')
  pageSeo() {
    return this.admin.listPageSeo();
  }
  @Post('page-seo')
  upsertPageSeo(@Body() body: Parameters<AdminService['upsertPageSeo']>[0]) {
    return this.admin.upsertPageSeo(body);
  }

  @Get('social-media')
  socialMedia() {
    return this.admin.listSocialMedia();
  }
  @Post('social-media')
  createSocialMedia(@Body() body: { name: string; link: string }) {
    return this.admin.createSocialMedia(body);
  }
  @Patch('social-media/:id/status')
  updateSocialMediaStatus(@Param('id', ParseIntPipe) id: number, @Body() body: { status: boolean }) {
    return this.admin.updateSocialMediaStatus(id, body.status);
  }
  @Delete('social-media/:id')
  deleteSocialMedia(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteSocialMedia(id);
  }

  // ── System config ────────────────────────────────────────────────────

  @Get('employees')
  employees(@Query('limit') limit?: string, @Query('offset') offset?: string, @Query('q') q?: string) {
    return this.admin.listEmployees({ limit: toInt(limit, 50), offset: toInt(offset, 0), q: q || undefined });
  }
  @Post('employees')
  createEmployee(@Body() body: Parameters<AdminService['createEmployee']>[0]) {
    return this.admin.createEmployee(body);
  }
  @Get('employees/:id')
  employeeDetail(@Param('id', ParseIntPipe) id: number) {
    return this.admin.getEmployee(id);
  }
  @Patch('employees/:id')
  updateEmployee(@Param('id', ParseIntPipe) id: number, @Body() body: Parameters<AdminService['updateEmployee']>[1]) {
    return this.admin.updateEmployee(id, body);
  }
  @Delete('employees/:id')
  deleteEmployee(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteEmployee(id);
  }

  @Get('admin-roles')
  adminRoles() {
    return this.admin.listAdminRoles();
  }
  @Post('admin-roles')
  createAdminRole(@Body() body: { name: string; modules?: string }) {
    return this.admin.createAdminRole(body);
  }
  @Patch('admin-roles/:id')
  updateAdminRole(@Param('id', ParseIntPipe) id: number, @Body() body: { name?: string; modules?: string; status?: boolean }) {
    return this.admin.updateAdminRole(id, body);
  }
  @Delete('admin-roles/:id')
  deleteAdminRole(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteAdminRole(id);
  }

  @Get('subscription-packages')
  subscriptionPackages() {
    return this.admin.listSubscriptionPackages();
  }
  @Post('subscription-packages')
  createSubscriptionPackage(@Body() body: Parameters<AdminService['createSubscriptionPackage']>[0]) {
    return this.admin.createSubscriptionPackage(body);
  }
  @Patch('subscription-packages/:id/status')
  updateSubscriptionPackageStatus(@Param('id', ParseIntPipe) id: number, @Body() body: { status: boolean }) {
    return this.admin.updateSubscriptionPackageStatus(id, body.status);
  }
  @Delete('subscription-packages/:id')
  deleteSubscriptionPackage(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteSubscriptionPackage(id);
  }

  @Get('shifts')
  shifts() {
    return this.admin.listShifts();
  }
  @Post('shifts')
  createShift(@Body() body: Parameters<AdminService['createShift']>[0]) {
    return this.admin.createShift(body);
  }
  @Patch('shifts/:id/status')
  updateShiftStatus(@Param('id', ParseIntPipe) id: number, @Body() body: { status: boolean }) {
    return this.admin.updateShiftStatus(id, body.status);
  }
  @Delete('shifts/:id')
  deleteShift(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteShift(id);
  }

  @Get('vehicles')
  vehicles() {
    return this.admin.listVehicles();
  }
  @Post('vehicles')
  createVehicle(@Body() body: Parameters<AdminService['createVehicle']>[0]) {
    return this.admin.createVehicle(body);
  }
  @Patch('vehicles/:id/status')
  updateVehicleStatus(@Param('id', ParseIntPipe) id: number, @Body() body: { status: boolean }) {
    return this.admin.updateVehicleStatus(id, body.status);
  }
  @Delete('vehicles/:id')
  deleteVehicle(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteVehicle(id);
  }

  @Get('order-cancel-reasons')
  orderCancelReasons() {
    return this.admin.listOrderCancelReasons();
  }
  @Post('order-cancel-reasons')
  createOrderCancelReason(@Body() body: { reason: string; user_type: string }) {
    return this.admin.createOrderCancelReason(body);
  }
  @Patch('order-cancel-reasons/:id/status')
  updateOrderCancelReasonStatus(@Param('id', ParseIntPipe) id: number, @Body() body: { status: boolean }) {
    return this.admin.updateOrderCancelReasonStatus(id, body.status);
  }
  @Delete('order-cancel-reasons/:id')
  deleteOrderCancelReason(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteOrderCancelReason(id);
  }

  @Get('refund-reasons')
  refundReasons() {
    return this.admin.listRefundReasons();
  }
  @Post('refund-reasons')
  createRefundReason(@Body() body: { reason: string }) {
    return this.admin.createRefundReason(body);
  }
  @Delete('refund-reasons/:id')
  deleteRefundReason(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteRefundReason(id);
  }

  @Get('refunds')
  refunds(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.admin.listRefunds({ limit: toInt(limit, 50), offset: toInt(offset, 0) });
  }
  @Patch('refunds/:id/status')
  updateRefundStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: string; admin_note?: string },
  ) {
    return this.admin.updateRefundStatus(id, body.status, body.admin_note);
  }

  @Get('currencies')
  currencies() {
    return this.admin.listCurrencies();
  }

  @Get('tags')
  tags() {
    return this.admin.listTags();
  }

  @Get('translations')
  translations(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.admin.listTranslations({ limit: toInt(limit, 200), offset: toInt(offset, 0) });
  }

  // ── Image upload (multipart) ─────────────────────────────────────────
  // POST /admin/upload?dir=banner  with form field "file"
  // → 200 { ok: true, filename: "1747-...png", path: "banner/1747-...png" }
  // Caller then puts `filename` into the row's image column.

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadImage(
    @UploadedFile() file: MulterFile | undefined,
    @Query('dir') dir?: string,
    @Body() body?: Record<string, unknown>,
  ) {
    // Accept EITHER a multipart file (field "file") OR a base64 image in the
    // JSON body (the admin panel sends the latter for some forms). Without the
    // base64 path a large data-URL payload 413s ("request entity too large").
    let buffer: Buffer | undefined = file?.buffer;
    let originalName: string | undefined = file?.originalname;
    let mimetype: string | undefined = file?.mimetype;
    if ((!buffer || buffer.length === 0) && body) {
      const b64 = (body.image ?? body.file ?? body.photo ?? body.data ?? body.base64) as string | undefined;
      if (typeof b64 === 'string' && b64.trim().length > 0) {
        const m = /^data:(image\/[a-z0-9.+-]+);base64,(.*)$/is.exec(b64.trim());
        const raw = m ? m[2] : b64.trim();
        mimetype = m ? m[1] : (mimetype ?? 'image/png');
        try { buffer = Buffer.from(raw, 'base64'); } catch { buffer = undefined; }
        originalName = (body.filename as string | undefined) ?? `upload.${(mimetype.split('/')[1] || 'png')}`;
      }
    }
    if (!buffer || buffer.length === 0) throw new BadRequestException({ errors: [{ code: 'file', message: 'file is required' }] });
    if (!dir || !ALLOWED_UPLOAD_DIRS.has(dir)) {
      throw new BadRequestException({
        errors: [{ code: 'dir', message: `dir must be one of: ${[...ALLOWED_UPLOAD_DIRS].join(', ')}` }],
      });
    }
    let ext = (path.extname(originalName ?? '') || `.${(mimetype ?? 'image/png').split('/')[1] || 'bin'}`).toLowerCase();
    if (!/^\.(png|jpe?g|webp|gif)$/i.test(ext)) {
      throw new BadRequestException({ errors: [{ code: 'ext', message: 'only png/jpg/jpeg/webp/gif allowed' }] });
    }
    // Auto-compress to a small WebP (~150–300 KB). Fall back to the original
    // bytes if sharp can't process it (compressImage never throws).
    let data = buffer;
    let contentType = mimetype || 'image/png';
    try {
      const compressed = await compressImage(buffer);
      if (compressed) { data = compressed.buffer; ext = compressed.ext; contentType = compressed.contentType; }
    } catch { /* keep original bytes */ }

    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    // Disk write is best-effort — Render's disk can be read-only / the path may
    // not be creatable. mkdirSync + writeFileSync must NEVER 500 the upload.
    try {
      const safeDir = path.join(STORAGE_ROOT, dir);
      fs.mkdirSync(safeDir, { recursive: true });
      fs.writeFileSync(path.join(safeDir, filename), data);
    } catch { /* ignore — Mongo copy below is the durable store */ }

    // Durable copy in Mongo (served back by the /storage/* Mongo fallback in
    // main.ts). This is what actually persists the image, so await it and only
    // surface a clean error if it genuinely fails.
    try {
      await this.mongo.insertOne('uploads', {
        path: `${dir}/${filename}`,
        content_type: contentType,
        data,
        size: data.length,
        created_at: new Date(),
      });
    } catch {
      throw new BadRequestException({ errors: [{ code: 'upload', message: 'Could not store the image. Try a smaller file.' }] });
    }
    return { ok: true, filename, path: `${dir}/${filename}`, url: `/storage/${dir}/${filename}` };
  }
}

function toInt(v: string | undefined, fallback: number): number {
  const n = parseInt(v ?? '', 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}
