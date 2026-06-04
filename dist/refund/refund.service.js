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
            const refundId = await this.mongo.nextMysqlId('refunds');
            await this.mongo.insertOne('refunds', {
                mysql_id: refundId,
                order_id: orderId,
                user_id: preview.money ? (await this.userIdFor(orderId)) : null,
                customer_reason: scenario.label,
                customer_note: remarks,
                refund_amount: effects.refund_amount,
                refund_method: 'wallet',
                refund_status: 'approved',
                admin_note: `Auto-created by refund engine for scenario ${scenario.key}`,
                created_at: new Date(),
            });
            artefacts.refund_id = refundId;
        }
        if (effects.generate_credit_note && effects.refund_amount > 0) {
            const cnId = await this.mongo.nextMysqlId('credit_notes');
            await this.mongo.insertOne('credit_notes', {
                mysql_id: cnId,
                order_id: orderId,
                amount: effects.refund_amount,
                reason: scenario.label,
                notes: remarks,
                status: 'issued',
                created_at: new Date(),
            });
            artefacts.credit_note_id = cnId;
        }
        if (effects.restaurant_wallet.direction !== 'none' && effects.restaurant_wallet.amount > 0) {
            const id = await this.writeLedger({
                actor_type: 'restaurant',
                actor_id: (await this.mongo.findByMysqlId('orders', orderId))?.mysql_restaurant_id ?? null,
                order_id: orderId,
                direction: effects.restaurant_wallet.direction,
                amount: effects.restaurant_wallet.amount,
                note: effects.restaurant_wallet.note,
                scenario: scenario.key,
            });
            artefacts.wallet_ledger_ids.push(id);
        }
        if (effects.deliveryman_wallet.direction !== 'none' && effects.deliveryman_wallet.amount > 0) {
            const id = await this.writeLedger({
                actor_type: 'deliveryman',
                actor_id: (await this.mongo.findByMysqlId('orders', orderId))?.mysql_delivery_man_id ?? null,
                order_id: orderId,
                direction: effects.deliveryman_wallet.direction,
                amount: effects.deliveryman_wallet.amount,
                note: effects.deliveryman_wallet.note,
                scenario: scenario.key,
            });
            artefacts.wallet_ledger_ids.push(id);
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
        const itemTotal = Math.max(0, grandTotal - tax - deliveryCharge + restDiscount - Number(o.coupon_discount_amount ?? 0));
        const txn = await this.mongo.findOne('order_transactions', { order_id: o.mysql_id });
        const additional = Number(txn?.additional_charge ?? 0);
        const packaging = Number(txn?.extra_packaging_amount ?? 0);
        const commission = Number(txn?.admin_commission ?? Math.round(itemTotal * 0.20 * 100) / 100);
        return {
            item_total: round2(itemTotal),
            tax: round2(tax),
            delivery_charge: round2(deliveryCharge),
            packaging_amount: round2(packaging),
            additional_charge: round2(additional),
            admin_commission: round2(commission),
            grand_total: round2(grandTotal),
        };
    }
    async userIdFor(orderId) {
        const o = await this.mongo.findByMysqlId('orders', orderId);
        return o?.mysql_user_id ?? null;
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
//# sourceMappingURL=refund.service.js.map