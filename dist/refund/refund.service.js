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
exports.RefundService = void 0;
const common_1 = require("@nestjs/common");
const mongo_data_service_1 = require("../mongo/mongo-data.service");
const credit_note_util_1 = require("../completion/credit-note.util");
const refund_policy_1 = require("./refund-policy");
let RefundService = class RefundService {
    mongo;
    constructor(mongo) {
        this.mongo = mongo;
    }
    catalogue() {
        return { scenarios: (0, refund_policy_1.listScenarios)() };
    }
    async preview(orderId, scenarioKey) {
        const scenario = (0, refund_policy_1.getScenario)(scenarioKey);
        if (!scenario)
            throw new common_1.BadRequestException({ errors: [{ code: 'scenario', message: `unknown scenario: ${scenarioKey}` }] });
        const order = await this.mongo.findByMysqlId('orders', orderId);
        if (!order)
            throw new common_1.NotFoundException({ errors: [{ code: 'order', message: 'Order not found' }] });
        const stage = this.stageOf(order);
        if (!scenario.allowsStage(stage)) {
            throw new common_1.BadRequestException({
                errors: [{
                        code: 'scenario_not_applicable',
                        message: `Scenario "${scenarioKey}" is not valid for an order in stage "${stage.status}" (DM=${stage.has_delivery_man}, delivered=${stage.is_delivered}).`,
                    }],
            });
        }
        const money = await this.moneyOf(order);
        const effects = scenario.decide(money);
        return {
            order_id: orderId,
            scenario: { key: scenario.key, label: scenario.label, cancelled_by: scenario.cancelled_by },
            stage,
            money,
            effects,
        };
    }
    async applicable(orderId) {
        const order = await this.mongo.findByMysqlId('orders', orderId);
        if (!order)
            throw new common_1.NotFoundException({ errors: [{ code: 'order', message: 'Order not found' }] });
        const stage = this.stageOf(order);
        return { order_id: orderId, stage, scenarios: (0, refund_policy_1.applicableScenarios)(stage) };
    }
    async apply(orderId, scenarioKey, remarks) {
        if (!remarks || !remarks.trim()) {
            throw new common_1.BadRequestException({ errors: [{ code: 'remarks', message: 'Admin remarks are required.' }] });
        }
        const preview = await this.preview(orderId, scenarioKey);
        const { effects, scenario } = preview;
        const artefacts = { wallet_ledger_ids: [] };
        await this.mongo.updateOne('orders', { mysql_id: orderId }, {
            order_status: effects.final_order_status,
            canceled_by: scenario.cancelled_by,
            cancellation_reason: scenario.label,
            cancellation_note: remarks,
            canceled: new Date(),
            ...(effects.final_order_status === 'refunded' ? { refunded: new Date() } : {}),
        });
        if (effects.refund_to_user && effects.refund_amount > 0) {
            const userId = await this.userIdFor(orderId);
            const refundId = await this.mongo.nextMysqlId('refunds');
            await this.mongo.insertOne('refunds', {
                mysql_id: refundId,
                order_id: orderId,
                user_id: userId,
                customer_reason: scenario.label,
                customer_note: remarks,
                refund_amount: effects.refund_amount,
                refund_method: 'wallet',
                refund_status: 'completed',
                admin_note: `Auto-created by refund engine for scenario ${scenario.key}`,
                created_at: new Date(),
            });
            artefacts.refund_id = refundId;
            await this.creditCustomerWallet(userId, effects.refund_amount, `Refund for order #${orderId} — ${scenario.label}`, orderId);
        }
        if (effects.generate_credit_note && effects.refund_amount > 0) {
            const { record } = await (0, credit_note_util_1.issueCreditNote)(this.mongo, {
                orderId,
                refundId: artefacts.refund_id ?? null,
                amount: effects.refund_amount,
                reason: scenario.label,
                notes: remarks,
            });
            if (record)
                artefacts.credit_note_id = record.mysql_id;
        }
        if (effects.generate_invoice) {
            await (0, credit_note_util_1.ensureOrderInvoice)(this.mongo, orderId);
        }
        const orderDoc = await this.mongo.findByMysqlId('orders', orderId);
        if (effects.restaurant_wallet.direction !== 'none' && effects.restaurant_wallet.amount > 0) {
            const restId = orderDoc?.mysql_restaurant_id ?? null;
            const id = await this.writeLedger({
                actor_type: 'restaurant',
                actor_id: restId,
                order_id: orderId,
                direction: effects.restaurant_wallet.direction,
                amount: effects.restaurant_wallet.amount,
                note: effects.restaurant_wallet.note,
                scenario: scenario.key,
            });
            artefacts.wallet_ledger_ids.push(id);
            await this.moveActorWallet('restaurant', restId, effects.restaurant_wallet.direction, effects.restaurant_wallet.amount);
        }
        if (effects.deliveryman_wallet.direction !== 'none' && effects.deliveryman_wallet.amount > 0) {
            const dmId = orderDoc?.mysql_delivery_man_id ?? null;
            const id = await this.writeLedger({
                actor_type: 'deliveryman',
                actor_id: dmId,
                order_id: orderId,
                direction: effects.deliveryman_wallet.direction,
                amount: effects.deliveryman_wallet.amount,
                note: effects.deliveryman_wallet.note,
                scenario: scenario.key,
            });
            artefacts.wallet_ledger_ids.push(id);
            await this.moveActorWallet('deliveryman', dmId, effects.deliveryman_wallet.direction, effects.deliveryman_wallet.amount);
        }
        const decisionId = await this.mongo.nextMysqlId('refund_decisions');
        const decision = {
            mysql_id: decisionId,
            order_id: orderId,
            scenario: scenario.key,
            remarks,
            effects,
            applied_at: new Date(),
            artefacts,
        };
        await this.mongo.insertOne('refund_decisions', decision);
        return { ok: true, decision_id: decisionId, artefacts, effects, scenario };
    }
    async applyCustomerCancellation(orderId, scenarioKey) {
        const scenario = (0, refund_policy_1.getScenario)(scenarioKey);
        if (!scenario)
            return { refund_status: 'not_required', refund_amount: 0, scenario: scenarioKey };
        const order = await this.mongo.findByMysqlId('orders', orderId);
        if (!order)
            return { refund_status: 'not_required', refund_amount: 0, scenario: scenarioKey };
        const money = await this.moneyOf(order);
        const effects = scenario.decide(money);
        const ledgerIds = [];
        let refundStatus = 'not_required';
        let refundId;
        const paid = String(order.payment_status ?? '') === 'paid';
        if (effects.refund_to_user && effects.refund_amount > 0 && paid) {
            const userId = order.mysql_user_id ?? null;
            refundId = await this.mongo.nextMysqlId('refunds');
            await this.mongo.insertOne('refunds', {
                mysql_id: refundId, order_id: orderId, user_id: userId,
                customer_reason: scenario.label, refund_amount: effects.refund_amount,
                refund_method: 'wallet', refund_status: 'completed',
                admin_note: `Auto refund (user cancel) — ${scenario.key}`, created_at: new Date(),
            });
            await this.creditCustomerWallet(userId, effects.refund_amount, `Refund for order #${orderId} — ${scenario.label}`, orderId);
            refundStatus = 'completed';
        }
        if (effects.restaurant_wallet.direction === 'credit' && effects.restaurant_wallet.amount > 0) {
            const id = await this.writeLedger({ actor_type: 'restaurant', actor_id: order.mysql_restaurant_id ?? null, order_id: orderId, direction: 'credit', amount: effects.restaurant_wallet.amount, note: effects.restaurant_wallet.note, scenario: scenario.key });
            ledgerIds.push(id);
            await this.moveActorWallet('restaurant', order.mysql_restaurant_id ?? null, 'credit', effects.restaurant_wallet.amount);
        }
        if (effects.deliveryman_wallet.direction === 'credit' && effects.deliveryman_wallet.amount > 0) {
            const id = await this.writeLedger({ actor_type: 'deliveryman', actor_id: order.mysql_delivery_man_id ?? null, order_id: orderId, direction: 'credit', amount: effects.deliveryman_wallet.amount, note: effects.deliveryman_wallet.note, scenario: scenario.key });
            ledgerIds.push(id);
            await this.moveActorWallet('deliveryman', order.mysql_delivery_man_id ?? null, 'credit', effects.deliveryman_wallet.amount);
        }
        if (effects.generate_invoice) {
            await (0, credit_note_util_1.ensureOrderInvoice)(this.mongo, orderId);
        }
        const decisionId = await this.mongo.nextMysqlId('refund_decisions');
        await this.mongo.insertOne('refund_decisions', {
            mysql_id: decisionId, order_id: orderId, scenario: scenario.key, scenario_label: scenario.label,
            cancelled_by: 'user', status: 'applied', review_kind: 'user_cancel',
            effects, artefacts: { wallet_ledger_ids: ledgerIds, refund_id: refundId ?? null },
            applied_at: new Date(), created_at: new Date(),
        });
        return { refund_status: refundStatus, refund_amount: effects.refund_amount, scenario: scenario.key };
    }
    async proposePartnerPenalty(orderId, scenarioKey, initiatedBy, reasonText) {
        const scenario = (0, refund_policy_1.getScenario)(scenarioKey);
        if (!scenario)
            return { ok: false, reason: 'unknown_scenario' };
        const order = await this.mongo.findByMysqlId('orders', orderId);
        if (!order)
            return { ok: false, reason: 'order_not_found' };
        const money = await this.moneyOf(order);
        const effects = scenario.decide(money);
        const restMoves = effects.restaurant_wallet.direction !== 'none' && effects.restaurant_wallet.amount > 0;
        const dmMoves = effects.deliveryman_wallet.direction !== 'none' && effects.deliveryman_wallet.amount > 0;
        if (!restMoves && !dmMoves) {
            return { ok: true, status: 'no_penalty' };
        }
        const decisionId = await this.mongo.nextMysqlId('refund_decisions');
        await this.mongo.insertOne('refund_decisions', {
            mysql_id: decisionId,
            order_id: orderId,
            scenario: scenario.key,
            scenario_label: scenario.label,
            cancelled_by: scenario.cancelled_by,
            status: 'pending',
            review_kind: 'partner_penalty',
            initiated_by: initiatedBy,
            reason: reasonText ?? null,
            restaurant_id: order.mysql_restaurant_id ?? null,
            delivery_man_id: order.mysql_delivery_man_id ?? null,
            effects,
            artefacts: { wallet_ledger_ids: [] },
            created_at: new Date(),
        });
        return { ok: true, status: 'pending', decision_id: decisionId };
    }
    async confirmPending(decisionId, adminRemarks) {
        if (!adminRemarks || !adminRemarks.trim()) {
            throw new common_1.BadRequestException({ errors: [{ code: 'remarks', message: 'Admin remarks are required.' }] });
        }
        const d = await this.mongo.findByMysqlId('refund_decisions', decisionId);
        if (!d)
            throw new common_1.NotFoundException({ errors: [{ code: 'decision', message: 'Decision not found' }] });
        if (d.status !== 'pending')
            throw new common_1.BadRequestException({ errors: [{ code: 'status', message: `Already ${d.status}` }] });
        const e = d.effects;
        const ledgerIds = [...(d.artefacts?.wallet_ledger_ids ?? [])];
        const moves = [
            ['restaurant', e.restaurant_wallet, d.restaurant_id ?? null],
            ['deliveryman', e.deliveryman_wallet, d.delivery_man_id ?? null],
        ];
        for (const [actorType, w, actorId] of moves) {
            if (w.direction === 'none' || w.amount <= 0)
                continue;
            const id = await this.writeLedger({
                actor_type: actorType,
                actor_id: actorId,
                order_id: d.order_id,
                direction: w.direction,
                amount: w.amount,
                note: `${w.note} (admin-confirmed)`,
                scenario: d.scenario,
            });
            ledgerIds.push(id);
            await this.moveActorWallet(actorType, actorId, w.direction, w.amount);
        }
        await this.mongo.updateOne('refund_decisions', { mysql_id: Number(decisionId) }, {
            status: 'applied',
            admin_remarks: adminRemarks,
            reviewed_at: new Date(),
            artefacts: { wallet_ledger_ids: ledgerIds },
        });
        return { ok: true, decision_id: decisionId, status: 'applied' };
    }
    async rejectPending(decisionId, adminRemarks) {
        if (!adminRemarks || !adminRemarks.trim()) {
            throw new common_1.BadRequestException({ errors: [{ code: 'remarks', message: 'Admin remarks are required.' }] });
        }
        const d = await this.mongo.findByMysqlId('refund_decisions', decisionId);
        if (!d)
            throw new common_1.NotFoundException({ errors: [{ code: 'decision', message: 'Decision not found' }] });
        if (d.status !== 'pending')
            throw new common_1.BadRequestException({ errors: [{ code: 'status', message: `Already ${d.status}` }] });
        await this.mongo.updateOne('refund_decisions', { mysql_id: Number(decisionId) }, {
            status: 'rejected', admin_remarks: adminRemarks, reviewed_at: new Date(),
        });
        return { ok: true, decision_id: decisionId, status: 'rejected' };
    }
    async listPending(limit = 50, offset = 0) {
        const filter = { status: 'pending' };
        const [rows, total] = await Promise.all([
            this.mongo.findMany('refund_decisions', filter, { sort: { mysql_id: -1 }, limit, skip: offset }),
            this.mongo.count('refund_decisions', filter),
        ]);
        const items = await Promise.all(rows.map(async (r) => {
            const o = await this.mongo.findByMysqlId('orders', Number(r.order_id));
            const penalty = r.effects.restaurant_wallet.direction === 'debit'
                ? { target: 'restaurant', amount: r.effects.restaurant_wallet.amount }
                : r.effects.deliveryman_wallet.direction === 'debit'
                    ? { target: 'deliveryman', amount: r.effects.deliveryman_wallet.amount }
                    : { target: null, amount: 0 };
            return {
                id: Number(r.mysql_id),
                order_id: r.order_id,
                scenario: r.scenario,
                scenario_label: r.scenario_label,
                cancelled_by: r.cancelled_by,
                initiated_by: r.initiated_by,
                reason: r.reason,
                order_amount: Number(o?.order_amount ?? 0),
                penalty,
                effects: r.effects,
                created_at: r.created_at,
            };
        }));
        return { total, limit, offset, items };
    }
    async historyFor(orderId) {
        const rows = await this.mongo.findMany('refund_decisions', { order_id: orderId }, {
            sort: { mysql_id: -1 }, limit: 20,
        });
        return { order_id: orderId, decisions: rows };
    }
    async ledger(limit = 100, offset = 0, actorType) {
        const filter = {};
        if (actorType)
            filter.actor_type = actorType;
        const [rows, total] = await Promise.all([
            this.mongo.findMany('wallet_ledger', filter, { sort: { mysql_id: -1 }, limit, skip: offset }),
            this.mongo.count('wallet_ledger', filter),
        ]);
        return { total, limit, offset, items: rows };
    }
    stageOf(o) {
        return {
            status: o.order_status ?? 'pending',
            has_delivery_man: o.mysql_delivery_man_id != null,
            is_delivered: o.delivered != null || o.order_status === 'delivered',
            cancelled_by: o.canceled_by ?? null,
        };
    }
    async moneyOf(o) {
        const tax = Number(o.total_tax_amount ?? 0);
        const deliveryCharge = Number(o.delivery_charge ?? 0);
        const restDiscount = Number(o.restaurant_discount_amount ?? 0);
        const grandTotal = Number(o.order_amount ?? 0);
        const additional = Number(o.additional_charge ?? 0);
        const packaging = Number(o.extra_packaging_amount ?? 0);
        const situational = Number(o.situational_charge ?? 0);
        const details = await this.mongo.findMany('order_details', { order_id: o.mysql_id });
        const foodFromDetails = round2(details.reduce((s, d) => s + Number(d.price ?? 0) * Number(d.quantity ?? 0), 0));
        const itemTotal = foodFromDetails > 0
            ? foodFromDetails
            : Math.max(0, grandTotal - tax - deliveryCharge - additional - packaging + restDiscount - Number(o.coupon_discount_amount ?? 0));
        const restaurant = await this.mongo.findByMysqlId('restaurants', Number(o.mysql_restaurant_id ?? 0));
        const commissionPct = Math.max(0, Number(restaurant?.comission ?? 0));
        const commission = round2(Math.max(0, itemTotal - restDiscount) * (commissionPct / 100));
        return {
            item_total: round2(itemTotal),
            tax: round2(tax),
            delivery_charge: round2(deliveryCharge),
            packaging_amount: round2(packaging),
            additional_charge: round2(additional),
            situational_charge: round2(situational),
            admin_commission: commission,
            admin_commission_gst: round2(commission * 0.18),
            grand_total: round2(grandTotal),
        };
    }
    async userIdFor(orderId) {
        const o = await this.mongo.findByMysqlId('orders', orderId);
        return o?.mysql_user_id ?? null;
    }
    async creditCustomerWallet(userId, amount, reason, orderId) {
        if (!userId || amount <= 0)
            return;
        const existing = await this.mongo.findOne('wallets', { $or: [{ user_id: userId }, { mysql_user_id: userId }] });
        const newBalance = round2(safeNum(existing?.balance) + amount);
        if (existing) {
            await this.mongo.updateOne('wallets', { mysql_id: Number(existing.mysql_id) }, {
                balance: newBalance, total_earning: round2(safeNum(existing.total_earning) + amount), updated_at: new Date(),
            });
        }
        else {
            const wid = await this.mongo.nextMysqlId('wallets');
            await this.mongo.insertOne('wallets', { mysql_id: wid, user_id: userId, mysql_user_id: userId, balance: newBalance, total_earning: amount, created_at: new Date() });
        }
        const txId = await this.mongo.nextMysqlId('wallet_transactions');
        await this.mongo.insertOne('wallet_transactions', {
            mysql_id: txId, user_id: userId, mysql_user_id: userId, transaction_id: `REFUND_${orderId}_${txId}`,
            credit: amount, debit: 0, balance: newBalance, transaction_type: 'order_refund', reference: reason, created_at: new Date(),
        });
    }
    async moveActorWallet(actorType, actorId, direction, amount) {
        if (!actorId || amount <= 0)
            return;
        const coll = actorType === 'restaurant' ? 'restaurant_wallets' : 'delivery_man_wallets';
        const idField = actorType === 'restaurant' ? 'restaurant_id' : 'delivery_man_id';
        const existing = await this.mongo.findOne(coll, { $or: [{ [idField]: actorId }, { [`mysql_${idField}`]: actorId }] });
        const delta = direction === 'credit' ? amount : -amount;
        const newBalance = round2(safeNum(existing?.balance) + delta);
        if (existing) {
            await this.mongo.updateOne(coll, { mysql_id: Number(existing.mysql_id) }, { balance: newBalance, updated_at: new Date() });
        }
        else {
            const wid = await this.mongo.nextMysqlId(coll);
            await this.mongo.insertOne(coll, { mysql_id: wid, [idField]: actorId, [`mysql_${idField}`]: actorId, balance: newBalance, total_earning: direction === 'credit' ? amount : 0, created_at: new Date() });
        }
    }
    async writeLedger(entry) {
        const id = await this.mongo.nextMysqlId('wallet_ledger');
        await this.mongo.insertOne('wallet_ledger', {
            mysql_id: id,
            ...entry,
            created_at: new Date(),
        });
        return id;
    }
};
exports.RefundService = RefundService;
exports.RefundService = RefundService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [mongo_data_service_1.MongoDataService])
], RefundService);
function round2(n) {
    return Math.round(n * 100) / 100;
}
function safeNum(v) {
    if (v == null)
        return 0;
    if (typeof v === 'number')
        return Number.isFinite(v) ? v : 0;
    const n = Number(typeof v === 'object' ? String(v) : v);
    return Number.isFinite(n) ? n : 0;
}
//# sourceMappingURL=refund.service.js.map