import { Injectable, Logger } from '@nestjs/common';
import { MongoDataService } from '../mongo/mongo-data.service';

const r2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

interface BonusDoc {
  mysql_id: number;
  name?: string;
  amount?: number;
  threshold?: number;
  period?: string; // 'daily' | 'weekly' | 'lifetime'
  status?: boolean | number;
}

interface OrderTipDoc {
  mysql_id: number;
  mysql_delivery_man_id?: number | null;
  dm_tips?: number;
  dm_tips_paid_out?: number;
}

/**
 * Single owner of credits to the delivery-man wallet for the "extra" earning
 * channels that settlement doesn't cover: customer tips, completion bonuses and
 * COD cash-in-hand tracking. Every movement is atomic (`$inc`) and writes a row
 * to `dm_wallet_transactions`; bonus + COD are idempotent via unique-index
 * guards so re-runs never double-credit.
 *
 * Wallet docs are matched by `mysql_delivery_man_id` (same key settlement uses)
 * and seeded with both id fields so the various readers stay consistent.
 */
@Injectable()
export class DmWalletService {
  private readonly logger = new Logger('DmWallet');
  // Memoised so concurrent first-callers all await the SAME index-creation —
  // a plain boolean flag let a second caller skip ahead and rely on a unique
  // index that wasn't built yet, defeating the idempotency guards.
  private indexing: Promise<void> | null = null;

  constructor(private readonly mongo: MongoDataService) {}

  private ensureIndexes(): Promise<void> {
    if (!this.indexing) {
      this.indexing = (async () => {
        await this.mongo.ensureIndex('dm_bonus_awards', { dm_id: 1, bonus_id: 1, period_key: 1 }, { unique: true, name: 'uniq_dm_bonus_period' });
        await this.mongo.ensureIndex('dm_cod_collections', { order_id: 1 }, { unique: true, name: 'uniq_cod_order' });
        await this.mongo.ensureIndex('dm_wallet_transactions', { mysql_id: 1 }, { unique: true, name: 'uniq_id' });
        // One auto-generated incentive claim per (rider, period) — guards the
        // auto-generator from raising the same period's claim twice.
        await this.mongo.ensureIndex('dm_incentive_awards', { dm_id: 1, period_key: 1 }, { unique: true, name: 'uniq_dm_incentive_period' });
      })().catch((e) => {
        // Reset so a later call retries rather than caching a failed attempt.
        this.indexing = null;
        throw e;
      });
    }
    return this.indexing;
  }

