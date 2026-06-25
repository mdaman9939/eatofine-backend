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
exports.SettlementService = void 0;
const common_1 = require("@nestjs/common");
const mongo_data_service_1 = require("../mongo/mongo-data.service");
const dm_wallet_service_1 = require("../wallet/dm-wallet.service");
const r2 = (n) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};
let SettlementService = class SettlementService {
    mongo;
    dmWallet;
    logger = new common_1.Logger('Settlement');
    indexesReady = false;
    constructor(mongo, dmWallet) {
        this.mongo = mongo;
        this.dmWallet = dmWallet;
    }
    async ensureIndexes() {
        if (this.indexesReady)
            return;
        await Promise.all([
            this.mongo.ensureIndex('settlements', { mysql_order_id: 1, mysql_restaurant_id: 1 }, { unique: true, name: 'uniq_order_restaurant' }),
            this.mongo.ensureIndex('wallet_transaction_ledger', { mysql_order_id: 1, leg: 1 }, { unique: true, name: 'uniq_order_leg' }),
            this.mongo.ensureIndex('platform_revenue_ledger', { mysql_order_id: 1 }, { unique: true, name: 'uniq_order' }),
            this.mongo.ensureIndex('tax_ledger', { mysql_order_id: 1 }, { unique: true, name: 'uniq_order' }),
            this.mongo.ensureIndex('discount_ledger', { mysql_order_id: 1 }, { unique: true, name: 'uniq_order' }),
            this.mongo.ensureIndex('withdrawal_ledger', { mysql_id: 1 }, { unique: true, name: 'uniq_id' }),
        ]);
        this.indexesReady = true;
    }
    async resolveDiscounts(order) {
        const admin = r2(Math.max(0, num(order.admin_discount_amount)));
        const restaurant = r2(Math.max(0, num(order.restaurant_discount_amount)));
        const owner = order.discount_owner ||
            (restaurant > 0 && admin === 0 ? 'restaurant' : 'admin');
        let coupon = null;
        if (num(order.coupon_discount_amount) > 0 && order.coupon_code) {
            coupon = await this.mongo.findOne('coupons', { code: order.coupon_code });
        }
        return { admin, restaurant, coupon, owner };
    }
    computeBreakdown(order, restaurant, foodAmount, discounts) {
        const customerPayment = r2(num(order.order_amount));
        const tax = r2(num(order.total_tax_amount));
        const deliveryCharge = r2(num(order.delivery_charge));
        const platformFee = r2(num(order.additional_charge));
        const hasDeliveryMan = order.mysql_delivery_man_id != null && Number(order.mysql_delivery_man_id) > 0;
        const commissionBase = Math.max(0, r2(foodAmount - discounts.restaurant));
        const commissionPct = Math.max(0, num(restaurant?.comission));
        const adminCommission = r2((commissionBase * commissionPct) / 100);
        const adminMarkup = r2(num(restaurant?.admin_markup));
        const deliverymanEarning = hasDeliveryMan ? deliveryCharge : 0;
        const undeliveredDelivery = hasDeliveryMan ? 0 : deliveryCharge;
        const platformRevenue = r2(adminCommission + platformFee + adminMarkup + undeliveredDelivery);
        const restaurantEarning = r2(customerPayment + discounts.admin - platformRevenue - deliverymanEarning - tax);
        const adminNet = r2(platformRevenue - discounts.admin);
        const lhs = r2(customerPayment + discounts.admin);
        const rhs = r2(restaurantEarning + platformRevenue + deliverymanEarning + tax);
        const identityOk = Math.abs(lhs - rhs) < 0.01;
        return {
            food_amount: r2(foodAmount),
            customer_payment: customerPayment,
            gross_order_amount: customerPayment,
            tax_amount: tax,
            delivery_charge: deliveryCharge,
            platform_fee: platformFee,
            admin_commission: adminCommission,
            admin_markup: adminMarkup,
            admin_discount: r2(discounts.admin),
            restaurant_discount: r2(discounts.restaurant),
            platform_revenue: platformRevenue,
            deliveryman_earning: deliverymanEarning,
            admin_net: adminNet,
            restaurant_earning: restaurantEarning,
            identity_ok: identityOk,
        };
    }
    async creditWalletOnce(orderId, leg, walletCollection, matchFilter, seed, amount, meta) {
        if (amount === 0)
            return false;
        const claimed = await this.mongo.tryInsertUnique('wallet_transaction_ledger', {
            mysql_order_id: orderId,
            leg,
            wallet_type: leg,
            amount: r2(amount),
            credit: amount > 0 ? r2(amount) : 0,
            debit: amount < 0 ? r2(-amount) : 0,
            ...meta,
            created_at: new Date(),
        });
        if (!claimed)
            return false;
        await this.mongo.increment(walletCollection, matchFilter, { balance: r2(amount), total_earning: r2(amount) }, { ...seed, created_at: new Date() });
        return true;
    }
    async writeLedgerOnce(collection, orderId, doc) {
        await this.mongo.tryInsertUnique(collection, {
            mysql_order_id: orderId,
            ...doc,
            created_at: new Date(),
        });
    }
    async settleOrder(orderId) {
        const order = await this.mongo.findByMysqlId('orders', orderId);
        if (!order)
            return { ok: false, reason: 'order_not_found' };
        if (order.order_status !== 'delivered' && order.order_status !== 'completed') {
            return { ok: false, skipped: true, reason: `not_terminal (${order.order_status ?? 'unknown'})` };
        }
        const restaurantId = order.mysql_restaurant_id != null ? Number(order.mysql_restaurant_id) : null;
        if (!restaurantId)
            return { ok: false, reason: 'order_has_no_restaurant' };
        await this.ensureIndexes();
        let settlement = await this.mongo.findOne('settlements', {
            mysql_order_id: orderId,
            mysql_restaurant_id: restaurantId,
        });
        if (settlement?.settlement_completed) {
            return { ok: true, skipped: true, reason: 'already_settled', settlement };
        }
        if (!settlement) {
            const mysqlId = await this.mongo.nextMysqlId('settlements');
            const claimed = await this.mongo.tryInsertUnique('settlements', {
                mysql_id: mysqlId,
                mysql_order_id: orderId,
                mysql_restaurant_id: restaurantId,
                mysql_delivery_man_id: order.mysql_delivery_man_id ?? null,
                settlement_completed: false,
                created_at: new Date(),
            });
            if (!claimed) {
                settlement = await this.mongo.findOne('settlements', {
                    mysql_order_id: orderId,
                    mysql_restaurant_id: restaurantId,
                });
                if (settlement?.settlement_completed) {
                    return { ok: true, skipped: true, reason: 'already_settled', settlement };
                }
            }
        }
        const details = await this.mongo.findMany('order_details', { order_id: orderId });
        const foodAmount = r2(details.reduce((s, d) => s + num(d.price) * num(d.quantity), 0));
        const restaurant = await this.mongo.findByMysqlId('restaurants', restaurantId);
        const discounts = await this.resolveDiscounts(order);
        const b = this.computeBreakdown(order, restaurant, foodAmount, discounts);
        if (!b.identity_ok) {
            this.logger.warn(`Order ${orderId}: accounting identity mismatch — stored anyway for audit.`);
        }
        await this.creditWalletOnce(orderId, 'restaurant', 'restaurant_wallets', { mysql_restaurant_id: restaurantId }, { restaurant_id: restaurantId }, b.restaurant_earning, { owner_id: restaurantId, reference: `settlement#${orderId}` });
        const dmId = order.mysql_delivery_man_id != null ? Number(order.mysql_delivery_man_id) : 0;
        if (dmId > 0) {
            await this.creditWalletOnce(orderId, 'deliveryman', 'delivery_man_wallets', { mysql_delivery_man_id: dmId }, { delivery_man_id: dmId }, b.deliveryman_earning, { owner_id: dmId, reference: `settlement#${orderId}` });
            await this.dmWallet.reconcileTips(orderId).catch(() => undefined);
            await this.dmWallet.evaluateIncentives(dmId).catch(() => undefined);
            if ((order.payment_method ?? 'cash_on_delivery') === 'cash_on_delivery') {
                await this.dmWallet.recordCod(dmId, orderId, Number(order.order_amount ?? 0)).catch(() => undefined);
            }
        }
        await this.creditWalletOnce(orderId, 'admin', 'admin_wallet', { key: 'platform' }, {}, b.admin_net, { owner_id: 0, reference: `settlement#${orderId}` });
        await this.writeLedgerOnce('platform_revenue_ledger', orderId, {
            mysql_restaurant_id: restaurantId,
            admin_commission: b.admin_commission,
            platform_fee: b.platform_fee,
            admin_markup: b.admin_markup,
            platform_revenue: b.platform_revenue,
            admin_net: b.admin_net,
        });
        await this.writeLedgerOnce('tax_ledger', orderId, {
            mysql_restaurant_id: restaurantId,
            total_tax: b.tax_amount,
            cgst: r2(b.tax_amount / 2),
            sgst: r2(b.tax_amount / 2),
            igst: 0,
        });
        if (b.admin_discount > 0 || b.restaurant_discount > 0) {
            await this.writeLedgerOnce('discount_ledger', orderId, {
                mysql_restaurant_id: restaurantId,
                coupon_id: discounts.coupon?.mysql_id ?? null,
                coupon_code: order.coupon_code ?? discounts.coupon?.code ?? null,
                discount_owner: discounts.owner,
                discount_type: discounts.coupon?.discount_type ?? null,
                total_discount_amount: r2(b.admin_discount + b.restaurant_discount),
                admin_discount_amount: b.admin_discount,
                restaurant_discount_amount: b.restaurant_discount,
                order_id: orderId,
                restaurant_id: restaurantId,
            });
        }
        await this.mongo.updateOne('settlements', { mysql_order_id: orderId, mysql_restaurant_id: restaurantId }, {
            ...b,
            order_type: order.order_type ?? null,
            payment_method: order.payment_method ?? null,
            discount_owner: discounts.owner,
            settlement_completed: true,
            completed_at: new Date(),
            updated_at: new Date(),
        });
        const finalDoc = await this.mongo.findOne('settlements', {
            mysql_order_id: orderId,
            mysql_restaurant_id: restaurantId,
        });
        return { ok: true, settlement: finalDoc ?? undefined };
    }
    async getSettlement(orderId) {
        return this.mongo.findOne('settlements', { mysql_order_id: Number(orderId) });
    }
    async listSettlements(limit = 50, offset = 0) {
        const [items, total] = await Promise.all([
            this.mongo.findMany('settlements', {}, { sort: { mysql_id: -1 }, limit, skip: offset }),
            this.mongo.count('settlements', {}),
        ]);
        return { total, items };
    }
    async requestWithdrawal(body) {
        await this.ensureIndexes();
        const amount = r2(num(body.amount));
        const id = await this.mongo.nextMysqlId('withdrawal_ledger');
        await this.mongo.insertOne('withdrawal_ledger', {
            mysql_id: id,
            actor_type: body.actor_type,
            actor_id: Number(body.actor_id),
            amount,
            status: 'pending',
            created_at: new Date(),
        });
        return { ok: true, id };
    }
};
exports.SettlementService = SettlementService;
exports.SettlementService = SettlementService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [mongo_data_service_1.MongoDataService,
        dm_wallet_service_1.DmWalletService])
], SettlementService);
//# sourceMappingURL=settlement.service.js.map