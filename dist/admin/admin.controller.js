"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const auth_guard_1 = require("../auth/auth.guard");
const admin_service_1 = require("./admin.service");
const STORAGE_ROOT = process.env.STORAGE_ROOT ??
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
let AdminController = class AdminController {
    admin;
    constructor(admin) {
        this.admin = admin;
    }
    me(req) {
        return this.admin.getMe(req.actor.id);
    }
    updateMe(req, body) {
        return this.admin.updateMe(req.actor.id, body);
    }
    changeMyPassword(req, body) {
        return this.admin.changeMyPassword(req.actor.id, body);
    }
    stats() {
        return this.admin.dashboardStats();
    }
    orders(limit, offset, status, q) {
        return this.admin.listOrders(toInt(limit, 50), toInt(offset, 0), status || undefined, q || undefined);
    }
    orderDetail(id) {
        return this.admin.getOrder(id);
    }
    updateOrderStatus(id, body) {
        return this.admin.updateOrderStatus(id, body.status, body.reason);
    }
    restaurants(limit, offset, q) {
        return this.admin.listRestaurants(toInt(limit, 50), toInt(offset, 0), q || undefined);
    }
    restaurantDetail(id) {
        return this.admin.getRestaurant(id);
    }
    updateRestaurant(id, body) {
        return this.admin.updateRestaurant(id, body);
    }
    users(limit, offset, q) {
        return this.admin.listUsers(toInt(limit, 50), toInt(offset, 0), q || undefined);
    }
    userDetail(id) {
        return this.admin.getUser(id);
    }
    updateUserStatus(id, body) {
        return this.admin.updateUserStatus(id, body.status);
    }
    vendors(limit, offset, q) {
        return this.admin.listVendors(toInt(limit, 50), toInt(offset, 0), q || undefined);
    }
    updateVendorStatus(id, body) {
        return this.admin.updateVendorStatus(id, body.status);
    }
    deliveryMen(limit, offset, q) {
        return this.admin.listDeliveryMen(toInt(limit, 50), toInt(offset, 0), q || undefined);
    }
    updateDMStatus(id, body) {
        return this.admin.updateDeliveryManStatus(id, body.status);
    }
    updateDMApproval(id, body) {
        return this.admin.approveDeliveryMan(id, body.approval);
    }
    food(limit, offset, q, restaurantId) {
        return this.admin.listFood(toInt(limit, 50), toInt(offset, 0), q || undefined, restaurantId ? parseInt(restaurantId, 10) : undefined);
    }
    foodDetail(id) {
        return this.admin.getFood(id);
    }
    updateFoodStatus(id, body) {
        return this.admin.updateFoodStatus(id, body.status);
    }
    updateFoodRecommended(id, body) {
        return this.admin.updateFoodRecommended(id, body.recommended);
    }
    categories(parentId) {
        return this.admin.listCategories(parentId !== undefined ? parseInt(parentId, 10) : undefined);
    }
    createCategory(body) {
        return this.admin.createCategory(body);
    }
    updateCategory(id, body) {
        return this.admin.updateCategory(id, body);
    }
    deleteCategory(id) {
        return this.admin.deleteCategory(id);
    }
    cuisines() {
        return this.admin.listCuisines();
    }
    createCuisine(body) {
        return this.admin.createCuisine(body);
    }
    updateCuisine(id, body) {
        return this.admin.updateCuisine(id, body);
    }
    deleteCuisine(id) {
        return this.admin.deleteCuisine(id);
    }
    coupons() {
        return this.admin.listCoupons();
    }
    createCoupon(body) {
        return this.admin.createCoupon(body);
    }
    updateCouponStatus(id, body) {
        return this.admin.updateCouponStatus(id, body.status);
    }
    deleteCoupon(id) {
        return this.admin.deleteCoupon(id);
    }
    banners() {
        return this.admin.listBanners();
    }
    createBanner(body) {
        return this.admin.createBanner(body);
    }
    updateBannerStatus(id, body) {
        return this.admin.updateBannerStatus(id, body.status);
    }
    deleteBanner(id) {
        return this.admin.deleteBanner(id);
    }
    zones() {
        return this.admin.listZones();
    }
    updateZoneStatus(id, body) {
        return this.admin.updateZoneStatus(id, body.status);
    }
    businessSettings(prefix) {
        return this.admin.listBusinessSettings(prefix || undefined);
    }
    upsertBusinessSettings(body) {
        return this.admin.upsertBusinessSettings(body);
    }
    salesSummary(days) {
        return this.admin.salesSummary(toInt(days, 30));
    }
    restaurantEarnings(limit) {
        return this.admin.restaurantEarnings(toInt(limit, 10));
    }
    adminEarningReport(days) {
        return this.admin.adminEarningReport(toInt(days, 30));
    }
    customerReport(limit) {
        return this.admin.customerReport(toInt(limit, 10));
    }
    deliverymanEarningReport(limit) {
        return this.admin.deliverymanEarningReport(toInt(limit, 10));
    }
    addOns(limit, offset, q, restaurantId) {
        return this.admin.listAddOns({
            limit: toInt(limit, 50),
            offset: toInt(offset, 0),
            q: q || undefined,
            restaurantId: restaurantId ? parseInt(restaurantId, 10) : undefined,
        });
    }
    createAddOn(body) {
        return this.admin.createAddOn(body);
    }
    updateAddOnStatus(id, body) {
        return this.admin.updateAddOnStatus(id, body.status);
    }
    deleteAddOn(id) {
        return this.admin.deleteAddOn(id);
    }
    addonCategories(limit, offset, q) {
        return this.admin.listAddonCategories({ limit: toInt(limit, 100), offset: toInt(offset, 0), q: q || undefined });
    }
    createAddonCategory(body) {
        return this.admin.createAddonCategory(body);
    }
    updateAddonCategoryStatus(id, body) {
        return this.admin.updateAddonCategoryStatus(id, body.status);
    }
    deleteAddonCategory(id) {
        return this.admin.deleteAddonCategory(id);
    }
    attributes() {
        return this.admin.listAttributes();
    }
    createAttribute(body) {
        return this.admin.createAttribute(body);
    }
    deleteAttribute(id) {
        return this.admin.deleteAttribute(id);
    }
    campaigns(limit, offset, q) {
        return this.admin.listCampaigns({ limit: toInt(limit, 50), offset: toInt(offset, 0), q: q || undefined });
    }
    createCampaign(body) {
        return this.admin.createCampaign(body);
    }
    updateCampaignStatus(id, body) {
        return this.admin.updateCampaignStatus(id, body.status);
    }
    deleteCampaign(id) {
        return this.admin.deleteCampaign(id);
    }
    advertisements(limit, offset) {
        return this.admin.listAdvertisements({ limit: toInt(limit, 50), offset: toInt(offset, 0) });
    }
    updateAdvertisementStatus(id, body) {
        return this.admin.updateAdvertisementStatus(id, body.status);
    }
    cashBacks() {
        return this.admin.listCashBacks();
    }
    walletBonuses() {
        return this.admin.listWalletBonuses();
    }
    createWalletBonus(body) {
        return this.admin.createWalletBonus(body);
    }
    updateWalletBonusStatus(id, body) {
        return this.admin.updateWalletBonusStatus(id, body.status);
    }
    deleteWalletBonus(id) {
        return this.admin.deleteWalletBonus(id);
    }
    accountTransactions(limit, offset) {
        return this.admin.listAccountTransactions({ limit: toInt(limit, 50), offset: toInt(offset, 0) });
    }
    walletTransactions(limit, offset) {
        return this.admin.listWalletTransactions({ limit: toInt(limit, 50), offset: toInt(offset, 0) });
    }
    loyaltyTransactions(limit, offset) {
        return this.admin.listLoyaltyPointTransactions({ limit: toInt(limit, 50), offset: toInt(offset, 0) });
    }
    cashbackHistories(limit, offset) {
        return this.admin.listCashbackHistories({ limit: toInt(limit, 50), offset: toInt(offset, 0) });
    }
    disbursements(limit, offset) {
        return this.admin.listDisbursements({ limit: toInt(limit, 50), offset: toInt(offset, 0) });
    }
    withdrawRequests(limit, offset, type, approved) {
        return this.admin.listWithdrawRequests({
            limit: toInt(limit, 50),
            offset: toInt(offset, 0),
            type: type || undefined,
            approved: approved === undefined ? undefined : approved === 'true',
        });
    }
    approveWithdrawRequest(id, body) {
        return this.admin.approveWithdrawRequest(id, body.approved);
    }
    withdrawalMethods() {
        return this.admin.listWithdrawalMethods();
    }
    offlinePaymentMethods() {
        return this.admin.listOfflinePaymentMethods();
    }
    updateOfflinePaymentMethodStatus(id, body) {
        return this.admin.updateOfflinePaymentMethodStatus(id, body.status);
    }
    provideDmEarnings(limit, offset) {
        return this.admin.listProvideDMEarnings({ limit: toInt(limit, 50), offset: toInt(offset, 0) });
    }
    contactMessages(limit, offset) {
        return this.admin.listContactMessages({ limit: toInt(limit, 50), offset: toInt(offset, 0) });
    }
    replyContactMessage(id, body) {
        return this.admin.replyContactMessage(id, body.reply);
    }
    notifications(limit, offset) {
        return this.admin.listNotifications({ limit: toInt(limit, 50), offset: toInt(offset, 0) });
    }
    createNotification(body) {
        return this.admin.createNotification(body);
    }
    deleteNotification(id) {
        return this.admin.deleteNotification(id);
    }
    reviews(limit, offset) {
        return this.admin.listReviews({ limit: toInt(limit, 50), offset: toInt(offset, 0) });
    }
    replyReview(id, body) {
        return this.admin.replyReview(id, body.reply);
    }
    dmReviews(limit, offset) {
        return this.admin.listDMReviews({ limit: toInt(limit, 50), offset: toInt(offset, 0) });
    }
    faqs() {
        return this.admin.listFAQs();
    }
    createFAQ(body) {
        return this.admin.createFAQ(body);
    }
    updateFAQ(id, body) {
        return this.admin.updateFAQ(id, body);
    }
    deleteFAQ(id) {
        return this.admin.deleteFAQ(id);
    }
    pageSeo() {
        return this.admin.listPageSeo();
    }
    upsertPageSeo(body) {
        return this.admin.upsertPageSeo(body);
    }
    socialMedia() {
        return this.admin.listSocialMedia();
    }
    createSocialMedia(body) {
        return this.admin.createSocialMedia(body);
    }
    updateSocialMediaStatus(id, body) {
        return this.admin.updateSocialMediaStatus(id, body.status);
    }
    deleteSocialMedia(id) {
        return this.admin.deleteSocialMedia(id);
    }
    employees(limit, offset, q) {
        return this.admin.listEmployees({ limit: toInt(limit, 50), offset: toInt(offset, 0), q: q || undefined });
    }
    adminRoles() {
        return this.admin.listAdminRoles();
    }
    createAdminRole(body) {
        return this.admin.createAdminRole(body);
    }
    deleteAdminRole(id) {
        return this.admin.deleteAdminRole(id);
    }
    subscriptionPackages() {
        return this.admin.listSubscriptionPackages();
    }
    createSubscriptionPackage(body) {
        return this.admin.createSubscriptionPackage(body);
    }
    updateSubscriptionPackageStatus(id, body) {
        return this.admin.updateSubscriptionPackageStatus(id, body.status);
    }
    deleteSubscriptionPackage(id) {
        return this.admin.deleteSubscriptionPackage(id);
    }
    shifts() {
        return this.admin.listShifts();
    }
    createShift(body) {
        return this.admin.createShift(body);
    }
    updateShiftStatus(id, body) {
        return this.admin.updateShiftStatus(id, body.status);
    }
    deleteShift(id) {
        return this.admin.deleteShift(id);
    }
    vehicles() {
        return this.admin.listVehicles();
    }
    createVehicle(body) {
        return this.admin.createVehicle(body);
    }
    updateVehicleStatus(id, body) {
        return this.admin.updateVehicleStatus(id, body.status);
    }
    deleteVehicle(id) {
        return this.admin.deleteVehicle(id);
    }
    orderCancelReasons() {
        return this.admin.listOrderCancelReasons();
    }
    createOrderCancelReason(body) {
        return this.admin.createOrderCancelReason(body);
    }
    updateOrderCancelReasonStatus(id, body) {
        return this.admin.updateOrderCancelReasonStatus(id, body.status);
    }
    deleteOrderCancelReason(id) {
        return this.admin.deleteOrderCancelReason(id);
    }
    refundReasons() {
        return this.admin.listRefundReasons();
    }
    createRefundReason(body) {
        return this.admin.createRefundReason(body);
    }
    deleteRefundReason(id) {
        return this.admin.deleteRefundReason(id);
    }
    refunds(limit, offset) {
        return this.admin.listRefunds({ limit: toInt(limit, 50), offset: toInt(offset, 0) });
    }
    updateRefundStatus(id, body) {
        return this.admin.updateRefundStatus(id, body.status, body.admin_note);
    }
    currencies() {
        return this.admin.listCurrencies();
    }
    tags() {
        return this.admin.listTags();
    }
    translations(limit, offset) {
        return this.admin.listTranslations({ limit: toInt(limit, 200), offset: toInt(offset, 0) });
    }
    uploadImage(file, dir) {
        if (!file)
            throw new common_1.BadRequestException({ errors: [{ code: 'file', message: 'file is required' }] });
        if (!dir || !ALLOWED_UPLOAD_DIRS.has(dir)) {
            throw new common_1.BadRequestException({
                errors: [{ code: 'dir', message: `dir must be one of: ${[...ALLOWED_UPLOAD_DIRS].join(', ')}` }],
            });
        }
        const ext = (path.extname(file.originalname) || '.bin').toLowerCase();
        if (!/^\.(png|jpe?g|webp|gif)$/i.test(ext)) {
            throw new common_1.BadRequestException({ errors: [{ code: 'ext', message: 'only png/jpg/jpeg/webp/gif allowed' }] });
        }
        const safeDir = path.join(STORAGE_ROOT, dir);
        fs.mkdirSync(safeDir, { recursive: true });
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
        const targetPath = path.join(safeDir, filename);
        fs.writeFileSync(targetPath, file.buffer);
        return { ok: true, filename, path: `${dir}/${filename}`, url: `/storage/${dir}/${filename}` };
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "me", null);
__decorate([
    (0, common_1.Patch)('me'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateMe", null);
__decorate([
    (0, common_1.Patch)('me/password'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "changeMyPassword", null);
__decorate([
    (0, common_1.Get)('dashboard/stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "stats", null);
__decorate([
    (0, common_1.Get)('orders'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "orders", null);
__decorate([
    (0, common_1.Get)('orders/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "orderDetail", null);
__decorate([
    (0, common_1.Patch)('orders/:id/status'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateOrderStatus", null);
__decorate([
    (0, common_1.Get)('restaurants'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __param(2, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "restaurants", null);
__decorate([
    (0, common_1.Get)('restaurants/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "restaurantDetail", null);
__decorate([
    (0, common_1.Patch)('restaurants/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateRestaurant", null);
__decorate([
    (0, common_1.Get)('users'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __param(2, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "users", null);
__decorate([
    (0, common_1.Get)('users/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "userDetail", null);
__decorate([
    (0, common_1.Patch)('users/:id/status'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateUserStatus", null);
__decorate([
    (0, common_1.Get)('vendors'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __param(2, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "vendors", null);
__decorate([
    (0, common_1.Patch)('vendors/:id/status'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateVendorStatus", null);
__decorate([
    (0, common_1.Get)('delivery-men'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __param(2, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "deliveryMen", null);
__decorate([
    (0, common_1.Patch)('delivery-men/:id/status'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateDMStatus", null);
__decorate([
    (0, common_1.Patch)('delivery-men/:id/approval'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateDMApproval", null);
__decorate([
    (0, common_1.Get)('food'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __param(2, (0, common_1.Query)('q')),
    __param(3, (0, common_1.Query)('restaurant_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "food", null);
__decorate([
    (0, common_1.Get)('food/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "foodDetail", null);
__decorate([
    (0, common_1.Patch)('food/:id/status'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateFoodStatus", null);
__decorate([
    (0, common_1.Patch)('food/:id/recommended'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateFoodRecommended", null);
__decorate([
    (0, common_1.Get)('categories'),
    __param(0, (0, common_1.Query)('parent_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "categories", null);
__decorate([
    (0, common_1.Post)('categories'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "createCategory", null);
__decorate([
    (0, common_1.Patch)('categories/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateCategory", null);
__decorate([
    (0, common_1.Delete)('categories/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "deleteCategory", null);
__decorate([
    (0, common_1.Get)('cuisines'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "cuisines", null);
__decorate([
    (0, common_1.Post)('cuisines'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "createCuisine", null);
__decorate([
    (0, common_1.Patch)('cuisines/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateCuisine", null);
__decorate([
    (0, common_1.Delete)('cuisines/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "deleteCuisine", null);
__decorate([
    (0, common_1.Get)('coupons'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "coupons", null);
__decorate([
    (0, common_1.Post)('coupons'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "createCoupon", null);
__decorate([
    (0, common_1.Patch)('coupons/:id/status'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateCouponStatus", null);
__decorate([
    (0, common_1.Delete)('coupons/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "deleteCoupon", null);
__decorate([
    (0, common_1.Get)('banners'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "banners", null);
__decorate([
    (0, common_1.Post)('banners'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "createBanner", null);
__decorate([
    (0, common_1.Patch)('banners/:id/status'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateBannerStatus", null);
__decorate([
    (0, common_1.Delete)('banners/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "deleteBanner", null);
__decorate([
    (0, common_1.Get)('zones'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "zones", null);
__decorate([
    (0, common_1.Patch)('zones/:id/status'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateZoneStatus", null);
__decorate([
    (0, common_1.Get)('business-settings'),
    __param(0, (0, common_1.Query)('prefix')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "businessSettings", null);
__decorate([
    (0, common_1.Patch)('business-settings'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "upsertBusinessSettings", null);
__decorate([
    (0, common_1.Get)('reports/sales-summary'),
    __param(0, (0, common_1.Query)('days')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "salesSummary", null);
__decorate([
    (0, common_1.Get)('reports/restaurant-earnings'),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "restaurantEarnings", null);
__decorate([
    (0, common_1.Get)('reports/admin-earnings'),
    __param(0, (0, common_1.Query)('days')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "adminEarningReport", null);
__decorate([
    (0, common_1.Get)('reports/top-customers'),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "customerReport", null);
__decorate([
    (0, common_1.Get)('reports/top-deliverymen'),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "deliverymanEarningReport", null);
__decorate([
    (0, common_1.Get)('add-ons'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __param(2, (0, common_1.Query)('q')),
    __param(3, (0, common_1.Query)('restaurant_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "addOns", null);
__decorate([
    (0, common_1.Post)('add-ons'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "createAddOn", null);
__decorate([
    (0, common_1.Patch)('add-ons/:id/status'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateAddOnStatus", null);
__decorate([
    (0, common_1.Delete)('add-ons/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "deleteAddOn", null);
__decorate([
    (0, common_1.Get)('addon-categories'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __param(2, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "addonCategories", null);
__decorate([
    (0, common_1.Post)('addon-categories'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "createAddonCategory", null);
__decorate([
    (0, common_1.Patch)('addon-categories/:id/status'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateAddonCategoryStatus", null);
__decorate([
    (0, common_1.Delete)('addon-categories/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "deleteAddonCategory", null);
__decorate([
    (0, common_1.Get)('attributes'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "attributes", null);
__decorate([
    (0, common_1.Post)('attributes'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "createAttribute", null);
__decorate([
    (0, common_1.Delete)('attributes/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "deleteAttribute", null);
__decorate([
    (0, common_1.Get)('campaigns'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __param(2, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "campaigns", null);
__decorate([
    (0, common_1.Post)('campaigns'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "createCampaign", null);
__decorate([
    (0, common_1.Patch)('campaigns/:id/status'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateCampaignStatus", null);
__decorate([
    (0, common_1.Delete)('campaigns/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "deleteCampaign", null);
__decorate([
    (0, common_1.Get)('advertisements'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "advertisements", null);
__decorate([
    (0, common_1.Patch)('advertisements/:id/status'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateAdvertisementStatus", null);
__decorate([
    (0, common_1.Get)('cash-backs'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "cashBacks", null);
__decorate([
    (0, common_1.Get)('wallet-bonuses'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "walletBonuses", null);
__decorate([
    (0, common_1.Post)('wallet-bonuses'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "createWalletBonus", null);
__decorate([
    (0, common_1.Patch)('wallet-bonuses/:id/status'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateWalletBonusStatus", null);
__decorate([
    (0, common_1.Delete)('wallet-bonuses/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "deleteWalletBonus", null);
__decorate([
    (0, common_1.Get)('account-transactions'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "accountTransactions", null);
__decorate([
    (0, common_1.Get)('wallet-transactions'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "walletTransactions", null);
__decorate([
    (0, common_1.Get)('loyalty-point-transactions'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "loyaltyTransactions", null);
__decorate([
    (0, common_1.Get)('cashback-histories'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "cashbackHistories", null);
__decorate([
    (0, common_1.Get)('disbursements'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "disbursements", null);
__decorate([
    (0, common_1.Get)('withdraw-requests'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __param(2, (0, common_1.Query)('type')),
    __param(3, (0, common_1.Query)('approved')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "withdrawRequests", null);
__decorate([
    (0, common_1.Patch)('withdraw-requests/:id/approval'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "approveWithdrawRequest", null);
__decorate([
    (0, common_1.Get)('withdrawal-methods'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "withdrawalMethods", null);
__decorate([
    (0, common_1.Get)('offline-payment-methods'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "offlinePaymentMethods", null);
__decorate([
    (0, common_1.Patch)('offline-payment-methods/:id/status'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateOfflinePaymentMethodStatus", null);
__decorate([
    (0, common_1.Get)('dm-earnings'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "provideDmEarnings", null);
__decorate([
    (0, common_1.Get)('contact-messages'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "contactMessages", null);
__decorate([
    (0, common_1.Patch)('contact-messages/:id/reply'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "replyContactMessage", null);
__decorate([
    (0, common_1.Get)('notifications'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "notifications", null);
__decorate([
    (0, common_1.Post)('notifications'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "createNotification", null);
__decorate([
    (0, common_1.Delete)('notifications/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "deleteNotification", null);
__decorate([
    (0, common_1.Get)('reviews'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "reviews", null);
__decorate([
    (0, common_1.Patch)('reviews/:id/reply'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "replyReview", null);
__decorate([
    (0, common_1.Get)('dm-reviews'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "dmReviews", null);
__decorate([
    (0, common_1.Get)('faqs'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "faqs", null);
__decorate([
    (0, common_1.Post)('faqs'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "createFAQ", null);
__decorate([
    (0, common_1.Patch)('faqs/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateFAQ", null);
__decorate([
    (0, common_1.Delete)('faqs/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "deleteFAQ", null);
__decorate([
    (0, common_1.Get)('page-seo'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "pageSeo", null);
__decorate([
    (0, common_1.Post)('page-seo'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "upsertPageSeo", null);
__decorate([
    (0, common_1.Get)('social-media'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "socialMedia", null);
__decorate([
    (0, common_1.Post)('social-media'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "createSocialMedia", null);
__decorate([
    (0, common_1.Patch)('social-media/:id/status'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateSocialMediaStatus", null);
__decorate([
    (0, common_1.Delete)('social-media/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "deleteSocialMedia", null);
__decorate([
    (0, common_1.Get)('employees'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __param(2, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "employees", null);
__decorate([
    (0, common_1.Get)('admin-roles'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "adminRoles", null);
__decorate([
    (0, common_1.Post)('admin-roles'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "createAdminRole", null);
__decorate([
    (0, common_1.Delete)('admin-roles/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "deleteAdminRole", null);
__decorate([
    (0, common_1.Get)('subscription-packages'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "subscriptionPackages", null);
__decorate([
    (0, common_1.Post)('subscription-packages'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "createSubscriptionPackage", null);
__decorate([
    (0, common_1.Patch)('subscription-packages/:id/status'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateSubscriptionPackageStatus", null);
__decorate([
    (0, common_1.Delete)('subscription-packages/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "deleteSubscriptionPackage", null);
__decorate([
    (0, common_1.Get)('shifts'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "shifts", null);
__decorate([
    (0, common_1.Post)('shifts'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "createShift", null);
__decorate([
    (0, common_1.Patch)('shifts/:id/status'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateShiftStatus", null);
__decorate([
    (0, common_1.Delete)('shifts/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "deleteShift", null);
__decorate([
    (0, common_1.Get)('vehicles'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "vehicles", null);
__decorate([
    (0, common_1.Post)('vehicles'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "createVehicle", null);
__decorate([
    (0, common_1.Patch)('vehicles/:id/status'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateVehicleStatus", null);
__decorate([
    (0, common_1.Delete)('vehicles/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "deleteVehicle", null);
__decorate([
    (0, common_1.Get)('order-cancel-reasons'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "orderCancelReasons", null);
__decorate([
    (0, common_1.Post)('order-cancel-reasons'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "createOrderCancelReason", null);
__decorate([
    (0, common_1.Patch)('order-cancel-reasons/:id/status'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateOrderCancelReasonStatus", null);
__decorate([
    (0, common_1.Delete)('order-cancel-reasons/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "deleteOrderCancelReason", null);
__decorate([
    (0, common_1.Get)('refund-reasons'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "refundReasons", null);
__decorate([
    (0, common_1.Post)('refund-reasons'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "createRefundReason", null);
__decorate([
    (0, common_1.Delete)('refund-reasons/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "deleteRefundReason", null);
__decorate([
    (0, common_1.Get)('refunds'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "refunds", null);
__decorate([
    (0, common_1.Patch)('refunds/:id/status'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateRefundStatus", null);
__decorate([
    (0, common_1.Get)('currencies'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "currencies", null);
__decorate([
    (0, common_1.Get)('tags'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "tags", null);
__decorate([
    (0, common_1.Get)('translations'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "translations", null);
__decorate([
    (0, common_1.Post)('upload'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { limits: { fileSize: 10 * 1024 * 1024 } })),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Query)('dir')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "uploadImage", null);
exports.AdminController = AdminController = __decorate([
    (0, common_1.Controller)('admin'),
    (0, auth_guard_1.RequireAuth)('admin'),
    __metadata("design:paramtypes", [admin_service_1.AdminService])
], AdminController);
function toInt(v, fallback) {
    const n = parseInt(v ?? '', 10);
    if (!Number.isFinite(n) || n < 0)
        return fallback;
    return n;
}
//# sourceMappingURL=admin.controller.js.map