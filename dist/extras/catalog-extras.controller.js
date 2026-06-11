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
const throttler_1 = require("@nestjs/throttler");
const prisma_service_1 = require("../prisma/prisma.service");
const mongo_data_service_1 = require("../mongo/mongo-data.service");
const storage_url_1 = require("../common/storage-url");
let CatalogExtrasController = class CatalogExtrasController {
    prisma;
    mongo;
    constructor(prisma, mongo) {
        this.prisma = prisma;
        this.mongo = mongo;
    }
    useMongo() {
        const v = (process.env.USE_MONGO_EXTRAS ?? '1').toLowerCase();
        return v === '1' || v === 'true' || v === 'yes';
    }
    num(v) {
        if (v === null || v === undefined || v === '')
            return 0;
        if (typeof v === 'number')
            return Number.isFinite(v) ? v : 0;
        if (typeof v === 'string')
            return Number(v) || 0;
        if (typeof v === 'object' && v !== null && 'toNumber' in v && typeof v.toNumber === 'function') {
            return v.toNumber();
        }
        return Number(v) || 0;
    }
    async couponList() {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('coupons', { status: true }, { sort: { mysql_id: -1 } });
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
    async couponApply(code, amountStr) {
        if (!code)
            return { code: 'invalid', message: 'code required' };
        if (this.useMongo()) {
            const c = await this.mongo.findOne('coupons', { code, status: true });
            if (!c)
                return { code: 'invalid', message: 'coupon not found' };
            const amount = parseFloat(amountStr ?? '0');
            const minPurchase = this.num(c.min_purchase);
            if (amount > 0 && amount < minPurchase) {
                return { code: 'minimum', message: `Minimum purchase ₹${minPurchase}` };
            }
            let discount = c.discount_type === 'percentage' ? (amount * this.num(c.discount)) / 100 : this.num(c.discount);
            const maxDiscount = this.num(c.max_discount);
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
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('coupons', {
                status: true,
                $or: [
                    { restaurant_id: id },
                    { mysql_restaurant_id: id },
                    { restaurant_id: null, coupon_type: 'default' },
                    { mysql_restaurant_id: null, coupon_type: 'default' },
                ],
            }, { sort: { mysql_id: -1 } });
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
    async cuisineAlias() {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('cuisines', { status: true });
            return rows.map((r) => ({
                id: Number(r.mysql_id),
                name: r.name,
                image: r.image,
                image_full_url: (0, storage_url_1.storageFullUrl)('cuisine', r.image ?? null),
                slug: r.slug,
            }));
        }
        const rows = await this.prisma.cuisines.findMany({ where: { status: true } });
        return rows.map((r) => ({
            id: Number(r.id),
            name: r.name,
            image: r.image,
            image_full_url: (0, storage_url_1.storageFullUrl)('cuisine', r.image ?? null),
            slug: r.slug,
        }));
    }
    async cuisineRestaurants(idStr) {
        const id = parseInt(idStr ?? '', 10);
        if (!Number.isFinite(id))
            return { restaurants: [], total_size: 0 };
        return { restaurants: [], total_size: 0 };
    }
    async addonCategoryList() {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('addon_categories', { status: true });
            return rows.map((r) => ({ id: Number(r.mysql_id), name: r.name, status: r.status, slug: r.slug }));
        }
        const rows = await this.prisma.addon_categories.findMany({ where: { status: true } });
        return rows.map((r) => ({ id: Number(r.id), name: r.name, status: r.status, slug: r.slug }));
    }
    async basicCampaigns() {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('campaigns', { status: true }, { sort: { mysql_id: -1 } });
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
    async basicCampaignDetails(idStr) {
        const id = parseInt(idStr ?? '', 10);
        if (!Number.isFinite(id))
            return { campaign: null, restaurants: [] };
        if (this.useMongo()) {
            const c = await this.mongo.findByMysqlId('campaigns', id);
            return { campaign: c ? { ...c, id: Number(c.mysql_id) } : null, restaurants: [] };
        }
        const campaign = await this.prisma.campaigns.findUnique({ where: { id: BigInt(id) } });
        return { campaign: campaign ? { ...campaign, id: Number(campaign.id) } : null, restaurants: [] };
    }
    itemCampaigns() {
        return { campaigns: [], total_size: 0 };
    }
    async cashbackList() {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('cash_backs', {});
            return rows.map((r) => ({ ...r, id: Number(r.mysql_id) }));
        }
        const rows = await this.prisma.cash_backs.findMany();
        return rows.map((r) => ({ ...r, id: Number(r.id) }));
    }
    getCashback() {
        return { cashback_amount: 0, message: 'no cashback' };
    }
    async offlinePaymentMethods() {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('offline_payment_methods', { $or: [{ status: 1 }, { status: true }] });
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
    async search(name, limitStr) {
        const limit = parseInt(limitStr ?? '20', 10);
        const q = (name ?? '').trim();
        if (!q)
            return { products: { products: [] }, restaurants: { restaurants: [] } };
        if (this.useMongo()) {
            const escape = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = { $regex: escape, $options: 'i' };
            const [products, restaurants] = await Promise.all([
                this.mongo.findMany('foods', { name: re, status: true }, { limit }),
                this.mongo.findMany('restaurants', { name: re, status: true }, { limit }),
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
    setMenu() {
        return { menus: [], total_size: 0 };
    }
    async productsSearch(name, offsetStr, limitStr, minPriceStr, maxPriceStr) {
        const limit = parseInt(limitStr ?? '10', 10);
        const offset = parseInt(offsetStr ?? '1', 10);
        const minPrice = parseFloat(minPriceStr ?? '0');
        const maxPrice = maxPriceStr ? parseFloat(maxPriceStr) : Infinity;
        const q = (name ?? '').trim();
        const filter = { status: true };
        if (q) {
            const escape = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.name = { $regex: escape, $options: 'i' };
        }
        if (!this.useMongo()) {
            return { total_size: 0, limit, offset, products: [] };
        }
        const all = await this.mongo.findMany('foods', filter);
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
    async restaurantsSearch(name, offsetStr, limitStr) {
        const limit = parseInt(limitStr ?? '10', 10);
        const offset = parseInt(offsetStr ?? '1', 10);
        const q = (name ?? '').trim();
        const filter = { status: true };
        if (q) {
            const escape = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.name = { $regex: escape, $options: 'i' };
        }
        if (!this.useMongo()) {
            return { total_size: 0, limit, offset, restaurants: [] };
        }
        const all = await this.mongo.findMany('restaurants', filter);
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
    async productReviewsByPath(idStr) {
        const id = parseInt(idStr, 10);
        const empty = { rating_count: 0, avg_rating: 0, rating: [0, 0, 0, 0, 0], reviews: [] };
        if (!Number.isFinite(id) || !this.useMongo())
            return empty;
        const rows = await this.mongo.findMany('reviews', { $or: [{ food_id: id }, { mysql_food_id: id }], status: { $ne: false } }, { sort: { mysql_id: -1 }, limit: 100 });
        if (rows.length === 0)
            return empty;
        const userIds = Array.from(new Set(rows.map((r) => Number(r.mysql_user_id ?? r.user_id ?? 0)).filter((n) => n > 0)));
        const users = userIds.length
            ? await this.mongo.findMany('users', { mysql_id: { $in: userIds } })
            : [];
        const userMap = new Map(users.map((u) => [Number(u.mysql_id), u]));
        const dist = [0, 0, 0, 0, 0];
        let sum = 0, n = 0;
        for (const r of rows) {
            const rt = Math.max(0, Math.min(5, Math.round(Number(r.rating ?? 0))));
            if (rt >= 1) {
                dist[5 - rt] += 1;
                sum += rt;
                n += 1;
            }
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
                    image_full_url: (0, storage_url_1.storageFullUrl)('profile', u.image ?? null),
                } : null,
            };
        });
        return { rating_count: rows.length, avg_rating: avg, rating: dist, reviews };
    }
    async productReviews(idStr) {
        const id = parseInt(idStr ?? '', 10);
        if (!Number.isFinite(id))
            return [];
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('reviews', { $or: [{ food_id: id }, { mysql_food_id: id }], status: true }, { sort: { mysql_id: -1 }, limit: 50 });
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
    async submitProductReview(body = {}) {
        if (!this.useMongo())
            return { message: 'review submitted' };
        const foodId = Number(body.food_id ?? body.product_id ?? 0);
        const rating = Math.max(1, Math.min(5, Math.round(Number(body.rating ?? 0))));
        if (!foodId || !rating)
            return { errors: [{ code: 'input', message: 'food_id and rating are required' }] };
        const food = await this.mongo.findByMysqlId('foods', foodId);
        if (!food)
            return { errors: [{ code: 'food', message: 'not found' }] };
        const restId = Number(food.mysql_restaurant_id ?? 0);
        const now = new Date();
        const nextId = await this.mongo.nextMysqlId('reviews');
        await this.mongo.insertOne('reviews', {
            mysql_id: nextId,
            mysql_food_id: foodId,
            food_id: foodId,
            mysql_restaurant_id: restId || null,
            mysql_user_id: body.user_id ? Number(body.user_id) : null,
            order_id: body.order_id ? Number(body.order_id) : null,
            comment: body.comment ? String(body.comment) : null,
            rating,
            created_at: now,
            updated_at: now,
        });
        await this.recomputeRating('foods', foodId, { mysql_food_id: foodId });
        if (restId)
            await this.recomputeRating('restaurants', restId, { mysql_restaurant_id: restId });
        return { message: 'review submitted' };
    }
    async recomputeRating(collection, mysqlId, match) {
        const agg = await this.mongo.aggregate('reviews', [
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
    async recommendedMostReviewed() {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('foods', { status: true }, { sort: { order_count: -1 }, limit: 10 });
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
    async restaurantReviews(idStr) {
        const id = parseInt(idStr ?? '', 10);
        if (!Number.isFinite(id))
            return [];
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('reviews', { $or: [{ restaurant_id: id }, { mysql_restaurant_id: id }], status: { $ne: false } }, { sort: { mysql_id: -1 }, limit: 50 });
            const foodIds = Array.from(new Set(rows.map((r) => Number(r.mysql_food_id ?? r.food_id ?? 0)).filter((n) => n > 0)));
            const userIds = Array.from(new Set(rows.map((r) => Number(r.mysql_user_id ?? r.user_id ?? 0)).filter((n) => n > 0)));
            const [foods, users] = await Promise.all([
                foodIds.length ? this.mongo.findMany('foods', { mysql_id: { $in: foodIds } }) : Promise.resolve([]),
                userIds.length ? this.mongo.findMany('users', { mysql_id: { $in: userIds } }) : Promise.resolve([]),
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
                    food_image_full_url: (0, storage_url_1.storageFullUrl)('product', food?.image ?? null),
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
    dineInRestaurants() {
        return { restaurants: [], total_size: 0 };
    }
    recentlyViewed() {
        return [];
    }
    async advertisementList() {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('advertisements', { status: { $in: ['approved', 'running'] } }, { sort: { priority: 1 }, limit: 20 });
            const img = (f) => {
                const s = f && String(f).trim() ? String(f) : '';
                if (!s)
                    return null;
                return /^https?:\/\//i.test(s) ? s : (0, storage_url_1.storageFullUrl)('advertisement', s);
            };
            const restIds = Array.from(new Set(rows
                .map((r) => Number(r.mysql_restaurant_id ?? r.restaurant_id ?? 0))
                .filter((n) => n > 0)));
            const restaurants = restIds.length
                ? await this.mongo.findMany('restaurants', { mysql_id: { $in: restIds } })
                : [];
            const restMap = new Map(restaurants.map((r) => [Number(r.mysql_id), r]));
            return rows
                .filter((r) => {
                const rest = restMap.get(Number(r.mysql_restaurant_id ?? r.restaurant_id ?? 0));
                return !!rest && rest.status !== false && rest.active !== false;
            })
                .map((r) => {
                const rid = Number(r.mysql_restaurant_id ?? r.restaurant_id ?? 0);
                const rest = restMap.get(rid);
                const coverUrl = img(r.cover_image) ?? (0, storage_url_1.storageFullUrl)('restaurant/cover', rest?.cover_photo ?? null) ?? (0, storage_url_1.storageFullUrl)('restaurant', rest?.logo ?? null);
                const profileUrl = img(r.profile_image) ?? (0, storage_url_1.storageFullUrl)('restaurant', rest?.logo ?? null);
                return {
                    ...r,
                    id: Number(r.mysql_id),
                    restaurant_id: rid,
                    restaurant_status: 1,
                    restaurant_name: rest?.name ?? null,
                    restaurant_logo_full_url: (0, storage_url_1.storageFullUrl)('restaurant', rest?.logo ?? null),
                    created_by_id: Number(r.mysql_created_by_id ?? r.created_by_id ?? 0),
                    cover_image_full_url: coverUrl,
                    profile_image_full_url: profileUrl,
                    video_attachment_full_url: img(r.video_attachment),
                };
            });
        }
        try {
            const rows = await this.prisma.advertisements.findMany({ where: { status: 'approved' }, orderBy: { priority: 'asc' }, take: 20 });
            return rows.map((r) => ({ ...r, id: Number(r.id), restaurant_id: Number(r.restaurant_id), created_by_id: Number(r.created_by_id) }));
        }
        catch {
            return [];
        }
    }
    async allergies() {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('allergies', {});
            return rows.map((r) => ({ ...r, id: Number(r.mysql_id) }));
        }
        const rows = await this.prisma.allergies.findMany();
        return rows.map((r) => ({ ...r, id: Number(r.id) }));
    }
    async nutritions() {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('nutritions', {});
            return rows.map((r) => ({ ...r, id: Number(r.mysql_id) }));
        }
        const rows = await this.prisma.nutritions.findMany();
        return rows.map((r) => ({ ...r, id: Number(r.id) }));
    }
    async vehicles() {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('vehicles', { status: true });
            return rows.map((r) => ({ ...r, id: Number(r.mysql_id) }));
        }
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
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('shifts', { status: true });
            return rows.map((r) => ({ ...r, id: Number(r.mysql_id) }));
        }
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
    (0, throttler_1.SkipThrottle)(),
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
    (0, throttler_1.SkipThrottle)(),
    (0, common_1.Get)('products/search'),
    __param(0, (0, common_1.Query)('name')),
    __param(1, (0, common_1.Query)('offset')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('min_price')),
    __param(4, (0, common_1.Query)('max_price')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], CatalogExtrasController.prototype, "productsSearch", null);
__decorate([
    (0, throttler_1.SkipThrottle)(),
    (0, common_1.Get)('restaurants/search'),
    __param(0, (0, common_1.Query)('name')),
    __param(1, (0, common_1.Query)('offset')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], CatalogExtrasController.prototype, "restaurantsSearch", null);
__decorate([
    (0, common_1.Get)('products/reviews/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CatalogExtrasController.prototype, "productReviewsByPath", null);
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
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
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
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        mongo_data_service_1.MongoDataService])
], CatalogExtrasController);
//# sourceMappingURL=catalog-extras.controller.js.map