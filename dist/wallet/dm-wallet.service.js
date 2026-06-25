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
exports.DmWalletService = void 0;
const common_1 = require("@nestjs/common");
const mongo_data_service_1 = require("../mongo/mongo-data.service");
const r2 = (n) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
let DmWalletService = class DmWalletService {
    mongo;
    logger = new common_1.Logger('DmWallet');
    indexing = null;
    constructor(mongo) {
        this.mongo = mongo;
    }
    ensureIndexes() {
        if (!this.indexing) {
            this.indexing = (async () => {
                await this.mongo.ensureIndex('dm_bonus_awards', { dm_id: 1, bonus_id: 1, period_key: 1 }, { unique: true, name: 'uniq_dm_bonus_period' });
                await this.mongo.ensureIndex('dm_cod_collections', { order_id: 1 }, { unique: true, name: 'uniq_cod_order' });
                await this.mongo.ensureIndex('dm_wallet_transactions', { mysql_id: 1 }, { unique: true, name: 'uniq_id' });
                await this.mongo.ensureIndex('dm_incentive_awards', { dm_id: 1, period_key: 1 }, { unique: true, name: 'uniq_dm_incentive_period' });
                await this.mongo.ensureIndex('dm_reward_claims', { dm_id: 1, bonus_id: 1, period_key: 1 }, { unique: true, name: 'uniq_dm_reward_claim' });
            })().catch((e) => {
                this.indexing = null;
                throw e;
            });
        }
        return this.indexing;
    }
    async logTxn(dmId, credit, debit, type, reference, meta = {}) {
        const id = await this.mongo.nextMysqlId('dm_wallet_transactions');
        await this.mongo.insertOne('dm_wallet_transactions', {
            mysql_id: id,
            delivery_man_id: Number(dmId),
            mysql_delivery_man_id: Number(dmId),
            credit: r2(credit),
            debit: r2(debit),
            type,
            reference,
            ...meta,
            created_at: new Date(),
        });
    }
    async credit(dmId, amount, type, reference, meta = {}) {
        const amt = r2(amount);
        if (!dmId || amt <= 0)
            return;
        await this.mongo.increment('delivery_man_wallets', { mysql_delivery_man_id: Number(dmId) }, { balance: amt, total_earning: amt }, { mysql_delivery_man_id: Number(dmId), delivery_man_id: Number(dmId), created_at: new Date() });
        await this.logTxn(dmId, amt, 0, type, reference, meta);
    }
    async reconcileTips(orderId) {
        const o = await this.mongo.findOne('orders', { mysql_id: Number(orderId) });
        if (!o)
            return 0;
        const dmId = o.mysql_delivery_man_id != null ? Number(o.mysql_delivery_man_id) : 0;
        const tips = r2(Number(o.dm_tips ?? 0));
        const paid = r2(Number(o.dm_tips_paid_out ?? 0));
        const delta = r2(tips - paid);
        if (!dmId || delta <= 0)
            return 0;
        const claim = await this.mongo.updateOne('orders', { mysql_id: Number(orderId), dm_tips_paid_out: paid }, { dm_tips_paid_out: tips, updated_at: new Date() });
        if (!claim.matchedCount)
            return 0;
        await this.credit(dmId, delta, 'tip', `tip#order:${orderId}`, { order_id: Number(orderId) });
        return delta;
    }
    periodWindow(period, when) {
        const d = new Date(when);
        if (period === 'lifetime')
            return { key: 'all', since: null };
        if (period === 'weekly') {
            const day = d.getDay();
            const diff = day === 0 ? -6 : 1 - day;
            const monday = new Date(d);
            monday.setDate(d.getDate() + diff);
            monday.setHours(0, 0, 0, 0);
            return { key: monday.toISOString().slice(0, 10), since: monday };
        }
        const start = new Date(d);
        start.setHours(0, 0, 0, 0);
        return { key: start.toISOString().slice(0, 10), since: start };
    }
    async evaluateBonuses(dmId, whenIso) {
        if (!dmId)
            return 0;
        await this.ensureIndexes();
        const bonuses = await this.mongo.findMany('dm_bonuses', { status: { $in: [true, 1] } }, { limit: 100 });
        const active = bonuses.filter((b) => Number(b.threshold ?? 0) > 0 && Number(b.amount ?? 0) > 0);
        if (!active.length)
            return 0;
        const when = whenIso ? new Date(whenIso) : new Date();
        let awarded = 0;
        for (const b of active) {
            const period = String(b.period ?? 'daily');
            const { key, since } = this.periodWindow(period, when);
            const filter = {
                mysql_delivery_man_id: Number(dmId),
                order_status: { $in: ['delivered', 'completed'] },
            };
            if (since)
                filter.created_at = { $gte: since };
            const count = await this.mongo.count('orders', filter);
            if (count < Number(b.threshold))
                continue;
            const periodKey = `${period}:${key}`;
            const claimed = await this.mongo.tryInsertUnique('dm_bonus_awards', {
                dm_id: Number(dmId),
                bonus_id: Number(b.mysql_id),
                period_key: periodKey,
                amount: r2(Number(b.amount)),
                created_at: new Date(),
            });
            if (!claimed)
                continue;
            await this.credit(Number(dmId), Number(b.amount), 'bonus', `bonus#${b.mysql_id}:${periodKey}`, {
                bonus_id: Number(b.mysql_id),
                bonus_name: b.name ?? null,
            });
            await this.mongo.increment('dm_bonuses', { mysql_id: Number(b.mysql_id) }, { claims_30d: 1 }, {}).catch(() => undefined);
            awarded++;
        }
        return awarded;
    }
    async readIncentiveConfig() {
        const rows = await this.mongo.findMany('business_settings', {
            key: { $in: ['dm_incentive_enabled', 'dm_incentive_per_delivery', 'dm_incentive_target_period', 'dm_incentive_target_deliveries'] },
        });
        const map = new Map(rows.map((r) => [String(r.key), String(r.value ?? '')]));
        return {
            enabled: /^(1|true|yes|on)$/i.test(map.get('dm_incentive_enabled') ?? '0'),
            perDelivery: Number(map.get('dm_incentive_per_delivery') ?? 0) || 0,
            targetPeriod: map.get('dm_incentive_target_period') || 'weekly',
            targetDeliveries: Number(map.get('dm_incentive_target_deliveries') ?? 0) || 0,
        };
    }
    incentiveWindow(period, when) {
        if (period === 'monthly') {
            const d = new Date(when);
            const start = new Date(d.getFullYear(), d.getMonth(), 1);
            start.setHours(0, 0, 0, 0);
            return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, since: start };
        }
        return this.periodWindow(period === 'weekly' ? 'weekly' : 'daily', when);
    }
    async evaluateIncentives(dmId, whenIso) {
        if (!dmId)
            return false;
        await this.ensureIndexes();
        const cfg = await this.readIncentiveConfig();
        if (!cfg.enabled || cfg.perDelivery <= 0 || cfg.targetDeliveries <= 0)
            return false;
        const when = whenIso ? new Date(whenIso) : new Date();
        const { key, since } = this.incentiveWindow(cfg.targetPeriod, when);
        const filter = {
            mysql_delivery_man_id: Number(dmId),
            order_status: { $in: ['delivered', 'completed'] },
        };
        if (since)
            filter.created_at = { $gte: since };
        const count = await this.mongo.count('orders', filter);
        if (count < cfg.targetDeliveries)
            return false;
        const periodKey = `${cfg.targetPeriod}:${key}`;
        const claimed = await this.mongo.tryInsertUnique('dm_incentive_awards', {
            dm_id: Number(dmId), period_key: periodKey, created_at: new Date(),
        });
        if (!claimed)
            return false;
        const amount = r2(cfg.perDelivery * count);
        const nextId = await this.mongo.nextMysqlId('dm_incentives');
        await this.mongo.insertOne('dm_incentives', {
            mysql_id: nextId,
            dm_id: Number(dmId),
            period: `${cfg.targetPeriod} ${key}`,
            deliveries: count,
            claim_amount: amount,
            status: 'pending',
            reason: null,
            auto: true,
            created_at: new Date(),
            updated_at: new Date(),
        });
        return true;
    }
    rewardWindow(period, when) {
        if (period === 'monthly') {
            const d = new Date(when);
            const start = new Date(d.getFullYear(), d.getMonth(), 1);
            start.setHours(0, 0, 0, 0);
            return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, since: start };
        }
        return this.periodWindow(period, when);
    }
    async deliveredCount(dmId, since) {
        const filter = {
            mysql_delivery_man_id: Number(dmId),
            order_status: { $in: ['delivered', 'completed'] },
        };
        if (since)
            filter.created_at = { $gte: since };
        return this.mongo.count('orders', filter);
    }
    async rewardProgress(dmId, whenIso) {
        if (!dmId)
            return [];
        const rules = await this.mongo.findMany('dm_bonuses', { status: { $in: [true, 1] } }, { limit: 100 });
        const active = rules.filter((b) => Number(b.threshold ?? 0) > 0 && Number(b.amount ?? 0) > 0);
        const when = whenIso ? new Date(whenIso) : new Date();
        const out = [];
        for (const b of active) {
            const period = String(b.period ?? 'daily');
            const { key, since } = this.rewardWindow(period, when);
            const count = await this.deliveredCount(Number(dmId), since);
            const threshold = Number(b.threshold);
            const periodKey = `${period}:${key}`;
            const existing = await this.mongo.findOne('dm_reward_claims', {
                dm_id: Number(dmId), bonus_id: Number(b.mysql_id), period_key: periodKey,
            });
            out.push({
                id: Number(b.mysql_id),
                name: b.name ?? null,
                type: String(b.type ?? 'bonus'),
                period,
                amount: r2(Number(b.amount)),
                threshold,
                deliveries: count,
                achieved: count >= threshold,
                claim_status: existing ? String(existing.status ?? 'pending') : null,
                claimable: count >= threshold && !existing,
            });
        }
        return out;
    }
    async claimReward(dmId, bonusId, whenIso) {
        if (!dmId)
            return { ok: false, reason: 'no_rider' };
        await this.ensureIndexes();
        const b = await this.mongo.findByMysqlId('dm_bonuses', Number(bonusId));
        if (!b || !(b.status === true || b.status === 1))
            return { ok: false, reason: 'rule_inactive' };
        const threshold = Number(b.threshold ?? 0);
        const amount = r2(Number(b.amount ?? 0));
        if (threshold <= 0 || amount <= 0)
            return { ok: false, reason: 'rule_invalid' };
        const period = String(b.period ?? 'daily');
        const when = whenIso ? new Date(whenIso) : new Date();
        const { key, since } = this.rewardWindow(period, when);
        const count = await this.deliveredCount(Number(dmId), since);
        if (count < threshold)
            return { ok: false, reason: 'target_not_met', deliveries: count, threshold };
        const periodKey = `${period}:${key}`;
        const dm = await this.mongo.findOne('delivery_men', { mysql_id: Number(dmId) });
        const dmName = [dm?.f_name, dm?.l_name].filter(Boolean).join(' ') || `Rider #${dmId}`;
        const now = new Date();
        const record = {
            mysql_id: await this.mongo.nextMysqlId('dm_reward_claims'),
            dm_id: Number(dmId), dm_name: dmName,
            bonus_id: Number(bonusId), bonus_name: b.name ?? null, type: String(b.type ?? 'bonus'),
            period, period_key: periodKey, threshold, deliveries: count, amount,
            status: 'pending', reason: null,
            requested_at: now, decided_at: null, credited_at: null,
            created_at: now, updated_at: now,
        };
        const inserted = await this.mongo.tryInsertUnique('dm_reward_claims', record);
        if (!inserted)
            return { ok: false, reason: 'already_claimed' };
        return { ok: true, claim: record };
    }
    async listRewardClaims(opts = {}) {
        const filter = {};
        if (opts.status)
            filter.status = opts.status;
        const rows = await this.mongo.findMany('dm_reward_claims', filter, { sort: { mysql_id: -1 }, limit: Math.min(opts.limit ?? 300, 1000) });
        return rows.map((r) => ({
            id: Number(r.mysql_id),
            dm_id: Number(r.dm_id ?? 0),
            dm_name: r.dm_name ?? null,
            bonus_id: Number(r.bonus_id ?? 0),
            bonus_name: r.bonus_name ?? null,
            type: r.type ?? 'bonus',
            period: r.period ?? null,
            threshold: Number(r.threshold ?? 0),
            deliveries: Number(r.deliveries ?? 0),
            amount: Number(r.amount ?? 0),
            status: r.status ?? 'pending',
            reason: r.reason ?? null,
            requested_at: r.requested_at ?? r.created_at ?? null,
            decided_at: r.decided_at ?? null,
            credited_at: r.credited_at ?? null,
        }));
    }
    async approveRewardClaim(id) {
        const claim = await this.mongo.findByMysqlId('dm_reward_claims', Number(id));
        if (!claim)
            return { ok: false, reason: 'not_found' };
        if (String(claim.status) !== 'pending')
            return { ok: false, reason: 'not_pending' };
        const now = new Date();
        const res = await this.mongo.updateOne('dm_reward_claims', { mysql_id: Number(id), status: 'pending' }, { status: 'approved', decided_at: now, credited_at: now, updated_at: now });
        if (!res.matchedCount)
            return { ok: false, reason: 'race' };
        await this.credit(Number(claim.dm_id), Number(claim.amount), 'reward', `reward#${claim.bonus_id}:${claim.period_key}`, {
            claim_id: Number(id), bonus_id: Number(claim.bonus_id), bonus_name: claim.bonus_name ?? null, reward_type: claim.type ?? 'bonus',
        });
        return { ok: true };
    }
    async rejectRewardClaim(id, reason) {
        await this.mongo.updateOne('dm_reward_claims', { mysql_id: Number(id), status: 'pending' }, { status: 'rejected', reason: reason ?? null, decided_at: new Date(), updated_at: new Date() });
        return { ok: true };
    }
    async listDmDisbursementReport(opts = {}) {
        const limit = Math.min(opts.limit ?? 300, 1000);
        const [claims, tips] = await Promise.all([
            this.mongo.findMany('dm_reward_claims', { status: 'approved' }, { sort: { mysql_id: -1 }, limit }),
            this.mongo.findMany('dm_wallet_transactions', { type: 'tip' }, { sort: { mysql_id: -1 }, limit }),
        ]);
        const tipDmIds = Array.from(new Set(tips.map((t) => Number(t.mysql_delivery_man_id ?? t.delivery_man_id ?? 0)).filter((n) => n > 0)));
        const dms = tipDmIds.length
            ? await this.mongo.findMany('delivery_men', { mysql_id: { $in: tipDmIds } })
            : [];
        const nameById = new Map(dms.map((d) => [Number(d.mysql_id), [d.f_name, d.l_name].filter(Boolean).join(' ') || `Rider #${d.mysql_id}`]));
        const rewardRows = claims.map((c) => ({
            kind: String(c.type ?? 'bonus'),
            dm_id: Number(c.dm_id ?? 0),
            dm_name: c.dm_name ?? null,
            amount: Number(c.amount ?? 0),
            reference: c.bonus_name ?? `${c.type ?? 'bonus'} reward`,
            order_id: null,
            at: (c.credited_at ?? c.decided_at ?? c.created_at) ?? null,
        }));
        const tipRows = tips.map((t) => {
            const dmId = Number(t.mysql_delivery_man_id ?? t.delivery_man_id ?? 0);
            return {
                kind: 'tip',
                dm_id: dmId,
                dm_name: nameById.get(dmId) ?? `Rider #${dmId}`,
                amount: Number(t.credit ?? 0),
                reference: 'Customer tip',
                order_id: t.order_id != null ? Number(t.order_id) : null,
                at: t.created_at ?? null,
            };
        });
        return [...rewardRows, ...tipRows]
            .sort((x, y) => (y.at ? new Date(y.at).getTime() : 0) - (x.at ? new Date(x.at).getTime() : 0))
            .slice(0, limit);
    }
    async recordCod(dmId, orderId, amount) {
        const amt = r2(amount);
        if (!dmId || amt <= 0)
            return;
        await this.ensureIndexes();
        const claimed = await this.mongo.tryInsertUnique('dm_cod_collections', {
            order_id: Number(orderId),
            dm_id: Number(dmId),
            amount: amt,
            created_at: new Date(),
        });
        if (!claimed)
            return;
        await this.mongo.increment('delivery_man_wallets', { mysql_delivery_man_id: Number(dmId) }, { collected_cash: amt }, { mysql_delivery_man_id: Number(dmId), delivery_man_id: Number(dmId), created_at: new Date() });
        await this.logTxn(dmId, 0, 0, 'cod_collected', `cod#order:${orderId}`, { order_id: Number(orderId), collected_cash: amt });
    }
    async getWallet(dmId) {
        return this.mongo.findOne('delivery_man_wallets', {
            $or: [{ mysql_delivery_man_id: Number(dmId) }, { delivery_man_id: Number(dmId) }],
        });
    }
    async getPayoutSummary(dmId) {
        const w = await this.getWallet(dmId);
        const balance = r2(Number(w?.balance ?? 0));
        const collected_cash = r2(Number(w?.collected_cash ?? 0));
        const pending_withdraw = r2(Number(w?.pending_withdraw ?? 0));
        const total_earning = r2(Number(w?.total_earning ?? 0));
        const total_withdrawn = r2(Number(w?.total_withdrawn ?? 0));
        const available_to_withdraw = Math.max(0, r2(balance - pending_withdraw - collected_cash));
        const net_position = r2(balance - collected_cash);
        return {
            balance,
            total_earning,
            collected_cash,
            pending_withdraw,
            total_withdrawn,
            available_to_withdraw,
            net_position,
            cash_to_deposit: collected_cash,
        };
    }
    async listTransactions(dmId, limit = 50) {
        const [txns, ledger] = await Promise.all([
            this.mongo.findMany('dm_wallet_transactions', { mysql_delivery_man_id: Number(dmId) }, { sort: { mysql_id: -1 }, limit }),
            this.mongo.findMany('wallet_ledger', { actor_type: 'deliveryman', actor_id: Number(dmId) }, { sort: { mysql_id: -1 }, limit }),
        ]);
        const a = txns.map((t) => ({
            type: String(t.type ?? 'txn'),
            credit: Number(t.credit ?? 0),
            debit: Number(t.debit ?? 0),
            reference: String(t.reference ?? ''),
            at: t.created_at ?? null,
        }));
        const b = ledger.map((l) => ({
            type: `penalty:${String(l.scenario ?? '')}`,
            credit: l.direction === 'credit' ? Number(l.amount ?? 0) : 0,
            debit: l.direction === 'debit' ? Number(l.amount ?? 0) : 0,
            reference: String(l.note ?? ''),
            at: l.created_at ?? null,
        }));
        return [...a, ...b]
            .sort((x, y) => (y.at ? new Date(y.at).getTime() : 0) - (x.at ? new Date(x.at).getTime() : 0))
            .slice(0, limit);
    }
};
exports.DmWalletService = DmWalletService;
exports.DmWalletService = DmWalletService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [mongo_data_service_1.MongoDataService])
], DmWalletService);
//# sourceMappingURL=dm-wallet.service.js.map