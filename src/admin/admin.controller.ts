import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
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

const STORAGE_ROOT =
  process.env.STORAGE_ROOT ??
  path.resolve(__dirname, '../../../../storage/app/public');

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
  constructor(private readonly admin: AdminService) {}

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
  ) {
    return this.admin.listOrders(toInt(limit, 50), toInt(offset, 0), status || undefined, q || undefined);
  }

  @Get('orders/:id')
  orderDetail(@Param('id', ParseIntPipe) id: number) {
    return this.admin.getOrder(id);
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

  @Get('restaurants/:id')
  restaurantDetail(@Param('id', ParseIntPipe) id: number) {
    return this.admin.getRestaurant(id);
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

  @Patch('delivery-men/:id/status')
  updateDMStatus(@Param('id', ParseIntPipe) id: number, @Body() body: { status: boolean }) {
    return this.admin.updateDeliveryManStatus(id, body.status);
  }

  @Patch('delivery-men/:id/approval')
  updateDMApproval(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { approval: 'approved' | 'denied' },
  ) {
    return this.admin.approveDeliveryMan(id, body.approval);
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

  @Get('food/:id')
  foodDetail(@Param('id', ParseIntPipe) id: number) {
    return this.admin.getFood(id);
  }

  @Patch('food/:id/status')
  updateFoodStatus(@Param('id', ParseIntPipe) id: number, @Body() body: { status: boolean }) {
    return this.admin.updateFoodStatus(id, body.status);
  }

  @Patch('food/:id/recommended')
  updateFoodRecommended(@Param('id', ParseIntPipe) id: number, @Body() body: { recommended: boolean }) {
    return this.admin.updateFoodRecommended(id, body.recommended);
  }

  // ── Categories ────────────────────────────────────────────────────────

  @Get('categories')
  categories(@Query('parent_id') parentId?: string) {
    return this.admin.listCategories(parentId !== undefined ? parseInt(parentId, 10) : undefined);
  }

  @Post('categories')
  createCategory(@Body() body: { name: string; parent_id?: number; position?: number; priority?: number }) {
    return this.admin.createCategory(body);
  }

  @Patch('categories/:id')
  updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; status?: boolean; priority?: number },
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

  @Delete('banners/:id')
  deleteBanner(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteBanner(id);
  }

  // ── Zones ─────────────────────────────────────────────────────────────

  @Get('zones')
  zones() {
    return this.admin.listZones();
  }

  @Patch('zones/:id/status')
  updateZoneStatus(@Param('id', ParseIntPipe) id: number, @Body() body: { status: boolean }) {
    return this.admin.updateZoneStatus(id, body.status);
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
  salesSummary(@Query('days') days?: string) {
    return this.admin.salesSummary(toInt(days, 30));
  }

  @Get('reports/restaurant-earnings')
  restaurantEarnings(@Query('limit') limit?: string) {
    return this.admin.restaurantEarnings(toInt(limit, 10));
  }

  @Get('reports/admin-earnings')
  adminEarningReport(@Query('days') days?: string) {
    return this.admin.adminEarningReport(toInt(days, 30));
  }

  @Get('reports/top-customers')
  customerReport(@Query('limit') limit?: string) {
    return this.admin.customerReport(toInt(limit, 10));
  }

  @Get('reports/top-deliverymen')
  deliverymanEarningReport(@Query('limit') limit?: string) {
    return this.admin.deliverymanEarningReport(toInt(limit, 10));
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
  @Delete('attributes/:id')
  deleteAttribute(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteAttribute(id);
  }

  // ── Marketing ────────────────────────────────────────────────────────

  @Get('campaigns')
  campaigns(@Query('limit') limit?: string, @Query('offset') offset?: string, @Query('q') q?: string) {
    return this.admin.listCampaigns({ limit: toInt(limit, 50), offset: toInt(offset, 0), q: q || undefined });
  }
  @Post('campaigns')
  createCampaign(@Body() body: Parameters<AdminService['createCampaign']>[0]) {
    return this.admin.createCampaign(body);
  }
  @Patch('campaigns/:id/status')
  updateCampaignStatus(@Param('id', ParseIntPipe) id: number, @Body() body: { status: boolean }) {
    return this.admin.updateCampaignStatus(id, body.status);
  }
  @Delete('campaigns/:id')
  deleteCampaign(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteCampaign(id);
  }

  @Get('advertisements')
  advertisements(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.admin.listAdvertisements({ limit: toInt(limit, 50), offset: toInt(offset, 0) });
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
  disbursements(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.admin.listDisbursements({ limit: toInt(limit, 50), offset: toInt(offset, 0) });
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
  @Patch('offline-payment-methods/:id/status')
  updateOfflinePaymentMethodStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: number },
  ) {
    return this.admin.updateOfflinePaymentMethodStatus(id, body.status);
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

  @Get('admin-roles')
  adminRoles() {
    return this.admin.listAdminRoles();
  }
  @Post('admin-roles')
  createAdminRole(@Body() body: { name: string; modules?: string }) {
    return this.admin.createAdminRole(body);
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
  uploadImage(
    @UploadedFile() file: MulterFile | undefined,
    @Query('dir') dir?: string,
  ) {
    if (!file) throw new BadRequestException({ errors: [{ code: 'file', message: 'file is required' }] });
    if (!dir || !ALLOWED_UPLOAD_DIRS.has(dir)) {
      throw new BadRequestException({
        errors: [{ code: 'dir', message: `dir must be one of: ${[...ALLOWED_UPLOAD_DIRS].join(', ')}` }],
      });
    }
    const ext = (path.extname(file.originalname) || '.bin').toLowerCase();
    if (!/^\.(png|jpe?g|webp|gif)$/i.test(ext)) {
      throw new BadRequestException({ errors: [{ code: 'ext', message: 'only png/jpg/jpeg/webp/gif allowed' }] });
    }
    const safeDir = path.join(STORAGE_ROOT, dir);
    fs.mkdirSync(safeDir, { recursive: true });
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const targetPath = path.join(safeDir, filename);
    fs.writeFileSync(targetPath, file.buffer);
    return { ok: true, filename, path: `${dir}/${filename}`, url: `/storage/${dir}/${filename}` };
  }
}

function toInt(v: string | undefined, fallback: number): number {
  const n = parseInt(v ?? '', 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}
