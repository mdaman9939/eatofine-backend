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
exports.DeliveryExtrasController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const prisma_service_1 = require("../prisma/prisma.service");
const mongo_data_service_1 = require("../mongo/mongo-data.service");
let DeliveryExtrasController = class DeliveryExtrasController {
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
    shapeDmOrder(r, detailsCount) {
        const created = r.created_at;
        const updated = r.updated_at;
        return {
            ...r,
            id: Number(r.mysql_id),
            user_id: r.mysql_user_id !== undefined && r.mysql_user_id !== null
                ? Number(r.mysql_user_id)
                : (r.user_id !== undefined && r.user_id !== null ? Number(r.user_id) : null),
            restaurant_id: Number(r.mysql_restaurant_id ?? r.restaurant_id ?? 0),
            delivery_man_id: r.mysql_delivery_man_id !== undefined && r.mysql_delivery_man_id !== null
                ? Number(r.mysql_delivery_man_id)
                : (r.delivery_man_id !== undefined && r.delivery_man_id !== null ? Number(r.delivery_man_id) : null),
            order_amount: r.order_amount !== undefined && r.order_amount !== null ? Number(r.order_amount) : 0,
            details_count: detailsCount,
            order_status: r.order_status ?? 'pending',
            order_type: r.order_type ?? 'delivery',
            payment_method: r.payment_method ?? 'cash_on_delivery',
            payment_status: r.payment_status ?? 'unpaid',
            delivery_address: r.delivery_address ?? null,
            created_at: created ? new Date(created).toISOString() : new Date().toISOString(),
            updated_at: updated ? new Date(updated).toISOString() : new Date().toISOString(),
        };
    }
    async dmDetailsCountMap(orderIds) {
        if (orderIds.length === 0)
            return new Map();
        const rows = await this.mongo.aggregate('order_details', [
            { $match: { order_id: { $in: orderIds } } },
            { $group: { _id: '$order_id', count: { $sum: 1 } } },
        ]);
        return new Map(rows.map((r) => [Number(r._id), r.count]));
    }
    async profile(req) {
        const actorId = Number(req.actor.id);
        if (this.useMongo()) {
            const d = await this.mongo.findByMysqlId('delivery_men', actorId);
            if (!d)
                return {};
            const allOrders = await this.mongo.findMany('orders', { mysql_delivery_man_id: actorId });
            const now = Date.now();
            const dayMs = 86_400_000;
            let today = 0, week = 0;
            let todayEarn = 0, weekEarn = 0, monthEarn = 0, allEarn = 0;
            for (const o of allOrders) {
                const ts = o.created_at ? new Date(o.created_at).getTime() : 0;
                if (!Number.isFinite(ts) || ts === 0)
                    continue;
                const age = now - ts;
                const delivered = o.order_status === 'delivered';
                const dmEarn = Number(o.delivery_charge ?? 0) + Number(o.dm_tips ?? 0);
                if (delivered)
                    allEarn += dmEarn;
                if (age <= dayMs) {
                    today++;
                    if (delivered)
                        todayEarn += dmEarn;
                }
                if (age <= 7 * dayMs) {
                    week++;
                    if (delivered)
                        weekEarn += dmEarn;
                }
                if (age <= 30 * dayMs) {
                    if (delivered)
                        monthEarn += dmEarn;
                }
            }
            const wallet = await this.mongo.findOne('delivery_man_wallets', { $or: [{ delivery_man_id: actorId }, { mysql_delivery_man_id: actorId }] });
            return {
                id: Number(d.mysql_id),
                f_name: d.f_name ?? null,
                l_name: d.l_name ?? null,
                email: d.email ?? null,
                phone: d.phone ?? null,
                image: d.image ?? null,
                status: d.status ?? null,
                application_status: d.application_status ?? null,
                zone_id: d.mysql_zone_id !== undefined && d.mysql_zone_id !== null
                    ? Number(d.mysql_zone_id)
                    : (d.zone_id !== undefined && d.zone_id !== null ? Number(d.zone_id) : null),
                order_count: allOrders.length,
                todays_order_count: today,
                this_week_order_count: week,
                todays_earning: todayEarn,
                this_week_earning: weekEarn,
                this_month_earning: monthEarn,
                all_time_earning: allEarn,
                balance: Number(wallet?.balance ?? 0),
                total_earning: Number(wallet?.total_earning ?? allEarn),
                collected_cash: Number(wallet?.collected_cash ?? 0),
                total_withdrawn: Number(wallet?.total_withdrawn ?? 0),
                pending_withdraw: Number(wallet?.pending_withdraw ?? 0),
            };
        }
        const d = await this.prisma.delivery_men.findUnique({ where: { id: req.actor.id } });
        if (!d)
            return {};
        return {
            id: Number(d.id),
            f_name: d.f_name,
            l_name: d.l_name,
            email: d.email,
            phone: d.phone,
            image: d.image,
            status: d.status,
            application_status: d.application_status,
            zone_id: d.zone_id ? Number(d.zone_id) : null,
            order_count: 0,
            todays_order_count: 0,
            this_week_order_count: 0,
            todays_earning: 0,
            this_week_earning: 0,
            this_month_earning: 0,
            all_time_earning: 0,
            balance: 0,
            total_earning: 0,
            collected_cash: 0,
            total_withdrawn: 0,
            pending_withdraw: 0,
        };
    }
    async updateProfile(req, body) {
        const data = {};
        for (const [k, v] of Object.entries(body))
            if (v !== undefined)
                data[k] = v;
        if (Object.keys(data).length) {
            if (this.useMongo()) {
                await this.mongo.updateOne('delivery_men', { mysql_id: Number(req.actor.id) }, { ...data, updated_at: new Date() });
                return { message: 'Profile updated' };
            }
            await this.prisma.delivery_men.update({ where: { id: req.actor.id }, data });
        }
        return { message: 'Profile updated' };
    }
    toggleActive() { return { message: 'updated' }; }
    fcmToken() { return { message: 'token-updated' }; }
    remove() { return { message: 'Not available in demo' }; }
    async allOrders(req) {
        const actorId = Number(req.actor.id);
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('orders', { mysql_delivery_man_id: actorId }, { sort: { mysql_id: -1 }, limit: 50 });
            const counts = await this.dmDetailsCountMap(rows.map((r) => Number(r.mysql_id)));
            return rows.map((r) => this.shapeDmOrder(r, counts.get(Number(r.mysql_id)) ?? 1));
        }
        const rows = await this.prisma.orders.findMany({ where: { delivery_man_id: req.actor.id }, orderBy: { id: 'desc' }, take: 50 });
        return rows.map((r) => ({ ...r, id: Number(r.id), user_id: r.user_id ? Number(r.user_id) : null, restaurant_id: Number(r.restaurant_id), order_amount: Number(r.order_amount) }));
    }
    async currentOrders(req) {
        const actorId = Number(req.actor.id);
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('orders', {
                mysql_delivery_man_id: actorId,
                order_status: { $in: ['handover', 'picked_up', 'confirmed', 'processing'] },
            }, { sort: { mysql_id: -1 } });
            const counts = await this.dmDetailsCountMap(rows.map((r) => Number(r.mysql_id)));
            return rows.map((r) => this.shapeDmOrder(r, counts.get(Number(r.mysql_id)) ?? 1));
        }
        return [];
    }
    async latestOrders(req) {
        const actorId = Number(req.actor.id);
        if (this.useMongo()) {
            const dm = await this.mongo.findByMysqlId('delivery_men', actorId);
            const zoneId = dm?.mysql_zone_id ?? dm?.zone_id;
            const rows = await this.mongo.findMany('orders', {
                mysql_delivery_man_id: { $in: [null, 0] },
                order_status: 'handover',
                ...(zoneId ? { $or: [{ mysql_zone_id: Number(zoneId) }, { zone_id: Number(zoneId) }] } : {}),
            }, { sort: { mysql_id: -1 }, limit: 20 });
            const counts = await this.dmDetailsCountMap(rows.map((r) => Number(r.mysql_id)));
            return rows.map((r) => this.shapeDmOrder(r, counts.get(Number(r.mysql_id)) ?? 1));
        }
        return [];
    }
    async order(idStr) {
        const id = parseInt(idStr ?? '', 10);
        if (!Number.isFinite(id))
            return null;
        if (this.useMongo()) {
            const o = await this.mongo.findByMysqlId('orders', id);
            if (!o)
                return null;
            const counts = await this.dmDetailsCountMap([id]);
            return this.shapeDmOrder(o, counts.get(id) ?? 1);
        }
        const o = await this.prisma.orders.findUnique({ where: { id: BigInt(id) } });
        return o ? { ...o, id: Number(o.id), user_id: o.user_id ? Number(o.user_id) : null, restaurant_id: Number(o.restaurant_id), order_amount: Number(o.order_amount) } : null;
    }
    async orderDetails(idStr) {
        const id = parseInt(idStr ?? '', 10);
        if (!Number.isFinite(id))
            return [];
        if (this.useMongo()) {
            const items = await this.mongo.findMany('order_details', { order_id: id }, { sort: { mysql_id: 1 } });
            return items.map((it) => {
                let parsed = {};
                try {
                    parsed = JSON.parse(it.food_details ?? '{}');
                }
                catch { }
                return {
                    id: Number(it.mysql_id),
                    order_id: id,
                    food_id: it.food_id ?? null,
                    item_campaign_id: it.item_campaign_id ?? null,
                    price: Number(it.price ?? 0),
                    quantity: Number(it.quantity ?? 1),
                    tax_amount: Number(it.tax_amount ?? 0),
                    discount_on_food: Number(it.discount_on_food ?? 0),
                    add_ons: it.add_ons ?? [],
                    total_add_on_price: Number(it.total_add_on_price ?? 0),
                    variation: it.variation ?? [],
                    variant: it.variant ?? null,
                    food_details: it.food_details ?? null,
                    food: {
                        id: it.food_id ?? null,
                        name: parsed.name ?? 'Item',
                        image: parsed.image ?? null,
                    },
                };
            });
        }
        return [];
    }
    acceptOrder() { return { message: 'order accepted' }; }
    updatePayment() { return { message: 'updated' }; }
    sendOtp() { return { otp: '1234' }; }
    recordLocation() { return { ok: true }; }
    lastLocation() { return { ok: true }; }
    async earningReport(req) {
        if (!this.useMongo())
            return { today: 0, this_week: 0, this_month: 0, all_time: 0 };
        const actorId = Number(req.actor.id);
        const rows = await this.mongo.findMany('orders', { mysql_delivery_man_id: actorId, order_status: 'delivered' });
        const now = Date.now(), dayMs = 86_400_000;
        let today = 0, week = 0, month = 0, all = 0;
        for (const o of rows) {
            const ts = o.created_at ? new Date(o.created_at).getTime() : 0;
            if (!Number.isFinite(ts) || ts === 0)
                continue;
            const earn = Number(o.delivery_charge ?? 0) + Number(o.dm_tips ?? 0);
            all += earn;
            const age = now - ts;
            if (age <= dayMs)
                today += earn;
            if (age <= 7 * dayMs)
                week += earn;
            if (age <= 30 * dayMs)
                month += earn;
        }
        return { today, this_week: week, this_month: month, all_time: all };
    }
    disbursementReport() { return { data: [], total: 0 }; }
    walletPayments() { return { data: [], total_size: 0 }; }
    collectedCash() { return { message: 'recorded' }; }
    walletAdjustment() { return { message: 'recorded' }; }
    async withdrawMethods() {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('withdrawal_methods', { $or: [{ is_active: 1 }, { is_active: true }] });
            return rows.map((r) => ({
                id: Number(r.mysql_id),
                method_name: r.method_name,
                method_fields: r.method_fields,
                is_default: r.is_default,
            }));
        }
        const rows = await this.prisma.withdrawal_methods.findMany({ where: { is_active: 1 } });
        return rows.map((r) => ({ id: Number(r.id), method_name: r.method_name, method_fields: r.method_fields, is_default: r.is_default }));
    }
    withdrawStore() { return { message: 'method added' }; }
    withdrawDefault() { return { message: 'default set' }; }
    withdrawDelete() { return { message: 'deleted' }; }
    getWithdrawMethods() { return this.withdrawMethods(); }
    async dmShift() {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('shifts', { status: true });
            return rows.map((r) => ({
                id: Number(r.mysql_id),
                name: r.name,
                start_time: r.start_time,
                end_time: r.end_time,
                is_full_day: r.is_full_day,
            }));
        }
        const rows = await this.prisma.shifts.findMany({ where: { status: true } });
        return rows.map((r) => ({ id: Number(r.id), name: r.name, start_time: r.start_time, end_time: r.end_time, is_full_day: r.is_full_day }));
    }
    dmTopic(req) {
        return { topic: `zone_${req.actor.id}_delivery_man` };
    }
    submitReview() { return { message: 'review submitted' }; }
    async notifications() {
        if (this.useMongo()) {
            const rows = await this.mongo.findMany('notifications', { status: true }, { sort: { mysql_id: -1 }, limit: 50 });
            return rows.map((r) => ({ id: Number(r.mysql_id), title: r.title, description: r.description }));
        }
        const rows = await this.prisma.notifications.findMany({ where: { status: true }, orderBy: { id: 'desc' }, take: 50 });
        return rows.map((r) => ({ id: Number(r.id), title: r.title, description: r.description }));
    }
    messageList() { return { conversations: [], total_size: 0 }; }
    messageDetails() { return { messages: [] }; }
    messageSearch() { return { conversations: [] }; }
    messageSend() { return { message: 'sent' }; }
};
exports.DeliveryExtrasController = DeliveryExtrasController;
__decorate([
    (0, common_1.Get)('profile'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "profile", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-profile'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-active-status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "toggleActive", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-fcm-token'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "fcmToken", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('remove-account'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)('all-orders'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "allOrders", null);
__decorate([
    (0, common_1.Get)('current-orders'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "currentOrders", null);
__decorate([
    (0, common_1.Get)('latest-orders'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "latestOrders", null);
__decorate([
    (0, common_1.Get)('order'),
    __param(0, (0, common_1.Query)('order_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "order", null);
__decorate([
    (0, common_1.Get)('order-details'),
    __param(0, (0, common_1.Query)('order_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "orderDetails", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('accept-order'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "acceptOrder", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('update-payment-status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "updatePayment", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('send-order-otp'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "sendOtp", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('record-location-data'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "recordLocation", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('last-location'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "lastLocation", null);
__decorate([
    (0, common_1.Get)('earning-report'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "earningReport", null);
__decorate([
    (0, common_1.Get)('get-disbursement-report'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "disbursementReport", null);
__decorate([
    (0, common_1.Get)('wallet-payment-list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "walletPayments", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('make-collected-cash-payment'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "collectedCash", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('make-wallet-adjustment'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "walletAdjustment", null);
__decorate([
    (0, common_1.Get)('withdraw-method/list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "withdrawMethods", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('withdraw-method/store'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "withdrawStore", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('withdraw-method/make-default'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "withdrawDefault", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Delete)('withdraw-method/delete'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "withdrawDelete", null);
__decorate([
    (0, common_1.Get)('get-withdraw-method-list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "getWithdrawMethods", null);
__decorate([
    (0, common_1.Get)('dm-shift'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "dmShift", null);
__decorate([
    (0, common_1.Get)('dm-topic'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "dmTopic", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('reviews/submit'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "submitReview", null);
__decorate([
    (0, common_1.Get)('notifications'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DeliveryExtrasController.prototype, "notifications", null);
__decorate([
    (0, common_1.Get)('message/list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "messageList", null);
__decorate([
    (0, common_1.Get)('message/details'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "messageDetails", null);
__decorate([
    (0, common_1.Get)('message/search-list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "messageSearch", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('message/send'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeliveryExtrasController.prototype, "messageSend", null);
exports.DeliveryExtrasController = DeliveryExtrasController = __decorate([
    (0, common_1.Controller)('delivery-man'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, auth_guard_1.RequireAuth)('deliveryman'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        mongo_data_service_1.MongoDataService])
], DeliveryExtrasController);
//# sourceMappingURL=delivery-extras.controller.js.map