  /** Append a DM wallet transaction (history for the rider + admin audit). */
  private async logTxn(dmId: number, credit: number, debit: number, type: string, reference: string, meta: Record<string, unknown> = {}): Promise<void> {
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

  /** Atomic credit to the DM wallet balance + total_earning, plus a ledger row. */
  async credit(dmId: number, amount: number, type: string, reference: string, meta: Record<string, unknown> = {}): Promise<void> {
    const amt = r2(amount);
    if (!dmId || amt <= 0) return;
    await this.mongo.increment(
      'delivery_man_wallets',
      { mysql_delivery_man_id: Number(dmId) },
      { balance: amt, total_earning: amt },
      { mysql_delivery_man_id: Number(dmId), delivery_man_id: Number(dmId), created_at: new Date() },
    );
    await this.logTxn(dmId, amt, 0, type, reference, meta);
  }

  // ── Tips ───────────────────────────────────────────────────────────────
  /**
   * Pay the rider any tip that hasn't been credited yet. The order accumulates
   * `dm_tips`; this credits `(dm_tips − dm_tips_paid_out)` to the assigned rider
   * and advances the watermark, so a tip is paid exactly once whether it was
   * added before delivery (settlement reconciles) or after (tip endpoint
   * reconciles immediately). No-op when no rider is assigned yet.
   */
  async reconcileTips(orderId: number): Promise<number> {
    const o = await this.mongo.findOne<OrderTipDoc>('orders', { mysql_id: Number(orderId) });
    if (!o) return 0;
    const dmId = o.mysql_delivery_man_id != null ? Number(o.mysql_delivery_man_id) : 0;
    const tips = r2(Number(o.dm_tips ?? 0));
    const paid = r2(Number(o.dm_tips_paid_out ?? 0));
    const delta = r2(tips - paid);
    if (!dmId || delta <= 0) return 0;
    // Claim the watermark FIRST (conditional on the value we read). If another
    // caller (e.g. settlement vs. the tip endpoint) already advanced it, we lose
    // the race and skip — so a tip is never paid twice.
    const claim = await this.mongo.updateOne(
      'orders',
      { mysql_id: Number(orderId), dm_tips_paid_out: paid },
      { dm_tips_paid_out: tips, updated_at: new Date() },
    );
    if (!claim.matchedCount) return 0;
    await this.credit(dmId, delta, 'tip', `tip#order:${orderId}`, { order_id: Number(orderId) });
    return delta;
  }

  // ── Bonuses (auto-trigger) ───────────────────────────────────────────────
  /** Calendar window for a bonus period → a stable idempotency key + a
   *  "count orders since" boundary. */
  private periodWindow(period: string, when: Date): { key: string; since: Date | null } {
    const d = new Date(when);
    if (period === 'lifetime') return { key: 'all', since: null };
    if (period === 'weekly') {
      const day = d.getDay(); // 0=Sun
      const diff = day === 0 ? -6 : 1 - day; // back to Monday
      const monday = new Date(d);
      monday.setDate(d.getDate() + diff);
      monday.setHours(0, 0, 0, 0);
      return { key: monday.toISOString().slice(0, 10), since: monday };
    }
    // daily (default)
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    return { key: start.toISOString().slice(0, 10), since: start };
  }

  /**
   * Evaluate active completion bonuses for a rider after a delivery. A bonus has
   * a `threshold` (# of delivered orders) over a `period` (daily/weekly/
   * lifetime) and an `amount`. When the rider's delivered-order count in the
   * window reaches the threshold, the bonus is credited once per (rider, bonus,
   * period) — guarded by a unique award row.
   */
  async evaluateBonuses(dmId: number, whenIso?: string): Promise<number> {
    if (!dmId) return 0;
    await this.ensureIndexes();
    const bonuses = await this.mongo.findMany<BonusDoc>('dm_bonuses', { status: { $in: [true, 1] } }, { limit: 100 });
    const active = bonuses.filter((b) => Number(b.threshold ?? 0) > 0 && Number(b.amount ?? 0) > 0);
    if (!active.length) return 0;
    const when = whenIso ? new Date(whenIso) : new Date();
    let awarded = 0;
    for (const b of active) {
      const period = String(b.period ?? 'daily');
      const { key, since } = this.periodWindow(period, when);
      const filter: Record<string, unknown> = {
        mysql_delivery_man_id: Number(dmId),
        order_status: { $in: ['delivered', 'completed'] },
      };
      if (since) filter.created_at = { $gte: since };
      const count = await this.mongo.count('orders', filter);
      if (count < Number(b.threshold)) continue;
      const periodKey = `${period}:${key}`;
      const claimed = await this.mongo.tryInsertUnique('dm_bonus_awards', {
        dm_id: Number(dmId),
        bonus_id: Number(b.mysql_id),
        period_key: periodKey,
        amount: r2(Number(b.amount)),
        created_at: new Date(),
      });
      if (!claimed) continue; // already awarded for this period
      await this.credit(Number(dmId), Number(b.amount), 'bonus', `bonus#${b.mysql_id}:${periodKey}`, {
        bonus_id: Number(b.mysql_id),
        bonus_name: b.name ?? null,
      });
      await this.mongo.increment('dm_bonuses', { mysql_id: Number(b.mysql_id) }, { claims_30d: 1 }, {}).catch(() => undefined);
      awarded++;
    }
    return awarded;
  }

  // ── Incentives (auto-generate PENDING claims from config) ─────────────────
  /** Read the `dm_incentive_*` program config from business_settings. */
  private async readIncentiveConfig(): Promise<{ enabled: boolean; perDelivery: number; targetPeriod: string; targetDeliveries: number }> {
    const rows = await this.mongo.findMany<{ key?: string; value?: string }>('business_settings', {
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

  /** Window for the incentive target period — adds `monthly` on top of the
   *  daily/weekly/lifetime windows the bonus engine uses. */
  private incentiveWindow(period: string, when: Date): { key: string; since: Date | null } {
    if (period === 'monthly') {
      const d = new Date(when);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, since: start };
    }
    return this.periodWindow(period === 'weekly' ? 'weekly' : 'daily', when);
  }

  /**
   * After a delivery, check whether the rider has hit the configured period
   * delivery target. If so, raise ONE *pending* incentive claim for the period —
   * `per_delivery × deliveries-in-window` — for the admin to review and approve.
   * Never auto-pays (approval credits the wallet). Idempotent per (rider, period)
   * via the `dm_incentive_awards` unique guard. No-op when the program is off or
   * unconfigured. Distinct from bonuses (which auto-PAY a threshold reward).
   */
  async evaluateIncentives(dmId: number, whenIso?: string): Promise<boolean> {
    if (!dmId) return false;
    await this.ensureIndexes();
    const cfg = await this.readIncentiveConfig();
    if (!cfg.enabled || cfg.perDelivery <= 0 || cfg.targetDeliveries <= 0) return false;
    const when = whenIso ? new Date(whenIso) : new Date();
    const { key, since } = this.incentiveWindow(cfg.targetPeriod, when);
    const filter: Record<string, unknown> = {
      mysql_delivery_man_id: Number(dmId),
      order_status: { $in: ['delivered', 'completed'] },
    };
    if (since) filter.created_at = { $gte: since };
    const count = await this.mongo.count('orders', filter);
    if (count < cfg.targetDeliveries) return false;
    const periodKey = `${cfg.targetPeriod}:${key}`;
    // Claim the (rider, period) slot first — only the winner raises the claim.
    const claimed = await this.mongo.tryInsertUnique('dm_incentive_awards', {
      dm_id: Number(dmId), period_key: periodKey, created_at: new Date(),
    });
    if (!claimed) return false;
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

  // ── COD cash-in-hand ─────────────────────────────────────────────────────
  /** Track cash the rider physically collected on a COD delivery (idempotent
   *  per order). Increases `collected_cash` on the wallet — what the rider owes
   *  the platform — without touching the earning balance. */
  async recordCod(dmId: number, orderId: number, amount: number): Promise<void> {
    const amt = r2(amount);
    if (!dmId || amt <= 0) return;
    await this.ensureIndexes();
    const claimed = await this.mongo.tryInsertUnique('dm_cod_collections', {
      order_id: Number(orderId),
      dm_id: Number(dmId),
      amount: amt,
      created_at: new Date(),
    });
    if (!claimed) return;
    await this.mongo.increment(
      'delivery_man_wallets',
      { mysql_delivery_man_id: Number(dmId) },
      { collected_cash: amt },
      { mysql_delivery_man_id: Number(dmId), delivery_man_id: Number(dmId), created_at: new Date() },
    );
    await this.logTxn(dmId, 0, 0, 'cod_collected', `cod#order:${orderId}`, { order_id: Number(orderId), collected_cash: amt });
  }

  // ── Payout / reconciliation ──────────────────────────────────────────────
  /** The canonical wallet doc for a rider (matches either id key). */
  async getWallet(dmId: number): Promise<WalletDoc | null> {
    return this.mongo.findOne<WalletDoc>('delivery_man_wallets', {
      $or: [{ mysql_delivery_man_id: Number(dmId) }, { delivery_man_id: Number(dmId) }],
    });
  }

  /**
   * The single source of truth for "what does the platform owe this rider".
   * Earnings (balance, already net of penalties) minus the COD cash the rider is
   * still holding minus any in-flight withdrawal reservation.
   *
   *   net_position        = balance − collected_cash   (>0 platform owes rider, <0 rider owes)
   *   available_to_withdraw = max(0, balance − pending_withdraw − collected_cash)
   */
  async getPayoutSummary(dmId: number) {
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

  /** Record that the rider handed COD cash back to the platform — reduces
   *  `collected_cash` (never below zero). Returns the amount actually cleared. */
  async recordCashDeposit(dmId: number, amount: number): Promise<{ ok: boolean; deposited: number; collected_cash: number }> {
    const amt = r2(amount);
    if (!dmId || amt <= 0) return { ok: false, deposited: 0, collected_cash: 0 };
    const w = await this.getWallet(dmId);
    const current = r2(Number(w?.collected_cash ?? 0));
    const dec = Math.min(current, amt);
    if (dec > 0) {
      await this.mongo.increment(
        'delivery_man_wallets',
        { mysql_delivery_man_id: Number(dmId) },
        { collected_cash: -dec },
        { mysql_delivery_man_id: Number(dmId), delivery_man_id: Number(dmId), created_at: new Date() },
      );
      await this.logTxn(dmId, 0, 0, 'cash_deposit', `deposit#dm:${dmId}`, { deposited: dec });
    }
    return { ok: true, deposited: dec, collected_cash: r2(current - dec) };
  }

  /** Unified wallet history for a rider: DmWalletService credits (delivery/tip/
   *  bonus/COD/deposit) UNION the refund engine's penalty/compensation entries
   *  (`wallet_ledger`), newest first — so penalties show up too. */
  async listTransactions(dmId: number, limit = 50): Promise<Array<{ type: string; credit: number; debit: number; reference: string; at: Date | null }>> {
    const [txns, ledger] = await Promise.all([
      this.mongo.findMany<Record<string, unknown>>('dm_wallet_transactions', { mysql_delivery_man_id: Number(dmId) }, { sort: { mysql_id: -1 }, limit }),
      this.mongo.findMany<Record<string, unknown>>('wallet_ledger', { actor_type: 'deliveryman', actor_id: Number(dmId) }, { sort: { mysql_id: -1 }, limit }),
    ]);
    const a = txns.map((t) => ({
      type: String(t.type ?? 'txn'),
      credit: Number(t.credit ?? 0),
      debit: Number(t.debit ?? 0),
      reference: String(t.reference ?? ''),
      at: (t.created_at as Date) ?? null,
    }));
    const b = ledger.map((l) => ({
      type: `penalty:${String(l.scenario ?? '')}`,
      credit: l.direction === 'credit' ? Number(l.amount ?? 0) : 0,
      debit: l.direction === 'debit' ? Number(l.amount ?? 0) : 0,
      reference: String(l.note ?? ''),
      at: (l.created_at as Date) ?? null,
    }));
    return [...a, ...b]
      .sort((x, y) => (y.at ? new Date(y.at).getTime() : 0) - (x.at ? new Date(x.at).getTime() : 0))
      .slice(0, limit);
  }
}

interface WalletDoc {
  balance?: number;
  total_earning?: number;
  collected_cash?: number;
  total_withdrawn?: number;
  pending_withdraw?: number;
}
