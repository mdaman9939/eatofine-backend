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
exports.CustomerExtrasController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const auth_guard_1 = require("../auth/auth.guard");
const prisma_service_1 = require("../prisma/prisma.service");
const mongo_data_service_1 = require("../mongo/mongo-data.service");
const STORAGE_ROOT = (() => {
    if (process.env.STORAGE_ROOT)
        return process.env.STORAGE_ROOT;
    const fs = require('fs');
    const repoLocal = path.resolve(__dirname, '../../storage/app/public');
    const monorepo = path.resolve(__dirname, '../../../../storage/app/public');
    return fs.existsSync(repoLocal) ? repoLocal : monorepo;
})();
const toNum = (v) => {
    if (v === null || v === undefined)
        return 0;
    if (typeof v === 'number')
        return v;
    if (typeof v === 'string')
        return Number(v) || 0;
    return Number(v) || 0;
};
let CustomerExtrasController = class CustomerExtrasController {
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
    async wishList(req) {
        const userId = Number(req.actor.id);
        const rows = await this.mongo.findMany('wishlists', { user_id: userId });
        const foodIds = rows.map((r) => r.food_id).filter((x) => x != null);
        const restaurantIds = rows.map((r) => r.restaurant_id).filter((x) => x != null);
        const [foods, restaurants] = await Promise.all([
            foodIds.length
                ? this.mongo.findMany('foods', { mysql_id: { $in: foodIds } })
                : Promise.resolve([]),
            restaurantIds.length
                ? this.mongo.findMany('restaurants', { mysql_id: { $in: restaurantIds } })
                : Promise.resolve([]),
        ]);
        return {
            product: foods.map((f) => ({
                ...(f.legacy ?? {}),
                ...f,
                id: Number(f.mysql_id),
                price: toNum(f.price),
                discount: toNum(f.discount),
                tax: toNum(f.tax),
                restaurant_id: f.mysql_restaurant_id != null ? Number(f.mysql_restaurant_id) : null,
                category_id: f.mysql_category_id != null ? Number(f.mysql_category_id) : null,
            })),
            restaurant: restaurants.map((r) => ({
                id: Number(r.mysql_id),
                name: r.name ?? null,
                logo: r.logo ?? null,
                address: r.address ?? null,
                avg_rating: r.avg_rating ?? 0,
            })),
        };
    }
    async wishAdd(req, body) {
        const userId = Number(req.actor.id);
        if (!body.food_id && !body.restaurant_id) {
            return { message: 'food_id or restaurant_id required' };
        }
        const filter = { user_id: userId };
        if (body.food_id)
            filter.food_id = Number(body.food_id);
        if (body.restaurant_id)
            filter.restaurant_id = Number(body.restaurant_id);
        const existing = await this.mongo.findOne('wishlists', filter);
        if (existing)
            return { message: 'already in wishlist' };
        const id = await this.mongo.nextMysqlId('wishlists');
        await this.mongo.insertOne('wishlists', {
            mysql_id: id,
            user_id: userId,
            food_id: body.food_id ? Number(body.food_id) : null,
            restaurant_id: body.restaurant_id ? Number(body.restaurant_id) : null,
            created_at: new Date(),
        });
        return { message: 'successfully added!' };
    }
    async wishRemove(req, foodId, restaurantId) {
        const userId = Number(req.actor.id);
        const filter = { user_id: userId };
        if (foodId)
            filter.food_id = Number(foodId);
        if (restaurantId)
            filter.restaurant_id = Number(restaurantId);
        if (!('food_id' in filter) && !('restaurant_id' in filter)) {
            return { message: 'nothing to remove' };
        }
        await this.mongo.deleteMany('wishlists', filter);
        return { message: 'successfully removed!' };
    }
    async wishClear(req) {
        await this.mongo.deleteMany('wishlists', { user_id: Number(req.actor.id) });
        return { message: 'cleared' };
    }
    async notifications() {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('notifications', { status: true }, { sort: { mysql_id: -1 }, limit: 50 });
            return rows.map((r) => ({
                id: Number(r.mysql_id),
                title: r.title ?? null,
                description: r.description ?? null,
                image: r.image ?? null,
                created_at: r.created_at ?? null,
            }));
        }
        const rows = await this.prisma.notifications.findMany({
            where: { status: true },
            orderBy: { id: 'desc' },
            take: 50,
        });
        return rows.map((r) => ({
            id: Number(r.id),
            title: r.title,
            description: r.description,
            image: r.image,
            created_at: r.created_at,
        }));
    }
    fcmToken() {
        return { message: 'token-updated' };
    }
    updateZoneGet() {
        return { ok: true };
    }
    updateZonePost() {
        return { ok: true };
    }
    async updateProfile(req, image, body) {
        const fields = body ?? {};
        const data = {};
        if (fields.f_name !== undefined)
            data.f_name = fields.f_name;
        if (fields.l_name !== undefined)
            data.l_name = fields.l_name;
        if (fields.email !== undefined)
            data.email = fields.email;
        if (fields.phone !== undefined)
            data.phone = fields.phone;
        if (image && image.buffer && image.buffer.length > 0) {
            const ext = (path.extname(image.originalname) || '.jpg').toLowerCase();
            if (!/^\.(png|jpe?g|webp|gif)$/i.test(ext)) {
                return { errors: [{ code: 'ext', message: 'only png/jpg/jpeg/webp/gif allowed' }] };
            }
            const dir = path.join(STORAGE_ROOT, 'profile');
            try {
                fs.mkdirSync(dir, { recursive: true });
                const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
                fs.writeFileSync(path.join(dir, filename), image.buffer);
                data.image = filename;
            }
            catch (e) {
                const msg = e.message || 'image write failed';
                if (Object.keys(data).length === 0) {
                    return { errors: [{ code: 'image', message: msg }] };
                }
            }
        }
        else if (typeof fields.image === 'string' && fields.image.length > 0) {
            data.image = fields.image;
        }
        if (this.useMongo()) {
            if (Object.keys(data).length) {
                await this.mongo.updateOne('users', { mysql_id: Number(req.actor.id) }, data);
            }
            return { message: 'Profile updated successfully', image: data.image ?? null };
        }
        if (Object.keys(data).length) {
            await this.prisma.users.update({ where: { id: req.actor.id }, data });
        }
        return { message: 'Profile updated successfully', image: data.image ?? null };
    }
    walletTx() {
        return { data: [], total_size: 0, limit: 25, offset: 1 };
    }
    walletBonuses() {
        return [];
    }
    addFund() {
        return { message: 'Not available in demo' };
    }
    loyaltyTx() {
        return { data: [], total_size: 0, limit: 25, offset: 1 };
    }
    pointTransfer() {
        return { message: 'Not available in demo' };
    }
    async messageList(req, type) {
        const userId = Number(req.actor.id);
        const filter = { user_id: userId };
        if (type === 'restaurant' || type === 'delivery_man')
            filter.counterpart_type = type;
        const rows = await this.mongo.findMany('conversations', filter, { sort: { last_message_at: -1 }, limit: 50 });
        return {
            conversations: rows.map((c) => ({
                id: Number(c.mysql_id),
                type: c.counterpart_type,
                counterpart_id: Number(c.counterpart_id),
                name: c.counterpart_name ?? `${c.counterpart_type} #${c.counterpart_id}`,
                avatar: c.counterpart_avatar ?? null,
                last_message: c.last_message ?? null,
                last_message_at: c.last_message_at ?? null,
                unread: c.unread ?? 0,
            })),
            total_size: rows.length,
        };
    }
    async messageDetails(req, convId) {
        if (!convId)
            return { messages: [] };
        const rows = await this.mongo.findMany('messages', { conversation_id: Number(convId) }, { sort: { mysql_id: 1 }, limit: 100 });
        return {
            messages: rows.map((m) => ({
                id: Number(m.mysql_id),
                sender_type: m.sender_type,
                sender_id: Number(m.sender_id),
                body: m.body,
                sent_by_me: m.sender_type === 'user' && Number(m.sender_id) === Number(req.actor.id),
                created_at: m.created_at ?? null,
            })),
        };
    }
    async messageGet(req, convId) {
        const d = await this.messageDetails(req, convId);
        return { messages: d.messages, total_size: d.messages.length };
    }
    async messageSearch(req, q) {
        if (!q || !q.trim())
            return { conversations: [] };
        const userId = Number(req.actor.id);
        const rows = await this.mongo.findMany('conversations', {
            user_id: userId,
            counterpart_name: { $regex: q, $options: 'i' },
        }, { limit: 25 });
        return { conversations: rows.map((c) => ({ id: Number(c.mysql_id), name: c.counterpart_name, type: c.counterpart_type })) };
    }
    async messageSend(req, body) {
        const userId = Number(req.actor.id);
        if (!body.body || !body.body.trim()) {
            return { message: 'message body required' };
        }
        let convId = body.conversation_id;
        if (!convId && body.counterpart_type && body.counterpart_id) {
            const existing = await this.mongo.findOne('conversations', {
                user_id: userId,
                counterpart_type: body.counterpart_type,
                counterpart_id: Number(body.counterpart_id),
            });
            if (existing) {
                convId = Number(existing.mysql_id);
            }
            else {
                convId = await this.mongo.nextMysqlId('conversations');
                await this.mongo.insertOne('conversations', {
                    mysql_id: convId,
                    user_id: userId,
                    counterpart_type: body.counterpart_type,
                    counterpart_id: Number(body.counterpart_id),
                    counterpart_name: null,
                    last_message: body.body,
                    last_message_at: new Date(),
                    unread: 0,
                });
            }
        }
        if (!convId)
            return { message: 'conversation_id or counterpart required' };
        const msgId = await this.mongo.nextMysqlId('messages');
        await this.mongo.insertOne('messages', {
            mysql_id: msgId,
            conversation_id: convId,
            sender_type: 'user',
            sender_id: userId,
            body: body.body,
            created_at: new Date(),
        });
        await this.mongo.updateOne('conversations', { mysql_id: convId }, {
            last_message: body.body,
            last_message_at: new Date(),
        });
        return { message: 'sent', conversation_id: convId, id: msgId };
    }
    async subscription(req) {
        const userId = Number(req.actor.id);
        const rows = await this.mongo.findMany('subscriptions', {
            $or: [{ user_id: userId }, { mysql_user_id: userId }],
        }, { sort: { mysql_id: -1 }, limit: 50 });
        return {
            data: rows.map((s) => ({
                id: Number(s.mysql_id),
                restaurant_id: s.restaurant_id ?? s.mysql_restaurant_id ?? null,
                plan_name: s.plan_name ?? null,
                frequency: s.frequency ?? null,
                status: s.status ?? 'active',
                created_at: s.created_at ?? null,
            })),
        };
    }
    updateInterest() {
        return { ok: true };
    }
    async suggestedFoods() {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('foods', { status: true }, { sort: { avg_rating: -1 }, limit: 10 });
            return {
                products: rows.map((r) => ({
                    ...(r.legacy ?? {}),
                    ...r,
                    id: Number(r.mysql_id),
                    price: toNum(r.price),
                    discount: toNum(r.discount),
                    tax: toNum(r.tax),
                    restaurant_id: r.mysql_restaurant_id !== null && r.mysql_restaurant_id !== undefined ? Number(r.mysql_restaurant_id) : null,
                    category_id: r.mysql_category_id !== null && r.mysql_category_id !== undefined ? Number(r.mysql_category_id) : null,
                })),
            };
        }
        const rows = await this.prisma.food.findMany({
            where: { status: true },
            orderBy: { avg_rating: 'desc' },
            take: 10,
        });
        return { products: rows.map((r) => ({ ...r, id: Number(r.id), price: Number(r.price), discount: Number(r.discount), tax: Number(r.tax), restaurant_id: Number(r.restaurant_id), category_id: r.category_id ? Number(r.category_id) : null })) };
    }
    orderAgain() {
        return [];
    }
    async runningOrders(req) {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('orders', {
                mysql_user_id: Number(req.actor.id),
                order_status: { $in: ['pending', 'confirmed', 'accepted', 'processing', 'handover', 'picked_up'] },
            }, { sort: { mysql_id: -1 }, limit: 25 });
            return rows.map((r) => ({
                ...(r.legacy ?? {}),
                ...r,
                id: Number(r.mysql_id),
                user_id: r.mysql_user_id !== null && r.mysql_user_id !== undefined ? Number(r.mysql_user_id) : null,
                restaurant_id: r.mysql_restaurant_id !== null && r.mysql_restaurant_id !== undefined ? Number(r.mysql_restaurant_id) : 0,
                order_amount: toNum(r.order_amount),
            }));
        }
        const rows = await this.prisma.orders.findMany({
            where: {
                user_id: req.actor.id,
                order_status: { in: ['pending', 'confirmed', 'accepted', 'processing', 'handover', 'picked_up'] },
            },
            orderBy: { id: 'desc' },
            take: 25,
        });
        return rows.map((r) => ({ ...r, id: Number(r.id), user_id: r.user_id ? Number(r.user_id) : null, restaurant_id: Number(r.restaurant_id), order_amount: Number(r.order_amount) }));
    }
    async orderSubscriptionList(req) {
        const userId = Number(req.actor.id);
        const orderRows = await this.mongo.findMany('orders', { mysql_user_id: userId, subscription_id: { $ne: null } }, {
            sort: { mysql_id: -1 }, limit: 25,
        });
        return {
            data: orderRows.map((o) => ({
                id: Number(o.mysql_id),
                restaurant_id: o.mysql_restaurant_id ?? null,
                subscription_id: o.subscription_id ?? null,
                order_status: o.order_status ?? 'pending',
                order_amount: toNum(o.order_amount),
                schedule_at: o.schedule_at ?? null,
                created_at: o.created_at_legacy ?? null,
            })),
            total_size: orderRows.length,
            limit: 25,
            offset: 1,
        };
    }
    async orderDetails(req, orderId) {
        const order = await this.mongo.findByMysqlId('orders', Number(orderId));
        const [user, restaurant, deliveryMan, items] = await Promise.all([
            order?.mysql_user_id != null
                ? this.mongo.findByMysqlId('users', Number(order.mysql_user_id))
                : Promise.resolve(null),
            order?.mysql_restaurant_id != null
                ? this.mongo.findByMysqlId('restaurants', Number(order.mysql_restaurant_id))
                : Promise.resolve(null),
            order?.mysql_delivery_man_id != null
                ? this.mongo.findByMysqlId('delivery_men', Number(order.mysql_delivery_man_id))
                : Promise.resolve(null),
            this.mongo.findMany('order_details', {
                $or: [{ order_id: Number(orderId) }, { mysql_order_id: Number(orderId) }],
            }),
        ]);
        const customerName = user ? [user.f_name, user.l_name].filter(Boolean).join(' ').trim() || null : null;
        const restaurantPayload = restaurant ? {
            id: Number(restaurant.mysql_id),
            name: restaurant.name ?? null,
            phone: restaurant.phone ?? null,
            email: restaurant.email ?? null,
            address: restaurant.address ?? null,
            logo: restaurant.logo ?? null,
            latitude: restaurant.latitude ?? null,
            longitude: restaurant.longitude ?? null,
        } : null;
        const dmPayload = deliveryMan ? {
            id: Number(deliveryMan.mysql_id),
            f_name: deliveryMan.f_name ?? null,
            l_name: deliveryMan.l_name ?? null,
            phone: deliveryMan.phone ?? null,
        } : null;
        return items.map((it) => ({
            ...(it.legacy ?? {}),
            ...it,
            id: Number(it.mysql_id),
            food_id: it.mysql_food_id != null ? Number(it.mysql_food_id) : null,
            order_id: it.mysql_order_id != null ? Number(it.mysql_order_id) : null,
            price: toNum(it.price),
            tax_amount: toNum(it.tax_amount),
            total_add_on_price: toNum(it.total_add_on_price),
            item_campaign_id: it.mysql_item_campaign_id != null ? Number(it.mysql_item_campaign_id) : null,
            discount_on_food: it.discount_on_food != null ? toNum(it.discount_on_food) : null,
            customer_name: customerName,
            customer_phone: user?.phone ?? null,
            customer_email: user?.email ?? null,
            delivery_address: order?.delivery_address ?? null,
            restaurant: restaurantPayload,
            delivery_man: dmPayload,
        }));
    }
    async cancelOrder(req, body) {
        const id = body.order_id;
        if (!id)
            return { message: 'order_id required' };
        if (this.useMongo()) {
            const order = await this.mongo.findOne('orders', {
                mysql_id: Number(id),
                mysql_user_id: Number(req.actor.id),
            });
            if (!order)
                return { message: 'order not found' };
            await this.mongo.updateOne('orders', { mysql_id: order.mysql_id }, {
                order_status: 'canceled',
                canceled: new Date(),
                canceled_by: 'customer',
                cancellation_reason: body.reason ?? null,
            });
            return { message: 'Order canceled' };
        }
        const order = await this.prisma.orders.findFirst({ where: { id: BigInt(id), user_id: req.actor.id } });
        if (!order)
            return { message: 'order not found' };
        await this.prisma.orders.update({
            where: { id: order.id },
            data: {
                order_status: 'canceled',
                canceled: new Date(),
                canceled_by: 'customer',
                cancellation_reason: body.reason ?? null,
            },
        });
        return { message: 'Order canceled' };
    }
    switchPaymentMethod() {
        return { message: 'Payment method updated' };
    }
    async refundReasons() {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('refund_reasons', { status: true });
            return rows.map((r) => ({ id: Number(r.mysql_id), reason: r.reason ?? null }));
        }
        const rows = await this.prisma.refund_reasons.findMany({ where: { status: true } });
        return rows.map((r) => ({ id: Number(r.id), reason: r.reason }));
    }
    async refundRequest(req, body) {
        if (!body.order_id)
            return { message: 'order_id required' };
        if (this.useMongo()) {
            const order = await this.mongo.findOne('orders', {
                mysql_id: Number(body.order_id),
                mysql_user_id: Number(req.actor.id),
            });
            if (!order)
                return { message: 'order not found' };
            const nextId = await this.mongo.nextMysqlId('refunds');
            const now = new Date();
            await this.mongo.insertOne('refunds', {
                mysql_id: nextId,
                mysql_order_id: order.mysql_id,
                mysql_user_id: Number(req.actor.id),
                order_status: order.order_status ?? null,
                customer_reason: body.customer_reason ?? null,
                customer_note: body.customer_note ?? null,
                refund_amount: toNum(order.order_amount),
                refund_status: 'pending',
                refund_method: 'wallet',
                created_at: now,
                updated_at: now,
            });
            return { message: 'Refund request submitted' };
        }
        const order = await this.prisma.orders.findFirst({ where: { id: BigInt(body.order_id), user_id: req.actor.id } });
        if (!order)
            return { message: 'order not found' };
        await this.prisma.refunds.create({
            data: {
                order_id: order.id,
                user_id: req.actor.id,
                order_status: order.order_status,
                customer_reason: body.customer_reason ?? null,
                customer_note: body.customer_note ?? null,
                refund_amount: order.order_amount,
                refund_status: 'pending',
                refund_method: 'wallet',
            },
        });
        return { message: 'Refund request submitted' };
    }
    getOrderTax() {
        return { total_tax_amount: 0, tax_amount: 0 };
    }
    sendNotification() {
        return { ok: true };
    }
    sendNotificationById() {
        return { ok: true };
    }
    checkRestaurantValidation() {
        return { message: 'valid' };
    }
    offlinePayment() {
        return { message: 'recorded' };
    }
    offlinePaymentUpdate() {
        return { message: 'recorded' };
    }
    async foodList(idsStr) {
        const ids = (idsStr ?? '').split(',').map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n));
        if (!ids.length)
            return [];
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('foods', { mysql_id: { $in: ids } });
            return rows.map((r) => ({
                ...(r.legacy ?? {}),
                ...r,
                id: Number(r.mysql_id),
                price: toNum(r.price),
                tax: toNum(r.tax),
                discount: toNum(r.discount),
                restaurant_id: r.mysql_restaurant_id !== null && r.mysql_restaurant_id !== undefined ? Number(r.mysql_restaurant_id) : 0,
                category_id: r.mysql_category_id !== null && r.mysql_category_id !== undefined ? Number(r.mysql_category_id) : null,
            }));
        }
        const rows = await this.prisma.food.findMany({ where: { id: { in: ids.map((n) => BigInt(n)) } } });
        return rows.map((r) => ({ ...r, id: Number(r.id), price: Number(r.price), tax: Number(r.tax), discount: Number(r.discount), restaurant_id: Number(r.restaurant_id), category_id: r.category_id ? Number(r.category_id) : null }));
    }
    cartAddMultiple() {
        return { message: 'added' };
    }
    async deleteAddress(req, addressId) {
        if (this.useMongo()) {
            const doc = await this.mongo.findOne('customer_addresses', { mysql_id: Number(addressId) });
            if (doc) {
                const ownerId = (doc.mysql_user_id ?? doc.user_id ?? null);
                if (ownerId !== null && Number(ownerId) === Number(req.actor.id)) {
                    await this.mongo.deleteOne('customer_addresses', { mysql_id: Number(addressId) });
                }
            }
            return { message: 'Address deleted' };
        }
        await this.prisma.customer_addresses.deleteMany({
            where: { id: BigInt(addressId), user_id: req.actor.id },
        });
        return { message: 'Address deleted' };
    }
    async updateAddress(id, req, body) {
        const data = {};
        for (const [k, v] of Object.entries(body)) {
            if (v !== undefined)
                data[k] = v;
        }
        if (this.useMongo()) {
            const doc = await this.mongo.findOne('customer_addresses', { mysql_id: Number(id) });
            if (doc) {
                const ownerId = (doc.mysql_user_id ?? doc.user_id ?? null);
                if (ownerId !== null && Number(ownerId) === Number(req.actor.id)) {
                    await this.mongo.updateOne('customer_addresses', { mysql_id: Number(id) }, { ...data, updated_at: new Date() });
                }
            }
            return { message: 'Address updated' };
        }
        await this.prisma.customer_addresses.updateMany({
            where: { id: BigInt(id), user_id: req.actor.id },
            data,
        });
        return { message: 'Address updated' };
    }
    setDefaultAddress() {
        return { message: 'default set' };
    }
    removeAccount() {
        return { message: 'Not available in demo' };
    }
};
exports.CustomerExtrasController = CustomerExtrasController;
__decorate([
    (0, common_1.Get)('wish-list'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "wishList", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('wish-list/add'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "wishAdd", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('wish-list/remove'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('food_id')),
    __param(2, (0, common_1.Query)('restaurant_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "wishRemove", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('wish-list/clear-all'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "wishClear", null);
__decorate([
    (0, common_1.Get)('notifications'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "notifications", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('cm-firebase-token'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "fcmToken", null);
__decorate([
    (0, common_1.Get)('update-zone'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "updateZoneGet", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-zone'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "updateZonePost", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-profile'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('image', { limits: { fileSize: 5 * 1024 * 1024 } })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.Get)('wallet/transactions'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "walletTx", null);
__decorate([
    (0, common_1.Get)('wallet/bonuses'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "walletBonuses", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('wallet/add-fund'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "addFund", null);
__decorate([
    (0, common_1.Get)('loyalty-point/transactions'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "loyaltyTx", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('loyalty-point/point-transfer'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "pointTransfer", null);
__decorate([
    (0, common_1.Get)('message/list'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('type')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "messageList", null);
__decorate([
    (0, common_1.Get)('message/details'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('conversation_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "messageDetails", null);
__decorate([
    (0, common_1.Get)('message/get'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('conversation_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "messageGet", null);
__decorate([
    (0, common_1.Get)('message/search-list'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "messageSearch", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('message/send'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "messageSend", null);
__decorate([
    (0, common_1.Get)('subscription'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "subscription", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-interest'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "updateInterest", null);
__decorate([
    (0, common_1.Get)('suggested-foods'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "suggestedFoods", null);
__decorate([
    (0, common_1.Get)('order-again'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "orderAgain", null);
__decorate([
    (0, common_1.Get)('order/running-orders'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "runningOrders", null);
__decorate([
    (0, common_1.Get)('order/order-subscription-list'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "orderSubscriptionList", null);
__decorate([
    (0, common_1.Get)('order/details'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('order_id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "orderDetails", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('order/cancel'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "cancelOrder", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('order/payment-method'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "switchPaymentMethod", null);
__decorate([
    (0, common_1.Get)('order/refund-reasons'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "refundReasons", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('order/refund-request'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "refundRequest", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('order/get-Tax'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "getOrderTax", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('order/send-notification'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "sendNotification", null);
__decorate([
    (0, common_1.Get)('order/send-notification/:id'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "sendNotificationById", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('order/check-restaurant-validation'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "checkRestaurantValidation", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('order/offline-payment'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "offlinePayment", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('order/offline-payment-update'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "offlinePaymentUpdate", null);
__decorate([
    (0, common_1.Get)('food-list'),
    __param(0, (0, common_1.Query)('ids')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "foodList", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('cart/add-multiple'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "cartAddMultiple", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('address/delete'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('address_id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "deleteAddress", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('address/update/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", Promise)
], CustomerExtrasController.prototype, "updateAddress", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('address/set-default'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "setDefaultAddress", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('remove-account'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "removeAccount", null);
exports.CustomerExtrasController = CustomerExtrasController = __decorate([
    (0, common_1.Controller)('customer'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, auth_guard_1.RequireAuth)('customer'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        mongo_data_service_1.MongoDataService])
], CustomerExtrasController);
//# sourceMappingURL=customer-extras.controller.js.map