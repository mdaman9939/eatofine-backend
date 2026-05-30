"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendorExtrasController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const prisma_service_1 = require("../prisma/prisma.service");
let VendorExtrasController = class VendorExtrasController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async profile(req) {
        const v = await this.prisma.vendors.findUnique({ where: { id: req.actor.id } });
        if (!v)
            return {};
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
    async updateProfile(req, body) {
        const data = {};
        for (const [k, v] of Object.entries(body))
            if (v !== undefined)
                data[k] = v;
        if (Object.keys(data).length) {
            await this.prisma.vendors.update({ where: { id: req.actor.id }, data });
        }
        return { message: 'Profile updated' };
    }
    fcmToken() { return { message: 'token-updated' }; }
    async toggleActive(req, body) {
        const r = await this.prisma.restaurants.findFirst({ where: { vendor_id: req.actor.id }, select: { id: true } });
        if (r && body.status !== undefined) {
            await this.prisma.restaurants.update({ where: { id: r.id }, data: { active: body.status } });
        }
        return { message: 'updated' };
    }
    toggleOpen() { return { message: 'updated' }; }
    announce() { return { message: 'announcement updated' }; }
    bankInfo() { return { message: 'bank info updated' }; }
    basicInfo() { return { message: 'basic info updated' }; }
    businessSetup() { return { message: 'business setup updated' }; }
    addDineInTable() { return { message: 'added' }; }
    remove() { return { message: 'Not available in demo' }; }
    async currentOrders(req) {
        const restaurant = await this.prisma.restaurants.findFirst({ where: { vendor_id: req.actor.id }, select: { id: true } });
        if (!restaurant)
            return [];
        const rows = await this.prisma.orders.findMany({
            where: { restaurant_id: restaurant.id, order_status: { in: ['accepted', 'confirmed', 'processing'] } },
            orderBy: { id: 'desc' },
        });
        return rows.map((r) => ({ ...r, id: Number(r.id), user_id: r.user_id ? Number(r.user_id) : null, restaurant_id: Number(r.restaurant_id), order_amount: Number(r.order_amount) }));
    }
    async completedOrders(req) {
        const restaurant = await this.prisma.restaurants.findFirst({ where: { vendor_id: req.actor.id }, select: { id: true } });
        if (!restaurant)
            return { orders: [], total_size: 0 };
        const rows = await this.prisma.orders.findMany({
            where: { restaurant_id: restaurant.id, order_status: { in: ['delivered', 'canceled', 'refunded'] } },
            orderBy: { id: 'desc' },
            take: 50,
        });
        return { orders: rows.map((r) => ({ ...r, id: Number(r.id), user_id: r.user_id ? Number(r.user_id) : null, restaurant_id: Number(r.restaurant_id), order_amount: Number(r.order_amount) })), total_size: rows.length };
    }
    async vendorOrder(idStr) {
        const id = parseInt(idStr ?? '', 10);
        if (!Number.isFinite(id))
            return null;
        const o = await this.prisma.orders.findUnique({ where: { id: BigInt(id) } });
        return o ? { ...o, id: Number(o.id), user_id: o.user_id ? Number(o.user_id) : null, restaurant_id: Number(o.restaurant_id), order_amount: Number(o.order_amount) } : null;
    }
    updateOrder() { return { message: 'order updated' }; }
    sendOrderOtp() { return { otp: '1234', message: 'otp generated' }; }
    customerAddressUpdate() { return { message: 'address updated' }; }
    async products(req, limitStr, offsetStr) {
        const limit = parseInt(limitStr ?? '25', 10);
        const offset = parseInt(offsetStr ?? '1', 10);
        const restaurant = await this.prisma.restaurants.findFirst({ where: { vendor_id: req.actor.id }, select: { id: true } });
        if (!restaurant)
            return { products: [], total_size: 0, limit, offset };
        const [rows, total] = await Promise.all([
            this.prisma.food.findMany({ where: { restaurant_id: restaurant.id }, orderBy: { id: 'desc' }, take: limit, skip: Math.max(0, (offset - 1) * limit) }),
            this.prisma.food.count({ where: { restaurant_id: restaurant.id } }),
        ]);
        return { products: rows.map((r) => ({ ...r, id: Number(r.id), price: Number(r.price), tax: Number(r.tax), discount: Number(r.discount), restaurant_id: Number(r.restaurant_id), category_id: r.category_id ? Number(r.category_id) : null })), total_size: total, limit, offset };
    }
    async productDetails(idStr) {
        const id = parseInt(idStr ?? '', 10);
        if (!Number.isFinite(id))
            return null;
        const f = await this.prisma.food.findUnique({ where: { id: BigInt(id) } });
        return f ? { ...f, id: Number(f.id), price: Number(f.price), tax: Number(f.tax), discount: Number(f.discount), restaurant_id: Number(f.restaurant_id), category_id: f.category_id ? Number(f.category_id) : null } : null;
    }
    productSearch() { return { products: [], total_size: 0 }; }
    productStatus() { return { message: 'updated' }; }
    productRecommended() { return { message: 'updated' }; }
    updateStock() { return { message: 'stock updated' }; }
    productStore() { return { message: 'product created' }; }
    productUpdate() { return { message: 'product updated' }; }
    productDelete() { return { message: 'product deleted' }; }
    async productReviews(idStr) {
        const id = parseInt(idStr ?? '', 10);
        if (!Number.isFinite(id))
            return [];
        const rows = await this.prisma.reviews.findMany({ where: { food_id: BigInt(id) }, orderBy: { id: 'desc' }, take: 50 });
        return rows.map((r) => ({ id: Number(r.id), food_id: Number(r.food_id), user_id: Number(r.user_id), comment: r.comment, rating: r.rating, reply: r.reply }));
    }
    productReply() { return { message: 'reply saved' }; }
    productLimits() { return { remaining: 'unlimited' }; }
    async categories() {
        const rows = await this.prisma.categories.findMany({ where: { parent_id: 0, status: true } });
        return rows.map((r) => ({ id: Number(r.id), name: r.name, image: r.image, status: r.status }));
    }
    childCategories(idStr) {
        const id = parseInt(idStr ?? '0', 10);
        return this.prisma.categories.findMany({ where: { parent_id: id, status: true } }).then((rows) => rows.map((r) => ({ id: Number(r.id), name: r.name, image: r.image, status: r.status })));
    }
    categoryProducts() { return { products: [], total_size: 0 }; }
    async vendorAddons(req) {
        const restaurant = await this.prisma.restaurants.findFirst({ where: { vendor_id: req.actor.id }, select: { id: true } });
        if (!restaurant)
            return { addons: [] };
        const rows = await this.prisma.add_ons.findMany({ where: { restaurant_id: restaurant.id } });
        return rows.map((r) => ({ ...r, id: Number(r.id), restaurant_id: Number(r.restaurant_id), addon_category_id: r.addon_category_id ? Number(r.addon_category_id) : null, price: Number(r.price) }));
    }
    addonStore() { return { message: 'addon created' }; }
    addonUpdate() { return { message: 'addon updated' }; }
    addonDelete() { return { message: 'addon deleted' }; }
    async attributes() {
        const rows = await this.prisma.attributes.findMany();
        return rows.map((r) => ({ id: Number(r.id), name: r.name }));
    }
    async vendorDmList(req) {
        const restaurant = await this.prisma.restaurants.findFirst({ where: { vendor_id: req.actor.id }, select: { id: true, zone_id: true } });
        if (!restaurant)
            return { delivery_men: [], total_size: 0 };
        const rows = await this.prisma.delivery_men.findMany({ where: { zone_id: restaurant.zone_id ?? undefined } });
        return rows.map((r) => ({ id: Number(r.id), f_name: r.f_name, l_name: r.l_name, phone: r.phone, status: r.status, application_status: r.application_status }));
    }
    getDmList(req) { return this.vendorDmList(req); }
    dmPreview() { return null; }
    dmStore() { return { message: 'delivery man created' }; }
    dmUpdate() { return { message: 'updated' }; }
    dmDelete() { return { message: 'deleted' }; }
    dmStatus() { return { message: 'status updated' }; }
    dmAssign() { return { message: 'assigned' }; }
    vendorCouponList() { return { coupons: [], total_size: 0 }; }
    vendorCouponStore() { return { message: 'coupon created' }; }
    vendorCouponUpdate() { return { message: 'coupon updated' }; }
    vendorCouponStatus() { return { message: 'status updated' }; }
    vendorCouponDelete() { return { message: 'coupon deleted' }; }
    vendorCouponView() { return {}; }
    walletPaymentList() { return { data: [], total_size: 0 }; }
    collectedCash() { return { message: 'recorded' }; }
    walletAdjustment() { return { message: 'recorded' }; }
    async withdrawMethods() {
        const rows = await this.prisma.withdrawal_methods.findMany({ where: { is_active: 1 } });
        return rows.map((r) => ({ id: Number(r.id), method_name: r.method_name, method_fields: r.method_fields, is_default: r.is_default }));
    }
    withdrawStore() { return { message: 'method added' }; }
    withdrawDefault() { return { message: 'default set' }; }
    withdrawDelete() { return { message: 'deleted' }; }
    getWithdrawMethods() { return this.withdrawMethods(); }
    getWithdrawList() { return { data: [], total_size: 0 }; }
    requestWithdraw() { return { message: 'withdraw requested' }; }
    earningReport() { return { total: 0, today: 0, this_week: 0, this_month: 0 }; }
    orderReport() { return { delivered: 0, canceled: 0, returned: 0 }; }
    foodReport() { return { data: [] }; }
    campaignReport() { return { data: [] }; }
    taxReport() { return { data: [], total: 0 }; }
    disbursementReport() { return { data: [], total: 0 }; }
    expenseReport() { return { data: [], total: 0 }; }
    transactionReport() { return { data: [], total: 0 }; }
    generateStatement() { return { message: 'not available in demo' }; }
    searchedFood() { return { products: [] }; }
    async vendorNotifications() {
        const rows = await this.prisma.notifications.findMany({ where: { status: true }, orderBy: { id: 'desc' }, take: 50 });
        return rows.map((r) => ({ id: Number(r.id), title: r.title, description: r.description }));
    }
    messageList() { return { conversations: [], total_size: 0 }; }
    messageDetails() { return { messages: [] }; }
    messageSearch() { return { conversations: [] }; }
    messageSend() { return { message: 'sent' }; }
    basicCampaigns() { return []; }
    campaignJoin() { return { message: 'joined' }; }
    campaignLeave() { return { message: 'left' }; }
    async ads(req) {
        const r = await this.prisma.restaurants.findFirst({ where: { vendor_id: req.actor.id }, select: { id: true } });
        if (!r)
            return [];
        const rows = await this.prisma.advertisements.findMany({ where: { restaurant_id: r.id } });
        return rows.map((row) => ({ ...row, id: Number(row.id), restaurant_id: Number(row.restaurant_id), created_by_id: Number(row.created_by_id) }));
    }
    adDetails() { return null; }
    adStore() { return { message: 'ad created' }; }
    adUpdate() { return { message: 'updated' }; }
    adStatus() { return { message: 'status updated' }; }
    adCopy() { return { message: 'copied' }; }
    adDelete() { return { message: 'deleted' }; }
    businessPlan() { return { commission: 1, subscription: 0 }; }
    packageView() { return { package: null, transactions: [] }; }
    subscriptionTransaction() { return { message: 'not available' }; }
    subscriptionPayment() { return { redirect_url: null }; }
    cancelSubscription() { return { message: 'canceled' }; }
    async schedule(req) {
        const r = await this.prisma.restaurants.findFirst({ where: { vendor_id: req.actor.id }, select: { id: true } });
        if (!r)
            return [];
        const rows = await this.prisma.restaurant_schedule.findMany({ where: { restaurant_id: r.id } });
        return rows.map((row) => ({ ...row, id: Number(row.id), restaurant_id: Number(row.restaurant_id) }));
    }
    scheduleStore() { return { message: 'schedule saved' }; }
    posCustomers() { return { users: [], total_size: 0 }; }
    posOrders() { return { orders: [], total_size: 0 }; }
    posPlaceOrder() { return { message: 'pos not available in demo' }; }
    characteristicSuggestions() { return []; }
};
exports.VendorExtrasController = VendorExtrasController;
__decorate([
    (0, common_1.Get)('profile'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "profile", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-profile'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-fcm-token'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "fcmToken", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-active-status'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "toggleActive", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('opening-closing-status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "toggleOpen", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-announcment'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "announce", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-bank-info'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "bankInfo", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-basic-info'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "basicInfo", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-business-setup'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "businessSetup", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('add-dine-in-table-number'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "addDineInTable", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('remove-account'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)('current-orders'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "currentOrders", null);
__decorate([
    (0, common_1.Get)('completed-orders'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "completedOrders", null);
__decorate([
    (0, common_1.Get)('order'),
    __param(0, (0, common_1.Query)('order_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "vendorOrder", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-order'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "updateOrder", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('send-order-otp'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "sendOrderOtp", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('customer-address-update'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "customerAddressUpdate", null);
__decorate([
    (0, common_1.Get)('get-products-list'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "products", null);
__decorate([
    (0, common_1.Get)('product/details'),
    __param(0, (0, common_1.Query)('product_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "productDetails", null);
__decorate([
    (0, common_1.Get)('product/search'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "productSearch", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('product/status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "productStatus", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('product/recommended'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "productRecommended", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('product/update-stock'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "updateStock", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('product/store'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "productStore", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('product/update'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "productUpdate", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('product/delete'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "productDelete", null);
__decorate([
    (0, common_1.Get)('product/reviews'),
    __param(0, (0, common_1.Query)('product_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "productReviews", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('product/reply-update'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "productReply", null);
__decorate([
    (0, common_1.Get)('check-product-limits'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "productLimits", null);
__decorate([
    (0, common_1.Get)('categories'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "categories", null);
__decorate([
    (0, common_1.Get)('categories/childes'),
    __param(0, (0, common_1.Query)('parent_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "childCategories", null);
__decorate([
    (0, common_1.Get)('categories/category-wise-products'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "categoryProducts", null);
__decorate([
    (0, common_1.Get)('addon'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "vendorAddons", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('addon/store'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "addonStore", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('addon/update'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "addonUpdate", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('addon/delete'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "addonDelete", null);
__decorate([
    (0, common_1.Get)('attributes'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "attributes", null);
__decorate([
    (0, common_1.Get)('delivery-man/list'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "vendorDmList", null);
__decorate([
    (0, common_1.Get)('delivery-man/get-delivery-man-list'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "getDmList", null);
__decorate([
    (0, common_1.Get)('delivery-man/preview'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "dmPreview", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('delivery-man/store'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "dmStore", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('delivery-man/update'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "dmUpdate", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('delivery-man/delete'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "dmDelete", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('delivery-man/status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "dmStatus", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('delivery-man/assign-deliveryman'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "dmAssign", null);
__decorate([
    (0, common_1.Get)('coupon-list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "vendorCouponList", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('coupon-store'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "vendorCouponStore", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('coupon-update'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "vendorCouponUpdate", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('coupon-status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "vendorCouponStatus", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('coupon-delete'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "vendorCouponDelete", null);
__decorate([
    (0, common_1.Get)('coupon/view-without-translate'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "vendorCouponView", null);
__decorate([
    (0, common_1.Get)('wallet-payment-list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "walletPaymentList", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('make-collected-cash-payment'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "collectedCash", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('make-wallet-adjustment'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "walletAdjustment", null);
__decorate([
    (0, common_1.Get)('withdraw-method/list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "withdrawMethods", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('withdraw-method/store'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "withdrawStore", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('withdraw-method/make-default'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "withdrawDefault", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('withdraw-method/delete'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "withdrawDelete", null);
__decorate([
    (0, common_1.Get)('get-withdraw-method-list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "getWithdrawMethods", null);
__decorate([
    (0, common_1.Get)('get-withdraw-list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "getWithdrawList", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('request-withdraw'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "requestWithdraw", null);
__decorate([
    (0, common_1.Get)('earning-report'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "earningReport", null);
__decorate([
    (0, common_1.Get)('get-order-report'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "orderReport", null);
__decorate([
    (0, common_1.Get)('get-food-wise-report'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "foodReport", null);
__decorate([
    (0, common_1.Get)('get-campaign-order-report'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "campaignReport", null);
__decorate([
    (0, common_1.Get)('get-tax-report'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "taxReport", null);
__decorate([
    (0, common_1.Get)('get-disbursement-report'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "disbursementReport", null);
__decorate([
    (0, common_1.Get)('get-expense'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "expenseReport", null);
__decorate([
    (0, common_1.Get)('get-transaction-report'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "transactionReport", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('generate-transaction-statement'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "generateStatement", null);
__decorate([
    (0, common_1.Get)('get-searched-food'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "searchedFood", null);
__decorate([
    (0, common_1.Get)('notifications'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "vendorNotifications", null);
__decorate([
    (0, common_1.Get)('message/list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "messageList", null);
__decorate([
    (0, common_1.Get)('message/details'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "messageDetails", null);
__decorate([
    (0, common_1.Get)('message/search-list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "messageSearch", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('message/send'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "messageSend", null);
__decorate([
    (0, common_1.Get)('get-basic-campaigns'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "basicCampaigns", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('campaign-join'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "campaignJoin", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('campaign-leave'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "campaignLeave", null);
__decorate([
    (0, common_1.Get)('advertisement'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "ads", null);
__decorate([
    (0, common_1.Get)('advertisement/details'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "adDetails", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('advertisement/store'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "adStore", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('advertisement/update'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "adUpdate", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('advertisement/status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "adStatus", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('advertisement/copy-add-post'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "adCopy", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('advertisement/delete'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "adDelete", null);
__decorate([
    (0, common_1.Get)('business_plan'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "businessPlan", null);
__decorate([
    (0, common_1.Get)('package-view'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "packageView", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('subscription-transaction'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "subscriptionTransaction", null);
__decorate([
    (0, common_1.Get)('subscription/payment/api'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "subscriptionPayment", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('cancel-subscription'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "cancelSubscription", null);
__decorate([
    (0, common_1.Get)('schedule'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorExtrasController.prototype, "schedule", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('schedule/store'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "scheduleStore", null);
__decorate([
    (0, common_1.Get)('pos/customers'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "posCustomers", null);
__decorate([
    (0, common_1.Get)('pos/orders'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "posOrders", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('pos/place-order'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "posPlaceOrder", null);
__decorate([
    (0, common_1.Get)('get-characteristic-suggestion'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VendorExtrasController.prototype, "characteristicSuggestions", null);
exports.VendorExtrasController = VendorExtrasController = __decorate([
    (0, common_1.Controller)('vendor'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, auth_guard_1.RequireAuth)('vendor'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], VendorExtrasController);
//# sourceMappingURL=vendor-extras.controller.js.map