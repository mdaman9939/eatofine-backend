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
exports.CatalogExtrasController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let CatalogExtrasController = class CatalogExtrasController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
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
    async couponApply(code, amountStr) {
        if (!code)
            return { code: 'invalid', message: 'code required' };
        const c = await this.prisma.coupons.findFirst({ where: { code, status: true } });
        if (!c)
            return { code: 'invalid', message: 'coupon not found' };
        const amount = parseFloat(amountStr ?? '0');
        const minPurchase = Number(c.min_purchase);
        if (amount > 0 && amount < minPurchase) {
            return { code: 'minimum', message: `Minimum purchase ₹${minPurchase}` };
        }
        let discount = c.discount_type === 'percentage' ? (amount * Number(c.discount)) / 100 : Number(c.discount);
        const maxDiscount = Number(c.max_discount);
        if (maxDiscount > 0 && discount > maxDiscount)
            discount = maxDiscount;
        return {
            code: 'valid',
            title: c.title,
            coupon_code: c.code,
            discount,
            min_purchase: minPurchase,
            max_discount: maxDiscount,
        };
    }
    async restaurantCoupons(idStr) {
        const id = parseInt(idStr ?? '', 10);
        if (!Number.isFinite(id))
            return [];
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
    async cuisineAlias() {
        const rows = await this.prisma.cuisines.findMany({ where: { status: true } });
        return rows.map((r) => ({ id: Number(r.id), name: r.name, image: r.image, slug: r.slug }));
    }
    async cuisineRestaurants(idStr) {
        const id = parseInt(idStr ?? '', 10);
        if (!Number.isFinite(id))
            return { restaurants: [], total_size: 0 };
        return { restaurants: [], total_size: 0 };
    }
    async addonCategoryList() {
        const rows = await this.prisma.addon_categories.findMany({ where: { status: true } });
        return rows.map((r) => ({ id: Number(r.id), name: r.name, status: r.status, slug: r.slug }));
    }
    async basicCampaigns() {
        const rows = await this.prisma.campaigns.findMany({ where: { status: true }, orderBy: { id: 'desc' } });
        return rows.map((r) => ({ id: Number(r.id), title: r.title, description: r.description, image: r.image, start_date: r.start_date, end_date: r.end_date }));
    }
    async basicCampaignDetails(idStr) {
        const id = parseInt(idStr ?? '', 10);
        if (!Number.isFinite(id))
            return { campaign: null, restaurants: [] };
        const campaign = await this.prisma.campaigns.findUnique({ where: { id: BigInt(id) } });
        return { campaign: campaign ? { ...campaign, id: Number(campaign.id) } : null, restaurants: [] };
    }
    itemCampaigns() {
        return { campaigns: [], total_size: 0 };
    }
    async cashbackList() {
        const rows = await this.prisma.cash_backs.findMany();
        return rows.map((r) => ({ ...r, id: Number(r.id) }));
    }
    getCashback() {
        return { cashback_amount: 0, message: 'no cashback' };
    }
    async offlinePaymentMethods() {
        const rows = await this.prisma.offline_payment_methods.findMany({ where: { status: 1 } });
        return rows.map((r) => ({
            id: Number(r.id),
            method_name: r.method_name,
            method_fields: r.method_fields,
            method_informations: r.method_informations,
        }));
    }
    async search(name, limitStr) {
        const limit = parseInt(limitStr ?? '20', 10);
        const q = (name ?? '').trim();
        if (!q)
            return { products: { products: [] }, restaurants: { restaurants: [] } };
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
    setMenu() {
        return { menus: [], total_size: 0 };
    }
    async productReviews(idStr) {
        const id = parseInt(idStr ?? '', 10);
        if (!Number.isFinite(id))
            return [];
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
    submitProductReview() {
        return { message: 'review submitted' };
    }
    async recommendedMostReviewed() {
        const rows = await this.prisma.food.findMany({ where: { status: true }, orderBy: { rating_count: 'desc' }, take: 10 });
        return { products: rows.map((r) => ({ ...r, id: Number(r.id), price: Number(r.price), tax: Number(r.tax), discount: Number(r.discount), restaurant_id: Number(r.restaurant_id), category_id: r.category_id ? Number(r.category_id) : null })) };
    }
    async restaurantReviews(idStr) {
        const id = parseInt(idStr ?? '', 10);
        if (!Number.isFinite(id))
            return [];
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
    dineInRestaurants() {
        return { restaurants: [], total_size: 0 };
    }
    recentlyViewed() {
        return [];
    }
    async advertisementList() {
        const rows = await this.prisma.advertisements.findMany({ where: { status: 'approved' }, orderBy: { priority: 'asc' }, take: 20 });
        return rows.map((r) => ({ ...r, id: Number(r.id), restaurant_id: Number(r.restaurant_id), created_by_id: Number(r.created_by_id) }));
    }
    async allergies() {
        const rows = await this.prisma.allergies.findMany();
        return rows.map((r) => ({ ...r, id: Number(r.id) }));
    }
    async nutritions() {
        const rows = await this.prisma.nutritions.findMany();
        return rows.map((r) => ({ ...r, id: Number(r.id) }));
    }
    async vehicles() {
        const rows = await this.prisma.vehicles.findMany({ where: { status: true } });
        return rows.map((r) => ({ ...r, id: Number(r.id) }));
    }
    vehicleExtraCharge() {
        return { extra_charges: 0 };
    }
    mostTips() {
        return [10, 20, 30, 50, 100];
    }
    async dmShifts() {
        const rows = await this.prisma.shifts.findMany({ where: { status: true } });
        return rows.map((r) => ({ ...r, id: Number(r.id) }));
    }
    taxList() {
        return [];
    }
    newsletter() {
        return { message: 'subscribed' };
    }
};
exports.CatalogExtrasController = CatalogExtrasController;
__decorate([
    (0, common_1.Get)('coupon/list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CatalogExtrasController.prototype, "couponList", null);
__decorate([
    (0, common_1.Get)('coupon/apply'),
    __param(0, (0, common_1.Query)('code')),
    __param(1, (0, common_1.Query)('order_amount')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], CatalogExtrasController.prototype, "couponApply", null);
__decorate([
    (0, common_1.Get)('coupon/restaurant-wise-coupon'),
    __param(0, (0, common_1.Query)('restaurant_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CatalogExtrasController.prototype, "restaurantCoupons", null);
__decorate([
    (0, common_1.Get)('cuisine'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CatalogExtrasController.prototype, "cuisineAlias", null);
__decorate([
    (0, common_1.Get)('cuisine/get_restaurants'),
    __param(0, (0, common_1.Query)('cuisine_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CatalogExtrasController.prototype, "cuisineRestaurants", null);
__decorate([
    (0, common_1.Get)('addon-category/list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CatalogExtrasController.prototype, "addonCategoryList", null);
__decorate([
    (0, common_1.Get)('campaigns/basic'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CatalogExtrasController.prototype, "basicCampaigns", null);
__decorate([
    (0, common_1.Get)('campaigns/basic-campaign-details'),
    __param(0, (0, common_1.Query)('basic_campaign_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CatalogExtrasController.prototype, "basicCampaignDetails", null);
__decorate([
    (0, common_1.Get)('campaigns/item'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CatalogExtrasController.prototype, "itemCampaigns", null);
__decorate([
    (0, common_1.Get)('cashback/list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CatalogExtrasController.prototype, "cashbackList", null);
__decorate([
    (0, common_1.Get)('cashback/getCashback'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CatalogExtrasController.prototype, "getCashback", null);
__decorate([
    (0, common_1.Get)('offline_payment_method_list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CatalogExtrasController.prototype, "offlinePaymentMethods", null);
__decorate([
    (0, common_1.Get)('products/food-or-restaurant-search'),
    __param(0, (0, common_1.Query)('name')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], CatalogExtrasController.prototype, "search", null);
__decorate([
    (0, common_1.Get)('products/set-menu'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CatalogExtrasController.prototype, "setMenu", null);
__decorate([
    (0, common_1.Get)('products/reviews'),
    __param(0, (0, common_1.Query)('product_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CatalogExtrasController.prototype, "productReviews", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('products/reviews/submit'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CatalogExtrasController.prototype, "submitProductReview", null);
__decorate([
    (0, common_1.Get)('products/recommended/most-reviewed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CatalogExtrasController.prototype, "recommendedMostReviewed", null);
__decorate([
    (0, common_1.Get)('restaurants/reviews'),
    __param(0, (0, common_1.Query)('restaurant_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CatalogExtrasController.prototype, "restaurantReviews", null);
__decorate([
    (0, common_1.Get)('restaurants/dine-in'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CatalogExtrasController.prototype, "dineInRestaurants", null);
__decorate([
    (0, common_1.Get)('restaurants/recently-viewed-restaurants'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CatalogExtrasController.prototype, "recentlyViewed", null);
__decorate([
    (0, common_1.Get)('advertisement/list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CatalogExtrasController.prototype, "advertisementList", null);
__decorate([
    (0, common_1.Get)('food/get-allergy-name-list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CatalogExtrasController.prototype, "allergies", null);
__decorate([
    (0, common_1.Get)('food/get-nutrition-name-list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CatalogExtrasController.prototype, "nutritions", null);
__decorate([
    (0, common_1.Get)('get-vehicles'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CatalogExtrasController.prototype, "vehicles", null);
__decorate([
    (0, common_1.Get)('vehicle/extra_charge'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CatalogExtrasController.prototype, "vehicleExtraCharge", null);
__decorate([
    (0, common_1.Get)('most-tips'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CatalogExtrasController.prototype, "mostTips", null);
__decorate([
    (0, common_1.Get)('dm-shifts'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CatalogExtrasController.prototype, "dmShifts", null);
__decorate([
    (0, common_1.Get)('taxvat/get-taxVat-list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CatalogExtrasController.prototype, "taxList", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('newsletter/subscribe'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CatalogExtrasController.prototype, "newsletter", null);
exports.CatalogExtrasController = CatalogExtrasController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CatalogExtrasController);
//# sourceMappingURL=catalog-extras.controller.js.map