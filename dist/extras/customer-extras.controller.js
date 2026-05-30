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
exports.CustomerExtrasController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const prisma_service_1 = require("../prisma/prisma.service");
const mongo_data_service_1 = require("../mongo/mongo-data.service");
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
        const v = (process.env.USE_MONGO_EXTRAS ?? '').toLowerCase();
        return v === '1' || v === 'true' || v === 'yes';
    }
    wishList() {
        return { product: [], restaurant: [] };
    }
    wishAdd() {
        return { message: 'successfully added!' };
    }
    wishRemove() {
        return { message: 'successfully removed!' };
    }
    wishClear() {
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
    async updateProfile(req, body) {
        const data = {};
        if (body.f_name !== undefined)
            data.f_name = body.f_name;
        if (body.l_name !== undefined)
            data.l_name = body.l_name;
        if (body.email !== undefined)
            data.email = body.email;
        if (body.image !== undefined)
            data.image = body.image;
        if (this.useMongo()) {
            if (Object.keys(data).length) {
                await this.mongo.updateOne('users', { mysql_id: Number(req.actor.id) }, data);
            }
            return { message: 'Profile updated successfully' };
        }
        if (Object.keys(data).length) {
            await this.prisma.users.update({ where: { id: req.actor.id }, data });
        }
        return { message: 'Profile updated successfully' };
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
    messageList() {
        return { conversations: [], total_size: 0 };
    }
    messageDetails() {
        return { messages: [] };
    }
    messageGet() {
        return { messages: [], total_size: 0 };
    }
    messageSearch() {
        return { conversations: [] };
    }
    messageSend() {
        return { message: 'sent' };
    }
    subscription() {
        return { data: [] };
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
    orderSubscriptionList() {
        return { data: [], total_size: 0, limit: 25, offset: 1 };
    }
    async orderDetails(req, orderId) {
        if (this.useMongo()) {
            const items = await this.mongo.findMany('order_details', { mysql_order_id: Number(orderId) });
            return items.map((it) => ({
                ...(it.legacy ?? {}),
                ...it,
                id: Number(it.mysql_id),
                food_id: it.mysql_food_id !== null && it.mysql_food_id !== undefined ? Number(it.mysql_food_id) : null,
                order_id: it.mysql_order_id !== null && it.mysql_order_id !== undefined ? Number(it.mysql_order_id) : null,
                price: toNum(it.price),
                tax_amount: toNum(it.tax_amount),
                total_add_on_price: toNum(it.total_add_on_price),
                item_campaign_id: it.mysql_item_campaign_id !== null && it.mysql_item_campaign_id !== undefined ? Number(it.mysql_item_campaign_id) : null,
                discount_on_food: it.discount_on_food !== null && it.discount_on_food !== undefined ? toNum(it.discount_on_food) : null,
            }));
        }
        const items = await this.prisma.order_details.findMany({ where: { order_id: BigInt(orderId) } });
        return items.map((it) => ({
            ...it,
            id: Number(it.id),
            food_id: it.food_id ? Number(it.food_id) : null,
            order_id: it.order_id ? Number(it.order_id) : null,
            price: Number(it.price),
            tax_amount: Number(it.tax_amount),
            total_add_on_price: Number(it.total_add_on_price),
            item_campaign_id: it.item_campaign_id ? Number(it.item_campaign_id) : null,
            discount_on_food: it.discount_on_food ? Number(it.discount_on_food) : null,
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
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "wishList", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('wish-list/add'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "wishAdd", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('wish-list/remove'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "wishRemove", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('wish-list/clear-all'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
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
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
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
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "messageList", null);
__decorate([
    (0, common_1.Get)('message/details'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "messageDetails", null);
__decorate([
    (0, common_1.Get)('message/get'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "messageGet", null);
__decorate([
    (0, common_1.Get)('message/search-list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "messageSearch", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('message/send'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerExtrasController.prototype, "messageSend", null);
__decorate([
    (0, common_1.Get)('subscription'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
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
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
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