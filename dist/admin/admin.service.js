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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = __importStar(require("bcrypt"));
const prisma_service_1 = require("../prisma/prisma.service");
const mongo_data_service_1 = require("../mongo/mongo-data.service");
const ORDER_STATUSES = [
    'pending',
    'confirmed',
    'accepted',
    'processing',
    'handover',
    'picked_up',
    'delivered',
    'canceled',
    'failed',
    'refund_requested',
    'refunded',
];
const TIMESTAMP_COLUMN = {
    pending: 'pending',
    accepted: 'accepted',
    confirmed: 'confirmed',
    processing: 'processing',
    handover: 'handover',
    picked_up: 'picked_up',
    delivered: 'delivered',
    canceled: 'canceled',
    failed: 'failed',
    refund_requested: 'refund_requested',
    refunded: 'refunded',
};
let AdminService = class AdminService {
    prisma;
    mongo;
    constructor(prisma, mongo) {
        this.prisma = prisma;
        this.mongo = mongo;
    }
    useMongo() {
        const v = (process.env.USE_MONGO_ADMIN ?? '').toLowerCase();
        return v === '1' || v === 'true' || v === 'yes';
    }
    async getMe(adminId) {
        if (this.useMongo()) {
            const a = await this.mongo.findByMysqlId('admins', Number(adminId));
            if (!a)
                throw new common_1.NotFoundException({ errors: [{ code: 'admin', message: 'not_found' }] });
            return {
                id: Number(a.mysql_id),
                f_name: a.f_name,
                l_name: a.l_name,
                email: a.email,
                phone: a.phone,
                image: a.image,
                role_id: a.role_id ?? null,
                zone_id: a.zone_id ?? null,
                created_at: a.created_at ?? null,
                updated_at: a.updated_at ?? null,
            };
        }
        const a = await this.prisma.admins.findUnique({ where: { id: adminId } });
        if (!a)
            throw new common_1.NotFoundException({ errors: [{ code: 'admin', message: 'not_found' }] });
        return {
            id: Number(a.id),
            f_name: a.f_name,
            l_name: a.l_name,
            email: a.email,
            phone: a.phone,
            image: a.image,
            role_id: a.role_id ? Number(a.role_id) : null,
            zone_id: a.zone_id ? Number(a.zone_id) : null,
            created_at: a.created_at,
            updated_at: a.updated_at,
        };
    }
    async updateMe(adminId, body) {
        const data = {};
        if (body.f_name !== undefined)
            data.f_name = body.f_name.trim();
        if (body.l_name !== undefined)
            data.l_name = body.l_name.trim();
        if (body.email !== undefined) {
            const email = body.email.trim().toLowerCase();
            if (!/^\S+@\S+\.\S+$/.test(email))
                throw new common_1.BadRequestException({ errors: [{ code: 'email', message: 'invalid email' }] });
            data.email = email;
        }
        if (body.phone !== undefined)
            data.phone = body.phone.trim();
        if (body.image !== undefined)
            data.image = body.image;
        if (Object.keys(data).length === 0)
            throw new common_1.BadRequestException({ errors: [{ code: 'body', message: 'no fields' }] });
        data.updated_at = new Date();
        await this.prisma.admins.update({ where: { id: adminId }, data });
        return this.getMe(adminId);
    }
    async changeMyPassword(adminId, body) {
        if (!body.current_password || !body.new_password) {
            throw new common_1.BadRequestException({ errors: [{ code: 'body', message: 'current_password and new_password required' }] });
        }
        if (body.new_password.length < 6) {
            throw new common_1.BadRequestException({ errors: [{ code: 'new_password', message: 'must be at least 6 characters' }] });
        }
        const a = await this.prisma.admins.findUnique({ where: { id: adminId } });
        if (!a)
            throw new common_1.NotFoundException({ errors: [{ code: 'admin', message: 'not_found' }] });
        const current = a.password;
        if (!current)
            throw new common_1.BadRequestException({ errors: [{ code: 'password', message: 'no password on record' }] });
        const phpStyle = current.replace(/^\$2y\$/, '$2b$');
        const ok = await bcrypt.compare(body.current_password, phpStyle);
        if (!ok)
            throw new common_1.BadRequestException({ errors: [{ code: 'current_password', message: 'incorrect current password' }] });
        const newHash = (await bcrypt.hash(body.new_password, 10)).replace(/^\$2b\$/, '$2y$');
        await this.prisma.admins.update({ where: { id: adminId }, data: { password: newHash, updated_at: new Date() } });
        return { ok: true };
    }
    async dashboardStats() {
        if (this.useMongo()) {
            const [totalOrders, pendingOrders, deliveredOrders, canceledOrders, totalRestaurants, activeRestaurants, totalUsers, totalDeliveryMen, totalVendors, totalFood, revenueAgg,] = await Promise.all([
                this.mongo.count('orders'),
                this.mongo.count('orders', { order_status: 'pending' }),
                this.mongo.count('orders', { order_status: 'delivered' }),
                this.mongo.count('orders', { order_status: 'canceled' }),
                this.mongo.count('restaurants'),
                this.mongo.count('restaurants', { status: true }),
                this.mongo.count('users'),
                this.mongo.count('delivery_men'),
                this.mongo.count('vendors'),
                this.mongo.count('foods'),
                this.mongo.aggregate('orders', [
                    { $match: { order_status: 'delivered', payment_status: 'paid' } },
                    { $group: { _id: null, total: { $sum: '$order_amount' } } },
                ]),
            ]);
            return {
                orders: {
                    total: totalOrders,
                    pending: pendingOrders,
                    delivered: deliveredOrders,
                    canceled: canceledOrders,
                },
                restaurants: { total: totalRestaurants, active: activeRestaurants },
                users: { total: totalUsers },
                delivery_men: { total: totalDeliveryMen },
                vendors: { total: totalVendors },
                food: { total: totalFood },
                revenue: { total: Number(revenueAgg[0]?.total ?? 0) },
            };
        }
        const [totalOrders, pendingOrders, deliveredOrders, canceledOrders, totalRestaurants, activeRestaurants, totalUsers, totalDeliveryMen, totalVendors, totalFood, revenueRow,] = await Promise.all([
            this.prisma.orders.count(),
            this.prisma.orders.count({ where: { order_status: 'pending' } }),
            this.prisma.orders.count({ where: { order_status: 'delivered' } }),
            this.prisma.orders.count({ where: { order_status: 'canceled' } }),
            this.prisma.restaurants.count(),
            this.prisma.restaurants.count({ where: { status: true } }),
            this.prisma.users.count(),
            this.prisma.delivery_men.count(),
            this.prisma.vendors.count(),
            this.prisma.food.count(),
            this.prisma.orders.aggregate({
                where: { order_status: 'delivered', payment_status: 'paid' },
                _sum: { order_amount: true },
            }),
        ]);
        return {
            orders: {
                total: totalOrders,
                pending: pendingOrders,
                delivered: deliveredOrders,
                canceled: canceledOrders,
            },
            restaurants: { total: totalRestaurants, active: activeRestaurants },
            users: { total: totalUsers },
            delivery_men: { total: totalDeliveryMen },
            vendors: { total: totalVendors },
            food: { total: totalFood },
            revenue: { total: Number(revenueRow._sum.order_amount ?? 0) },
        };
    }
    async listOrders(limit = 50, offset = 0, status, q) {
        if (this.useMongo()) {
            const filter = {};
            if (status)
                filter.order_status = status;
            if (q && /^\d+$/.test(q))
                filter.mysql_id = Number(q);
            const [rows, total] = await Promise.all([
                this.mongo.findMany('orders', filter, { sort: { mysql_id: -1 }, limit, skip: offset }),
                this.mongo.count('orders', filter),
            ]);
            const userIds = Array.from(new Set(rows.map((r) => r.mysql_user_id).filter((x) => !!x)));
            const restaurantIds = Array.from(new Set(rows.map((r) => r.mysql_restaurant_id).filter((x) => !!x)));
            const [users, restaurants] = await Promise.all([
                userIds.length
                    ? this.mongo.findMany('users', { mysql_id: { $in: userIds } }, { projection: { mysql_id: 1, f_name: 1, l_name: 1, email: 1, phone: 1 } })
                    : Promise.resolve([]),
                restaurantIds.length
                    ? this.mongo.findMany('restaurants', { mysql_id: { $in: restaurantIds } }, { projection: { mysql_id: 1, name: 1 } })
                    : Promise.resolve([]),
            ]);
            const userById = new Map(users.map((u) => [u.mysql_id, u]));
            const restaurantById = new Map(restaurants.map((r) => [r.mysql_id, r]));
            return {
                total, limit, offset,
                orders: rows.map((r) => ({
                    id: r.mysql_id,
                    user: r.mysql_user_id ? (userById.get(r.mysql_user_id) ? { id: r.mysql_user_id, ...userById.get(r.mysql_user_id) } : null) : null,
                    restaurant: r.mysql_restaurant_id ? (restaurantById.get(r.mysql_restaurant_id) ? { id: r.mysql_restaurant_id, name: restaurantById.get(r.mysql_restaurant_id)?.name } : null) : null,
                    order_amount: Number(r.order_amount ?? 0),
                    payment_status: r.payment_status,
                    order_status: r.order_status,
                    payment_method: r.payment_method,
                    order_type: r.order_type,
                    delivery_charge: Number(r.delivery_charge ?? 0),
                    total_tax_amount: Number(r.total_tax_amount ?? 0),
                    created_at: r.created_at_legacy,
                })),
            };
        }
        const where = {};
        if (status)
            where.order_status = status;
        if (q && /^\d+$/.test(q))
            where.id = BigInt(q);
        const [rows, total] = await Promise.all([
            this.prisma.orders.findMany({
                where,
                orderBy: { id: 'desc' },
                take: limit,
                skip: offset,
                select: {
                    id: true,
                    user_id: true,
                    restaurant_id: true,
                    order_amount: true,
                    payment_status: true,
                    order_status: true,
                    payment_method: true,
                    order_type: true,
                    delivery_charge: true,
                    total_tax_amount: true,
                    created_at: true,
                },
            }),
            this.prisma.orders.count({ where }),
        ]);
        const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter((x) => x !== null)));
        const restaurantIds = Array.from(new Set(rows.map((r) => r.restaurant_id)));
        const [users, restaurants] = await Promise.all([
            userIds.length
                ? this.prisma.users.findMany({
                    where: { id: { in: userIds } },
                    select: { id: true, f_name: true, l_name: true, email: true, phone: true },
                })
                : Promise.resolve([]),
            restaurantIds.length
                ? this.prisma.restaurants.findMany({
                    where: { id: { in: restaurantIds } },
                    select: { id: true, name: true },
                })
                : Promise.resolve([]),
        ]);
        const userById = new Map(users.map((u) => [String(u.id), u]));
        const restaurantById = new Map(restaurants.map((r) => [String(r.id), r]));
        return {
            total,
            limit,
            offset,
            orders: rows.map((r) => ({
                id: Number(r.id),
                user: r.user_id ? userById.get(String(r.user_id)) ?? null : null,
                restaurant: restaurantById.get(String(r.restaurant_id)) ?? null,
                order_amount: Number(r.order_amount),
                payment_status: r.payment_status,
                order_status: r.order_status,
                payment_method: r.payment_method,
                order_type: r.order_type,
                delivery_charge: Number(r.delivery_charge),
                total_tax_amount: Number(r.total_tax_amount),
                created_at: r.created_at,
            })),
        };
    }
    async getOrder(id) {
        if (this.useMongo()) {
            const order = await this.mongo.findByMysqlId('orders', id);
            if (!order)
                throw new common_1.NotFoundException({ errors: [{ code: 'order', message: 'Order not found' }] });
            const [user, restaurant, deliveryMan, items] = await Promise.all([
                order.mysql_user_id
                    ? this.mongo.findByMysqlId('users', order.mysql_user_id)
                    : Promise.resolve(null),
                order.mysql_restaurant_id
                    ? this.mongo.findByMysqlId('restaurants', order.mysql_restaurant_id)
                    : Promise.resolve(null),
                order.mysql_delivery_man_id
                    ? this.mongo.findByMysqlId('delivery_men', order.mysql_delivery_man_id)
                    : Promise.resolve(null),
                this.mongo.findMany('order_details', { order_id: order.mysql_id }, { sort: { mysql_id: 1 } }),
            ]);
            return {
                order: {
                    id: order.mysql_id,
                    order_amount: Number(order.order_amount ?? 0),
                    coupon_discount_amount: Number(order.coupon_discount_amount ?? 0),
                    total_tax_amount: Number(order.total_tax_amount ?? 0),
                    delivery_charge: Number(order.delivery_charge ?? 0),
                    restaurant_discount_amount: Number(order.restaurant_discount_amount ?? 0),
                    payment_status: order.payment_status,
                    order_status: order.order_status,
                    payment_method: order.payment_method,
                    order_type: order.order_type,
                    coupon_code: order.coupon_code ?? null,
                    order_note: order.order_note ?? null,
                    delivery_address: order.delivery_address ?? null,
                    cancellation_reason: order.cancellation_reason ?? null,
                    canceled_by: order.canceled_by ?? null,
                    timeline: {
                        pending: order.pending ?? null,
                        accepted: order.accepted ?? null,
                        confirmed: order.confirmed ?? null,
                        processing: order.processing ?? null,
                        handover: order.handover ?? null,
                        picked_up: order.picked_up ?? null,
                        delivered: order.delivered ?? null,
                        canceled: order.canceled ?? null,
                        failed: order.failed ?? null,
                    },
                    created_at: order.created_at_legacy ?? order.created_at ?? null,
                },
                user: user
                    ? { id: user.mysql_id, f_name: user.f_name, l_name: user.l_name, email: user.email, phone: user.phone }
                    : null,
                restaurant: restaurant
                    ? {
                        id: restaurant.mysql_id,
                        name: restaurant.name,
                        phone: restaurant.phone,
                        email: restaurant.email,
                        address: restaurant.address,
                        logo: restaurant.logo,
                    }
                    : null,
                delivery_man: deliveryMan
                    ? {
                        id: deliveryMan.mysql_id,
                        f_name: deliveryMan.f_name,
                        l_name: deliveryMan.l_name,
                        phone: deliveryMan.phone,
                    }
                    : null,
                items: items.map((it) => ({
                    id: it.mysql_id,
                    food_id: it.food_id ? Number(it.food_id) : null,
                    price: Number(it.price ?? 0),
                    quantity: it.quantity ?? 0,
                    tax_amount: Number(it.tax_amount ?? 0),
                    total_add_on_price: Number(it.total_add_on_price ?? 0),
                    variant: it.variant ?? null,
                    food_details: parseJsonField(it.food_details ?? null),
                })),
            };
        }
        const order = await this.prisma.orders.findUnique({ where: { id: BigInt(id) } });
        if (!order)
            throw new common_1.NotFoundException({ errors: [{ code: 'order', message: 'Order not found' }] });
        const [user, restaurant, deliveryMan, items] = await Promise.all([
            order.user_id ? this.prisma.users.findUnique({ where: { id: order.user_id } }) : null,
            this.prisma.restaurants.findUnique({ where: { id: order.restaurant_id } }),
            order.delivery_man_id
                ? this.prisma.delivery_men.findUnique({ where: { id: order.delivery_man_id } })
                : null,
            this.prisma.order_details.findMany({ where: { order_id: order.id }, orderBy: { id: 'asc' } }),
        ]);
        return {
            order: {
                id: Number(order.id),
                order_amount: Number(order.order_amount),
                coupon_discount_amount: Number(order.coupon_discount_amount),
                total_tax_amount: Number(order.total_tax_amount),
                delivery_charge: Number(order.delivery_charge),
                restaurant_discount_amount: Number(order.restaurant_discount_amount),
                payment_status: order.payment_status,
                order_status: order.order_status,
                payment_method: order.payment_method,
                order_type: order.order_type,
                coupon_code: order.coupon_code,
                order_note: order.order_note,
                delivery_address: order.delivery_address,
                cancellation_reason: order.cancellation_reason,
                canceled_by: order.canceled_by,
                timeline: {
                    pending: order.pending,
                    accepted: order.accepted,
                    confirmed: order.confirmed,
                    processing: order.processing,
                    handover: order.handover,
                    picked_up: order.picked_up,
                    delivered: order.delivered,
                    canceled: order.canceled,
                    failed: order.failed,
                },
                created_at: order.created_at,
            },
            user: user
                ? { id: Number(user.id), f_name: user.f_name, l_name: user.l_name, email: user.email, phone: user.phone }
                : null,
            restaurant: restaurant
                ? {
                    id: Number(restaurant.id),
                    name: restaurant.name,
                    phone: restaurant.phone,
                    email: restaurant.email,
                    address: restaurant.address,
                    logo: restaurant.logo,
                }
                : null,
            delivery_man: deliveryMan
                ? {
                    id: Number(deliveryMan.id),
                    f_name: deliveryMan.f_name,
                    l_name: deliveryMan.l_name,
                    phone: deliveryMan.phone,
                }
                : null,
            items: items.map((it) => ({
                id: Number(it.id),
                food_id: it.food_id ? Number(it.food_id) : null,
                price: Number(it.price),
                quantity: it.quantity,
                tax_amount: Number(it.tax_amount),
                total_add_on_price: Number(it.total_add_on_price),
                variant: it.variant,
                food_details: parseJsonField(it.food_details),
            })),
        };
    }
    async updateOrderStatus(id, status, reason) {
        if (!ORDER_STATUSES.includes(status)) {
            throw new common_1.BadRequestException({
                errors: [{ code: 'status', message: `status must be one of ${ORDER_STATUSES.join(',')}` }],
            });
        }
        if (this.useMongo()) {
            const order = await this.mongo.findByMysqlId('orders', id);
            if (!order)
                throw new common_1.NotFoundException({ errors: [{ code: 'order', message: 'Order not found' }] });
            const data = { order_status: status };
            const tsCol = TIMESTAMP_COLUMN[status];
            if (tsCol)
                data[tsCol] = new Date();
            if (status === 'delivered' && order.payment_method === 'cash_on_delivery') {
                data.payment_status = 'paid';
            }
            if (status === 'canceled') {
                data.canceled_by = 'admin';
                if (reason)
                    data.cancellation_reason = reason;
            }
            await this.mongo.updateOne('orders', { mysql_id: id }, data);
            return { ok: true, id, status };
        }
        const order = await this.prisma.orders.findUnique({ where: { id: BigInt(id) } });
        if (!order)
            throw new common_1.NotFoundException({ errors: [{ code: 'order', message: 'Order not found' }] });
        const data = { order_status: status };
        const tsCol = TIMESTAMP_COLUMN[status];
        if (tsCol)
            data[tsCol] = new Date();
        if (status === 'delivered' && order.payment_method === 'cash_on_delivery') {
            data.payment_status = 'paid';
        }
        if (status === 'canceled') {
            data.canceled_by = 'admin';
            if (reason)
                data.cancellation_reason = reason;
        }
        await this.prisma.orders.update({ where: { id: order.id }, data });
        return { ok: true, id, status };
    }
    async listRestaurants(limit = 50, offset = 0, q) {
        if (this.useMongo()) {
            const filter = this.buildMongoSearchFilter(q, ['name', 'email', 'phone']);
            const [rows, total] = await Promise.all([
                this.mongo.findMany('restaurants', filter, { sort: { mysql_id: -1 }, limit, skip: offset }),
                this.mongo.count('restaurants', filter),
            ]);
            return {
                total, limit, offset,
                restaurants: rows.map((r) => ({
                    id: r.mysql_id, name: r.name, email: r.email, phone: r.phone,
                    status: r.status, active: r.active, address: r.address, logo: r.logo,
                    latitude: r.latitude, longitude: r.longitude,
                    zone_id: r.mysql_zone_id ?? null, vendor_id: r.mysql_vendor_id ?? 0,
                    comission: r.comission ?? null, minimum_order: r.minimum_order ?? 0,
                    restaurant_model: r.restaurant_model, order_count: r.order_count ?? 0,
                    created_at: r.created_at,
                })),
            };
        }
        const where = q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] } : {};
        const [rows, total] = await Promise.all([
            this.prisma.restaurants.findMany({
                where,
                orderBy: { id: 'desc' },
                take: limit,
                skip: offset,
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    status: true,
                    active: true,
                    address: true,
                    logo: true,
                    latitude: true,
                    longitude: true,
                    zone_id: true,
                    vendor_id: true,
                    comission: true,
                    minimum_order: true,
                    delivery: true,
                    take_away: true,
                    restaurant_model: true,
                    order_count: true,
                    created_at: true,
                },
            }),
            this.prisma.restaurants.count({ where }),
        ]);
        return {
            total,
            limit,
            offset,
            restaurants: rows.map((r) => ({
                ...r,
                id: Number(r.id),
                zone_id: r.zone_id ? Number(r.zone_id) : null,
                vendor_id: Number(r.vendor_id),
                comission: r.comission !== null ? Number(r.comission) : null,
                minimum_order: Number(r.minimum_order),
            })),
        };
    }
    async getRestaurant(id) {
        if (this.useMongo()) {
            const r = await this.mongo.findByMysqlId('restaurants', id);
            if (!r)
                throw new common_1.NotFoundException({ errors: [{ code: 'restaurant', message: 'Restaurant not found' }] });
            const vendorId = r.mysql_vendor_id ?? 0;
            const [vendor, foodCount, orderCount, revenueAgg] = await Promise.all([
                vendorId
                    ? this.mongo.findByMysqlId('vendors', vendorId)
                    : Promise.resolve(null),
                this.mongo.count('foods', { mysql_restaurant_id: r.mysql_id }),
                this.mongo.count('orders', { mysql_restaurant_id: r.mysql_id }),
                this.mongo.aggregate('orders', [
                    { $match: { mysql_restaurant_id: r.mysql_id, order_status: 'delivered', payment_status: 'paid' } },
                    { $group: { _id: null, total: { $sum: '$order_amount' } } },
                ]),
            ]);
            return {
                restaurant: {
                    ...r,
                    id: r.mysql_id,
                    zone_id: r.mysql_zone_id ?? null,
                    vendor_id: r.mysql_vendor_id ?? 0,
                    comission: r.comission !== null && r.comission !== undefined ? Number(r.comission) : null,
                    minimum_order: Number(r.minimum_order ?? 0),
                    tax: Number(r.tax ?? 0),
                    minimum_shipping_charge: Number(r.minimum_shipping_charge ?? 0),
                },
                vendor: vendor
                    ? {
                        id: vendor.mysql_id,
                        f_name: vendor.f_name,
                        l_name: vendor.l_name,
                        email: vendor.email,
                        phone: vendor.phone,
                    }
                    : null,
                stats: {
                    food_count: foodCount,
                    order_count: orderCount,
                    revenue: Number(revenueAgg[0]?.total ?? 0),
                },
            };
        }
        const r = await this.prisma.restaurants.findUnique({ where: { id: BigInt(id) } });
        if (!r)
            throw new common_1.NotFoundException({ errors: [{ code: 'restaurant', message: 'Restaurant not found' }] });
        const [vendor, foodCount, orderCount, revenue] = await Promise.all([
            this.prisma.vendors.findUnique({ where: { id: r.vendor_id } }),
            this.prisma.food.count({ where: { restaurant_id: r.id } }),
            this.prisma.orders.count({ where: { restaurant_id: r.id } }),
            this.prisma.orders.aggregate({
                where: { restaurant_id: r.id, order_status: 'delivered', payment_status: 'paid' },
                _sum: { order_amount: true },
            }),
        ]);
        return {
            restaurant: {
                ...r,
                id: Number(r.id),
                zone_id: r.zone_id ? Number(r.zone_id) : null,
                vendor_id: Number(r.vendor_id),
                comission: r.comission !== null ? Number(r.comission) : null,
                minimum_order: Number(r.minimum_order),
                tax: Number(r.tax),
                minimum_shipping_charge: Number(r.minimum_shipping_charge),
            },
            vendor: vendor
                ? {
                    id: Number(vendor.id),
                    f_name: vendor.f_name,
                    l_name: vendor.l_name,
                    email: vendor.email,
                    phone: vendor.phone,
                }
                : null,
            stats: {
                food_count: foodCount,
                order_count: orderCount,
                revenue: Number(revenue._sum.order_amount ?? 0),
            },
        };
    }
    async updateRestaurant(id, body) {
        const data = {};
        if (body.name !== undefined)
            data.name = body.name;
        if (body.email !== undefined)
            data.email = body.email;
        if (body.phone !== undefined)
            data.phone = body.phone;
        if (body.address !== undefined)
            data.address = body.address;
        if (body.comission !== undefined)
            data.comission = body.comission;
        if (body.minimum_order !== undefined)
            data.minimum_order = body.minimum_order;
        if (body.status !== undefined)
            data.status = body.status;
        if (body.active !== undefined)
            data.active = body.active;
        if (Object.keys(data).length === 0) {
            throw new common_1.BadRequestException({ errors: [{ code: 'body', message: 'no fields to update' }] });
        }
        if (this.useMongo()) {
            const r = await this.mongo.findByMysqlId('restaurants', id);
            if (!r)
                throw new common_1.NotFoundException({ errors: [{ code: 'restaurant', message: 'Restaurant not found' }] });
            await this.mongo.updateOne('restaurants', { mysql_id: id }, data);
            return { ok: true, id };
        }
        await this.prisma.restaurants.update({ where: { id: BigInt(id) }, data });
        return { ok: true, id };
    }
    async listUsers(limit = 50, offset = 0, q) {
        if (this.useMongo()) {
            const filter = this.buildMongoSearchFilter(q, ['f_name', 'l_name', 'email', 'phone']);
            const [rows, total] = await Promise.all([
                this.mongo.findMany('users', filter, { sort: { mysql_id: -1 }, limit, skip: offset,
                    projection: { mysql_id: 1, f_name: 1, l_name: 1, email: 1, phone: 1, status: 1, created_at: 1 } }),
                this.mongo.count('users', filter),
            ]);
            return { total, limit, offset, users: rows.map((r) => ({
                    id: r.mysql_id, f_name: r.f_name, l_name: r.l_name, email: r.email,
                    phone: r.phone, status: r.status, created_at: r.created_at,
                })) };
        }
        const where = q
            ? { OR: [{ f_name: { contains: q } }, { l_name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] }
            : {};
        const [rows, total] = await Promise.all([
            this.prisma.users.findMany({
                where,
                orderBy: { id: 'desc' },
                take: limit,
                skip: offset,
                select: {
                    id: true,
                    f_name: true,
                    l_name: true,
                    email: true,
                    phone: true,
                    status: true,
                    created_at: true,
                },
            }),
            this.prisma.users.count({ where }),
        ]);
        return { total, limit, offset, users: rows.map((r) => ({ ...r, id: Number(r.id) })) };
    }
    buildMongoSearchFilter(q, fields) {
        if (!q?.trim())
            return {};
        const regex = { $regex: q.trim(), $options: 'i' };
        return { $or: fields.map((f) => ({ [f]: regex })) };
    }
    async getUser(id) {
        if (this.useMongo()) {
            const u = await this.mongo.findByMysqlId('users', id);
            if (!u)
                throw new common_1.NotFoundException({ errors: [{ code: 'user', message: 'User not found' }] });
            const [orderCount, spendAgg] = await Promise.all([
                this.mongo.count('orders', { mysql_user_id: u.mysql_id }),
                this.mongo.aggregate('orders', [
                    { $match: { mysql_user_id: u.mysql_id, payment_status: 'paid' } },
                    { $group: { _id: null, total: { $sum: '$order_amount' } } },
                ]),
            ]);
            return {
                user: {
                    id: u.mysql_id,
                    f_name: u.f_name,
                    l_name: u.l_name,
                    email: u.email,
                    phone: u.phone,
                    status: u.status,
                    is_phone_verified: u.is_phone_verified,
                    is_email_verified: u.is_email_verified,
                    login_medium: u.login_medium,
                    created_at: u.created_at,
                },
                stats: {
                    order_count: orderCount,
                    total_spend: Number(spendAgg[0]?.total ?? 0),
                },
            };
        }
        const u = await this.prisma.users.findUnique({ where: { id: BigInt(id) } });
        if (!u)
            throw new common_1.NotFoundException({ errors: [{ code: 'user', message: 'User not found' }] });
        const [orderCount, totalSpend] = await Promise.all([
            this.prisma.orders.count({ where: { user_id: u.id } }),
            this.prisma.orders.aggregate({
                where: { user_id: u.id, payment_status: 'paid' },
                _sum: { order_amount: true },
            }),
        ]);
        return {
            user: {
                id: Number(u.id),
                f_name: u.f_name,
                l_name: u.l_name,
                email: u.email,
                phone: u.phone,
                status: u.status,
                is_phone_verified: u.is_phone_verified,
                is_email_verified: u.is_email_verified,
                login_medium: u.login_medium,
                created_at: u.created_at,
            },
            stats: {
                order_count: orderCount,
                total_spend: Number(totalSpend._sum.order_amount ?? 0),
            },
        };
    }
    async updateUserStatus(id, status) {
        if (this.useMongo()) {
            const u = await this.mongo.findByMysqlId('users', id);
            if (!u)
                throw new common_1.NotFoundException({ errors: [{ code: 'user', message: 'User not found' }] });
            await this.mongo.updateOne('users', { mysql_id: id }, { status });
            return { ok: true, id, status };
        }
        const u = await this.prisma.users.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
        if (!u)
            throw new common_1.NotFoundException({ errors: [{ code: 'user', message: 'User not found' }] });
        await this.prisma.users.update({ where: { id: u.id }, data: { status } });
        return { ok: true, id, status };
    }
    async listVendors(limit = 50, offset = 0, q) {
        if (this.useMongo()) {
            const filter = this.buildMongoSearchFilter(q, ['f_name', 'l_name', 'email', 'phone']);
            const [rows, total] = await Promise.all([
                this.mongo.findMany('vendors', filter, { sort: { mysql_id: -1 }, limit, skip: offset,
                    projection: { mysql_id: 1, f_name: 1, l_name: 1, email: 1, phone: 1, status: 1, image: 1, created_at: 1 } }),
                this.mongo.count('vendors', filter),
            ]);
            return { total, limit, offset, vendors: rows.map((r) => ({
                    id: r.mysql_id, f_name: r.f_name, l_name: r.l_name, email: r.email,
                    phone: r.phone, status: r.status, image: r.image, created_at: r.created_at,
                })) };
        }
        const where = q
            ? { OR: [{ f_name: { contains: q } }, { l_name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] }
            : {};
        const [rows, total] = await Promise.all([
            this.prisma.vendors.findMany({
                where,
                orderBy: { id: 'desc' },
                take: limit,
                skip: offset,
                select: {
                    id: true,
                    f_name: true,
                    l_name: true,
                    email: true,
                    phone: true,
                    status: true,
                    image: true,
                    created_at: true,
                },
            }),
            this.prisma.vendors.count({ where }),
        ]);
        return { total, limit, offset, vendors: rows.map((r) => ({ ...r, id: Number(r.id) })) };
    }
    async updateVendorStatus(id, status) {
        if (this.useMongo()) {
            const v = await this.mongo.findByMysqlId('vendors', id);
            if (!v)
                throw new common_1.NotFoundException({ errors: [{ code: 'vendor', message: 'Vendor not found' }] });
            await this.mongo.updateOne('vendors', { mysql_id: id }, { status });
            return { ok: true, id, status };
        }
        const v = await this.prisma.vendors.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
        if (!v)
            throw new common_1.NotFoundException({ errors: [{ code: 'vendor', message: 'Vendor not found' }] });
        await this.prisma.vendors.update({ where: { id: v.id }, data: { status } });
        return { ok: true, id, status };
    }
    async listDeliveryMen(limit = 50, offset = 0, q) {
        if (this.useMongo()) {
            const filter = this.buildMongoSearchFilter(q, ['f_name', 'l_name', 'email', 'phone']);
            const [rows, total] = await Promise.all([
                this.mongo.findMany('delivery_men', filter, { sort: { mysql_id: -1 }, limit, skip: offset }),
                this.mongo.count('delivery_men', filter),
            ]);
            return {
                total, limit, offset,
                delivery_men: rows.map((r) => ({
                    id: r.mysql_id, f_name: r.f_name, l_name: r.l_name, email: r.email,
                    phone: r.phone, status: r.status, application_status: r.application_status,
                    image: r.image, zone_id: r.mysql_zone_id ?? null, created_at: r.created_at,
                })),
            };
        }
        const where = q
            ? { OR: [{ f_name: { contains: q } }, { l_name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] }
            : {};
        const [rows, total] = await Promise.all([
            this.prisma.delivery_men.findMany({
                where,
                orderBy: { id: 'desc' },
                take: limit,
                skip: offset,
                select: {
                    id: true,
                    f_name: true,
                    l_name: true,
                    email: true,
                    phone: true,
                    status: true,
                    application_status: true,
                    image: true,
                    zone_id: true,
                    created_at: true,
                },
            }),
            this.prisma.delivery_men.count({ where }),
        ]);
        return {
            total,
            limit,
            offset,
            delivery_men: rows.map((r) => ({
                ...r,
                id: Number(r.id),
                zone_id: r.zone_id ? Number(r.zone_id) : null,
            })),
        };
    }
    async updateDeliveryManStatus(id, status) {
        if (this.useMongo()) {
            const d = await this.mongo.findByMysqlId('delivery_men', id);
            if (!d)
                throw new common_1.NotFoundException({ errors: [{ code: 'delivery_man', message: 'Delivery man not found' }] });
            await this.mongo.updateOne('delivery_men', { mysql_id: id }, { status });
            return { ok: true, id, status };
        }
        const d = await this.prisma.delivery_men.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
        if (!d)
            throw new common_1.NotFoundException({ errors: [{ code: 'delivery_man', message: 'Delivery man not found' }] });
        await this.prisma.delivery_men.update({ where: { id: d.id }, data: { status } });
        return { ok: true, id, status };
    }
    async approveDeliveryMan(id, approval) {
        if (this.useMongo()) {
            const d = await this.mongo.findByMysqlId('delivery_men', id);
            if (!d)
                throw new common_1.NotFoundException({ errors: [{ code: 'delivery_man', message: 'Delivery man not found' }] });
            await this.mongo.updateOne('delivery_men', { mysql_id: id }, { application_status: approval });
            return { ok: true, id, application_status: approval };
        }
        const d = await this.prisma.delivery_men.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
        if (!d)
            throw new common_1.NotFoundException({ errors: [{ code: 'delivery_man', message: 'Delivery man not found' }] });
        await this.prisma.delivery_men.update({
            where: { id: d.id },
            data: { application_status: approval },
        });
        return { ok: true, id, application_status: approval };
    }
    async listFood(limit = 50, offset = 0, q, restaurantId) {
        if (this.useMongo()) {
            const filter = {};
            if (restaurantId)
                filter.mysql_restaurant_id = restaurantId;
            if (q?.trim())
                filter.name = { $regex: q.trim(), $options: 'i' };
            const [rows, total] = await Promise.all([
                this.mongo.findMany('foods', filter, { sort: { mysql_id: -1 }, limit, skip: offset }),
                this.mongo.count('foods', filter),
            ]);
            const restaurantIds = Array.from(new Set(rows.map((r) => r.mysql_restaurant_id).filter((x) => !!x)));
            const restaurants = restaurantIds.length
                ? await this.mongo.findMany('restaurants', { mysql_id: { $in: restaurantIds } }, { projection: { mysql_id: 1, name: 1 } })
                : [];
            const restMap = new Map(restaurants.map((r) => [r.mysql_id, r.name]));
            return {
                total, limit, offset,
                food: rows.map((r) => ({
                    id: r.mysql_id, name: r.name, image: r.image,
                    price: Number(r.price ?? 0), discount: Number(r.discount ?? 0),
                    discount_type: r.discount_type, veg: !!r.veg, status: !!r.status,
                    restaurant_id: r.mysql_restaurant_id ?? 0,
                    category_id: r.mysql_category_id ?? 0,
                    avg_rating: Number(r.avg_rating ?? 0),
                    order_count: r.order_count ?? 0,
                    recommended: !!r.recommended,
                    item_stock: r.item_stock ?? 0,
                    stock_type: r.stock_type,
                    restaurant: { id: r.mysql_restaurant_id, name: restMap.get(r.mysql_restaurant_id ?? 0) ?? null },
                })),
            };
        }
        const where = {};
        if (restaurantId)
            where.restaurant_id = BigInt(restaurantId);
        if (q)
            where.name = { contains: q };
        const [rows, total] = await Promise.all([
            this.prisma.food.findMany({
                where,
                orderBy: { id: 'desc' },
                take: limit,
                skip: offset,
                select: {
                    id: true,
                    name: true,
                    image: true,
                    price: true,
                    discount: true,
                    discount_type: true,
                    veg: true,
                    status: true,
                    restaurant_id: true,
                    category_id: true,
                    avg_rating: true,
                    order_count: true,
                    recommended: true,
                    item_stock: true,
                    stock_type: true,
                },
            }),
            this.prisma.food.count({ where }),
        ]);
        const restaurantIds = Array.from(new Set(rows.map((r) => r.restaurant_id)));
        const restaurants = restaurantIds.length
            ? await this.prisma.restaurants.findMany({
                where: { id: { in: restaurantIds } },
                select: { id: true, name: true },
            })
            : [];
        const restaurantById = new Map(restaurants.map((r) => [String(r.id), r]));
        return {
            total,
            limit,
            offset,
            food: rows.map((r) => ({
                ...r,
                id: Number(r.id),
                restaurant_id: Number(r.restaurant_id),
                restaurant: restaurantById.get(String(r.restaurant_id)) ?? null,
                category_id: r.category_id ? Number(r.category_id) : null,
                price: Number(r.price),
                discount: Number(r.discount),
            })),
        };
    }
    async getFood(id) {
        const f = await this.prisma.food.findUnique({ where: { id: BigInt(id) } });
        if (!f)
            throw new common_1.NotFoundException({ errors: [{ code: 'food', message: 'Food not found' }] });
        const restaurant = await this.prisma.restaurants.findUnique({
            where: { id: f.restaurant_id },
            select: { id: true, name: true },
        });
        return {
            food: {
                ...f,
                id: Number(f.id),
                restaurant_id: Number(f.restaurant_id),
                category_id: f.category_id ? Number(f.category_id) : null,
                price: Number(f.price),
                tax: Number(f.tax),
                discount: Number(f.discount),
                variations: parseJsonField(f.variations),
                add_ons: parseJsonField(f.add_ons),
                attributes: parseJsonField(f.attributes),
                choice_options: parseJsonField(f.choice_options),
            },
            restaurant: restaurant ? { id: Number(restaurant.id), name: restaurant.name } : null,
        };
    }
    async updateFoodStatus(id, status) {
        if (this.useMongo()) {
            const f = await this.mongo.findByMysqlId('foods', id);
            if (!f)
                throw new common_1.NotFoundException({ errors: [{ code: 'food', message: 'Food not found' }] });
            await this.mongo.updateOne('foods', { mysql_id: id }, { status });
            return { ok: true, id, status };
        }
        const f = await this.prisma.food.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
        if (!f)
            throw new common_1.NotFoundException({ errors: [{ code: 'food', message: 'Food not found' }] });
        await this.prisma.food.update({ where: { id: f.id }, data: { status } });
        return { ok: true, id, status };
    }
    async updateFoodRecommended(id, recommended) {
        if (this.useMongo()) {
            const f = await this.mongo.findByMysqlId('foods', id);
            if (!f)
                throw new common_1.NotFoundException({ errors: [{ code: 'food', message: 'Food not found' }] });
            await this.mongo.updateOne('foods', { mysql_id: id }, { recommended });
            return { ok: true, id, recommended };
        }
        const f = await this.prisma.food.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
        if (!f)
            throw new common_1.NotFoundException({ errors: [{ code: 'food', message: 'Food not found' }] });
        await this.prisma.food.update({ where: { id: f.id }, data: { recommended } });
        return { ok: true, id, recommended };
    }
    async listCategories(parentId) {
        if (this.useMongo()) {
            const filter = {};
            if (parentId !== undefined)
                filter.parent_id = parentId;
            const rows = await this.mongo.findMany('categories', filter, { sort: { priority: 1, mysql_id: -1 } });
            return {
                categories: rows.map((r) => ({
                    id: r.mysql_id,
                    name: r.name,
                    image: r.image,
                    parent_id: r.parent_id,
                    position: r.position,
                    status: r.status ?? true,
                    priority: r.priority,
                    slug: r.slug ?? null,
                    meta_title: r.meta_title ?? null,
                    meta_description: r.meta_description ?? null,
                    meta_image: r.meta_image ?? null,
                    meta_data: r.meta_data ?? null,
                    created_at: r.created_at ?? null,
                    updated_at: r.updated_at ?? null,
                })),
            };
        }
        const rows = await this.prisma.categories.findMany({
            where: parentId !== undefined ? { parent_id: parentId } : undefined,
            orderBy: [{ priority: 'asc' }, { id: 'desc' }],
        });
        return { categories: rows.map((r) => ({ ...r, id: Number(r.id) })) };
    }
    async createCategory(body) {
        if (!body.name)
            throw new common_1.BadRequestException({ errors: [{ code: 'name', message: 'name is required' }] });
        if (this.useMongo()) {
            const now = new Date();
            const mysql_id = await this.mongo.nextMysqlId('categories');
            await this.mongo.insertOne('categories', {
                mysql_id,
                name: body.name,
                parent_id: body.parent_id ?? 0,
                position: body.position ?? 1,
                priority: body.priority ?? 0,
                image: body.image ?? 'def.png',
                status: true,
                created_at: now,
                updated_at: now,
            });
            return { ok: true, id: mysql_id };
        }
        const created = await this.prisma.categories.create({
            data: {
                name: body.name,
                parent_id: body.parent_id ?? 0,
                position: body.position ?? 1,
                priority: body.priority ?? 0,
                image: body.image ?? 'def.png',
            },
        });
        return { ok: true, id: Number(created.id) };
    }
    async updateCategory(id, body) {
        if (this.useMongo()) {
            const c = await this.mongo.findByMysqlId('categories', id);
            if (!c)
                throw new common_1.NotFoundException({ errors: [{ code: 'category', message: 'Category not found' }] });
            const data = {};
            if (body.name !== undefined)
                data.name = body.name;
            if (body.status !== undefined)
                data.status = body.status;
            if (body.priority !== undefined)
                data.priority = body.priority;
            if (Object.keys(data).length === 0) {
                throw new common_1.BadRequestException({ errors: [{ code: 'body', message: 'no fields to update' }] });
            }
            data.updated_at = new Date();
            await this.mongo.updateOne('categories', { mysql_id: id }, data);
            return { ok: true, id };
        }
        const c = await this.prisma.categories.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
        if (!c)
            throw new common_1.NotFoundException({ errors: [{ code: 'category', message: 'Category not found' }] });
        const data = {};
        if (body.name !== undefined)
            data.name = body.name;
        if (body.status !== undefined)
            data.status = body.status;
        if (body.priority !== undefined)
            data.priority = body.priority;
        if (Object.keys(data).length === 0) {
            throw new common_1.BadRequestException({ errors: [{ code: 'body', message: 'no fields to update' }] });
        }
        await this.prisma.categories.update({ where: { id: c.id }, data });
        return { ok: true, id };
    }
    async deleteCategory(id) {
        if (this.useMongo()) {
            const c = await this.mongo.findByMysqlId('categories', id);
            if (!c)
                throw new common_1.NotFoundException({ errors: [{ code: 'category', message: 'Category not found' }] });
            await this.mongo.deleteOne('categories', { mysql_id: id });
            return { ok: true, id };
        }
        const c = await this.prisma.categories.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
        if (!c)
            throw new common_1.NotFoundException({ errors: [{ code: 'category', message: 'Category not found' }] });
        await this.prisma.categories.delete({ where: { id: c.id } });
        return { ok: true, id };
    }
    async listCuisines() {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('cuisines', {}, { sort: { mysql_id: -1 } });
            return {
                cuisines: rows.map((r) => ({
                    id: r.mysql_id,
                    name: r.name,
                    image: r.image,
                    status: r.status ?? true,
                    slug: r.slug ?? null,
                    meta_title: r.meta_title ?? null,
                    meta_description: r.meta_description ?? null,
                    meta_image: r.meta_image ?? null,
                    meta_data: r.meta_data ?? null,
                    created_at: r.created_at ?? null,
                    updated_at: r.updated_at ?? null,
                })),
            };
        }
        const rows = await this.prisma.cuisines.findMany({ orderBy: { id: 'desc' } });
        return { cuisines: rows.map((r) => ({ ...r, id: Number(r.id) })) };
    }
    async createCuisine(body) {
        if (!body.name)
            throw new common_1.BadRequestException({ errors: [{ code: 'name', message: 'name is required' }] });
        if (this.useMongo()) {
            const now = new Date();
            const mysql_id = await this.mongo.nextMysqlId('cuisines');
            await this.mongo.insertOne('cuisines', {
                mysql_id,
                name: body.name,
                image: body.image ?? null,
                status: true,
                created_at: now,
                updated_at: now,
            });
            return { ok: true, id: mysql_id };
        }
        const created = await this.prisma.cuisines.create({ data: { name: body.name, image: body.image ?? null } });
        return { ok: true, id: Number(created.id) };
    }
    async updateCuisine(id, body) {
        if (this.useMongo()) {
            const c = await this.mongo.findByMysqlId('cuisines', id);
            if (!c)
                throw new common_1.NotFoundException({ errors: [{ code: 'cuisine', message: 'Cuisine not found' }] });
            const data = {};
            if (body.name !== undefined)
                data.name = body.name;
            if (body.status !== undefined)
                data.status = body.status;
            if (Object.keys(data).length === 0) {
                throw new common_1.BadRequestException({ errors: [{ code: 'body', message: 'no fields to update' }] });
            }
            data.updated_at = new Date();
            await this.mongo.updateOne('cuisines', { mysql_id: id }, data);
            return { ok: true, id };
        }
        const c = await this.prisma.cuisines.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
        if (!c)
            throw new common_1.NotFoundException({ errors: [{ code: 'cuisine', message: 'Cuisine not found' }] });
        const data = {};
        if (body.name !== undefined)
            data.name = body.name;
        if (body.status !== undefined)
            data.status = body.status;
        if (Object.keys(data).length === 0) {
            throw new common_1.BadRequestException({ errors: [{ code: 'body', message: 'no fields to update' }] });
        }
        await this.prisma.cuisines.update({ where: { id: c.id }, data });
        return { ok: true, id };
    }
    async deleteCuisine(id) {
        if (this.useMongo()) {
            const c = await this.mongo.findByMysqlId('cuisines', id);
            if (!c)
                throw new common_1.NotFoundException({ errors: [{ code: 'cuisine', message: 'Cuisine not found' }] });
            await this.mongo.deleteOne('cuisines', { mysql_id: id });
            return { ok: true, id };
        }
        const c = await this.prisma.cuisines.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
        if (!c)
            throw new common_1.NotFoundException({ errors: [{ code: 'cuisine', message: 'Cuisine not found' }] });
        await this.prisma.cuisines.delete({ where: { id: c.id } });
        return { ok: true, id };
    }
    async listCoupons() {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('coupons', {}, { sort: { mysql_id: -1 } });
            return {
                coupons: rows.map((r) => ({
                    id: r.mysql_id,
                    title: r.title ?? null,
                    code: r.code ?? null,
                    start_date: r.start_date ?? null,
                    expire_date: r.expire_date ?? null,
                    min_purchase: Number(r.min_purchase ?? 0),
                    max_discount: Number(r.max_discount ?? 0),
                    discount: Number(r.discount ?? 0),
                    discount_type: r.discount_type ?? 'percentage',
                    coupon_type: r.coupon_type ?? 'default',
                    limit: r.limit ?? null,
                    status: r.status ?? true,
                    created_at: r.created_at ?? null,
                    updated_at: r.updated_at ?? null,
                    data: r.data ?? null,
                    total_uses: r.total_uses ? Number(r.total_uses) : 0,
                    created_by: r.created_by ?? null,
                    customer_id: r.customer_id ?? null,
                    slug: r.slug ?? null,
                    restaurant_id: r.mysql_restaurant_id ?? r.restaurant_id ?? null,
                })),
            };
        }
        const rows = await this.prisma.coupons.findMany({ orderBy: { id: 'desc' } });
        return {
            coupons: rows.map((r) => ({
                ...r,
                id: Number(r.id),
                restaurant_id: r.restaurant_id ? Number(r.restaurant_id) : null,
                min_purchase: Number(r.min_purchase),
                max_discount: Number(r.max_discount),
                discount: Number(r.discount),
                total_uses: r.total_uses ? Number(r.total_uses) : 0,
            })),
        };
    }
    async createCoupon(body) {
        if (!body.title || !body.code || typeof body.discount !== 'number') {
            throw new common_1.BadRequestException({
                errors: [{ code: 'body', message: 'title, code, discount required' }],
            });
        }
        if (this.useMongo()) {
            const existing = await this.mongo.findOne('coupons', { code: body.code });
            if (existing) {
                throw new common_1.BadRequestException({ errors: [{ code: 'code', message: 'coupon code already exists' }] });
            }
            const now = new Date();
            const mysql_id = await this.mongo.nextMysqlId('coupons');
            await this.mongo.insertOne('coupons', {
                mysql_id,
                title: body.title,
                code: body.code,
                discount: body.discount,
                discount_type: body.discount_type ?? 'percentage',
                min_purchase: body.min_purchase ?? 0,
                max_discount: body.max_discount ?? 0,
                start_date: body.start_date ? new Date(body.start_date) : null,
                expire_date: body.expire_date ? new Date(body.expire_date) : null,
                limit: body.limit ?? null,
                coupon_type: body.coupon_type ?? 'default',
                status: true,
                created_by: 'admin',
                total_uses: 0,
                created_at: now,
                updated_at: now,
            });
            return { ok: true, id: mysql_id };
        }
        const existing = await this.prisma.coupons.findUnique({ where: { code: body.code } });
        if (existing) {
            throw new common_1.BadRequestException({ errors: [{ code: 'code', message: 'coupon code already exists' }] });
        }
        const created = await this.prisma.coupons.create({
            data: {
                title: body.title,
                code: body.code,
                discount: body.discount,
                discount_type: body.discount_type ?? 'percentage',
                min_purchase: body.min_purchase ?? 0,
                max_discount: body.max_discount ?? 0,
                start_date: body.start_date ? new Date(body.start_date) : null,
                expire_date: body.expire_date ? new Date(body.expire_date) : null,
                limit: body.limit ?? null,
                coupon_type: body.coupon_type ?? 'default',
                status: true,
                created_by: 'admin',
            },
        });
        return { ok: true, id: Number(created.id) };
    }
    async updateCouponStatus(id, status) {
        if (this.useMongo()) {
            const c = await this.mongo.findByMysqlId('coupons', id);
            if (!c)
                throw new common_1.NotFoundException({ errors: [{ code: 'coupon', message: 'Coupon not found' }] });
            await this.mongo.updateOne('coupons', { mysql_id: id }, { status, updated_at: new Date() });
            return { ok: true, id, status };
        }
        const c = await this.prisma.coupons.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
        if (!c)
            throw new common_1.NotFoundException({ errors: [{ code: 'coupon', message: 'Coupon not found' }] });
        await this.prisma.coupons.update({ where: { id: c.id }, data: { status } });
        return { ok: true, id, status };
    }
    async deleteCoupon(id) {
        if (this.useMongo()) {
            const c = await this.mongo.findByMysqlId('coupons', id);
            if (!c)
                throw new common_1.NotFoundException({ errors: [{ code: 'coupon', message: 'Coupon not found' }] });
            await this.mongo.deleteOne('coupons', { mysql_id: id });
            return { ok: true, id };
        }
        const c = await this.prisma.coupons.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
        if (!c)
            throw new common_1.NotFoundException({ errors: [{ code: 'coupon', message: 'Coupon not found' }] });
        await this.prisma.coupons.delete({ where: { id: c.id } });
        return { ok: true, id };
    }
    async listBanners() {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('banners', {}, { sort: { mysql_id: -1 } });
            return {
                banners: rows.map((r) => ({
                    id: r.mysql_id,
                    title: r.title,
                    type: r.type,
                    image: r.image,
                    status: r.status ?? true,
                    data: r.data,
                    zone_id: Number(r.mysql_zone_id ?? r.zone_id ?? 0),
                    created_at: r.created_at ?? null,
                    updated_at: r.updated_at ?? null,
                })),
            };
        }
        const rows = await this.prisma.banners.findMany({ orderBy: { id: 'desc' } });
        return {
            banners: rows.map((r) => ({ ...r, id: Number(r.id), zone_id: Number(r.zone_id) })),
        };
    }
    async createBanner(body) {
        if (!body.title || !body.type || !body.zone_id) {
            throw new common_1.BadRequestException({
                errors: [{ code: 'body', message: 'title, type, zone_id required' }],
            });
        }
        if (this.useMongo()) {
            const now = new Date();
            const mysql_id = await this.mongo.nextMysqlId('banners');
            await this.mongo.insertOne('banners', {
                mysql_id,
                title: body.title,
                type: body.type,
                zone_id: body.zone_id,
                mysql_zone_id: body.zone_id,
                data: body.data ?? '',
                image: body.image ?? null,
                status: true,
                created_at: now,
                updated_at: now,
            });
            return { ok: true, id: mysql_id };
        }
        const created = await this.prisma.banners.create({
            data: {
                title: body.title,
                type: body.type,
                zone_id: BigInt(body.zone_id),
                data: body.data ?? '',
                image: body.image ?? null,
            },
        });
        return { ok: true, id: Number(created.id) };
    }
    async updateBannerStatus(id, status) {
        if (this.useMongo()) {
            const b = await this.mongo.findByMysqlId('banners', id);
            if (!b)
                throw new common_1.NotFoundException({ errors: [{ code: 'banner', message: 'Banner not found' }] });
            await this.mongo.updateOne('banners', { mysql_id: id }, { status, updated_at: new Date() });
            return { ok: true, id, status };
        }
        const b = await this.prisma.banners.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
        if (!b)
            throw new common_1.NotFoundException({ errors: [{ code: 'banner', message: 'Banner not found' }] });
        await this.prisma.banners.update({ where: { id: b.id }, data: { status } });
        return { ok: true, id, status };
    }
    async deleteBanner(id) {
        if (this.useMongo()) {
            const b = await this.mongo.findByMysqlId('banners', id);
            if (!b)
                throw new common_1.NotFoundException({ errors: [{ code: 'banner', message: 'Banner not found' }] });
            await this.mongo.deleteOne('banners', { mysql_id: id });
            return { ok: true, id };
        }
        const b = await this.prisma.banners.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
        if (!b)
            throw new common_1.NotFoundException({ errors: [{ code: 'banner', message: 'Banner not found' }] });
        await this.prisma.banners.delete({ where: { id: b.id } });
        return { ok: true, id };
    }
    async listZones() {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('zones', {}, {
                sort: { mysql_id: -1 },
                projection: {
                    mysql_id: 1, name: 1, display_name: 1, status: 1, is_default: 1,
                    minimum_shipping_charge: 1, per_km_shipping_charge: 1,
                    maximum_shipping_charge: 1, minimum_delivery_time: 1,
                    max_cod_order_amount: 1, created_at: 1,
                },
            });
            const restaurantCounts = await this.mongo.aggregate('restaurants', [{ $group: { _id: '$mysql_zone_id', count: { $sum: 1 } } }]);
            const countByZone = new Map(restaurantCounts.map((g) => [String(g._id ?? 'null'), g.count]));
            return {
                zones: rows.map((r) => ({
                    id: r.mysql_id,
                    name: r.name,
                    display_name: r.display_name ?? null,
                    status: r.status ?? true,
                    is_default: r.is_default ?? false,
                    minimum_shipping_charge: r.minimum_shipping_charge ?? null,
                    per_km_shipping_charge: r.per_km_shipping_charge ?? null,
                    maximum_shipping_charge: r.maximum_shipping_charge ?? null,
                    minimum_delivery_time: r.minimum_delivery_time ?? null,
                    max_cod_order_amount: r.max_cod_order_amount ?? null,
                    created_at: r.created_at ?? null,
                    restaurant_count: countByZone.get(String(r.mysql_id)) ?? 0,
                })),
            };
        }
        const rows = await this.prisma.zones.findMany({
            orderBy: { id: 'desc' },
            select: {
                id: true,
                name: true,
                display_name: true,
                status: true,
                is_default: true,
                minimum_shipping_charge: true,
                per_km_shipping_charge: true,
                maximum_shipping_charge: true,
                minimum_delivery_time: true,
                max_cod_order_amount: true,
                created_at: true,
            },
        });
        const restaurantCounts = await this.prisma.restaurants.groupBy({
            by: ['zone_id'],
            _count: { _all: true },
        });
        const countByZone = new Map(restaurantCounts.map((g) => [g.zone_id ? String(g.zone_id) : 'null', g._count._all]));
        return {
            zones: rows.map((r) => ({
                ...r,
                id: Number(r.id),
                restaurant_count: countByZone.get(String(r.id)) ?? 0,
            })),
        };
    }
    async updateZoneStatus(id, status) {
        if (this.useMongo()) {
            const z = await this.mongo.findByMysqlId('zones', id);
            if (!z)
                throw new common_1.NotFoundException({ errors: [{ code: 'zone', message: 'Zone not found' }] });
            await this.mongo.updateOne('zones', { mysql_id: id }, { status, updated_at: new Date() });
            return { ok: true, id, status };
        }
        const z = await this.prisma.zones.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
        if (!z)
            throw new common_1.NotFoundException({ errors: [{ code: 'zone', message: 'Zone not found' }] });
        await this.prisma.zones.update({ where: { id: z.id }, data: { status } });
        return { ok: true, id, status };
    }
    async listBusinessSettings(prefix) {
        if (this.useMongo()) {
            const filter = {};
            if (prefix)
                filter.key = { $regex: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` };
            const rows = await this.mongo.findMany('business_settings', filter, { sort: { key: 1 } });
            return {
                settings: rows.map((r) => ({ id: r.mysql_id, key: r.key, value: r.value })),
            };
        }
        const rows = await this.prisma.business_settings.findMany({
            where: prefix ? { key: { startsWith: prefix } } : undefined,
            orderBy: { key: 'asc' },
        });
        return {
            settings: rows.map((r) => ({ id: Number(r.id), key: r.key, value: r.value })),
        };
    }
    async upsertBusinessSettings(body) {
        if (!Array.isArray(body.settings) || body.settings.length === 0) {
            throw new common_1.BadRequestException({ errors: [{ code: 'settings', message: 'settings[] required' }] });
        }
        if (this.useMongo()) {
            let updated = 0;
            for (const s of body.settings) {
                const existing = await this.mongo.findOne('business_settings', { key: s.key });
                const now = new Date();
                if (existing) {
                    await this.mongo.updateOne('business_settings', { key: s.key }, { value: s.value, updated_at: now });
                }
                else {
                    const mysql_id = await this.mongo.nextMysqlId('business_settings');
                    await this.mongo.insertOne('business_settings', {
                        mysql_id,
                        key: s.key,
                        value: s.value,
                        created_at: now,
                        updated_at: now,
                    });
                }
                updated++;
            }
            return { ok: true, updated };
        }
        let updated = 0;
        for (const s of body.settings) {
            const existing = await this.prisma.business_settings.findFirst({ where: { key: s.key } });
            if (existing) {
                await this.prisma.business_settings.update({
                    where: { id: existing.id },
                    data: { value: s.value },
                });
            }
            else {
                await this.prisma.business_settings.create({ data: { key: s.key, value: s.value } });
            }
            updated++;
        }
        return { ok: true, updated };
    }
    async salesSummary(days = 30) {
        if (this.useMongo()) {
            const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
            const rows = await this.mongo.aggregate('orders', [
                { $match: { order_status: 'delivered', payment_status: 'paid', delivered: { $gte: cutoff } } },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$delivered' } },
                        orders: { $sum: 1 },
                        revenue: { $sum: '$order_amount' },
                        tax: { $sum: '$total_tax_amount' },
                        delivery: { $sum: '$delivery_charge' },
                    },
                },
                { $sort: { _id: 1 } },
            ]);
            const series = rows.map((r) => ({
                day: r._id,
                revenue: Number(r.revenue ?? 0),
                orders: Number(r.orders ?? 0),
                tax: Number(r.tax ?? 0),
                delivery: Number(r.delivery ?? 0),
            }));
            return {
                days,
                total_revenue: series.reduce((s, x) => s + x.revenue, 0),
                total_orders: series.reduce((s, x) => s + x.orders, 0),
                series,
            };
        }
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const orders = await this.prisma.orders.findMany({
            where: { created_at: { gte: since }, order_status: 'delivered' },
            select: { created_at: true, order_amount: true, total_tax_amount: true, delivery_charge: true },
        });
        const dailyMap = new Map();
        for (const o of orders) {
            if (!o.created_at)
                continue;
            const day = o.created_at.toISOString().slice(0, 10);
            const cur = dailyMap.get(day) ?? { revenue: 0, orders: 0, tax: 0, delivery: 0 };
            cur.revenue += Number(o.order_amount);
            cur.tax += Number(o.total_tax_amount);
            cur.delivery += Number(o.delivery_charge);
            cur.orders += 1;
            dailyMap.set(day, cur);
        }
        const series = Array.from(dailyMap.entries())
            .sort((a, b) => (a[0] < b[0] ? -1 : 1))
            .map(([day, v]) => ({ day, ...v }));
        return {
            days,
            total_revenue: series.reduce((s, x) => s + x.revenue, 0),
            total_orders: series.reduce((s, x) => s + x.orders, 0),
            series,
        };
    }
    async restaurantEarnings(limit = 10) {
        if (this.useMongo()) {
            const rows = await this.mongo.aggregate('orders', [
                { $match: { order_status: 'delivered', payment_status: 'paid' } },
                {
                    $group: {
                        _id: '$mysql_restaurant_id',
                        revenue: { $sum: '$order_amount' },
                        orders: { $sum: 1 },
                    },
                },
                { $sort: { revenue: -1 } },
                { $limit: limit },
                {
                    $lookup: {
                        from: 'restaurants',
                        localField: '_id',
                        foreignField: 'mysql_id',
                        as: 'restaurant',
                    },
                },
                { $unwind: { path: '$restaurant', preserveNullAndEmptyArrays: true } },
            ]);
            return {
                top_earners: rows.map((g) => {
                    const revenue = Number(g.revenue ?? 0);
                    const commission = g.restaurant && g.restaurant.comission !== null && g.restaurant.comission !== undefined
                        ? Number(g.restaurant.comission)
                        : 0;
                    return {
                        restaurant_id: Number(g._id),
                        name: g.restaurant?.name ?? null,
                        orders: Number(g.orders ?? 0),
                        revenue,
                        admin_commission: revenue * (commission / 100),
                        restaurant_take: revenue * (1 - commission / 100),
                    };
                }),
            };
        }
        const groups = await this.prisma.orders.groupBy({
            by: ['restaurant_id'],
            where: { order_status: 'delivered', payment_status: 'paid' },
            _sum: { order_amount: true },
            _count: { _all: true },
            orderBy: { _sum: { order_amount: 'desc' } },
            take: limit,
        });
        const restaurantIds = groups.map((g) => g.restaurant_id);
        const restaurants = restaurantIds.length
            ? await this.prisma.restaurants.findMany({
                where: { id: { in: restaurantIds } },
                select: { id: true, name: true, comission: true },
            })
            : [];
        const map = new Map(restaurants.map((r) => [String(r.id), r]));
        return {
            top_earners: groups.map((g) => {
                const r = map.get(String(g.restaurant_id));
                const revenue = Number(g._sum.order_amount ?? 0);
                const commission = r?.comission !== null && r?.comission !== undefined ? Number(r.comission) : 0;
                return {
                    restaurant_id: Number(g.restaurant_id),
                    name: r?.name ?? null,
                    orders: g._count._all,
                    revenue,
                    admin_commission: revenue * (commission / 100),
                    restaurant_take: revenue * (1 - commission / 100),
                };
            }),
        };
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        mongo_data_service_1.MongoDataService])
], AdminService);
function bigToNumber(row) {
    const out = { ...row };
    for (const k of Object.keys(out)) {
        if (typeof out[k] === 'bigint')
            out[k] = Number(out[k]);
    }
    return out;
}
function paginate(rows, total, limit, offset) {
    return { total, limit, offset, items: rows };
}
AdminService.prototype.listAddOns = async function (opts) {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    if (this['useMongo']()) {
        const filter = {};
        if (opts.restaurantId)
            filter.restaurant_id = Number(opts.restaurantId);
        if (opts.q)
            filter.name = { $regex: opts.q, $options: 'i' };
        const [rows, total] = await Promise.all([
            this['mongo'].findMany('add_ons', filter, {
                limit,
                skip: offset,
                sort: { mysql_id: -1 },
            }),
            this['mongo'].count('add_ons', filter),
        ]);
        return paginate(rows.map((r) => ({
            ...r,
            id: Number(r.mysql_id),
            price: r.price !== undefined && r.price !== null ? Number(r.price) : 0,
        })), total, limit, offset);
    }
    const where = {};
    if (opts.restaurantId)
        where.restaurant_id = BigInt(opts.restaurantId);
    if (opts.q)
        where.name = { contains: opts.q };
    const [rows, total] = await Promise.all([
        this['prisma'].add_ons.findMany({ where, orderBy: { id: 'desc' }, take: limit, skip: offset }),
        this['prisma'].add_ons.count({ where }),
    ]);
    return paginate(rows.map((r) => ({ ...bigToNumber(r), price: Number(r.price) })), total, limit, offset);
};
AdminService.prototype.createAddOn = async function (body) {
    if (!body.name || typeof body.price !== 'number' || !body.restaurant_id) {
        throw new common_1.BadRequestException({ errors: [{ code: 'body', message: 'name, price, restaurant_id required' }] });
    }
    if (this['useMongo']()) {
        const mysqlId = await this['mongo'].nextMysqlId('add_ons');
        await this['mongo'].insertOne('add_ons', {
            mysql_id: mysqlId,
            name: body.name,
            price: body.price,
            restaurant_id: Number(body.restaurant_id),
            addon_category_id: body.addon_category_id ? Number(body.addon_category_id) : null,
            status: true,
            created_at: new Date(),
            updated_at: new Date(),
        });
        return { ok: true, id: mysqlId };
    }
    const created = await this['prisma'].add_ons.create({
        data: {
            name: body.name,
            price: body.price,
            restaurant_id: BigInt(body.restaurant_id),
            addon_category_id: body.addon_category_id ? BigInt(body.addon_category_id) : null,
        },
    });
    return { ok: true, id: Number(created.id) };
};
AdminService.prototype.updateAddOnStatus = async function (id, status) {
    if (this['useMongo']()) {
        const a = await this['mongo'].findByMysqlId('add_ons', id);
        if (!a)
            throw new common_1.NotFoundException({ errors: [{ code: 'add_on', message: 'Add-on not found' }] });
        await this['mongo'].updateOne('add_ons', { mysql_id: Number(id) }, { status, updated_at: new Date() });
        return { ok: true, id, status };
    }
    const a = await this['prisma'].add_ons.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!a)
        throw new common_1.NotFoundException({ errors: [{ code: 'add_on', message: 'Add-on not found' }] });
    await this['prisma'].add_ons.update({ where: { id: a.id }, data: { status } });
    return { ok: true, id, status };
};
AdminService.prototype.deleteAddOn = async function (id) {
    if (this['useMongo']()) {
        const a = await this['mongo'].findByMysqlId('add_ons', id);
        if (!a)
            throw new common_1.NotFoundException({ errors: [{ code: 'add_on', message: 'Add-on not found' }] });
        await this['mongo'].deleteOne('add_ons', { mysql_id: Number(id) });
        return { ok: true, id };
    }
    const a = await this['prisma'].add_ons.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!a)
        throw new common_1.NotFoundException({ errors: [{ code: 'add_on', message: 'Add-on not found' }] });
    await this['prisma'].add_ons.delete({ where: { id: a.id } });
    return { ok: true, id };
};
AdminService.prototype.listAddonCategories = async function (opts) {
    const limit = opts.limit ?? 100;
    const offset = opts.offset ?? 0;
    if (this['useMongo']()) {
        const filter = {};
        if (opts.q)
            filter.name = { $regex: opts.q, $options: 'i' };
        const [mrows, mtotal] = await Promise.all([
            this['mongo'].findMany('addon_categories', filter, { limit, skip: offset, sort: { mysql_id: -1 } }),
            this['mongo'].count('addon_categories', filter),
        ]);
        return paginate(mrows.map((r) => ({ ...r, id: Number(r.mysql_id) })), mtotal, limit, offset);
    }
    const [rows, total] = await Promise.all([
        this['prisma'].addon_categories.findMany({
            where: opts.q ? { name: { contains: opts.q } } : undefined,
            orderBy: { id: 'desc' },
            take: limit,
            skip: offset,
        }),
        this['prisma'].addon_categories.count({ where: opts.q ? { name: { contains: opts.q } } : undefined }),
    ]);
    return paginate(rows.map((r) => bigToNumber(r)), total, limit, offset);
};
AdminService.prototype.createAddonCategory = async function (body) {
    if (!body.name)
        throw new common_1.BadRequestException({ errors: [{ code: 'name', message: 'name required' }] });
    if (this['useMongo']()) {
        const mysqlId = await this['mongo'].nextMysqlId('addon_categories');
        await this['mongo'].insertOne('addon_categories', { mysql_id: mysqlId, name: body.name, status: true, created_at: new Date(), updated_at: new Date() });
        return { ok: true, id: mysqlId };
    }
    const created = await this['prisma'].addon_categories.create({ data: { name: body.name } });
    return { ok: true, id: Number(created.id) };
};
AdminService.prototype.updateAddonCategoryStatus = async function (id, status) {
    if (this['useMongo']()) {
        const c = await this['mongo'].findByMysqlId('addon_categories', id);
        if (!c)
            throw new common_1.NotFoundException({ errors: [{ code: 'addon_category', message: 'not found' }] });
        await this['mongo'].updateOne('addon_categories', { mysql_id: Number(id) }, { status, updated_at: new Date() });
        return { ok: true, id, status };
    }
    const c = await this['prisma'].addon_categories.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!c)
        throw new common_1.NotFoundException({ errors: [{ code: 'addon_category', message: 'not found' }] });
    await this['prisma'].addon_categories.update({ where: { id: c.id }, data: { status } });
    return { ok: true, id, status };
};
AdminService.prototype.deleteAddonCategory = async function (id) {
    if (this['useMongo']()) {
        const c = await this['mongo'].findByMysqlId('addon_categories', id);
        if (!c)
            throw new common_1.NotFoundException({ errors: [{ code: 'addon_category', message: 'not found' }] });
        await this['mongo'].deleteOne('addon_categories', { mysql_id: Number(id) });
        return { ok: true, id };
    }
    const c = await this['prisma'].addon_categories.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!c)
        throw new common_1.NotFoundException({ errors: [{ code: 'addon_category', message: 'not found' }] });
    await this['prisma'].addon_categories.delete({ where: { id: c.id } });
    return { ok: true, id };
};
AdminService.prototype.listAttributes = async function () {
    if (this['useMongo']()) {
        const rows = await this['mongo'].findMany('attributes', {}, { sort: { mysql_id: -1 } });
        return { attributes: rows.map((r) => ({ ...r, id: Number(r.mysql_id) })) };
    }
    const rows = await this['prisma'].attributes.findMany({ orderBy: { id: 'desc' } });
    return { attributes: rows.map((r) => bigToNumber(r)) };
};
AdminService.prototype.createAttribute = async function (body) {
    if (!body.name)
        throw new common_1.BadRequestException({ errors: [{ code: 'name', message: 'name required' }] });
    if (this['useMongo']()) {
        const mysqlId = await this['mongo'].nextMysqlId('attributes');
        await this['mongo'].insertOne('attributes', { mysql_id: mysqlId, name: body.name, created_at: new Date(), updated_at: new Date() });
        return { ok: true, id: mysqlId };
    }
    const created = await this['prisma'].attributes.create({ data: { name: body.name } });
    return { ok: true, id: Number(created.id) };
};
AdminService.prototype.deleteAttribute = async function (id) {
    if (this['useMongo']()) {
        const a = await this['mongo'].findByMysqlId('attributes', id);
        if (!a)
            throw new common_1.NotFoundException({ errors: [{ code: 'attribute', message: 'not found' }] });
        await this['mongo'].deleteOne('attributes', { mysql_id: Number(id) });
        return { ok: true, id };
    }
    const a = await this['prisma'].attributes.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!a)
        throw new common_1.NotFoundException({ errors: [{ code: 'attribute', message: 'not found' }] });
    await this['prisma'].attributes.delete({ where: { id: a.id } });
    return { ok: true, id };
};
AdminService.prototype.listCampaigns = async function (opts) {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    if (this['useMongo']()) {
        const filter = {};
        if (opts.q)
            filter.title = { $regex: opts.q, $options: 'i' };
        const [mrows, mtotal] = await Promise.all([
            this['mongo'].findMany('campaigns', filter, { limit, skip: offset, sort: { mysql_id: -1 } }),
            this['mongo'].count('campaigns', filter),
        ]);
        return paginate(mrows.map((r) => ({ ...r, id: Number(r.mysql_id) })), mtotal, limit, offset);
    }
    const where = opts.q ? { title: { contains: opts.q } } : undefined;
    const [rows, total] = await Promise.all([
        this['prisma'].campaigns.findMany({ where, orderBy: { id: 'desc' }, take: limit, skip: offset }),
        this['prisma'].campaigns.count({ where }),
    ]);
    return paginate(rows.map((r) => bigToNumber(r)), total, limit, offset);
};
AdminService.prototype.createCampaign = async function (body) {
    if (!body.title)
        throw new common_1.BadRequestException({ errors: [{ code: 'title', message: 'title required' }] });
    if (this['useMongo']()) {
        const mysqlId = await this['mongo'].nextMysqlId('campaigns');
        await this['mongo'].insertOne('campaigns', {
            mysql_id: mysqlId,
            title: body.title,
            description: body.description ?? null,
            start_date: body.start_date ? new Date(body.start_date) : null,
            end_date: body.end_date ? new Date(body.end_date) : null,
            status: true,
            created_at: new Date(),
            updated_at: new Date(),
        });
        return { ok: true, id: mysqlId };
    }
    const created = await this['prisma'].campaigns.create({
        data: {
            title: body.title,
            description: body.description,
            start_date: body.start_date ? new Date(body.start_date) : null,
            end_date: body.end_date ? new Date(body.end_date) : null,
        },
    });
    return { ok: true, id: Number(created.id) };
};
AdminService.prototype.updateCampaignStatus = async function (id, status) {
    if (this['useMongo']()) {
        const c = await this['mongo'].findByMysqlId('campaigns', id);
        if (!c)
            throw new common_1.NotFoundException({ errors: [{ code: 'campaign', message: 'not found' }] });
        await this['mongo'].updateOne('campaigns', { mysql_id: Number(id) }, { status, updated_at: new Date() });
        return { ok: true, id, status };
    }
    const c = await this['prisma'].campaigns.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!c)
        throw new common_1.NotFoundException({ errors: [{ code: 'campaign', message: 'not found' }] });
    await this['prisma'].campaigns.update({ where: { id: c.id }, data: { status } });
    return { ok: true, id, status };
};
AdminService.prototype.deleteCampaign = async function (id) {
    if (this['useMongo']()) {
        const c = await this['mongo'].findByMysqlId('campaigns', id);
        if (!c)
            throw new common_1.NotFoundException({ errors: [{ code: 'campaign', message: 'not found' }] });
        await this['mongo'].deleteOne('campaigns', { mysql_id: Number(id) });
        return { ok: true, id };
    }
    const c = await this['prisma'].campaigns.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!c)
        throw new common_1.NotFoundException({ errors: [{ code: 'campaign', message: 'not found' }] });
    await this['prisma'].campaigns.delete({ where: { id: c.id } });
    return { ok: true, id };
};
AdminService.prototype.listAdvertisements = async function (opts) {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    if (this['useMongo']()) {
        const [mrows, mtotal] = await Promise.all([
            this['mongo'].findMany('advertisements', {}, { limit, skip: offset, sort: { mysql_id: -1 } }),
            this['mongo'].count('advertisements'),
        ]);
        return paginate(mrows.map((r) => ({ ...r, id: Number(r.mysql_id) })), mtotal, limit, offset);
    }
    const [rows, total] = await Promise.all([
        this['prisma'].advertisements.findMany({ orderBy: { id: 'desc' }, take: limit, skip: offset }),
        this['prisma'].advertisements.count(),
    ]);
    return paginate(rows.map((r) => bigToNumber(r)), total, limit, offset);
};
AdminService.prototype.updateAdvertisementStatus = async function (id, status) {
    if (this['useMongo']()) {
        const a = await this['mongo'].findByMysqlId('advertisements', id);
        if (!a)
            throw new common_1.NotFoundException({ errors: [{ code: 'advertisement', message: 'not found' }] });
        await this['mongo'].updateOne('advertisements', { mysql_id: Number(id) }, { status, updated_at: new Date() });
        return { ok: true, id, status };
    }
    const a = await this['prisma'].advertisements.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!a)
        throw new common_1.NotFoundException({ errors: [{ code: 'advertisement', message: 'not found' }] });
    await this['prisma'].advertisements.update({ where: { id: a.id }, data: { status } });
    return { ok: true, id, status };
};
AdminService.prototype.listCashBacks = async function () {
    if (this['useMongo']()) {
        const rows = await this['mongo'].findMany('cash_backs', {}, { sort: { mysql_id: -1 } });
        return { cash_backs: rows.map((r) => ({ ...r, id: Number(r.mysql_id) })) };
    }
    const rows = await this['prisma'].cash_backs.findMany({ orderBy: { id: 'desc' } });
    return { cash_backs: rows.map((r) => bigToNumber(r)) };
};
AdminService.prototype.listWalletBonuses = async function () {
    if (this['useMongo']()) {
        const rows = await this['mongo'].findMany('wallet_bonuses', {}, { sort: { mysql_id: -1 } });
        return { wallet_bonuses: rows.map((r) => ({ ...r, id: Number(r.mysql_id) })) };
    }
    const rows = await this['prisma'].wallet_bonuses.findMany({ orderBy: { id: 'desc' } });
    return { wallet_bonuses: rows.map((r) => bigToNumber(r)) };
};
AdminService.prototype.createWalletBonus = async function (body) {
    if (!body.title || !body.bonus_type || typeof body.bonus_amount !== 'number') {
        throw new common_1.BadRequestException({ errors: [{ code: 'body', message: 'title, bonus_type, bonus_amount required' }] });
    }
    if (this['useMongo']()) {
        const mysqlId = await this['mongo'].nextMysqlId('wallet_bonuses');
        await this['mongo'].insertOne('wallet_bonuses', {
            mysql_id: mysqlId,
            title: body.title,
            bonus_type: body.bonus_type,
            bonus_amount: body.bonus_amount,
            minimum_add_amount: body.minimum_add_amount ?? 0,
            maximum_bonus_amount: body.maximum_bonus_amount ?? 0,
            start_date: body.start_date ? new Date(body.start_date) : null,
            end_date: body.end_date ? new Date(body.end_date) : null,
            status: true,
            created_at: new Date(),
            updated_at: new Date(),
        });
        return { ok: true, id: mysqlId };
    }
    const created = await this['prisma'].wallet_bonuses.create({
        data: {
            title: body.title,
            bonus_type: body.bonus_type,
            bonus_amount: body.bonus_amount,
            minimum_add_amount: body.minimum_add_amount ?? 0,
            maximum_bonus_amount: body.maximum_bonus_amount ?? 0,
            start_date: body.start_date ? new Date(body.start_date) : null,
            end_date: body.end_date ? new Date(body.end_date) : null,
        },
    });
    return { ok: true, id: Number(created.id) };
};
AdminService.prototype.updateWalletBonusStatus = async function (id, status) {
    if (this['useMongo']()) {
        const b = await this['mongo'].findByMysqlId('wallet_bonuses', id);
        if (!b)
            throw new common_1.NotFoundException({ errors: [{ code: 'wallet_bonus', message: 'not found' }] });
        await this['mongo'].updateOne('wallet_bonuses', { mysql_id: Number(id) }, { status, updated_at: new Date() });
        return { ok: true, id, status };
    }
    const b = await this['prisma'].wallet_bonuses.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!b)
        throw new common_1.NotFoundException({ errors: [{ code: 'wallet_bonus', message: 'not found' }] });
    await this['prisma'].wallet_bonuses.update({ where: { id: b.id }, data: { status } });
    return { ok: true, id, status };
};
AdminService.prototype.deleteWalletBonus = async function (id) {
    if (this['useMongo']()) {
        const b = await this['mongo'].findByMysqlId('wallet_bonuses', id);
        if (!b)
            throw new common_1.NotFoundException({ errors: [{ code: 'wallet_bonus', message: 'not found' }] });
        await this['mongo'].deleteOne('wallet_bonuses', { mysql_id: Number(id) });
        return { ok: true, id };
    }
    const b = await this['prisma'].wallet_bonuses.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!b)
        throw new common_1.NotFoundException({ errors: [{ code: 'wallet_bonus', message: 'not found' }] });
    await this['prisma'].wallet_bonuses.delete({ where: { id: b.id } });
    return { ok: true, id };
};
AdminService.prototype.listAccountTransactions = async function (opts) {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    if (this['useMongo']()) {
        const [rows, total] = await Promise.all([
            this['mongo'].findMany('account_transactions', {}, {
                limit,
                skip: offset,
                sort: { mysql_id: -1 },
            }),
            this['mongo'].count('account_transactions'),
        ]);
        return paginate(rows.map((r) => ({
            ...r,
            id: Number(r.mysql_id),
            from_id: r.from_id !== undefined && r.from_id !== null ? Number(r.from_id) : 0,
            current_balance: r.current_balance !== undefined && r.current_balance !== null ? Number(r.current_balance) : 0,
            amount: r.amount !== undefined && r.amount !== null ? Number(r.amount) : 0,
        })), total, limit, offset);
    }
    const [rows, total] = await Promise.all([
        this['prisma'].account_transactions.findMany({ orderBy: { id: 'desc' }, take: limit, skip: offset }),
        this['prisma'].account_transactions.count(),
    ]);
    return paginate(rows.map((r) => ({
        ...bigToNumber(r),
        from_id: Number(r.from_id),
        current_balance: Number(r.current_balance),
        amount: Number(r.amount),
    })), total, limit, offset);
};
AdminService.prototype.listWalletTransactions = async function (opts) {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    if (this['useMongo']()) {
        const [rows, total] = await Promise.all([
            this['mongo'].findMany('wallet_transactions', {}, {
                limit,
                skip: offset,
                sort: { mysql_id: -1 },
            }),
            this['mongo'].count('wallet_transactions'),
        ]);
        return paginate(rows.map((r) => ({
            ...r,
            id: Number(r.mysql_id),
            credit: r.credit !== undefined && r.credit !== null ? Number(r.credit) : 0,
            debit: r.debit !== undefined && r.debit !== null ? Number(r.debit) : 0,
            balance: r.balance !== undefined && r.balance !== null ? Number(r.balance) : 0,
            admin_bonus: r.admin_bonus !== undefined && r.admin_bonus !== null ? Number(r.admin_bonus) : 0,
        })), total, limit, offset);
    }
    const [rows, total] = await Promise.all([
        this['prisma'].wallet_transactions.findMany({ orderBy: { id: 'desc' }, take: limit, skip: offset }),
        this['prisma'].wallet_transactions.count(),
    ]);
    return paginate(rows.map((r) => ({
        ...bigToNumber(r),
        credit: Number(r.credit),
        debit: Number(r.debit),
        balance: Number(r.balance),
        admin_bonus: Number(r.admin_bonus),
    })), total, limit, offset);
};
AdminService.prototype.listLoyaltyPointTransactions = async function (opts) {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    if (this['useMongo']()) {
        const [rows, total] = await Promise.all([
            this['mongo'].findMany('loyalty_point_transactions', {}, {
                limit,
                skip: offset,
                sort: { mysql_id: -1 },
            }),
            this['mongo'].count('loyalty_point_transactions'),
        ]);
        return paginate(rows.map((r) => ({
            ...r,
            id: Number(r.mysql_id),
            credit: r.credit !== undefined && r.credit !== null ? Number(r.credit) : 0,
            debit: r.debit !== undefined && r.debit !== null ? Number(r.debit) : 0,
            balance: r.balance !== undefined && r.balance !== null ? Number(r.balance) : 0,
        })), total, limit, offset);
    }
    const [rows, total] = await Promise.all([
        this['prisma'].loyalty_point_transactions.findMany({ orderBy: { id: 'desc' }, take: limit, skip: offset }),
        this['prisma'].loyalty_point_transactions.count(),
    ]);
    return paginate(rows.map((r) => ({
        ...bigToNumber(r),
        credit: Number(r.credit),
        debit: Number(r.debit),
        balance: Number(r.balance),
    })), total, limit, offset);
};
AdminService.prototype.listCashbackHistories = async function (opts) {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    if (this['useMongo']()) {
        const [rows, total] = await Promise.all([
            this['mongo'].findMany('cash_back_histories', {}, {
                limit,
                skip: offset,
                sort: { mysql_id: -1 },
            }),
            this['mongo'].count('cash_back_histories'),
        ]);
        return paginate(rows.map((r) => ({ ...r, id: Number(r.mysql_id) })), total, limit, offset);
    }
    const [rows, total] = await Promise.all([
        this['prisma'].cash_back_histories.findMany({ orderBy: { id: 'desc' }, take: limit, skip: offset }),
        this['prisma'].cash_back_histories.count(),
    ]);
    return paginate(rows.map((r) => bigToNumber(r)), total, limit, offset);
};
AdminService.prototype.listDisbursements = async function (opts) {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    if (this['useMongo']()) {
        const [rows, total] = await Promise.all([
            this['mongo'].findMany('disbursements', {}, {
                limit,
                skip: offset,
                sort: { mysql_id: -1 },
            }),
            this['mongo'].count('disbursements'),
        ]);
        return paginate(rows.map((r) => ({
            ...r,
            id: Number(r.mysql_id),
            total_amount: r.total_amount !== undefined && r.total_amount !== null ? Number(r.total_amount) : 0,
        })), total, limit, offset);
    }
    const [rows, total] = await Promise.all([
        this['prisma'].disbursements.findMany({ orderBy: { id: 'desc' }, take: limit, skip: offset }),
        this['prisma'].disbursements.count(),
    ]);
    return paginate(rows.map((r) => bigToNumber(r)), total, limit, offset);
};
AdminService.prototype.listWithdrawRequests = async function (opts) {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    if (this['useMongo']()) {
        const filter = {};
        if (opts.type)
            filter.type = opts.type;
        if (opts.approved !== undefined)
            filter.approved = opts.approved;
        const [rows, total] = await Promise.all([
            this['mongo'].findMany('withdraw_requests', filter, {
                limit,
                skip: offset,
                sort: { mysql_id: -1 },
            }),
            this['mongo'].count('withdraw_requests', filter),
        ]);
        return paginate(rows.map((r) => ({
            ...r,
            id: Number(r.mysql_id),
            amount: r.amount !== undefined && r.amount !== null ? Number(r.amount) : 0,
        })), total, limit, offset);
    }
    const where = {};
    if (opts.type)
        where.type = opts.type;
    if (opts.approved !== undefined)
        where.approved = opts.approved;
    const [rows, total] = await Promise.all([
        this['prisma'].withdraw_requests.findMany({ where, orderBy: { id: 'desc' }, take: limit, skip: offset }),
        this['prisma'].withdraw_requests.count({ where }),
    ]);
    return paginate(rows.map((r) => ({ ...bigToNumber(r), amount: Number(r.amount) })), total, limit, offset);
};
AdminService.prototype.approveWithdrawRequest = async function (id, approve) {
    if (this['useMongo']()) {
        const w = await this['mongo'].findByMysqlId('withdraw_requests', Number(id));
        if (!w)
            throw new common_1.NotFoundException({ errors: [{ code: 'withdraw_request', message: 'not found' }] });
        await this['mongo'].updateOne('withdraw_requests', { mysql_id: Number(id) }, { approved: approve, updated_at: new Date() });
        return { ok: true, id, approved: approve };
    }
    const w = await this['prisma'].withdraw_requests.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!w)
        throw new common_1.NotFoundException({ errors: [{ code: 'withdraw_request', message: 'not found' }] });
    await this['prisma'].withdraw_requests.update({ where: { id: w.id }, data: { approved: approve } });
    return { ok: true, id, approved: approve };
};
AdminService.prototype.listWithdrawalMethods = async function () {
    if (this['useMongo']()) {
        const rows = await this['mongo'].findMany('withdrawal_methods', {}, {
            sort: { mysql_id: -1 },
        });
        return {
            withdrawal_methods: rows.map((r) => ({ ...r, id: Number(r.mysql_id) })),
        };
    }
    const rows = await this['prisma'].withdrawal_methods.findMany({ orderBy: { id: 'desc' } });
    return { withdrawal_methods: rows.map((r) => bigToNumber(r)) };
};
AdminService.prototype.listOfflinePaymentMethods = async function () {
    if (this['useMongo']()) {
        const rows = await this['mongo'].findMany('offline_payment_methods', {}, {
            sort: { mysql_id: -1 },
        });
        return {
            offline_payment_methods: rows.map((r) => ({ ...r, id: Number(r.mysql_id) })),
        };
    }
    const rows = await this['prisma'].offline_payment_methods.findMany({ orderBy: { id: 'desc' } });
    return { offline_payment_methods: rows.map((r) => bigToNumber(r)) };
};
AdminService.prototype.updateOfflinePaymentMethodStatus = async function (id, status) {
    if (this['useMongo']()) {
        const m = await this['mongo'].findByMysqlId('offline_payment_methods', Number(id));
        if (!m)
            throw new common_1.NotFoundException({ errors: [{ code: 'method', message: 'not found' }] });
        await this['mongo'].updateOne('offline_payment_methods', { mysql_id: Number(id) }, { status, updated_at: new Date() });
        return { ok: true, id, status };
    }
    const m = await this['prisma'].offline_payment_methods.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!m)
        throw new common_1.NotFoundException({ errors: [{ code: 'method', message: 'not found' }] });
    await this['prisma'].offline_payment_methods.update({ where: { id: m.id }, data: { status } });
    return { ok: true, id, status };
};
AdminService.prototype.listProvideDMEarnings = async function (opts) {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    if (this['useMongo']()) {
        const [rows, total] = await Promise.all([
            this['mongo'].findMany('provide_d_m_earnings', {}, {
                limit,
                skip: offset,
                sort: { mysql_id: -1 },
            }),
            this['mongo'].count('provide_d_m_earnings'),
        ]);
        return paginate(rows.map((r) => ({
            ...r,
            id: Number(r.mysql_id),
            amount: r.amount !== undefined && r.amount !== null ? Number(r.amount) : 0,
        })), total, limit, offset);
    }
    const [rows, total] = await Promise.all([
        this['prisma'].provide_d_m_earnings.findMany({ orderBy: { id: 'desc' }, take: limit, skip: offset }),
        this['prisma'].provide_d_m_earnings.count(),
    ]);
    return paginate(rows.map((r) => ({ ...bigToNumber(r), amount: Number(r.amount) })), total, limit, offset);
};
AdminService.prototype.listContactMessages = async function (opts) {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    if (this['useMongo']()) {
        const [rows, total] = await Promise.all([
            this['mongo'].findMany('contact_messages', {}, {
                limit,
                skip: offset,
                sort: { mysql_id: -1 },
            }),
            this['mongo'].count('contact_messages'),
        ]);
        return paginate(rows.map((r) => ({ ...r, id: Number(r.mysql_id) })), total, limit, offset);
    }
    const [rows, total] = await Promise.all([
        this['prisma'].contact_messages.findMany({ orderBy: { id: 'desc' }, take: limit, skip: offset }),
        this['prisma'].contact_messages.count(),
    ]);
    return paginate(rows.map((r) => bigToNumber(r)), total, limit, offset);
};
AdminService.prototype.replyContactMessage = async function (id, reply) {
    if (!reply)
        throw new common_1.BadRequestException({ errors: [{ code: 'reply', message: 'reply required' }] });
    if (this['useMongo']()) {
        const m = await this['mongo'].findByMysqlId('contact_messages', Number(id));
        if (!m)
            throw new common_1.NotFoundException({ errors: [{ code: 'contact_message', message: 'not found' }] });
        await this['mongo'].updateOne('contact_messages', { mysql_id: Number(id) }, { reply, seen: true, replied: true, updated_at: new Date() });
        return { ok: true, id };
    }
    const m = await this['prisma'].contact_messages.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!m)
        throw new common_1.NotFoundException({ errors: [{ code: 'contact_message', message: 'not found' }] });
    await this['prisma'].contact_messages.update({ where: { id: m.id }, data: { reply, seen: true } });
    return { ok: true, id };
};
AdminService.prototype.listNotifications = async function (opts) {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    if (this['useMongo']()) {
        const [rows, total] = await Promise.all([
            this['mongo'].findMany('notifications', {}, {
                limit,
                skip: offset,
                sort: { mysql_id: -1 },
            }),
            this['mongo'].count('notifications'),
        ]);
        return paginate(rows.map((r) => ({ ...r, id: Number(r.mysql_id) })), total, limit, offset);
    }
    const [rows, total] = await Promise.all([
        this['prisma'].notifications.findMany({ orderBy: { id: 'desc' }, take: limit, skip: offset }),
        this['prisma'].notifications.count(),
    ]);
    return paginate(rows.map((r) => bigToNumber(r)), total, limit, offset);
};
AdminService.prototype.createNotification = async function (body) {
    if (!body.title)
        throw new common_1.BadRequestException({ errors: [{ code: 'title', message: 'title required' }] });
    if (this['useMongo']()) {
        const mysqlId = await this['mongo'].nextMysqlId('notifications');
        const now = new Date();
        await this['mongo'].insertOne('notifications', {
            mysql_id: mysqlId,
            title: body.title,
            description: body.description ?? null,
            tergat: body.tergat ?? null,
            zone_id: body.zone_id ? Number(body.zone_id) : null,
            created_at: now,
            updated_at: now,
        });
        return { ok: true, id: mysqlId };
    }
    const created = await this['prisma'].notifications.create({
        data: {
            title: body.title,
            description: body.description,
            tergat: body.tergat,
            zone_id: body.zone_id ? BigInt(body.zone_id) : null,
        },
    });
    return { ok: true, id: Number(created.id) };
};
AdminService.prototype.deleteNotification = async function (id) {
    if (this['useMongo']()) {
        const n = await this['mongo'].findByMysqlId('notifications', Number(id));
        if (!n)
            throw new common_1.NotFoundException({ errors: [{ code: 'notification', message: 'not found' }] });
        await this['mongo'].deleteOne('notifications', { mysql_id: Number(id) });
        return { ok: true, id };
    }
    const n = await this['prisma'].notifications.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!n)
        throw new common_1.NotFoundException({ errors: [{ code: 'notification', message: 'not found' }] });
    await this['prisma'].notifications.delete({ where: { id: n.id } });
    return { ok: true, id };
};
AdminService.prototype.listReviews = async function (opts) {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    if (this['useMongo']()) {
        const [rows, total] = await Promise.all([
            this['mongo'].findMany('reviews', {}, {
                limit,
                skip: offset,
                sort: { mysql_id: -1 },
            }),
            this['mongo'].count('reviews'),
        ]);
        return paginate(rows.map((r) => ({
            ...r,
            id: Number(r.mysql_id),
            rating: r.rating !== undefined && r.rating !== null ? Number(r.rating) : 0,
        })), total, limit, offset);
    }
    const [rows, total] = await Promise.all([
        this['prisma'].reviews.findMany({ orderBy: { id: 'desc' }, take: limit, skip: offset }),
        this['prisma'].reviews.count(),
    ]);
    return paginate(rows.map((r) => bigToNumber(r)), total, limit, offset);
};
AdminService.prototype.replyReview = async function (id, reply) {
    if (this['useMongo']()) {
        const r = await this['mongo'].findByMysqlId('reviews', Number(id));
        if (!r)
            throw new common_1.NotFoundException({ errors: [{ code: 'review', message: 'not found' }] });
        await this['mongo'].updateOne('reviews', { mysql_id: Number(id) }, { reply, reply_at: new Date(), updated_at: new Date() });
        return { ok: true, id };
    }
    const r = await this['prisma'].reviews.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!r)
        throw new common_1.NotFoundException({ errors: [{ code: 'review', message: 'not found' }] });
    await this['prisma'].reviews.update({ where: { id: r.id }, data: { reply, reply_at: new Date() } });
    return { ok: true, id };
};
AdminService.prototype.listDMReviews = async function (opts) {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    if (this['useMongo']()) {
        const [rows, total] = await Promise.all([
            this['mongo'].findMany('d_m_reviews', {}, {
                limit,
                skip: offset,
                sort: { mysql_id: -1 },
            }),
            this['mongo'].count('d_m_reviews'),
        ]);
        return paginate(rows.map((r) => ({
            ...r,
            id: Number(r.mysql_id),
            rating: r.rating !== undefined && r.rating !== null ? Number(r.rating) : 0,
        })), total, limit, offset);
    }
    const [rows, total] = await Promise.all([
        this['prisma'].d_m_reviews.findMany({ orderBy: { id: 'desc' }, take: limit, skip: offset }),
        this['prisma'].d_m_reviews.count(),
    ]);
    return paginate(rows.map((r) => bigToNumber(r)), total, limit, offset);
};
AdminService.prototype.listFAQs = async function () {
    if (this['useMongo']()) {
        const rows = await this['mongo'].findMany('f_a_q_s', {}, {
            sort: { mysql_id: -1 },
        });
        return {
            faqs: rows.map((r) => ({ ...r, id: Number(r.mysql_id) })),
        };
    }
    const rows = await this['prisma'].f_a_q_s.findMany({ orderBy: { id: 'desc' } });
    return { faqs: rows.map((r) => bigToNumber(r)) };
};
AdminService.prototype.createFAQ = async function (body) {
    if (!body.question || !body.answer) {
        throw new common_1.BadRequestException({ errors: [{ code: 'body', message: 'question and answer required' }] });
    }
    if (this['useMongo']()) {
        const mysqlId = await this['mongo'].nextMysqlId('f_a_q_s');
        const now = new Date();
        await this['mongo'].insertOne('f_a_q_s', {
            mysql_id: mysqlId,
            question: body.question,
            answer: body.answer,
            page_type: body.page_type ?? null,
            user_type: body.user_type ?? null,
            status: true,
            created_at: now,
            updated_at: now,
        });
        return { ok: true, id: mysqlId };
    }
    const created = await this['prisma'].f_a_q_s.create({
        data: { question: body.question, answer: body.answer, page_type: body.page_type, user_type: body.user_type },
    });
    return { ok: true, id: Number(created.id) };
};
AdminService.prototype.updateFAQ = async function (id, body) {
    if (this['useMongo']()) {
        const f = await this['mongo'].findByMysqlId('f_a_q_s', Number(id));
        if (!f)
            throw new common_1.NotFoundException({ errors: [{ code: 'faq', message: 'not found' }] });
        const data = {};
        if (body.question !== undefined)
            data.question = body.question;
        if (body.answer !== undefined)
            data.answer = body.answer;
        if (body.status !== undefined)
            data.status = body.status;
        if (Object.keys(data).length === 0) {
            throw new common_1.BadRequestException({ errors: [{ code: 'body', message: 'no fields' }] });
        }
        data.updated_at = new Date();
        await this['mongo'].updateOne('f_a_q_s', { mysql_id: Number(id) }, data);
        return { ok: true, id };
    }
    const f = await this['prisma'].f_a_q_s.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!f)
        throw new common_1.NotFoundException({ errors: [{ code: 'faq', message: 'not found' }] });
    const data = {};
    if (body.question !== undefined)
        data.question = body.question;
    if (body.answer !== undefined)
        data.answer = body.answer;
    if (body.status !== undefined)
        data.status = body.status;
    if (Object.keys(data).length === 0) {
        throw new common_1.BadRequestException({ errors: [{ code: 'body', message: 'no fields' }] });
    }
    await this['prisma'].f_a_q_s.update({ where: { id: f.id }, data });
    return { ok: true, id };
};
AdminService.prototype.deleteFAQ = async function (id) {
    if (this['useMongo']()) {
        const f = await this['mongo'].findByMysqlId('f_a_q_s', Number(id));
        if (!f)
            throw new common_1.NotFoundException({ errors: [{ code: 'faq', message: 'not found' }] });
        await this['mongo'].deleteOne('f_a_q_s', { mysql_id: Number(id) });
        return { ok: true, id };
    }
    const f = await this['prisma'].f_a_q_s.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!f)
        throw new common_1.NotFoundException({ errors: [{ code: 'faq', message: 'not found' }] });
    await this['prisma'].f_a_q_s.delete({ where: { id: f.id } });
    return { ok: true, id };
};
AdminService.prototype.listPageSeo = async function () {
    if (this['useMongo']()) {
        const rows = await this['mongo'].findMany('page_seo_data', {}, {
            sort: { mysql_id: -1 },
        });
        return {
            pages: rows.map((r) => ({ ...r, id: Number(r.mysql_id) })),
        };
    }
    const rows = await this['prisma'].page_seo_data.findMany({ orderBy: { id: 'desc' } });
    return { pages: rows.map((r) => bigToNumber(r)) };
};
AdminService.prototype.upsertPageSeo = async function (body) {
    if (!body.page_name || !body.title || !body.description) {
        throw new common_1.BadRequestException({ errors: [{ code: 'body', message: 'page_name, title, description required' }] });
    }
    if (this['useMongo']()) {
        const existing = await this['mongo'].findOne('page_seo_data', { page_name: body.page_name });
        const now = new Date();
        if (existing) {
            const data = {
                title: body.title,
                description: body.description,
                updated_at: now,
            };
            if (body.status !== undefined)
                data.status = body.status;
            await this['mongo'].updateOne('page_seo_data', { mysql_id: existing.mysql_id }, data);
            return { ok: true, id: Number(existing.mysql_id) };
        }
        const mysqlId = await this['mongo'].nextMysqlId('page_seo_data');
        await this['mongo'].insertOne('page_seo_data', {
            mysql_id: mysqlId,
            page_name: body.page_name,
            title: body.title,
            description: body.description,
            status: body.status ?? true,
            created_at: now,
            updated_at: now,
        });
        return { ok: true, id: mysqlId };
    }
    const row = await this['prisma'].page_seo_data.upsert({
        where: { page_name: body.page_name },
        create: {
            page_name: body.page_name,
            title: body.title,
            description: body.description,
            status: body.status ?? true,
        },
        update: {
            title: body.title,
            description: body.description,
            status: body.status ?? undefined,
        },
    });
    return { ok: true, id: Number(row.id) };
};
AdminService.prototype.listSocialMedia = async function () {
    if (this['useMongo']()) {
        const rows = await this['mongo'].findMany('social_media', {}, {
            sort: { mysql_id: -1 },
        });
        return {
            social_media: rows.map((r) => ({ ...r, id: Number(r.mysql_id) })),
        };
    }
    const rows = await this['prisma'].social_media.findMany({ orderBy: { id: 'desc' } });
    return { social_media: rows.map((r) => bigToNumber(r)) };
};
AdminService.prototype.createSocialMedia = async function (body) {
    if (!body.name || !body.link)
        throw new common_1.BadRequestException({ errors: [{ code: 'body', message: 'name and link required' }] });
    if (this['useMongo']()) {
        const mysqlId = await this['mongo'].nextMysqlId('social_media');
        const now = new Date();
        await this['mongo'].insertOne('social_media', {
            mysql_id: mysqlId,
            name: body.name,
            link: body.link,
            status: true,
            created_at: now,
            updated_at: now,
        });
        return { ok: true, id: mysqlId };
    }
    const created = await this['prisma'].social_media.create({ data: { name: body.name, link: body.link } });
    return { ok: true, id: Number(created.id) };
};
AdminService.prototype.updateSocialMediaStatus = async function (id, status) {
    if (this['useMongo']()) {
        const s = await this['mongo'].findByMysqlId('social_media', Number(id));
        if (!s)
            throw new common_1.NotFoundException({ errors: [{ code: 'social_media', message: 'not found' }] });
        await this['mongo'].updateOne('social_media', { mysql_id: Number(id) }, { status, updated_at: new Date() });
        return { ok: true, id, status };
    }
    const s = await this['prisma'].social_media.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!s)
        throw new common_1.NotFoundException({ errors: [{ code: 'social_media', message: 'not found' }] });
    await this['prisma'].social_media.update({ where: { id: s.id }, data: { status } });
    return { ok: true, id, status };
};
AdminService.prototype.deleteSocialMedia = async function (id) {
    if (this['useMongo']()) {
        const s = await this['mongo'].findByMysqlId('social_media', Number(id));
        if (!s)
            throw new common_1.NotFoundException({ errors: [{ code: 'social_media', message: 'not found' }] });
        await this['mongo'].deleteOne('social_media', { mysql_id: Number(id) });
        return { ok: true, id };
    }
    const s = await this['prisma'].social_media.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!s)
        throw new common_1.NotFoundException({ errors: [{ code: 'social_media', message: 'not found' }] });
    await this['prisma'].social_media.delete({ where: { id: s.id } });
    return { ok: true, id };
};
AdminService.prototype.listEmployees = async function (opts) {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    if (this['useMongo']()) {
        const filter = opts.q
            ? {
                $or: [
                    { f_name: { $regex: opts.q, $options: 'i' } },
                    { email: { $regex: opts.q, $options: 'i' } },
                ],
            }
            : { role_id: { $ne: 1 } };
        const [rows, total] = await Promise.all([
            this['mongo'].findMany('admins', filter, {
                limit,
                skip: offset,
                sort: { mysql_id: -1 },
                projection: {
                    mysql_id: 1,
                    f_name: 1,
                    l_name: 1,
                    email: 1,
                    phone: 1,
                    image: 1,
                    role_id: 1,
                    zone_id: 1,
                    created_at: 1,
                },
            }),
            this['mongo'].count('admins', filter),
        ]);
        return paginate(rows.map((r) => ({
            id: Number(r.mysql_id),
            f_name: r.f_name ?? null,
            l_name: r.l_name ?? null,
            email: r.email ?? null,
            phone: r.phone ?? null,
            image: r.image ?? null,
            role_id: r.role_id !== undefined && r.role_id !== null ? Number(r.role_id) : null,
            zone_id: r.zone_id !== undefined && r.zone_id !== null ? Number(r.zone_id) : null,
            created_at: r.created_at ?? null,
        })), total, limit, offset);
    }
    const where = opts.q
        ? { OR: [{ f_name: { contains: opts.q } }, { email: { contains: opts.q } }] }
        : { role_id: { not: 1n } };
    const [rows, total] = await Promise.all([
        this['prisma'].admins.findMany({
            where,
            orderBy: { id: 'desc' },
            take: limit,
            skip: offset,
            select: {
                id: true,
                f_name: true,
                l_name: true,
                email: true,
                phone: true,
                image: true,
                role_id: true,
                zone_id: true,
                created_at: true,
            },
        }),
        this['prisma'].admins.count({ where }),
    ]);
    return paginate(rows.map((r) => ({ ...r, id: Number(r.id), role_id: Number(r.role_id), zone_id: r.zone_id ? Number(r.zone_id) : null })), total, limit, offset);
};
AdminService.prototype.listAdminRoles = async function () {
    if (this['useMongo']()) {
        const rows = await this['mongo'].findMany('admin_roles', {}, {
            sort: { mysql_id: -1 },
        });
        return {
            roles: rows.map((r) => ({ ...r, id: Number(r.mysql_id) })),
        };
    }
    const rows = await this['prisma'].admin_roles.findMany({ orderBy: { id: 'desc' } });
    return { roles: rows.map((r) => bigToNumber(r)) };
};
AdminService.prototype.createAdminRole = async function (body) {
    if (!body.name)
        throw new common_1.BadRequestException({ errors: [{ code: 'name', message: 'name required' }] });
    if (this['useMongo']()) {
        const mysqlId = await this['mongo'].nextMysqlId('admin_roles');
        const now = new Date();
        await this['mongo'].insertOne('admin_roles', {
            mysql_id: mysqlId,
            name: body.name,
            modules: body.modules ?? null,
            status: true,
            created_at: now,
            updated_at: now,
        });
        return { ok: true, id: mysqlId };
    }
    const created = await this['prisma'].admin_roles.create({ data: { name: body.name, modules: body.modules ?? null } });
    return { ok: true, id: Number(created.id) };
};
AdminService.prototype.deleteAdminRole = async function (id) {
    if (this['useMongo']()) {
        const r = await this['mongo'].findByMysqlId('admin_roles', Number(id));
        if (!r)
            throw new common_1.NotFoundException({ errors: [{ code: 'role', message: 'not found' }] });
        await this['mongo'].deleteOne('admin_roles', { mysql_id: Number(id) });
        return { ok: true, id };
    }
    const r = await this['prisma'].admin_roles.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!r)
        throw new common_1.NotFoundException({ errors: [{ code: 'role', message: 'not found' }] });
    await this['prisma'].admin_roles.delete({ where: { id: r.id } });
    return { ok: true, id };
};
AdminService.prototype.listSubscriptionPackages = async function () {
    if (this['useMongo']()) {
        const rows = await this['mongo'].findMany('subscription_packages', {}, { sort: { mysql_id: -1 } });
        return { packages: rows.map((r) => ({ ...r, id: Number(r.mysql_id), price: r.price !== undefined && r.price !== null ? Number(r.price) : 0 })) };
    }
    const rows = await this['prisma'].subscription_packages.findMany({ orderBy: { id: 'desc' } });
    return { packages: rows.map((r) => bigToNumber(r)) };
};
AdminService.prototype.createSubscriptionPackage = async function (body) {
    if (!body.package_name || typeof body.price !== 'number' || typeof body.validity !== 'number') {
        throw new common_1.BadRequestException({ errors: [{ code: 'body', message: 'package_name, price, validity required' }] });
    }
    if (this['useMongo']()) {
        const mysqlId = await this['mongo'].nextMysqlId('subscription_packages');
        await this['mongo'].insertOne('subscription_packages', {
            mysql_id: mysqlId,
            package_name: body.package_name,
            price: body.price,
            validity: body.validity,
            max_order: body.max_order ?? 'unlimited',
            max_product: body.max_product ?? 'unlimited',
            status: true,
            created_at: new Date(),
            updated_at: new Date(),
        });
        return { ok: true, id: mysqlId };
    }
    const created = await this['prisma'].subscription_packages.create({
        data: {
            package_name: body.package_name,
            price: body.price,
            validity: body.validity,
            max_order: body.max_order ?? 'unlimited',
            max_product: body.max_product ?? 'unlimited',
        },
    });
    return { ok: true, id: Number(created.id) };
};
AdminService.prototype.updateSubscriptionPackageStatus = async function (id, status) {
    if (this['useMongo']()) {
        const p = await this['mongo'].findByMysqlId('subscription_packages', id);
        if (!p)
            throw new common_1.NotFoundException({ errors: [{ code: 'package', message: 'not found' }] });
        await this['mongo'].updateOne('subscription_packages', { mysql_id: Number(id) }, { status, updated_at: new Date() });
        return { ok: true, id, status };
    }
    const p = await this['prisma'].subscription_packages.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!p)
        throw new common_1.NotFoundException({ errors: [{ code: 'package', message: 'not found' }] });
    await this['prisma'].subscription_packages.update({ where: { id: p.id }, data: { status } });
    return { ok: true, id, status };
};
AdminService.prototype.deleteSubscriptionPackage = async function (id) {
    if (this['useMongo']()) {
        const p = await this['mongo'].findByMysqlId('subscription_packages', id);
        if (!p)
            throw new common_1.NotFoundException({ errors: [{ code: 'package', message: 'not found' }] });
        await this['mongo'].deleteOne('subscription_packages', { mysql_id: Number(id) });
        return { ok: true, id };
    }
    const p = await this['prisma'].subscription_packages.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!p)
        throw new common_1.NotFoundException({ errors: [{ code: 'package', message: 'not found' }] });
    await this['prisma'].subscription_packages.delete({ where: { id: p.id } });
    return { ok: true, id };
};
AdminService.prototype.listShifts = async function () {
    if (this['useMongo']()) {
        const rows = await this['mongo'].findMany('shifts', {}, { sort: { mysql_id: -1 } });
        return { shifts: rows.map((r) => ({ ...r, id: Number(r.mysql_id) })) };
    }
    const rows = await this['prisma'].shifts.findMany({ orderBy: { id: 'desc' } });
    return { shifts: rows.map((r) => bigToNumber(r)) };
};
AdminService.prototype.createShift = async function (body) {
    if (!body.name)
        throw new common_1.BadRequestException({ errors: [{ code: 'name', message: 'name required' }] });
    const baseDate = '1970-01-01T';
    if (this['useMongo']()) {
        const mysqlId = await this['mongo'].nextMysqlId('shifts');
        await this['mongo'].insertOne('shifts', {
            mysql_id: mysqlId,
            name: body.name,
            start_time: body.start_time ? new Date(`${baseDate}${body.start_time}Z`) : null,
            end_time: body.end_time ? new Date(`${baseDate}${body.end_time}Z`) : null,
            is_full_day: body.is_full_day ?? false,
            status: true,
            created_at: new Date(),
            updated_at: new Date(),
        });
        return { ok: true, id: mysqlId };
    }
    const created = await this['prisma'].shifts.create({
        data: {
            name: body.name,
            start_time: body.start_time ? new Date(`${baseDate}${body.start_time}Z`) : null,
            end_time: body.end_time ? new Date(`${baseDate}${body.end_time}Z`) : null,
            is_full_day: body.is_full_day ?? false,
        },
    });
    return { ok: true, id: Number(created.id) };
};
AdminService.prototype.updateShiftStatus = async function (id, status) {
    if (this['useMongo']()) {
        const s = await this['mongo'].findByMysqlId('shifts', id);
        if (!s)
            throw new common_1.NotFoundException({ errors: [{ code: 'shift', message: 'not found' }] });
        await this['mongo'].updateOne('shifts', { mysql_id: Number(id) }, { status, updated_at: new Date() });
        return { ok: true, id, status };
    }
    const s = await this['prisma'].shifts.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!s)
        throw new common_1.NotFoundException({ errors: [{ code: 'shift', message: 'not found' }] });
    await this['prisma'].shifts.update({ where: { id: s.id }, data: { status } });
    return { ok: true, id, status };
};
AdminService.prototype.deleteShift = async function (id) {
    if (this['useMongo']()) {
        const s = await this['mongo'].findByMysqlId('shifts', id);
        if (!s)
            throw new common_1.NotFoundException({ errors: [{ code: 'shift', message: 'not found' }] });
        await this['mongo'].deleteOne('shifts', { mysql_id: Number(id) });
        return { ok: true, id };
    }
    const s = await this['prisma'].shifts.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!s)
        throw new common_1.NotFoundException({ errors: [{ code: 'shift', message: 'not found' }] });
    await this['prisma'].shifts.delete({ where: { id: s.id } });
    return { ok: true, id };
};
AdminService.prototype.listVehicles = async function () {
    if (this['useMongo']()) {
        const rows = await this['mongo'].findMany('vehicles', {}, { sort: { mysql_id: -1 } });
        return { vehicles: rows.map((r) => ({ ...r, id: Number(r.mysql_id) })) };
    }
    const rows = await this['prisma'].vehicles.findMany({ orderBy: { id: 'desc' } });
    return { vehicles: rows.map((r) => bigToNumber(r)) };
};
AdminService.prototype.createVehicle = async function (body) {
    if (!body.type ||
        typeof body.starting_coverage_area !== 'number' ||
        typeof body.maximum_coverage_area !== 'number' ||
        typeof body.extra_charges !== 'number') {
        throw new common_1.BadRequestException({ errors: [{ code: 'body', message: 'type/coverage/extra_charges required' }] });
    }
    if (this['useMongo']()) {
        const mysqlId = await this['mongo'].nextMysqlId('vehicles');
        await this['mongo'].insertOne('vehicles', {
            mysql_id: mysqlId,
            type: body.type,
            starting_coverage_area: body.starting_coverage_area,
            maximum_coverage_area: body.maximum_coverage_area,
            extra_charges: body.extra_charges,
            status: true,
            created_at: new Date(),
            updated_at: new Date(),
        });
        return { ok: true, id: mysqlId };
    }
    const created = await this['prisma'].vehicles.create({
        data: {
            type: body.type,
            starting_coverage_area: body.starting_coverage_area,
            maximum_coverage_area: body.maximum_coverage_area,
            extra_charges: body.extra_charges,
        },
    });
    return { ok: true, id: Number(created.id) };
};
AdminService.prototype.updateVehicleStatus = async function (id, status) {
    if (this['useMongo']()) {
        const v = await this['mongo'].findByMysqlId('vehicles', id);
        if (!v)
            throw new common_1.NotFoundException({ errors: [{ code: 'vehicle', message: 'not found' }] });
        await this['mongo'].updateOne('vehicles', { mysql_id: Number(id) }, { status, updated_at: new Date() });
        return { ok: true, id, status };
    }
    const v = await this['prisma'].vehicles.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!v)
        throw new common_1.NotFoundException({ errors: [{ code: 'vehicle', message: 'not found' }] });
    await this['prisma'].vehicles.update({ where: { id: v.id }, data: { status } });
    return { ok: true, id, status };
};
AdminService.prototype.deleteVehicle = async function (id) {
    if (this['useMongo']()) {
        const v = await this['mongo'].findByMysqlId('vehicles', id);
        if (!v)
            throw new common_1.NotFoundException({ errors: [{ code: 'vehicle', message: 'not found' }] });
        await this['mongo'].deleteOne('vehicles', { mysql_id: Number(id) });
        return { ok: true, id };
    }
    const v = await this['prisma'].vehicles.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!v)
        throw new common_1.NotFoundException({ errors: [{ code: 'vehicle', message: 'not found' }] });
    await this['prisma'].vehicles.delete({ where: { id: v.id } });
    return { ok: true, id };
};
AdminService.prototype.listOrderCancelReasons = async function () {
    if (this['useMongo']()) {
        const rows = await this['mongo'].findMany('order_cancel_reasons', {}, {
            sort: { mysql_id: -1 },
        });
        return {
            reasons: rows.map((r) => ({ ...r, id: Number(r.mysql_id) })),
        };
    }
    const rows = await this['prisma'].order_cancel_reasons.findMany({ orderBy: { id: 'desc' } });
    return { reasons: rows.map((r) => bigToNumber(r)) };
};
AdminService.prototype.createOrderCancelReason = async function (body) {
    if (!body.reason || !body.user_type) {
        throw new common_1.BadRequestException({ errors: [{ code: 'body', message: 'reason and user_type required' }] });
    }
    if (this['useMongo']()) {
        const mysqlId = await this['mongo'].nextMysqlId('order_cancel_reasons');
        const now = new Date();
        await this['mongo'].insertOne('order_cancel_reasons', {
            mysql_id: mysqlId,
            reason: body.reason,
            user_type: body.user_type,
            status: true,
            created_at: now,
            updated_at: now,
        });
        return { ok: true, id: mysqlId };
    }
    const created = await this['prisma'].order_cancel_reasons.create({
        data: { reason: body.reason, user_type: body.user_type },
    });
    return { ok: true, id: Number(created.id) };
};
AdminService.prototype.updateOrderCancelReasonStatus = async function (id, status) {
    if (this['useMongo']()) {
        const r = await this['mongo'].findByMysqlId('order_cancel_reasons', Number(id));
        if (!r)
            throw new common_1.NotFoundException({ errors: [{ code: 'reason', message: 'not found' }] });
        await this['mongo'].updateOne('order_cancel_reasons', { mysql_id: Number(id) }, { status, updated_at: new Date() });
        return { ok: true, id, status };
    }
    const r = await this['prisma'].order_cancel_reasons.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!r)
        throw new common_1.NotFoundException({ errors: [{ code: 'reason', message: 'not found' }] });
    await this['prisma'].order_cancel_reasons.update({ where: { id: r.id }, data: { status } });
    return { ok: true, id, status };
};
AdminService.prototype.deleteOrderCancelReason = async function (id) {
    if (this['useMongo']()) {
        const r = await this['mongo'].findByMysqlId('order_cancel_reasons', Number(id));
        if (!r)
            throw new common_1.NotFoundException({ errors: [{ code: 'reason', message: 'not found' }] });
        await this['mongo'].deleteOne('order_cancel_reasons', { mysql_id: Number(id) });
        return { ok: true, id };
    }
    const r = await this['prisma'].order_cancel_reasons.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!r)
        throw new common_1.NotFoundException({ errors: [{ code: 'reason', message: 'not found' }] });
    await this['prisma'].order_cancel_reasons.delete({ where: { id: r.id } });
    return { ok: true, id };
};
AdminService.prototype.listRefundReasons = async function () {
    if (this['useMongo']()) {
        const rows = await this['mongo'].findMany('refund_reasons', {}, {
            sort: { mysql_id: -1 },
        });
        return {
            reasons: rows.map((r) => ({ ...r, id: Number(r.mysql_id) })),
        };
    }
    const rows = await this['prisma'].refund_reasons.findMany({ orderBy: { id: 'desc' } });
    return { reasons: rows.map((r) => bigToNumber(r)) };
};
AdminService.prototype.createRefundReason = async function (body) {
    if (!body.reason)
        throw new common_1.BadRequestException({ errors: [{ code: 'reason', message: 'reason required' }] });
    if (this['useMongo']()) {
        const mysqlId = await this['mongo'].nextMysqlId('refund_reasons');
        const now = new Date();
        await this['mongo'].insertOne('refund_reasons', {
            mysql_id: mysqlId,
            reason: body.reason,
            status: true,
            created_at: now,
            updated_at: now,
        });
        return { ok: true, id: mysqlId };
    }
    const created = await this['prisma'].refund_reasons.create({ data: { reason: body.reason } });
    return { ok: true, id: Number(created.id) };
};
AdminService.prototype.deleteRefundReason = async function (id) {
    if (this['useMongo']()) {
        const r = await this['mongo'].findByMysqlId('refund_reasons', Number(id));
        if (!r)
            throw new common_1.NotFoundException({ errors: [{ code: 'refund_reason', message: 'not found' }] });
        await this['mongo'].deleteOne('refund_reasons', { mysql_id: Number(id) });
        return { ok: true, id };
    }
    const r = await this['prisma'].refund_reasons.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!r)
        throw new common_1.NotFoundException({ errors: [{ code: 'refund_reason', message: 'not found' }] });
    await this['prisma'].refund_reasons.delete({ where: { id: r.id } });
    return { ok: true, id };
};
AdminService.prototype.listRefunds = async function (opts) {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    if (this['useMongo']()) {
        const [rows, total] = await Promise.all([
            this['mongo'].findMany('refunds', {}, {
                limit,
                skip: offset,
                sort: { mysql_id: -1 },
            }),
            this['mongo'].count('refunds'),
        ]);
        return paginate(rows.map((r) => ({
            ...r,
            id: Number(r.mysql_id),
            refund_amount: r.refund_amount !== undefined && r.refund_amount !== null ? Number(r.refund_amount) : 0,
        })), total, limit, offset);
    }
    const [rows, total] = await Promise.all([
        this['prisma'].refunds.findMany({ orderBy: { id: 'desc' }, take: limit, skip: offset }),
        this['prisma'].refunds.count(),
    ]);
    return paginate(rows.map((r) => ({ ...bigToNumber(r), refund_amount: Number(r.refund_amount) })), total, limit, offset);
};
AdminService.prototype.updateRefundStatus = async function (id, status, admin_note) {
    if (this['useMongo']()) {
        const r = await this['mongo'].findByMysqlId('refunds', Number(id));
        if (!r)
            throw new common_1.NotFoundException({ errors: [{ code: 'refund', message: 'not found' }] });
        const data = { refund_status: status, updated_at: new Date() };
        if (admin_note !== undefined)
            data.admin_note = admin_note;
        await this['mongo'].updateOne('refunds', { mysql_id: Number(id) }, data);
        return { ok: true, id, status };
    }
    const r = await this['prisma'].refunds.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
    if (!r)
        throw new common_1.NotFoundException({ errors: [{ code: 'refund', message: 'not found' }] });
    await this['prisma'].refunds.update({
        where: { id: r.id },
        data: { refund_status: status, admin_note: admin_note ?? undefined },
    });
    return { ok: true, id, status };
};
AdminService.prototype.listCurrencies = async function () {
    if (this['useMongo']()) {
        const rows = await this['mongo'].findMany('currencies', {}, { sort: { mysql_id: 1 } });
        return {
            currencies: rows.map((r) => ({
                ...r,
                id: Number(r.mysql_id),
                exchange_rate: r.exchange_rate !== undefined && r.exchange_rate !== null ? Number(r.exchange_rate) : null,
            })),
        };
    }
    const rows = await this['prisma'].currencies.findMany({ orderBy: { id: 'asc' } });
    return {
        currencies: rows.map((r) => ({ ...bigToNumber(r), exchange_rate: r.exchange_rate ? Number(r.exchange_rate) : null })),
    };
};
AdminService.prototype.listTags = async function () {
    if (this['useMongo']()) {
        const rows = await this['mongo'].findMany('tags', {}, { limit: 200, sort: { mysql_id: -1 } });
        return { tags: rows.map((r) => ({ ...r, id: Number(r.mysql_id) })) };
    }
    const rows = await this['prisma'].tags.findMany({ orderBy: { id: 'desc' }, take: 200 });
    return { tags: rows.map((r) => bigToNumber(r)) };
};
AdminService.prototype.listTranslations = async function (opts) {
    const limit = opts.limit ?? 200;
    const offset = opts.offset ?? 0;
    if (this['useMongo']()) {
        const [mrows, mtotal] = await Promise.all([
            this['mongo'].findMany('translations', {}, { limit, skip: offset, sort: { mysql_id: -1 } }),
            this['mongo'].count('translations'),
        ]);
        return paginate(mrows.map((r) => ({ ...r, id: Number(r.mysql_id) })), mtotal, limit, offset);
    }
    const [rows, total] = await Promise.all([
        this['prisma'].translations.findMany({ orderBy: { id: 'desc' }, take: limit, skip: offset }),
        this['prisma'].translations.count(),
    ]);
    return paginate(rows.map((r) => bigToNumber(r)), total, limit, offset);
};
AdminService.prototype.adminEarningReport = async function (days) {
    if (this['useMongo']()) {
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const rows = await this['mongo'].aggregate('orders', [
            {
                $match: {
                    order_status: 'delivered',
                    payment_status: 'paid',
                    delivered: { $gte: cutoff },
                },
            },
            {
                $group: {
                    _id: '$mysql_restaurant_id',
                    gross: { $sum: '$order_amount' },
                    tax: { $sum: '$total_tax_amount' },
                    delivery: { $sum: '$delivery_charge' },
                    orders: { $sum: 1 },
                },
            },
            {
                $lookup: {
                    from: 'restaurants',
                    localField: '_id',
                    foreignField: 'mysql_id',
                    as: 'restaurant',
                },
            },
            { $unwind: { path: '$restaurant', preserveNullAndEmptyArrays: true } },
        ]);
        let gross = 0;
        let tax = 0;
        let deliveryCharges = 0;
        let adminCommission = 0;
        let deliveredOrders = 0;
        for (const r of rows) {
            const g = Number(r.gross ?? 0);
            gross += g;
            tax += Number(r.tax ?? 0);
            deliveryCharges += Number(r.delivery ?? 0);
            deliveredOrders += Number(r.orders ?? 0);
            const comm = r.restaurant && r.restaurant.comission !== null && r.restaurant.comission !== undefined
                ? Number(r.restaurant.comission)
                : 0;
            adminCommission += g * (comm / 100);
        }
        return {
            days,
            delivered_orders: deliveredOrders,
            gross_sales: gross,
            total_tax: tax,
            total_delivery_charges: deliveryCharges,
            admin_commission: adminCommission,
            restaurant_take: gross - adminCommission,
        };
    }
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const orders = await this['prisma'].orders.findMany({
        where: { created_at: { gte: since }, order_status: 'delivered', payment_status: 'paid' },
        select: { order_amount: true, restaurant_id: true, total_tax_amount: true, delivery_charge: true },
    });
    const restaurantIds = Array.from(new Set(orders.map((o) => o.restaurant_id)));
    const restaurants = restaurantIds.length
        ? await this['prisma'].restaurants.findMany({
            where: { id: { in: restaurantIds } },
            select: { id: true, comission: true },
        })
        : [];
    const commByRestaurant = new Map(restaurants.map((r) => [String(r.id), r.comission !== null ? Number(r.comission) : 0]));
    let gross = 0;
    let tax = 0;
    let deliveryCharges = 0;
    let adminCommission = 0;
    for (const o of orders) {
        const amt = Number(o.order_amount);
        gross += amt;
        tax += Number(o.total_tax_amount);
        deliveryCharges += Number(o.delivery_charge);
        const comm = commByRestaurant.get(String(o.restaurant_id)) ?? 0;
        adminCommission += amt * (comm / 100);
    }
    return {
        days,
        delivered_orders: orders.length,
        gross_sales: gross,
        total_tax: tax,
        total_delivery_charges: deliveryCharges,
        admin_commission: adminCommission,
        restaurant_take: gross - adminCommission,
    };
};
AdminService.prototype.customerReport = async function (limit) {
    if (this['useMongo']()) {
        const rows = await this['mongo'].aggregate('orders', [
            { $match: { payment_status: 'paid', mysql_user_id: { $ne: null } } },
            {
                $group: {
                    _id: '$mysql_user_id',
                    orders: { $sum: 1 },
                    total_spend: { $sum: '$order_amount' },
                },
            },
            { $sort: { total_spend: -1 } },
            { $limit: limit },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: 'mysql_id',
                    as: 'user',
                },
            },
            { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        ]);
        return {
            top_customers: rows.map((g) => ({
                user_id: g._id !== null && g._id !== undefined ? Number(g._id) : null,
                name: g.user ? `${g.user.f_name ?? ''} ${g.user.l_name ?? ''}`.trim() : null,
                email: g.user?.email ?? null,
                phone: g.user?.phone ?? null,
                orders: Number(g.orders ?? 0),
                total_spend: Number(g.total_spend ?? 0),
            })),
        };
    }
    const groups = await this['prisma'].orders.groupBy({
        by: ['user_id'],
        where: { user_id: { not: null } },
        _count: { _all: true },
        _sum: { order_amount: true },
        orderBy: { _sum: { order_amount: 'desc' } },
        take: limit,
    });
    const userIds = groups.map((g) => g.user_id).filter((u) => u !== null);
    const users = userIds.length
        ? await this['prisma'].users.findMany({
            where: { id: { in: userIds } },
            select: { id: true, f_name: true, l_name: true, email: true, phone: true },
        })
        : [];
    const map = new Map(users.map((u) => [String(u.id), u]));
    return {
        top_customers: groups.map((g) => {
            const u = g.user_id ? map.get(String(g.user_id)) : null;
            return {
                user_id: g.user_id ? Number(g.user_id) : null,
                name: u ? `${u.f_name ?? ''} ${u.l_name ?? ''}`.trim() : null,
                email: u?.email ?? null,
                phone: u?.phone ?? null,
                orders: g._count._all,
                total_spend: Number(g._sum.order_amount ?? 0),
            };
        }),
    };
};
AdminService.prototype.deliverymanEarningReport = async function (limit) {
    if (this['useMongo']()) {
        const rows = await this['mongo'].aggregate('orders', [
            { $match: { order_status: 'delivered', mysql_delivery_man_id: { $ne: null } } },
            {
                $group: {
                    _id: '$mysql_delivery_man_id',
                    deliveries: { $sum: 1 },
                    total_tips: { $sum: '$dm_tips' },
                    total_delivery_charges: { $sum: '$delivery_charge' },
                },
            },
            { $sort: { deliveries: -1 } },
            { $limit: limit },
            {
                $lookup: {
                    from: 'delivery_men',
                    localField: '_id',
                    foreignField: 'mysql_id',
                    as: 'dm',
                },
            },
            { $unwind: { path: '$dm', preserveNullAndEmptyArrays: true } },
        ]);
        return {
            top_delivery_men: rows.map((g) => ({
                delivery_man_id: g._id !== null && g._id !== undefined ? Number(g._id) : null,
                name: g.dm ? `${g.dm.f_name ?? ''} ${g.dm.l_name ?? ''}`.trim() : null,
                phone: g.dm?.phone ?? null,
                zone_id: g.dm && g.dm.mysql_zone_id !== null && g.dm.mysql_zone_id !== undefined
                    ? Number(g.dm.mysql_zone_id)
                    : null,
                deliveries: Number(g.deliveries ?? 0),
                total_tips: Number(g.total_tips ?? 0),
                total_delivery_charges: Number(g.total_delivery_charges ?? 0),
            })),
        };
    }
    const groups = await this['prisma'].orders.groupBy({
        by: ['delivery_man_id'],
        where: { delivery_man_id: { not: null }, order_status: 'delivered' },
        _count: { _all: true },
        _sum: { dm_tips: true, delivery_charge: true },
        orderBy: { _count: { delivery_man_id: 'desc' } },
        take: limit,
    });
    const dmIds = groups.map((g) => g.delivery_man_id).filter((d) => d !== null);
    const dms = dmIds.length
        ? await this['prisma'].delivery_men.findMany({
            where: { id: { in: dmIds } },
            select: { id: true, f_name: true, l_name: true, phone: true, zone_id: true },
        })
        : [];
    const map = new Map(dms.map((d) => [String(d.id), d]));
    return {
        top_delivery_men: groups.map((g) => {
            const d = g.delivery_man_id ? map.get(String(g.delivery_man_id)) : null;
            return {
                delivery_man_id: g.delivery_man_id ? Number(g.delivery_man_id) : null,
                name: d ? `${d.f_name ?? ''} ${d.l_name ?? ''}`.trim() : null,
                phone: d?.phone ?? null,
                zone_id: d?.zone_id ? Number(d.zone_id) : null,
                deliveries: g._count._all,
                total_tips: Number(g._sum.dm_tips ?? 0),
                total_delivery_charges: Number(g._sum.delivery_charge ?? 0),
            };
        }),
    };
};
function parseJsonField(s) {
    if (!s)
        return null;
    try {
        return JSON.parse(s);
    }
    catch {
        return s;
    }
}
//# sourceMappingURL=admin.service.js.map