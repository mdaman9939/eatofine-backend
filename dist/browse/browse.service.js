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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowseService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const mongo_data_service_1 = require("../mongo/mongo-data.service");
const storage_url_1 = require("../common/storage-url");
let BrowseService = class BrowseService {
    prisma;
    mongo;
    constructor(prisma, mongo) {
        this.prisma = prisma;
        this.mongo = mongo;
    }
    useMongo() {
        const v = (process.env.USE_MONGO_BROWSE ?? '1').toLowerCase();
        return v === '1' || v === 'true' || v === 'yes';
    }
    fullUrl(folder, file) {
        return (0, storage_url_1.storageFullUrl)(folder, file);
    }
    mapRestaurant(r) {
        return {
            id: r.id,
            name: r.name,
            phone: r.phone,
            email: r.email,
            logo: r.logo,
            logo_full_url: this.fullUrl('restaurant', r.logo),
            cover_photo: r.cover_photo,
            cover_photo_full_url: this.fullUrl('restaurant/cover', r.cover_photo),
            latitude: r.latitude,
            longitude: r.longitude,
            address: r.address,
            minimum_order: Number(r.minimum_order ?? 0),
            delivery_time: r.delivery_time ?? '30-40',
            avg_rating: r.avg_rating ?? 0,
            rating_count: r.rating_count ?? 0,
            free_delivery: r.free_delivery ? 1 : 0,
            delivery: r.delivery ? 1 : 0,
            take_away: r.take_away ? 1 : 0,
            veg: r.veg ? 1 : 0,
            non_veg: r.non_veg ? 1 : 0,
            minimum_shipping_charge: Number(r.minimum_shipping_charge ?? 0),
            schedule_order: r.schedule_order ? 1 : 0,
            status: r.status ? 1 : 0,
            restaurant_status: r.status ? 1 : 0,
            active: r.active ? 1 : 0,
            open: r.open ?? 1,
            zone_id: r.zone_id,
            vendor_id: r.vendor_id,
            opening_time: r.opening_time,
            closeing_time: r.closeing_time,
            food_section: r.food_section ? 1 : 0,
        };
    }
    mapRestaurantMongo(r, vendorImage) {
        const logo = r.logo ?? null;
        const logoUrl = this.fullUrl('restaurant', logo) ?? this.fullUrl('profile', vendorImage ?? null);
        return {
            id: Number(r.mysql_id ?? 0),
            name: r.name ?? null,
            phone: r.phone ?? null,
            email: r.email ?? null,
            logo: logo ?? vendorImage ?? null,
            logo_full_url: logoUrl,
            cover_photo: r.cover_photo ?? null,
            cover_photo_full_url: this.fullUrl('restaurant/cover', r.cover_photo ?? null),
            latitude: r.latitude != null ? String(r.latitude) : null,
            longitude: r.longitude != null ? String(r.longitude) : null,
            address: r.address ?? null,
            minimum_order: Number(r.minimum_order ?? 0),
            delivery_time: r.delivery_time ?? '30-40',
            avg_rating: r.avg_rating ?? 0,
            rating_count: r.rating_count ?? 0,
            free_delivery: r.free_delivery ? 1 : 0,
            delivery: r.delivery ? 1 : 0,
            take_away: r.take_away ? 1 : 0,
            veg: r.veg ? 1 : 0,
            non_veg: r.non_veg ? 1 : 0,
            minimum_shipping_charge: Number(r.minimum_shipping_charge ?? 0),
            schedule_order: r.schedule_order ? 1 : 0,
            status: r.status ? 1 : 0,
            restaurant_status: r.status ? 1 : 0,
            active: r.active ? 1 : 0,
            open: r.open ?? 1,
            zone_id: r.mysql_zone_id != null ? Number(r.mysql_zone_id) : null,
            vendor_id: Number(r.mysql_vendor_id ?? 0),
            opening_time: r.opening_time ?? null,
            closeing_time: r.closeing_time ?? null,
            food_section: r.food_section ? 1 : 0,
        };
    }
    async vendorImageMap(restaurants) {
        const ids = Array.from(new Set(restaurants.filter((r) => !r.logo && r.mysql_vendor_id).map((r) => Number(r.mysql_vendor_id))));
        if (ids.length === 0)
            return new Map();
        const vendors = await this.mongo.findMany('vendors', { mysql_id: { $in: ids } }, { projection: { mysql_id: 1, image: 1 } });
        return new Map(vendors.map((v) => [Number(v.mysql_id), v.image ?? null]));
    }
    mapFood(f, restaurantName) {
        const safeParse = (s) => {
            if (!s)
                return [];
            try {
                return JSON.parse(s);
            }
            catch {
                return [];
            }
        };
        return {
            id: f.id,
            name: f.name,
            description: f.description,
            image: f.image,
            image_full_url: this.fullUrl('product', f.image),
            category_id: f.category_id,
            category_ids: safeParse(f.category_ids),
            variations: safeParse(f.variations),
            add_ons: safeParse(f.add_ons),
            attributes: safeParse(f.attributes),
            choice_options: safeParse(f.choice_options),
            price: Number(f.price),
            tax: Number(f.tax),
            tax_type: f.tax_type,
            discount: Number(f.discount),
            discount_type: f.discount_type,
            veg: f.veg ? 1 : 0,
            status: f.status ? 1 : 0,
            restaurant_id: f.restaurant_id,
            restaurant_name: restaurantName ?? null,
            avg_rating: f.avg_rating,
            rating_count: f.rating_count,
            recommended: f.recommended ? 1 : 0,
        };
    }
    mapFoodMongo(f, restaurantName) {
        const safeParse = (s) => {
            if (s == null)
                return [];
            if (typeof s !== 'string')
                return s;
            try {
                return JSON.parse(s);
            }
            catch {
                return [];
            }
        };
        return {
            id: Number(f.mysql_id ?? 0),
            name: f.name ?? null,
            description: f.description ?? null,
            image: f.image ?? null,
            image_full_url: this.fullUrl('product', f.image ?? null),
            category_id: f.mysql_category_id != null ? Number(f.mysql_category_id) : null,
            category_ids: safeParse(f.category_ids),
            variations: safeParse(f.variations),
            add_ons: safeParse(f.add_ons),
            attributes: safeParse(f.attributes),
            choice_options: safeParse(f.choice_options),
            price: Number(f.price ?? 0),
            tax: Number(f.tax ?? 0),
            tax_type: f.tax_type ?? 'percent',
            discount: Number(f.discount ?? 0),
            discount_type: f.discount_type ?? 'percent',
            veg: f.veg ? 1 : 0,
            status: f.status ? 1 : 0,
            restaurant_id: Number(f.mysql_restaurant_id ?? 0),
            restaurant_name: restaurantName ?? null,
            avg_rating: Number(f.avg_rating ?? 0),
            rating_count: Number(f.rating_count ?? 0),
            recommended: f.recommended ? 1 : 0,
        };
    }
    async getRestaurants(opts) {
        if (this.useMongo()) {
            const filter = { status: true, active: true };
            if (opts.zoneId)
                filter.mysql_zone_id = Number(opts.zoneId);
            const total = await this.mongo.count('restaurants', filter);
            const rows = await this.mongo.findMany('restaurants', filter, {
                limit: opts.limit,
                skip: Math.max(0, (opts.offset - 1) * opts.limit),
                sort: { mysql_id: 1 },
            });
            const vendorImg = await this.vendorImageMap(rows);
            return {
                filter_data: opts.filter ?? 'all',
                total_size: total,
                limit: String(opts.limit),
                offset: String(opts.offset),
                restaurants: rows.map((r) => this.mapRestaurantMongo(r, vendorImg.get(Number(r.mysql_vendor_id ?? 0)))),
            };
        }
        const where = { status: true, active: true };
        if (opts.zoneId)
            where.zone_id = BigInt(opts.zoneId);
        const total = await this.prisma.restaurants.count({ where });
        const rows = await this.prisma.restaurants.findMany({
            where,
            take: opts.limit,
            skip: Math.max(0, (opts.offset - 1) * opts.limit),
            orderBy: { id: 'asc' },
        });
        return {
            filter_data: opts.filter ?? 'all',
            total_size: total,
            limit: String(opts.limit),
            offset: String(opts.offset),
            restaurants: rows.map((r) => this.mapRestaurant(r)),
        };
    }
    async getRestaurantsLatest(zoneId, limit = 10, offset = 1) {
        if (this.useMongo()) {
            return this.queryRestaurantsOrderedMongo(zoneId, limit, offset, { mysql_id: -1 });
        }
        return this.queryRestaurantsOrdered(zoneId, limit, offset, { id: 'desc' });
    }
    async getRestaurantsPopular(zoneId, limit = 10, offset = 1) {
        if (this.useMongo()) {
            return this.queryRestaurantsOrderedMongo(zoneId, limit, offset, { order_count: -1 });
        }
        return this.queryRestaurantsOrdered(zoneId, limit, offset, { order_count: 'desc' });
    }
    async queryRestaurantsOrderedMongo(zoneId, limit, offset, sort) {
        const filter = { status: true, active: true };
        if (zoneId)
            filter.mysql_zone_id = Number(zoneId);
        const total = await this.mongo.count('restaurants', filter);
        const rows = await this.mongo.findMany('restaurants', filter, {
            limit,
            skip: Math.max(0, (offset - 1) * limit),
            sort,
        });
        return {
            total_size: total,
            limit: String(limit),
            offset: String(offset),
            restaurants: rows.map((r) => this.mapRestaurantMongo(r)),
        };
    }
    async queryRestaurantsOrdered(zoneId, limit, offset, orderBy) {
        const where = { status: true, active: true };
        if (zoneId)
            where.zone_id = BigInt(zoneId);
        const total = await this.prisma.restaurants.count({ where });
        const rows = await this.prisma.restaurants.findMany({
            where,
            take: limit,
            skip: Math.max(0, (offset - 1) * limit),
            orderBy,
        });
        return {
            total_size: total,
            limit: String(limit),
            offset: String(offset),
            restaurants: rows.map((r) => this.mapRestaurant(r)),
        };
    }
    async getRestaurantDetails(idOrSlug) {
        const numeric = /^\d+$/.test(String(idOrSlug)) ? Number(idOrSlug) : null;
        if (this.useMongo()) {
            const r = numeric !== null
                ? await this.mongo.findByMysqlId('restaurants', numeric)
                : await this.mongo.findOne('restaurants', { slug: String(idOrSlug) });
            if (!r)
                return null;
            const id = Number(r.mysql_id);
            const vendor = r.mysql_vendor_id
                ? await this.mongo.findByMysqlId('vendors', Number(r.mysql_vendor_id))
                : null;
            const foods = await this.mongo.findMany('foods', { mysql_restaurant_id: Number(id), status: true }, { sort: { mysql_id: 1 } });
            const categoryIdsRaw = foods
                .map((f) => f.mysql_category_id)
                .filter((cid) => cid != null);
            const uniqueCatIds = Array.from(new Set(categoryIdsRaw.map((n) => Number(n))));
            const cats = uniqueCatIds.length
                ? await this.mongo.findMany('categories', {
                    mysql_id: { $in: uniqueCatIds },
                })
                : [];
            return {
                ...this.mapRestaurantMongo(r, vendor?.image),
                foods: foods.map((f) => this.mapFoodMongo(f, r.name)),
                categories: cats.map((c) => ({
                    id: Number(c.mysql_id ?? 0),
                    name: c.name ?? null,
                    image: c.image ?? null,
                    image_full_url: this.fullUrl('category', c.image ?? null),
                    parent_id: c.parent_id ?? 0,
                })),
            };
        }
        if (numeric === null)
            return null;
        const r = await this.prisma.restaurants.findUnique({ where: { id: BigInt(numeric) } });
        if (!r)
            return null;
        const foods = await this.prisma.food.findMany({
            where: { restaurant_id: r.id, status: true },
            orderBy: { id: 'asc' },
        });
        const categoryIdsRaw = foods
            .map((f) => f.category_id)
            .filter((cid) => cid !== null);
        const uniqueCatIds = Array.from(new Set(categoryIdsRaw.map((bi) => Number(bi))));
        const cats = uniqueCatIds.length
            ? await this.prisma.categories.findMany({ where: { id: { in: uniqueCatIds.map((n) => BigInt(n)) } } })
            : [];
        return {
            ...this.mapRestaurant(r),
            foods: foods.map((f) => this.mapFood(f, r.name)),
            categories: cats.map((c) => ({
                id: c.id,
                name: c.name,
                image: c.image,
                image_full_url: this.fullUrl('category', c.image),
                parent_id: c.parent_id ?? 0,
            })),
        };
    }
    async getProductsLatest(zoneId, limit = 10, offset = 1) {
        if (this.useMongo()) {
            return this.queryFoodsOrderedMongo(zoneId, limit, offset, { mysql_id: -1 });
        }
        return this.queryFoodsOrdered(zoneId, limit, offset, { id: 'desc' });
    }
    async getProductsPopular(zoneId, limit = 10, offset = 1) {
        if (this.useMongo()) {
            return this.queryFoodsOrderedMongo(zoneId, limit, offset, { order_count: -1 });
        }
        return this.queryFoodsOrdered(zoneId, limit, offset, { order_count: 'desc' });
    }
    async getProductsRecommended(zoneId, limit = 10, offset = 1) {
        if (this.useMongo()) {
            return this.queryFoodsOrderedMongo(zoneId, limit, offset, { mysql_id: 1 }, { recommended: true });
        }
        return this.queryFoodsOrdered(zoneId, limit, offset, { id: 'asc' }, { recommended: true });
    }
    async getProductsMostReviewed(zoneId, limit = 10, offset = 1) {
        if (this.useMongo()) {
            return this.queryFoodsOrderedMongo(zoneId, limit, offset, { rating_count: -1 });
        }
        return this.queryFoodsOrdered(zoneId, limit, offset, { rating_count: 'desc' });
    }
    async queryFoodsOrderedMongo(zoneId, limit, offset, sort, extraFilter = {}) {
        const restaurantFilter = { status: true, active: true };
        if (zoneId)
            restaurantFilter.mysql_zone_id = Number(zoneId);
        const restaurants = await this.mongo.findMany('restaurants', restaurantFilter, { projection: { mysql_id: 1, name: 1 } });
        const restaurantNameById = new Map(restaurants.map((r) => [Number(r.mysql_id ?? 0), r.name]));
        const restaurantIds = restaurants.map((r) => Number(r.mysql_id ?? 0));
        const foodFilter = {
            status: true,
            mysql_restaurant_id: { $in: restaurantIds },
            ...extraFilter,
        };
        const total = await this.mongo.count('foods', foodFilter);
        const rows = await this.mongo.findMany('foods', foodFilter, {
            limit,
            skip: Math.max(0, (offset - 1) * limit),
            sort,
        });
        return {
            total_size: total,
            limit: String(limit),
            offset: String(offset),
            products: rows.map((f) => this.mapFoodMongo(f, restaurantNameById.get(Number(f.mysql_restaurant_id ?? 0)) ?? undefined)),
        };
    }
    async queryFoodsOrdered(zoneId, limit, offset, orderBy, extraWhere = {}) {
        const restaurantWhere = {
            status: true,
            active: true,
        };
        if (zoneId)
            restaurantWhere.zone_id = BigInt(zoneId);
        const restaurants = await this.prisma.restaurants.findMany({
            where: restaurantWhere,
            select: { id: true, name: true },
        });
        const restaurantNameById = new Map(restaurants.map((r) => [r.id, r.name]));
        const restaurantIds = restaurants.map((r) => r.id);
        const total = await this.prisma.food.count({
            where: { status: true, restaurant_id: { in: restaurantIds }, ...extraWhere },
        });
        const rows = await this.prisma.food.findMany({
            where: { status: true, restaurant_id: { in: restaurantIds }, ...extraWhere },
            take: limit,
            skip: Math.max(0, (offset - 1) * limit),
            orderBy,
        });
        return {
            total_size: total,
            limit: String(limit),
            offset: String(offset),
            products: rows.map((f) => this.mapFood(f, restaurantNameById.get(f.restaurant_id) ?? undefined)),
        };
    }
    async getProductDetails(id) {
        if (this.useMongo()) {
            const f = await this.mongo.findByMysqlId('foods', Number(id));
            if (!f)
                return null;
            const r = f.mysql_restaurant_id != null
                ? await this.mongo.findByMysqlId('restaurants', Number(f.mysql_restaurant_id))
                : null;
            return this.mapFoodMongo(f, r?.name);
        }
        const f = await this.prisma.food.findUnique({ where: { id: BigInt(id) } });
        if (!f)
            return null;
        const r = await this.prisma.restaurants.findUnique({ where: { id: f.restaurant_id } });
        return this.mapFood(f, r?.name);
    }
    async getCategoryProducts(categoryId, limit = 10, offset = 1) {
        if (this.useMongo()) {
            const filter = { status: true, mysql_category_id: Number(categoryId) };
            const total = await this.mongo.count('foods', filter);
            const rows = await this.mongo.findMany('foods', filter, {
                limit,
                skip: Math.max(0, (offset - 1) * limit),
            });
            return {
                total_size: total,
                limit: String(limit),
                offset: String(offset),
                products: rows.map((f) => this.mapFoodMongo(f)),
            };
        }
        const where = { status: true, category_id: BigInt(categoryId) };
        const total = await this.prisma.food.count({ where });
        const rows = await this.prisma.food.findMany({
            where,
            take: limit,
            skip: Math.max(0, (offset - 1) * limit),
        });
        return {
            total_size: total,
            limit: String(limit),
            offset: String(offset),
            products: rows.map((f) => this.mapFood(f)),
        };
    }
    async getCategoryRestaurants(categoryId, limit = 10, offset = 1) {
        if (this.useMongo()) {
            const foods = await this.mongo.findMany('foods', { status: true, mysql_category_id: Number(categoryId) }, { projection: { mysql_restaurant_id: 1 } });
            const restaurantIds = Array.from(new Set(foods
                .map((f) => f.mysql_restaurant_id)
                .filter((rid) => rid != null)
                .map((n) => Number(n))));
            const filter = {
                status: true,
                mysql_id: { $in: restaurantIds },
            };
            const total = await this.mongo.count('restaurants', filter);
            const rows = await this.mongo.findMany('restaurants', filter, {
                limit,
                skip: Math.max(0, (offset - 1) * limit),
            });
            return {
                total_size: total,
                limit: String(limit),
                offset: String(offset),
                restaurants: rows.map((r) => this.mapRestaurantMongo(r)),
            };
        }
        const foods = await this.prisma.food.findMany({
            where: { status: true, category_id: BigInt(categoryId) },
            select: { restaurant_id: true },
        });
        const restaurantIds = Array.from(new Set(foods.map((f) => f.restaurant_id)));
        const where = { status: true, id: { in: restaurantIds } };
        const total = await this.prisma.restaurants.count({ where });
        const rows = await this.prisma.restaurants.findMany({
            where,
            take: limit,
            skip: Math.max(0, (offset - 1) * limit),
        });
        return {
            total_size: total,
            limit: String(limit),
            offset: String(offset),
            restaurants: rows.map((r) => this.mapRestaurant(r)),
        };
    }
};
exports.BrowseService = BrowseService;
exports.BrowseService = BrowseService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        mongo_data_service_1.MongoDataService])
], BrowseService);
//# sourceMappingURL=browse.service.js.map