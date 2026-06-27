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
const storage_url_1 = require("../common/storage-url");
const fcm_service_1 = require("../notifications/fcm.service");
const user_delivery_charges_service_1 = require("../enhancements/user-delivery-charges.service");
const zone_service_1 = require("../zone/zone.service");
const additional_charge_1 = require("../common/additional-charge");
const coupon_1 = require("../common/coupon");
function haversineKm(lat1, lng1, lat2, lng2) {
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
let OrderService = class OrderService {
    prisma;
    mongo;
    fcm;
    userCharges;
    zones;
    constructor(prisma, mongo, fcm, userCharges, zones) {
        this.prisma = prisma;
        this.mongo = mongo;
        this.fcm = fcm;
        this.userCharges = userCharges;
        this.zones = zones;
    }
    async chargesApplyOnNonDelivery() {
        const doc = await this.mongo.findOne('business_settings', { key: 'charges_on_takeaway_dinein' });
        const raw = doc?.value ?? doc?.key_value;
        return raw === '1' || raw === 'true';
    }
    async foodGstOrderTypes() {
        const doc = await this.mongo.findOne('business_settings', { key: 'food_gst_order_types' });
        const raw = doc?.value ?? doc?.key_value;
        if (raw)
            return (0, additional_charge_1.sanitizeOrderTypes)(raw);
        return (await this.chargesApplyOnNonDelivery())
            ? ['take_away', 'dine_in', 'delivery']
            : ['delivery'];
    }
    async pushNewOrderToRestaurant(restaurantId, orderId) {
        try {
            const restaurant = await this.mongo.findOne('restaurants', { mysql_id: Number(restaurantId) });
            const vendorId = Number(restaurant?.mysql_vendor_id ?? 0);
            if (!vendorId)
                return;
            const vendor = await this.mongo.findOne('vendors', { mysql_id: vendorId });
            const token = vendor?.fcm_token;
            if (!token)
                return;
            await this.fcm.sendToToken(token, { title: 'New order placed', body: `You have a new order #${orderId}` }, { type: 'new_order', order_id: orderId, title: 'New order placed' });
        }
        catch {
        }
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
            if ((body.order_type ?? 'delivery') === 'delivery') {
                const dLat = Number(body.latitude);
                const dLng = Number(body.longitude);
                if (Number.isFinite(dLat) && Number.isFinite(dLng)) {
                    const { zones, geofencingActive, serviceable } = await this.zones.classifyPoint(dLat, dLng);
                    if (geofencingActive) {
                        if (!serviceable) {
                            throw new common_1.BadRequestException({ errors: [{ code: 'zone', message: 'We are not available at your location yet.' }] });
                        }
                        const zoneIds = zones.map((z) => z.id);
                        if (restaurant.mysql_zone_id != null && !zoneIds.includes(Number(restaurant.mysql_zone_id))) {
                            throw new common_1.BadRequestException({ errors: [{ code: 'zone', message: 'This restaurant does not deliver to your area.' }] });
                        }
                    }
                }
            }
            const itemIds = body.cart.map((c) => Number(c.item_id ?? 0));
            const foods = await this.mongo.findMany('foods', { mysql_id: { $in: itemIds } });
            const foodById = new Map(foods.map((f) => [Number(f.mysql_id), f]));
            for (const c of body.cart) {
                const f = foodById.get(Number(c.item_id ?? 0));
                if (!f)
                    continue;
                const stockType = String(f.stock_type ?? 'unlimited');
                if (stockType !== 'unlimited') {
                    const available = Number(f.item_stock ?? 0);
                    const wanted = Number(c.quantity ?? 1);
                    if (available <= 0) {
                        throw new common_1.BadRequestException({ errors: [{ code: 'stock', message: `${f.name ?? 'This item'} is out of stock` }] });
                    }
                    if (wanted > available) {
                        throw new common_1.BadRequestException({ errors: [{ code: 'stock', message: `Only ${available} left of ${f.name ?? 'this item'}` }] });
                    }
                }
            }
            const foodGstDoc = await this.mongo.findOne('business_settings', { key: 'food_gst_rate' });
            const adminFoodGstRate = (() => {
                const raw = foodGstDoc?.value ?? foodGstDoc?.key_value;
                const n = raw != null ? parseFloat(String(raw)) : NaN;
                return Number.isFinite(n) && n >= 0 ? n : 5;
            })();
            let orderAmount = 0;
            let totalTax = 0;
            for (const c of body.cart) {
                const f = foodById.get(Number(c.item_id ?? 0));
                if (!f)
                    continue;
                const qty = c.quantity ?? 1;
                const price = c.price ?? Number(f.price ?? 0);
                const lineTotal = price * qty;
                orderAmount += lineTotal;
                totalTax += lineTotal * (adminFoodGstRate / 100);
            }
            const couponResult = await (0, coupon_1.validateAndComputeCoupon)(this.mongo, {
                code: body.coupon_code,
                orderAmount,
                restaurantId: body.restaurant_id,
            });
            const couponDiscount = couponResult.couponDiscount;
            const couponCode = couponResult.couponCode;
            const couponAdminDiscount = couponResult.adminDiscount;
            const couponRestaurantDiscount = couponResult.restaurantDiscount;
            const couponMysqlId = couponResult.couponMysqlId;
            const couponOwner = couponResult.couponOwner;
            let deliveryCharge = 0;
            let deliveryGst = 0;
            if (body.order_type !== 'take_away' && body.order_type !== 'dine_in') {
                let distanceKm = body.distance != null && Number.isFinite(Number(body.distance)) ? Math.max(0, Number(body.distance)) : NaN;
                if (Number.isNaN(distanceKm)) {
                    const rLat = Number(restaurant.latitude), rLng = Number(restaurant.longitude);
                    const uLat = Number(body.latitude), uLng = Number(body.longitude);
                    distanceKm = [rLat, rLng, uLat, uLng].every((n) => Number.isFinite(n)) ? haversineKm(rLat, rLng, uLat, uLng) : 0;
                }
                try {
                    const dc = await this.userCharges.calculate({ distance_km: distanceKm, order_value: orderAmount, when: body.schedule_at });
                    if (dc.free_delivery) {
                        deliveryCharge = 0;
                    }
                    else if (dc.matched_slab) {
                        deliveryCharge = Number(dc.subtotal ?? 0);
                        deliveryGst = Number(dc.gst_amount ?? 0);
                    }
                    else {
                        deliveryCharge = Number(restaurant.minimum_shipping_charge ?? 0);
                    }
                }
                catch {
                    deliveryCharge = Number(restaurant.minimum_shipping_charge ?? 0);
                }
                if (!Number.isFinite(deliveryCharge))
                    deliveryCharge = Number(restaurant.minimum_shipping_charge ?? 0) || 0;
                if (!Number.isFinite(deliveryGst))
                    deliveryGst = 0;
            }
            const orderTypeName = String(body.order_type ?? 'delivery');
            const foodGstApplies = (await this.foodGstOrderTypes()).includes(orderTypeName);
            if (!foodGstApplies) {
                totalTax = 0;
            }
            const effectiveFoodGstRate = foodGstApplies ? adminFoodGstRate : 0;
            const orderFoodGst = Math.round(totalTax * 100) / 100;
            totalTax = Math.round((totalTax + deliveryGst) * 100) / 100;
            const addChargeRows = await this.mongo.findMany('additional_user_charges', {});
            const additionalCharge = (0, additional_charge_1.computeFlatAdditionalCharge)(addChargeRows, orderTypeName).amount;
            const finalAmount = Math.round((orderAmount - couponDiscount + totalTax + deliveryCharge + additionalCharge) * 100) / 100;
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
                const lineTax = Math.round(price * qty * (effectiveFoodGstRate / 100) * 100) / 100;
                const foodDetails = {
                    id: Number(f.mysql_id),
                    name: f.name,
                    price: Number(f.price ?? 0),
                    veg: f.veg ? 1 : 0,
                    gst_rate: effectiveFoodGstRate,
                    gst_amount: lineTax,
                };
                items.push({
                    food_id: Number(f.mysql_id),
                    price,
                    quantity: qty,
                    tax_amount: lineTax,
                    gst_rate: effectiveFoodGstRate,
                    food_details: foodDetails,
                    variation: c.variations ?? [],
                    add_ons: [],
                    discount_on_food: 0,
                    discount_type: 'amount',
                    total_add_on_price: 0,
                    category_id: f.mysql_category_id ?? null,
                });
            }
            if (items.length > 0) {
                const perLineSum = items.reduce((s, it) => s + Number(it.tax_amount ?? 0), 0);
                const residual = Math.round((orderFoodGst - perLineSum) * 100) / 100;
                if (residual !== 0) {
                    const target = items.reduce((a, b) => (Number(b.tax_amount) >= Number(a.tax_amount) ? b : a), items[0]);
                    target.tax_amount = Math.round((Number(target.tax_amount) + residual) * 100) / 100;
                    const fd = target.food_details;
                    if (fd)
                        fd.gst_amount = target.tax_amount;
                }
            }
            let deliveryAddress = null;
            if (body.contact_person_name || body.address || body.latitude) {
                deliveryAddress = {
                    contact_person_name: body.contact_person_name ?? null,
                    contact_person_number: body.contact_person_number ?? null,
                    address_type: body.address_type ?? 'home',
                    address: body.address ?? null,
                    road: body.road ?? null,
                    house: body.house ?? null,
                    floor: body.floor ?? null,
                    latitude: body.latitude ?? null,
                    longitude: body.longitude ?? null,
                };
            }
            else if (body.delivery_address_id != null) {
                const addr = await this.mongo.findByMysqlId('customer_addresses', Number(body.delivery_address_id));
                if (addr) {
                    deliveryAddress = {
                        contact_person_name: addr.contact_person_name ?? null,
                        contact_person_number: addr.contact_person_number ?? null,
                        address_type: addr.address_type ?? 'home',
                        address: addr.address ?? null,
                        road: addr.road ?? null,
                        house: addr.house ?? null,
                        floor: addr.floor ?? null,
                        latitude: addr.latitude ?? null,
                        longitude: addr.longitude ?? null,
                    };
                }
            }
            if (!deliveryAddress) {
                const matches = await this.mongo.findMany('customer_addresses', { $or: [{ user_id: Number(userId) }, { mysql_user_id: Number(userId) }] }, { sort: { is_default: -1, mysql_id: -1 }, limit: 1 });
                const defaultAddr = matches[0] ?? null;
                if (defaultAddr) {
                    deliveryAddress = {
                        contact_person_name: defaultAddr.contact_person_name ?? null,
                        contact_person_number: defaultAddr.contact_person_number ?? null,
                        address_type: defaultAddr.address_type ?? 'home',
                        address: defaultAddr.address ?? null,
                        road: defaultAddr.road ?? null,
                        house: defaultAddr.house ?? null,
                        floor: defaultAddr.floor ?? null,
                        latitude: defaultAddr.latitude ?? null,
                        longitude: defaultAddr.longitude ?? null,
                    };
                }
            }
            await this.mongo.insertOne('orders', {
                mysql_id: orderMysqlId,
                mysql_user_id: Number(userId),
                mysql_restaurant_id: Number(body.restaurant_id),
                mysql_zone_id: restaurant.mysql_zone_id,
                order_status: 'pending',
                payment_status: 'unpaid',
                cancel_reason: null,
                refund_status: 'not_required',
                payment_method: paymentMethod,
                order_type: body.order_type ?? 'delivery',
                order_amount: finalAmount,
                total_tax_amount: Math.round(totalTax * 100) / 100,
                food_gst_rate: effectiveFoodGstRate,
                delivery_charge: deliveryCharge,
                coupon_discount_amount: couponDiscount,
                coupon_code: couponCode,
                discount_owner: couponCode ? couponOwner : null,
                admin_discount_amount: couponAdminDiscount,
                additional_charge: additionalCharge,
                restaurant_discount_amount: couponRestaurantDiscount,
                dm_tips: 0,
                dm_tips_paid_out: 0,
                otp,
                pending: now,
                items,
                cutlery: !!Number(body.cutlery ?? 0) || body.cutlery === true,
                order_note: body.order_note ?? null,
                delivery_address: deliveryAddress,
                created_at: now,
                updated_at: now,
                created_at_legacy: now,
            });
            if (couponMysqlId != null) {
                await this.mongo.increment('coupons', { mysql_id: couponMysqlId }, { total_uses: 1 });
            }
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
                    gst_rate: it.gst_rate,
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
            for (const c of body.cart) {
                const f = foodById.get(Number(c.item_id ?? 0));
                if (!f)
                    continue;
                const qty = Number(c.quantity ?? 1);
                const data = { sell_count: Number(f.sell_count ?? 0) + qty, updated_at: now };
                if (String(f.stock_type ?? 'unlimited') !== 'unlimited') {
                    data.item_stock = Math.max(0, Number(f.item_stock ?? 0) - qty);
                }
                await this.mongo.updateOne('foods', { mysql_id: Number(f.mysql_id) }, data).catch(() => undefined);
            }
            try {
                const notifId = await this.mongo.nextMysqlId('notifications');
                await this.mongo.insertOne('notifications', {
                    mysql_id: notifId,
                    title: 'New order received',
                    description: `Order #${orderMysqlId} has just been placed.`,
                    mysql_restaurant_id: Number(body.restaurant_id),
                    target: 'restaurant',
                    order_id: orderMysqlId,
                    status: true,
                    created_at: now,
                    updated_at: now,
                });
            }
            catch {
            }
            await this.pushNewOrderToRestaurant(Number(body.restaurant_id), orderMysqlId);
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
    buildDeliveryAddress(order, defaultAddr, customer) {
        const fromOrder = order.delivery_address;
        const fromOrderObj = fromOrder && typeof fromOrder === 'object' ? fromOrder : {};
        const fromOrderStr = typeof fromOrder === 'string' ? fromOrder : null;
        const customerFullName = customer
            ? `${customer.f_name ?? ''} ${customer.l_name ?? ''}`.trim() || null
            : null;
        return {
            contact_person_name: fromOrderObj.contact_person_name
                ?? defaultAddr?.contact_person_name
                ?? customerFullName
                ?? 'Customer',
            contact_person_number: fromOrderObj.contact_person_number
                ?? defaultAddr?.contact_person_number
                ?? customer?.phone
                ?? null,
            address_type: fromOrderObj.address_type ?? defaultAddr?.address_type ?? 'home',
            address: fromOrderObj.address ?? defaultAddr?.address ?? fromOrderStr ?? null,
            road: fromOrderObj.road ?? defaultAddr?.road ?? null,
            house: fromOrderObj.house ?? defaultAddr?.house ?? null,
            floor: fromOrderObj.floor ?? defaultAddr?.floor ?? null,
            latitude: fromOrderObj.latitude ?? defaultAddr?.latitude ?? null,
            longitude: fromOrderObj.longitude ?? defaultAddr?.longitude ?? null,
        };
    }
    async trackOrder(orderId) {
        if (this.useMongo()) {
            const o = await this.mongo.findByMysqlId('orders', orderId);
            if (!o)
                throw new common_1.NotFoundException({ errors: [{ code: 'order_id', message: 'not_found' }] });
            const [restaurant, customer, deliveryMan, defaultAddr] = await Promise.all([
                o.mysql_restaurant_id != null
                    ? this.mongo.findByMysqlId('restaurants', Number(o.mysql_restaurant_id))
                    : Promise.resolve(null),
                o.mysql_user_id != null
                    ? this.mongo.findByMysqlId('users', Number(o.mysql_user_id))
                    : Promise.resolve(null),
                o.mysql_delivery_man_id != null
                    ? this.mongo.findByMysqlId('delivery_men', Number(o.mysql_delivery_man_id))
                    : Promise.resolve(null),
                o.mysql_user_id != null
                    ? this.mongo.findMany('customer_addresses', { $or: [{ user_id: Number(o.mysql_user_id) }, { mysql_user_id: Number(o.mysql_user_id) }] }, { sort: { is_default: -1, mysql_id: -1 }, limit: 1 }).then((rows) => rows[0] ?? null)
                    : Promise.resolve(null),
            ]);
            const restCover = restaurant?.cover_photo ?? null;
            const restaurantPayload = restaurant ? {
                id: Number(restaurant.mysql_id),
                name: restaurant.name ?? 'Restaurant',
                phone: restaurant.phone ?? null,
                email: restaurant.email ?? null,
                address: restaurant.address ?? null,
                logo: restaurant.logo ?? 'default.png',
                logo_full_url: (0, storage_url_1.storageFullUrl)('restaurant', restaurant.logo ?? null),
                image_full_url: (0, storage_url_1.storageFullUrl)('restaurant', restaurant.logo ?? null),
                cover_photo: restCover,
                cover_photo_full_url: (0, storage_url_1.storageFullUrl)('restaurant/cover', restCover),
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
                image_full_url: (0, storage_url_1.storageFullUrl)('profile', customer.image ?? null),
            } : null;
            const dmRating = deliveryMan;
            const dmPayload = deliveryMan ? {
                id: Number(deliveryMan.mysql_id),
                f_name: deliveryMan.f_name ?? null,
                l_name: deliveryMan.l_name ?? null,
                phone: deliveryMan.phone ?? null,
                image: deliveryMan.image ?? null,
                image_full_url: (0, storage_url_1.storageFullUrl)('delivery-man', deliveryMan.image ?? null),
                avg_rating: dmRating.avg_rating != null ? Number(dmRating.avg_rating) : 0,
                rating_count: dmRating.rating_count != null ? Number(dmRating.rating_count) : 0,
                lat: deliveryMan.latitude != null ? String(deliveryMan.latitude) : null,
                lng: deliveryMan.longitude != null ? String(deliveryMan.longitude) : null,
                location: deliveryMan.location ?? null,
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
                delivery_address: this.buildDeliveryAddress(o, defaultAddr, customer),
                cutlery: !!o.cutlery,
                order_note: o.order_note ?? null,
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
            const restIds = Array.from(new Set(orders.map((o) => Number(o.mysql_restaurant_id)).filter((n) => Number.isFinite(n) && n > 0)));
            const restaurants = restIds.length
                ? await this.mongo.findMany('restaurants', { mysql_id: { $in: restIds } })
                : [];
            const vendIds = Array.from(new Set(restaurants.filter((r) => !r.logo && r.mysql_vendor_id).map((r) => Number(r.mysql_vendor_id))));
            const vendImg = new Map();
            if (vendIds.length) {
                const vendors = await this.mongo.findMany('vendors', { mysql_id: { $in: vendIds } });
                for (const v of vendors)
                    vendImg.set(Number(v.mysql_id), v.image ?? null);
            }
            const restMap = new Map(restaurants.map((r) => {
                const fallback = !r.logo && r.mysql_vendor_id ? vendImg.get(Number(r.mysql_vendor_id)) ?? null : null;
                return [Number(r.mysql_id), {
                        id: Number(r.mysql_id),
                        name: r.name ?? null,
                        logo: r.logo ?? null,
                        logo_full_url: (0, storage_url_1.storageFullUrl)('restaurant', r.logo ?? null) ?? (0, storage_url_1.storageFullUrl)('profile', fallback),
                        zone_id: r.mysql_zone_id != null ? Number(r.mysql_zone_id) : null,
                    }];
            }));
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
                        restaurant: restMap.get(Number(o.mysql_restaurant_id)) ?? null,
                        created_at: o.created_at ?? o.created_at_legacy ?? null,
                        details_count: count,
                        cutlery: !!o.cutlery,
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
        mongo_data_service_1.MongoDataService,
        fcm_service_1.FcmService,
        user_delivery_charges_service_1.UserDeliveryChargesService,
        zone_service_1.ZoneService])
], OrderService);
//# sourceMappingURL=order.service.js.map