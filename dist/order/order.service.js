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
exports.OrderService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const mongo_data_service_1 = require("../mongo/mongo-data.service");
let OrderService = class OrderService {
    prisma;
    mongo;
    constructor(prisma, mongo) {
        this.prisma = prisma;
        this.mongo = mongo;
    }
    useMongo() {
        const v = (process.env.USE_MONGO_ORDER ?? '1').toLowerCase();
        return v === '1' || v === 'true' || v === 'yes';
    }
    async placeOrder(userId, body) {
        if (!body.cart || body.cart.length === 0) {
            throw new common_1.BadRequestException({ errors: [{ code: 'cart', message: 'cart_is_empty' }] });
        }
        if (!body.restaurant_id) {
            throw new common_1.BadRequestException({ errors: [{ code: 'restaurant_id', message: 'required' }] });
        }
        const paymentMethod = body.payment_method ?? 'cash_on_delivery';
        if (paymentMethod !== 'cash_on_delivery') {
            throw new common_1.BadRequestException({
                errors: [{ code: 'payment_method', message: 'Only COD supported in demo backend' }],
            });
        }
        if (this.useMongo()) {
            const restaurant = await this.mongo.findByMysqlId('restaurants', body.restaurant_id);
            if (!restaurant) {
                throw new common_1.NotFoundException({ errors: [{ code: 'restaurant_id', message: 'not_found' }] });
            }
            const itemIds = body.cart.map((c) => Number(c.item_id ?? 0));
            const foods = await this.mongo.findMany('foods', { mysql_id: { $in: itemIds } });
            const foodById = new Map(foods.map((f) => [Number(f.mysql_id), f]));
            let orderAmount = 0;
            let totalTax = 0;
            for (const c of body.cart) {
                const f = foodById.get(Number(c.item_id ?? 0));
                if (!f)
                    continue;
                const qty = c.quantity ?? 1;
                const price = c.price ?? Number(f.price ?? 0);
                const lineTotal = price * qty;
                const taxRate = Number(f.tax ?? 0) / 100;
                const lineTax = f.tax_type === 'percent' ? lineTotal * taxRate : Number(f.tax ?? 0) * qty;
                orderAmount += lineTotal;
                totalTax += lineTax;
            }
            const deliveryCharge = body.order_type === 'take_away' ? 0 : Number(restaurant.minimum_shipping_charge ?? 0);
            const finalAmount = Math.round((orderAmount + totalTax + deliveryCharge) * 100) / 100;
            const otp = String(Math.floor(1000 + Math.random() * 9000));
            const now = new Date();
            const orderMysqlId = await this.mongo.nextMysqlId('orders');
            const items = [];
            for (const c of body.cart) {
                const f = foodById.get(Number(c.item_id ?? 0));
                if (!f)
                    continue;
                const qty = c.quantity ?? 1;
                const price = c.price ?? Number(f.price ?? 0);
                const taxRate = Number(f.tax ?? 0) / 100;
                const lineTax = f.tax_type === 'percent' ? price * qty * taxRate : Number(f.tax ?? 0) * qty;
                const foodDetails = { id: Number(f.mysql_id), name: f.name, price: Number(f.price ?? 0), veg: f.veg ? 1 : 0 };
                items.push({
                    food_id: Number(f.mysql_id),
                    price,
                    quantity: qty,
                    tax_amount: Math.round(lineTax * 100) / 100,
                    food_details: foodDetails,
                    variation: c.variations ?? [],
                    add_ons: [],
                    discount_on_food: 0,
                    discount_type: 'amount',
                    total_add_on_price: 0,
                    category_id: f.mysql_category_id ?? null,
                });
            }
            await this.mongo.insertOne('orders', {
                mysql_id: orderMysqlId,
                mysql_user_id: Number(userId),
                mysql_restaurant_id: Number(body.restaurant_id),
                mysql_zone_id: restaurant.mysql_zone_id,
                order_status: 'pending',
                payment_status: 'unpaid',
                payment_method: paymentMethod,
                order_type: body.order_type ?? 'delivery',
                order_amount: finalAmount,
                total_tax_amount: Math.round(totalTax * 100) / 100,
                delivery_charge: deliveryCharge,
                coupon_discount_amount: 0,
                additional_charge: 0,
                restaurant_discount_amount: 0,
                otp,
                pending: now,
                items,
                created_at_legacy: now,
            });
            for (const it of items) {
                const odMysqlId = await this.mongo.nextMysqlId('order_details');
                await this.mongo.insertOne('order_details', {
                    mysql_id: odMysqlId,
                    order_id: orderMysqlId,
                    food_id: it.food_id,
                    food_details: it.food_details,
                    price: it.price,
                    quantity: it.quantity,
                    tax_amount: it.tax_amount,
                    discount_on_food: it.discount_on_food,
                    discount_type: it.discount_type,
                    total_add_on_price: it.total_add_on_price,
                    variation: it.variation,
                    add_ons: it.add_ons,
                    category_id: it.category_id,
                    created_at: now,
                    updated_at: now,
                });
            }
            try {
                await this.mongo.updateMany('carts', { mysql_user_id: Number(userId), is_guest: false }, {});
            }
            catch {
            }
            return {
                message: 'order_placed_successfully',
                order_id: orderMysqlId,
                total_ammount: finalAmount,
            };
        }
        const restaurant = await this.prisma.restaurants.findUnique({
            where: { id: BigInt(body.restaurant_id) },
        });
        if (!restaurant) {
            throw new common_1.NotFoundException({ errors: [{ code: 'restaurant_id', message: 'not_found' }] });
        }
        const itemIds = body.cart.map((c) => BigInt(c.item_id ?? 0));
        const foods = await this.prisma.food.findMany({ where: { id: { in: itemIds } } });
        const foodById = new Map(foods.map((f) => [f.id, f]));
        let orderAmount = 0;
        let totalTax = 0;
        for (const c of body.cart) {
            const f = foodById.get(BigInt(c.item_id ?? 0));
            if (!f)
                continue;
            const qty = c.quantity ?? 1;
            const price = c.price ?? Number(f.price);
            const lineTotal = price * qty;
            const taxRate = Number(f.tax) / 100;
            const lineTax = f.tax_type === 'percent' ? lineTotal * taxRate : Number(f.tax) * qty;
            orderAmount += lineTotal;
            totalTax += lineTax;
        }
        const deliveryCharge = body.order_type === 'take_away' ? 0 : Number(restaurant.minimum_shipping_charge ?? 0);
        const finalAmount = Math.round((orderAmount + totalTax + deliveryCharge) * 100) / 100;
        const otp = String(Math.floor(1000 + Math.random() * 9000));
        const order = await this.prisma.orders.create({
            data: {
                user_id: userId,
                order_amount: finalAmount,
                total_tax_amount: Math.round(totalTax * 100) / 100,
                payment_method: paymentMethod,
                payment_status: 'unpaid',
                order_status: 'pending',
                delivery_address_id: body.delivery_address_id ? BigInt(body.delivery_address_id) : null,
                order_type: body.order_type ?? 'delivery',
                restaurant_id: BigInt(body.restaurant_id),
                delivery_charge: deliveryCharge,
                otp,
                pending: new Date(),
                order_note: body.order_note,
                coupon_code: body.coupon_code,
                schedule_at: body.schedule_at ? new Date(body.schedule_at) : null,
                restaurant_discount_amount: 0,
                delivery_address: body.address,
                zone_id: restaurant.zone_id,
                distance: body.distance,
            },
        });
        for (const c of body.cart) {
            const f = foodById.get(BigInt(c.item_id ?? 0));
            if (!f)
                continue;
            const qty = c.quantity ?? 1;
            const price = c.price ?? Number(f.price);
            const taxRate = Number(f.tax) / 100;
            const lineTax = f.tax_type === 'percent' ? price * qty * taxRate : Number(f.tax) * qty;
            await this.prisma.order_details.create({
                data: {
                    food_id: f.id,
                    order_id: order.id,
                    price,
                    quantity: qty,
                    tax_amount: Math.round(lineTax * 100) / 100,
                    food_details: JSON.stringify({ id: Number(f.id), name: f.name, price: Number(f.price), veg: f.veg ? 1 : 0 }),
                    variation: JSON.stringify(c.variations ?? []),
                    add_ons: JSON.stringify([]),
                    discount_on_food: 0,
                    discount_type: 'amount',
                    total_add_on_price: 0,
                    category_id: f.category_id ? Number(f.category_id) : null,
                },
            });
        }
        await this.prisma.carts.deleteMany({ where: { user_id: userId, is_guest: false } });
        return {
            message: 'order_placed_successfully',
            order_id: Number(order.id),
            total_ammount: finalAmount,
        };
    }
    async trackOrder(orderId) {
        if (this.useMongo()) {
            const o = await this.mongo.findByMysqlId('orders', orderId);
            if (!o)
                throw new common_1.NotFoundException({ errors: [{ code: 'order_id', message: 'not_found' }] });
            const [restaurant, customer, deliveryMan] = await Promise.all([
                o.mysql_restaurant_id != null
                    ? this.mongo.findByMysqlId('restaurants', Number(o.mysql_restaurant_id))
                    : Promise.resolve(null),
                o.mysql_user_id != null
                    ? this.mongo.findByMysqlId('users', Number(o.mysql_user_id))
                    : Promise.resolve(null),
                o.mysql_delivery_man_id != null
                    ? this.mongo.findByMysqlId('delivery_men', Number(o.mysql_delivery_man_id))
                    : Promise.resolve(null),
            ]);
            const restaurantPayload = restaurant ? {
                id: Number(restaurant.mysql_id),
                name: restaurant.name ?? 'Restaurant',
                phone: restaurant.phone ?? null,
                email: restaurant.email ?? null,
                address: restaurant.address ?? null,
                logo: restaurant.logo ?? 'default.png',
                latitude: restaurant.latitude != null ? String(restaurant.latitude) : null,
                longitude: restaurant.longitude != null ? String(restaurant.longitude) : null,
            } : null;
            const customerPayload = customer ? {
                id: Number(customer.mysql_id),
                f_name: customer.f_name ?? null,
                l_name: customer.l_name ?? null,
                phone: customer.phone ?? null,
                email: customer.email ?? null,
                image: customer.image ?? null,
            } : null;
            const dmPayload = deliveryMan ? {
                id: Number(deliveryMan.mysql_id),
                f_name: deliveryMan.f_name ?? null,
                l_name: deliveryMan.l_name ?? null,
                phone: deliveryMan.phone ?? null,
                image: deliveryMan.image ?? null,
            } : null;
            return {
                id: o.mysql_id,
                order_status: o.order_status,
                payment_status: o.payment_status,
                payment_method: o.payment_method,
                order_amount: Number(o.order_amount ?? 0),
                restaurant_id: o.mysql_restaurant_id ?? null,
                delivery_man_id: o.mysql_delivery_man_id ?? null,
                restaurant: restaurantPayload,
                customer: customerPayload,
                delivery_man: dmPayload,
                deliveryMan: dmPayload,
                delivery_address: o.delivery_address ?? null,
                pending: o.pending ?? null,
                accepted: o.accepted ?? null,
                confirmed: o.confirmed ?? null,
                processing: o.processing ?? null,
                handover: o.handover ?? null,
                picked_up: o.picked_up ?? null,
                delivered: o.delivered ?? null,
                otp: o.otp ?? null,
            };
        }
        const o = await this.prisma.orders.findUnique({ where: { id: BigInt(orderId) } });
        if (!o)
            throw new common_1.NotFoundException({ errors: [{ code: 'order_id', message: 'not_found' }] });
        return {
            id: o.id,
            order_status: o.order_status,
            payment_status: o.payment_status,
            payment_method: o.payment_method,
            order_amount: Number(o.order_amount),
            restaurant_id: o.restaurant_id,
            delivery_man_id: o.delivery_man_id,
            pending: o.pending,
            accepted: o.accepted,
            confirmed: o.confirmed,
            processing: o.processing,
            handover: o.handover,
            picked_up: o.picked_up,
            delivered: o.delivered,
            otp: o.otp,
        };
    }
    async customerOrderList(userId) {
        if (this.useMongo()) {
            const orders = await this.mongo.findMany('orders', { mysql_user_id: Number(userId) }, { sort: { mysql_id: -1 } });
            const orderIds = orders.map((o) => Number(o.mysql_id));
            const countRows = orderIds.length
                ? await this.mongo.aggregate('order_details', [
                    { $match: { order_id: { $in: orderIds } } },
                    { $group: { _id: '$order_id', count: { $sum: 1 } } },
                ])
                : [];
            const countMap = new Map(countRows.map((r) => [Number(r._id), r.count]));
            return {
                total_size: orders.length,
                limit: 10,
                offset: 1,
                orders: orders.map((o) => {
                    const embedded = Array.isArray(o.items) ? o.items.length : 0;
                    const count = embedded || countMap.get(Number(o.mysql_id)) || 1;
                    return {
                        id: o.mysql_id,
                        order_status: o.order_status,
                        payment_status: o.payment_status,
                        order_amount: Number(o.order_amount ?? 0),
                        payment_method: o.payment_method,
                        restaurant_id: o.mysql_restaurant_id ?? null,
                        created_at: o.created_at ?? o.created_at_legacy ?? null,
                        details_count: count,
                    };
                }),
            };
        }
        const orders = await this.prisma.orders.findMany({
            where: { user_id: userId },
            orderBy: { id: 'desc' },
        });
        return {
            total_size: orders.length,
            limit: 10,
            offset: 1,
            orders: orders.map((o) => ({
                id: o.id,
                order_status: o.order_status,
                payment_status: o.payment_status,
                order_amount: Number(o.order_amount),
                payment_method: o.payment_method,
                restaurant_id: o.restaurant_id,
                created_at: o.created_at,
            })),
        };
    }
    async cancellationReasons() {
        if (this.useMongo()) {
            const rows = await this.mongo
                .findMany('order_cancel_reasons', { status: true })
                .catch(() => []);
            return {
                reasons: rows.map((r) => ({
                    id: r.mysql_id ?? null,
                    reason: r.reason ?? null,
                    user_type: r.user_type ?? null,
                    status: r.status ?? true,
                })),
            };
        }
        const rows = await this.prisma.order_cancel_reasons.findMany({ where: { status: true } }).catch(() => []);
        return { reasons: rows };
    }
};
exports.OrderService = OrderService;
exports.OrderService = OrderService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        mongo_data_service_1.MongoDataService])
], OrderService);
//# sourceMappingURL=order.service.js.map