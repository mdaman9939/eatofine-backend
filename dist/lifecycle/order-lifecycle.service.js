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
exports.OrderLifecycleService = void 0;
const common_1 = require("@nestjs/common");
const mongo_data_service_1 = require("../mongo/mongo-data.service");
const fcm_service_1 = require("../notifications/fcm.service");
const order_lifecycle_constants_1 = require("./order-lifecycle.constants");
let OrderLifecycleService = class OrderLifecycleService {
    mongo;
    fcm;
    logger = new common_1.Logger('OrderLifecycle');
    constructor(mongo, fcm) {
        this.mongo = mongo;
        this.fcm = fcm;
    }
    async log(orderId, fromStatus, toStatus, by, reason) {
        try {
            const id = await this.mongo.nextMysqlId('order_status_logs');
            await this.mongo.insertOne('order_status_logs', {
                mysql_id: id,
                order_id: Number(orderId),
                from_status: fromStatus ?? null,
                to_status: toStatus,
                changed_by: by,
                reason: reason ?? null,
                created_at: new Date(),
            });
        }
        catch (e) {
            this.logger.warn(`audit log failed for order ${orderId}: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
    async tokenForUser(userId) {
        if (!userId)
            return null;
        const u = await this.mongo.findOne('users', { mysql_id: Number(userId) });
        return u?.fcm_token ?? null;
    }
    async tokenForRestaurant(restaurantId) {
        if (!restaurantId)
            return null;
        const r = await this.mongo.findOne('restaurants', { mysql_id: Number(restaurantId) });
        if (!r?.mysql_vendor_id)
            return null;
        const v = await this.mongo.findOne('vendors', { mysql_id: Number(r.mysql_vendor_id) });
        return v?.fcm_token ?? null;
    }
    async tokenForDeliveryMan(dmId) {
        if (!dmId)
            return null;
        const d = await this.mongo.findOne('delivery_men', { mysql_id: Number(dmId) });
        return d?.fcm_token ?? null;
    }
    async push(token, title, body, orderId, type) {
        if (!token)
            return;
        await this.fcm.sendToToken(token, { title, body }, { type, order_id: orderId, title }).catch(() => undefined);
    }
    refundStatusForCancel(order) {
        const isCod = (order.payment_method ?? 'cash_on_delivery') === 'cash_on_delivery';
        if (isCod)
            return order_lifecycle_constants_1.REFUND_STATUS.NOT_REQUIRED;
        return order.payment_status === 'paid' ? order_lifecycle_constants_1.REFUND_STATUS.PENDING : order_lifecycle_constants_1.REFUND_STATUS.NOT_REQUIRED;
    }
    async cancelOrder(orderId, reason, by) {
        const order = await this.mongo.findByMysqlId('orders', orderId);
        if (!order)
            return { ok: false, reason: 'order_not_found' };
        if (order_lifecycle_constants_1.TERMINAL_STATUSES.has(String(order.order_status))) {
            return { ok: false, skipped: true, reason: `already_${order.order_status}` };
        }
        const toStatus = reason === 'restaurant_not_responded' ? 'auto_cancelled' : 'canceled';
        const refundStatus = this.refundStatusForCancel(order);
        await this.mongo.updateOne('orders', { mysql_id: Number(orderId) }, {
            order_status: toStatus,
            cancel_reason: reason,
            cancellation_reason: reason,
            canceled_by: by,
            refund_status: refundStatus,
            canceled: new Date(),
            updated_at: new Date(),
        });
        await this.log(orderId, order.order_status, toStatus, by, reason);
        const [custTok, restTok] = await Promise.all([
            this.tokenForUser(order.mysql_user_id),
            this.tokenForRestaurant(order.mysql_restaurant_id),
        ]);
        await this.push(custTok, 'Order cancelled', order_lifecycle_constants_1.CANCEL_MESSAGE_CUSTOMER[reason], orderId, 'order_cancelled');
        await this.push(restTok, 'Order cancelled', order_lifecycle_constants_1.CANCEL_MESSAGE_RESTAURANT[reason], orderId, 'order_cancelled');
        if (order_lifecycle_constants_1.NOTIFY_DELIVERY_ON_CANCEL.has(reason) && order.mysql_delivery_man_id) {
            const dmTok = await this.tokenForDeliveryMan(order.mysql_delivery_man_id);
            await this.push(dmTok, 'Order cancelled', 'Order cancelled', orderId, 'order_cancelled');
        }
        return { ok: true, status: toStatus, cancel_reason: reason, refund_status: refundStatus };
    }
    canCancel(order, by) {
        const s = (0, order_lifecycle_constants_1.normaliseStatus)(String(order.order_status ?? ''));
        if (order_lifecycle_constants_1.TERMINAL_STATUSES.has(s))
            return false;
        if (by === 'admin')
            return true;
        return s === 'pending' || s === 'confirmed';
    }
    async handleDeliveryRejection(orderId, rejectingDmId) {
        const order = await this.mongo.findByMysqlId('orders', orderId);
        if (!order)
            return { ok: false };
        await this.mongo.updateOne('orders', { mysql_id: Number(orderId) }, {
            mysql_delivery_man_id: null,
            delivery_man_id: null,
            updated_at: new Date(),
        });
        await this.log(orderId, order.order_status, String(order.order_status), 'delivery_partner', `rider_${rejectingDmId}_rejected`);
        const next = await this.findAvailableRider(order, rejectingDmId);
        if (next) {
            await this.mongo.updateOne('orders', { mysql_id: Number(orderId) }, {
                mysql_delivery_man_id: next, delivery_man_id: next, updated_at: new Date(),
            });
            await this.log(orderId, order.order_status, String(order.order_status), 'system', `reassigned_to_${next}`);
            const tok = await this.tokenForDeliveryMan(next);
            await this.push(tok, 'New delivery assigned', 'Pick up order', orderId, 'order_assigned');
            return { ok: true, reassigned_to: next };
        }
        await this.cancelOrder(orderId, 'delivery_partner_unavailable', 'system');
        return { ok: true, cancelled: true };
    }
    async findAvailableRider(order, excludeDmId) {
        const filter = {
            mysql_id: { $ne: Number(excludeDmId) },
            $or: [{ application_status: 'approved' }, { application_status: { $exists: false } }],
        };
        if (order.mysql_zone_id != null)
            filter.mysql_zone_id = Number(order.mysql_zone_id);
        const riders = await this.mongo.findMany('delivery_men', filter, { limit: 20 });
        const active = riders.find((r) => r.status === true || r.status === 1 || r.status === undefined) ?? riders[0];
        return active ? Number(active.mysql_id) : null;
    }
    async autoCancelStalePending() {
        const cutoff = new Date(Date.now() - 60_000);
        const stale = await this.mongo.findMany('orders', {
            order_status: 'pending',
            $or: [{ pending: { $lte: cutoff } }, { pending: { $exists: false }, created_at: { $lte: cutoff } }],
        }, { limit: 500, sort: { mysql_id: 1 } });
        let cancelled = 0;
        for (const o of stale) {
            const res = await this.cancelOrder(Number(o.mysql_id), 'restaurant_not_responded', 'system');
            if (res.ok)
                cancelled++;
        }
        if (cancelled)
            this.logger.log(`auto-cancelled ${cancelled} unresponded pending order(s)`);
        return { cancelled };
    }
    async recordTransition(orderId, fromStatus, toStatus, by) {
        const canonical = (0, order_lifecycle_constants_1.normaliseStatus)(toStatus);
        await this.log(orderId, fromStatus, canonical, by);
        const label = order_lifecycle_constants_1.STATUS_LABELS[canonical]?.customer;
        if (label) {
            const order = await this.mongo.findByMysqlId('orders', orderId);
            const tok = await this.tokenForUser(order?.mysql_user_id);
            await this.push(tok, 'Order update', label, orderId, 'order_status');
        }
    }
};
exports.OrderLifecycleService = OrderLifecycleService;
exports.OrderLifecycleService = OrderLifecycleService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [mongo_data_service_1.MongoDataService,
        fcm_service_1.FcmService])
], OrderLifecycleService);
//# sourceMappingURL=order-lifecycle.service.js.map