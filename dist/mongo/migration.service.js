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
exports.MigrationService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const prisma_service_1 = require("../prisma/prisma.service");
const user_schema_1 = require("./schemas/user.schema");
const vendor_schema_1 = require("./schemas/vendor.schema");
const restaurant_schema_1 = require("./schemas/restaurant.schema");
const food_schema_1 = require("./schemas/food.schema");
const delivery_man_schema_1 = require("./schemas/delivery-man.schema");
const order_schema_1 = require("./schemas/order.schema");
const category_schema_1 = require("./schemas/category.schema");
const cuisine_schema_1 = require("./schemas/cuisine.schema");
const banner_schema_1 = require("./schemas/banner.schema");
let MigrationService = class MigrationService {
    prisma;
    userModel;
    vendorModel;
    restaurantModel;
    foodModel;
    dmModel;
    orderModel;
    categoryModel;
    cuisineModel;
    bannerModel;
    log = new common_1.Logger('Migration');
    constructor(prisma, userModel, vendorModel, restaurantModel, foodModel, dmModel, orderModel, categoryModel, cuisineModel, bannerModel) {
        this.prisma = prisma;
        this.userModel = userModel;
        this.vendorModel = vendorModel;
        this.restaurantModel = restaurantModel;
        this.foodModel = foodModel;
        this.dmModel = dmModel;
        this.orderModel = orderModel;
        this.categoryModel = categoryModel;
        this.cuisineModel = cuisineModel;
        this.bannerModel = bannerModel;
    }
    async runAll() {
        const startedAt = new Date();
        const steps = [];
        steps.push(await this.migrateUsers());
        steps.push(await this.migrateVendors());
        steps.push(await this.migrateDeliveryMen());
        steps.push(await this.migrateRestaurants());
        steps.push(await this.migrateFoods());
        steps.push(await this.migrateOrders());
        steps.push(await this.migrateCategories());
        steps.push(await this.migrateCuisines());
        steps.push(await this.migrateBanners());
        const finishedAt = new Date();
        const totalInserted = steps.reduce((s, x) => s + x.inserted, 0);
        const totalSkipped = steps.reduce((s, x) => s + x.skipped, 0);
        return {
            started_at: startedAt.toISOString(),
            finished_at: finishedAt.toISOString(),
            duration_ms: finishedAt.getTime() - startedAt.getTime(),
            steps,
            total_inserted: totalInserted,
            total_skipped: totalSkipped,
        };
    }
    async migrateUsers() {
        return this.runStep('users', async () => {
            const rows = await this.prisma.$queryRawUnsafe(`SELECT * FROM users`);
            let inserted = 0;
            let skipped = 0;
            for (const r of rows) {
                const mysqlId = Number(r.id);
                try {
                    const { id, f_name, l_name, email, phone, password, status, image, ref_code, is_phone_verified, is_email_verified, ...rest } = r;
                    void id;
                    await this.userModel.updateOne({ mysql_id: mysqlId }, {
                        $set: {
                            mysql_id: mysqlId,
                            f_name: f_name,
                            l_name: l_name,
                            email: email?.toLowerCase(),
                            phone: phone,
                            password: password,
                            status: status === null || status === undefined ? true : !!status,
                            image: image,
                            ref_code: ref_code,
                            is_phone_verified: !!is_phone_verified,
                            is_email_verified: !!is_email_verified,
                            legacy: rest,
                        },
                    }, { upsert: true });
                    inserted++;
                }
                catch (e) {
                    skipped++;
                    this.log.warn(`user #${mysqlId}: ${e.message}`);
                }
            }
            return { inserted, skipped, mysql_count: rows.length };
        });
    }
    async migrateVendors() {
        return this.runStep('vendors', async () => {
            const rows = await this.prisma.$queryRawUnsafe(`SELECT id, f_name, l_name, email, phone, password, status, image,
                created_at, updated_at
         FROM vendors`);
            let inserted = 0;
            let skipped = 0;
            for (const r of rows) {
                const mysqlId = Number(r.id);
                try {
                    await this.vendorModel.updateOne({ mysql_id: mysqlId }, {
                        $set: {
                            mysql_id: mysqlId,
                            f_name: r.f_name,
                            l_name: r.l_name,
                            email: r.email?.toLowerCase(),
                            phone: r.phone,
                            password: r.password,
                            status: !!r.status,
                            image: r.image,
                            legacy: {
                                created_at: r.created_at,
                                updated_at: r.updated_at,
                            },
                        },
                    }, { upsert: true });
                    inserted++;
                }
                catch (e) {
                    skipped++;
                    this.log.warn(`vendor #${mysqlId}: ${e.message}`);
                }
            }
            return { inserted, skipped, mysql_count: rows.length };
        });
    }
    async migrateDeliveryMen() {
        return this.runStep('delivery_men', async () => {
            const rows = await this.prisma.$queryRawUnsafe(`SELECT id, f_name, l_name, email, phone, password, status, image,
                application_status, zone_id, created_at, updated_at
         FROM delivery_men`);
            let inserted = 0;
            let skipped = 0;
            for (const r of rows) {
                const mysqlId = Number(r.id);
                try {
                    await this.dmModel.updateOne({ mysql_id: mysqlId }, {
                        $set: {
                            mysql_id: mysqlId,
                            f_name: r.f_name,
                            l_name: r.l_name,
                            email: r.email?.toLowerCase(),
                            phone: r.phone,
                            password: r.password,
                            status: !!r.status,
                            image: r.image,
                            application_status: r.application_status,
                            mysql_zone_id: r.zone_id ? Number(r.zone_id) : undefined,
                            legacy: { created_at: r.created_at, updated_at: r.updated_at },
                        },
                    }, { upsert: true });
                    inserted++;
                }
                catch (e) {
                    skipped++;
                    this.log.warn(`dm #${mysqlId}: ${e.message}`);
                }
            }
            return { inserted, skipped, mysql_count: rows.length };
        });
    }
    async migrateRestaurants() {
        return this.runStep('restaurants', async () => {
            const rows = await this.prisma.$queryRawUnsafe(`SELECT r.id, r.name, r.email, r.phone, r.address, r.latitude, r.longitude,
                r.vendor_id, r.zone_id, r.logo, r.cover_photo, r.comission,
                r.minimum_order, r.restaurant_model, r.status, r.active,
                r.created_at, r.updated_at,
                COALESCE((SELECT COUNT(*) FROM orders o WHERE o.restaurant_id = r.id), 0) AS order_count
         FROM restaurants r`);
            let inserted = 0;
            let skipped = 0;
            for (const r of rows) {
                const mysqlId = Number(r.id);
                try {
                    await this.restaurantModel.updateOne({ mysql_id: mysqlId }, {
                        $set: {
                            mysql_id: mysqlId,
                            name: r.name,
                            email: r.email?.toLowerCase(),
                            phone: r.phone,
                            address: r.address,
                            latitude: r.latitude ? Number(r.latitude) : undefined,
                            longitude: r.longitude ? Number(r.longitude) : undefined,
                            mysql_vendor_id: r.vendor_id ? Number(r.vendor_id) : undefined,
                            mysql_zone_id: r.zone_id ? Number(r.zone_id) : undefined,
                            logo: r.logo,
                            cover_photo: r.cover_photo,
                            comission: r.comission ? Number(r.comission) : undefined,
                            minimum_order: r.minimum_order ? Number(r.minimum_order) : undefined,
                            restaurant_model: r.restaurant_model,
                            status: !!r.status,
                            active: !!r.active,
                            order_count: Number(r.order_count ?? 0),
                            legacy: { created_at: r.created_at, updated_at: r.updated_at },
                        },
                    }, { upsert: true });
                    inserted++;
                }
                catch (e) {
                    skipped++;
                    this.log.warn(`restaurant #${mysqlId}: ${e.message}`);
                }
            }
            return { inserted, skipped, mysql_count: rows.length };
        });
    }
    async migrateFoods() {
        return this.runStep('foods', async () => {
            const rows = await this.prisma.$queryRawUnsafe(`SELECT id, name, description, image, restaurant_id, category_id,
                price, discount, discount_type, veg, status, recommended,
                avg_rating, order_count, item_stock, stock_type,
                variations, add_ons, created_at, updated_at
         FROM food`);
            let inserted = 0;
            let skipped = 0;
            for (const r of rows) {
                const mysqlId = Number(r.id);
                try {
                    await this.foodModel.updateOne({ mysql_id: mysqlId }, {
                        $set: {
                            mysql_id: mysqlId,
                            name: r.name,
                            description: r.description,
                            image: r.image,
                            mysql_restaurant_id: r.restaurant_id ? Number(r.restaurant_id) : undefined,
                            mysql_category_id: r.category_id ? Number(r.category_id) : undefined,
                            price: r.price ? Number(r.price) : undefined,
                            discount: r.discount ? Number(r.discount) : undefined,
                            discount_type: r.discount_type,
                            veg: !!r.veg,
                            status: !!r.status,
                            recommended: !!r.recommended,
                            avg_rating: r.avg_rating ? Number(r.avg_rating) : undefined,
                            order_count: r.order_count ? Number(r.order_count) : 0,
                            item_stock: r.item_stock ? Number(r.item_stock) : undefined,
                            stock_type: r.stock_type,
                            variations: this.tryParseJSON(r.variations),
                            add_ons: this.tryParseJSON(r.add_ons),
                            legacy: { created_at: r.created_at, updated_at: r.updated_at },
                        },
                    }, { upsert: true });
                    inserted++;
                }
                catch (e) {
                    skipped++;
                    this.log.warn(`food #${mysqlId}: ${e.message}`);
                }
            }
            return { inserted, skipped, mysql_count: rows.length };
        });
    }
    async migrateOrders() {
        return this.runStep('orders', async () => {
            const rows = await this.prisma.$queryRawUnsafe(`SELECT id, user_id, restaurant_id, delivery_man_id,
                order_status, payment_status, payment_method, order_type,
                order_amount, total_tax_amount, delivery_charge,
                coupon_discount_amount, additional_charge, restaurant_discount_amount,
                created_at, delivered
         FROM orders`);
            const itemRows = await this.prisma.$queryRawUnsafe(`SELECT order_id, food_id, food_details, quantity, price,
                discount_on_food, discount_type, variation, add_ons, tax_amount
         FROM order_details`);
            const itemsByOrder = new Map();
            for (const item of itemRows) {
                const oid = Number(item.order_id);
                if (!itemsByOrder.has(oid))
                    itemsByOrder.set(oid, []);
                itemsByOrder.get(oid).push({
                    mysql_food_id: item.food_id ? Number(item.food_id) : undefined,
                    food_details: this.tryParseJSON(item.food_details),
                    quantity: Number(item.quantity ?? 0),
                    price: Number(item.price ?? 0),
                    discount_on_food: Number(item.discount_on_food ?? 0),
                    discount_type: item.discount_type,
                    variation: this.tryParseJSON(item.variation),
                    add_ons: this.tryParseJSON(item.add_ons),
                    tax_amount: Number(item.tax_amount ?? 0),
                });
            }
            let inserted = 0;
            let skipped = 0;
            for (const r of rows) {
                const mysqlId = Number(r.id);
                try {
                    await this.orderModel.updateOne({ mysql_id: mysqlId }, {
                        $set: {
                            mysql_id: mysqlId,
                            mysql_user_id: r.user_id ? Number(r.user_id) : undefined,
                            mysql_restaurant_id: r.restaurant_id ? Number(r.restaurant_id) : undefined,
                            mysql_delivery_man_id: r.delivery_man_id ? Number(r.delivery_man_id) : undefined,
                            order_status: r.order_status,
                            payment_status: r.payment_status,
                            payment_method: r.payment_method,
                            order_type: r.order_type,
                            order_amount: r.order_amount ? Number(r.order_amount) : 0,
                            total_tax_amount: r.total_tax_amount ? Number(r.total_tax_amount) : 0,
                            delivery_charge: r.delivery_charge ? Number(r.delivery_charge) : 0,
                            coupon_discount_amount: r.coupon_discount_amount ? Number(r.coupon_discount_amount) : 0,
                            additional_charge: r.additional_charge ? Number(r.additional_charge) : 0,
                            restaurant_discount_amount: r.restaurant_discount_amount ? Number(r.restaurant_discount_amount) : 0,
                            items: itemsByOrder.get(mysqlId) ?? [],
                            created_at_legacy: r.created_at ? new Date(r.created_at) : undefined,
                            delivered: r.delivered ? new Date(r.delivered) : undefined,
                        },
                    }, { upsert: true });
                    inserted++;
                }
                catch (e) {
                    skipped++;
                    this.log.warn(`order #${mysqlId}: ${e.message}`);
                }
            }
            return { inserted, skipped, mysql_count: rows.length };
        });
    }
    async migrateCategories() {
        return this.runStep('categories', async () => {
            const rows = await this.prisma.$queryRawUnsafe(`SELECT * FROM categories`);
            let inserted = 0;
            let skipped = 0;
            for (const r of rows) {
                const mysqlId = Number(r.id);
                try {
                    const { id, name, image, parent_id, position, priority, status, ...rest } = r;
                    void id;
                    await this.categoryModel.updateOne({ mysql_id: mysqlId }, {
                        $set: {
                            mysql_id: mysqlId,
                            name: name,
                            image: image,
                            parent_id: parent_id !== null && parent_id !== undefined ? Number(parent_id) : 0,
                            position: position !== null && position !== undefined ? Number(position) : 0,
                            priority: priority !== null && priority !== undefined ? Number(priority) : 0,
                            status: status === null || status === undefined ? true : !!status,
                            legacy: rest,
                        },
                    }, { upsert: true });
                    inserted++;
                }
                catch (e) {
                    skipped++;
                    this.log.warn(`category #${mysqlId}: ${e.message}`);
                }
            }
            return { inserted, skipped, mysql_count: rows.length };
        });
    }
    async migrateCuisines() {
        return this.runStep('cuisines', async () => {
            const rows = await this.prisma.$queryRawUnsafe(`SELECT * FROM cuisines`);
            let inserted = 0;
            let skipped = 0;
            for (const r of rows) {
                const mysqlId = Number(r.id);
                try {
                    const { id, name, image, status, ...rest } = r;
                    void id;
                    await this.cuisineModel.updateOne({ mysql_id: mysqlId }, {
                        $set: {
                            mysql_id: mysqlId,
                            name: name,
                            image: image,
                            status: status === null || status === undefined ? true : !!status,
                            legacy: rest,
                        },
                    }, { upsert: true });
                    inserted++;
                }
                catch (e) {
                    skipped++;
                    this.log.warn(`cuisine #${mysqlId}: ${e.message}`);
                }
            }
            return { inserted, skipped, mysql_count: rows.length };
        });
    }
    async migrateBanners() {
        return this.runStep('banners', async () => {
            const rows = await this.prisma.$queryRawUnsafe(`SELECT * FROM banners`);
            let inserted = 0;
            let skipped = 0;
            for (const r of rows) {
                const mysqlId = Number(r.id);
                try {
                    const { id, title, type, image, data, zone_id, status, ...rest } = r;
                    void id;
                    await this.bannerModel.updateOne({ mysql_id: mysqlId }, {
                        $set: {
                            mysql_id: mysqlId,
                            title: title,
                            type: type,
                            image: image,
                            data: this.tryParseJSON(data),
                            zone_id: zone_id !== null && zone_id !== undefined ? Number(zone_id) : undefined,
                            status: status === null || status === undefined ? true : !!status,
                            legacy: rest,
                        },
                    }, { upsert: true });
                    inserted++;
                }
                catch (e) {
                    skipped++;
                    this.log.warn(`banner #${mysqlId}: ${e.message}`);
                }
            }
            return { inserted, skipped, mysql_count: rows.length };
        });
    }
    async runStep(collection, fn) {
        const errors = [];
        try {
            this.log.log(`Migrating ${collection}...`);
            const r = await fn();
            this.log.log(`${collection}: ${r.inserted} upserted, ${r.skipped} skipped (mysql had ${r.mysql_count})`);
            return { collection, inserted: r.inserted, skipped: r.skipped, mysql_count: r.mysql_count, errors };
        }
        catch (e) {
            const msg = e.message;
            this.log.error(`${collection} FAILED: ${msg}`);
            errors.push(msg);
            return { collection, inserted: 0, skipped: 0, mysql_count: 0, errors };
        }
    }
    tryParseJSON(value) {
        if (value === null || value === undefined)
            return undefined;
        if (typeof value !== 'string')
            return value;
        try {
            return JSON.parse(value);
        }
        catch {
            return value;
        }
    }
    async counts() {
        const [users, vendors, deliveryMen, restaurants, foods, orders, categories, cuisines, banners] = await Promise.all([
            this.userModel.countDocuments(),
            this.vendorModel.countDocuments(),
            this.dmModel.countDocuments(),
            this.restaurantModel.countDocuments(),
            this.foodModel.countDocuments(),
            this.orderModel.countDocuments(),
            this.categoryModel.countDocuments(),
            this.cuisineModel.countDocuments(),
            this.bannerModel.countDocuments(),
        ]);
        return {
            users, vendors, delivery_men: deliveryMen, restaurants, foods, orders,
            categories, cuisines, banners,
        };
    }
};
exports.MigrationService = MigrationService;
exports.MigrationService = MigrationService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __param(2, (0, mongoose_1.InjectModel)(vendor_schema_1.Vendor.name)),
    __param(3, (0, mongoose_1.InjectModel)(restaurant_schema_1.Restaurant.name)),
    __param(4, (0, mongoose_1.InjectModel)(food_schema_1.Food.name)),
    __param(5, (0, mongoose_1.InjectModel)(delivery_man_schema_1.DeliveryMan.name)),
    __param(6, (0, mongoose_1.InjectModel)(order_schema_1.Order.name)),
    __param(7, (0, mongoose_1.InjectModel)(category_schema_1.Category.name)),
    __param(8, (0, mongoose_1.InjectModel)(cuisine_schema_1.Cuisine.name)),
    __param(9, (0, mongoose_1.InjectModel)(banner_schema_1.Banner.name)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], MigrationService);
//# sourceMappingURL=migration.service.js.map