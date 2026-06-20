import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MongoDataService } from '../mongo/mongo-data.service';
import { issueCreditNote } from '../completion/credit-note.util';
import {
  applicableScenarios,
  getScenario,
  listScenarios,
  OrderMoney,
  OrderStage,
  RefundEffects,
  ScenarioKey,
} from './refund-policy';

interface OrderDoc {
  mysql_id: number;
  mysql_user_id?: number | null;
  mysql_restaurant_id?: number | null;
  mysql_delivery_man_id?: number | null;
  order_status?: string;
  payment_status?: string;
  payment_method?: string;
  order_amount?: number;
  coupon_discount_amount?: number;
  restaurant_discount_amount?: number;
  total_tax_amount?: number;
  delivery_charge?: number;
  additional_charge?: number;
  extra_packaging_amount?: number;
  delivered?: Date | null;
  canceled_by?: string | null;
}

/** A stored refund_decisions row in the pending-review workflow. */
interface PendingDecisionDoc {
  mysql_id: number;
  order_id: number;
  scenario: ScenarioKey;
  scenario_label: string;
  cancelled_by: string;
  status: 'pending' | 'applied' | 'rejected';
  initiated_by?: string;
  reason?: string | null;
  restaurant_id?: number | null;
  delivery_man_id?: number | null;
  effects: RefundEffects;
  artefacts?: { wallet_ledger_ids?: number[] };
  created_at?: Date;
}

/**
 * The applied side-effects journal for an admin's refund/cancellation
 * decision. Stored back to mongo as a `refund_decisions` document so we
 * have an audit trail of every action and the policy version that produced
 * it. Lets ops reconcile partner wallets later.
 */
export interface AppliedDecision {
  order_id: number;
  scenario: ScenarioKey;
  remarks: string;
  effects: RefundEffects;
  applied_at: Date;
  /** Ids of artefacts the apply step created — convenient for the response. */
  artefacts: {
    refund_id?: number;
    credit_note_id?: number;
    wallet_ledger_ids: number[];
  };
}

/**
 * Refund + Cancellation Engine. The single entry point for any partner-money
 * movement triggered by a cancellation. Reads stay in policy/Mongo land —
 * the service composes them with audit + ledger writes and updates the order.
 *
 * Why centralised:
 *   - Multiple parties (user / restaurant / DM) have wallets that need
 *     simultaneous adjustment per scenario. Doing this in admin.service ad-hoc
 *     made it easy to miss a side-effect.
 *   - The PDF spec encodes 13 scenarios. Spreading those across each
 *     controller would mean re-deriving them. They live in refund-policy.ts
 *     so the matrix is in one greppable place.
 */
@Injectable()
export class RefundService {
  constructor(private readonly mongo: MongoDataService) {}

  catalogue() {
    return { scenarios: listScenarios() };
  }

  /** Loads the order, derives its current stage, computes the effects for the
   *  given scenario. Used by the admin UI to render a confirmation summary. */
  async preview(orderId: number, scenarioKey: ScenarioKey) {
    const scenario = getScenario(scenarioKey);
    if (!scenario) throw new BadRequestException({ errors: [{ code: 'scenario', message: `unknown scenario: ${scenarioKey}` }] });

    const order = await this.mongo.findByMysqlId<OrderDoc>('orders', orderId);
    if (!order) throw new NotFoundException({ errors: [{ code: 'order', message: 'Order not found' }] });

    const stage = this.stageOf(order);
    if (!scenario.allowsStage(stage)) {
      throw new BadRequestException({
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

  /** List only the scenarios that the order's current stage allows.
   *  Drives the admin dropdown — invalid options are filtered server-side. */
  async applicable(orderId: number) {
    const order = await this.mongo.findByMysqlId<OrderDoc>('orders', orderId);
    if (!order) throw new NotFoundException({ errors: [{ code: 'order', message: 'Order not found' }] });
    const stage = this.stageOf(order);
    return { order_id: orderId, stage, scenarios: applicableScenarios(stage) };
  }

  /** Apply the scenario: mutate order, create refund + credit-note + ledger
   *  records, write the audit row. Returns everything that was created. */
  async apply(orderId: number, scenarioKey: ScenarioKey, remarks: string) {
    if (!remarks || !remarks.trim()) {
      // PDF rule #4 — admin must enter remarks when rejecting/cancelling.
      throw new BadRequestException({ errors: [{ code: 'remarks', message: 'Admin remarks are required.' }] });
    }
    const preview = await this.preview(orderId, scenarioKey);
    const { effects, scenario } = preview;

    const artefacts: AppliedDecision['artefacts'] = { wallet_ledger_ids: [] };

    // 1. Update order status + cancellation metadata
    await this.mongo.updateOne('orders', { mysql_id: orderId }, {
      order_status: effects.final_order_status,
      canceled_by: scenario.cancelled_by,
      cancellation_reason: scenario.label,
      cancellation_note: remarks,
      canceled: new Date(),
      ...(effects.final_order_status === 'refunded' ? { refunded: new Date() } : {}),
    });

    // 2. Refund record (if money flowing back to user) + actually CREDIT the
    //    customer's wallet so the user gets their money back (not just a record).
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

    // 3. Credit note (if scenario requires) — unified issuer assigns CNOBR/CNETU
    //    numbers, links the order's OBR/ETFU reference invoice + ARN, and writes
    //    the full record shape (so the list/detail pages render correctly).
    if (effects.generate_credit_note && effects.refund_amount > 0) {
      const { record } = await issueCreditNote(this.mongo, {
        orderId,
        refundId: artefacts.refund_id ?? null,
        amount: effects.refund_amount,
        reason: scenario.label,
        notes: remarks,
      });
      if (record) artefacts.credit_note_id = record.mysql_id;
    }

    const orderDoc = await this.mongo.findByMysqlId<OrderDoc>('orders', orderId);

    // 4. Wallet ledger + actual balance move — restaurant
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

    // 5. Wallet ledger + actual balance move — deliveryman
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

    // 6. Audit row
    const decisionId = await this.mongo.nextMysqlId('refund_decisions');
    const decision: AppliedDecision & { mysql_id: number } = {
      mysql_id: decisionId,
      order_id: orderId,
      scenario: scenario.key as ScenarioKey,
      remarks,
      effects,
      applied_at: new Date(),
      artefacts,
    };
    await this.mongo.insertOne('refund_decisions', decision as unknown as Record<string, unknown>);

    return { ok: true, decision_id: decisionId, artefacts, effects, scenario };
  }

  // ── Pending-review workflow (auto-triggered partner penalties) ───────────
  /**
   * Called automatically when a restaurant (or any partner) self-cancels. The
   * CUSTOMER refund is already handled by the lifecycle cancel (full refund to
   * the user). Here we only deal with the PARTNER side: any wallet *credit*
   * (compensation, e.g. the rider's delivery fee) and the partner *penalty*
   * (wallet debit). The whole wallet bundle is parked as a `pending`
   * `refund_decisions` row so an admin reviews + confirms before any partner
   * money actually moves. No balances change until confirm().
   *
   * Returns status: 'pending' (needs review), 'no_penalty' (nothing to do), or
   * 'order_not_found'.
   */
  async proposePartnerPenalty(orderId: number, scenarioKey: ScenarioKey, initiatedBy: string, reasonText?: string) {
    const scenario = getScenario(scenarioKey);
    if (!scenario) return { ok: false as const, reason: 'unknown_scenario' };
    const order = await this.mongo.findByMysqlId<OrderDoc>('orders', orderId);
    if (!order) return { ok: false as const, reason: 'order_not_found' };

    const money = await this.moneyOf(order);
    const effects = scenario.decide(money);

    // Is there any partner money to move at all? (credit = compensation,
    // debit = penalty). Before-accept rejections have neither → nothing to do.
    const restMoves = effects.restaurant_wallet.direction !== 'none' && effects.restaurant_wallet.amount > 0;
    const dmMoves = effects.deliveryman_wallet.direction !== 'none' && effects.deliveryman_wallet.amount > 0;
    if (!restMoves && !dmMoves) {
      return { ok: true as const, status: 'no_penalty' as const };
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
      artefacts: { wallet_ledger_ids: [] as number[] },
      created_at: new Date(),
    });
    return { ok: true as const, status: 'pending' as const, decision_id: decisionId };
  }

  /** Admin confirms a pending penalty review → actually move the partner
   *  wallets (credit compensation + debit penalty) atomically + ledger. */
  async confirmPending(decisionId: number, adminRemarks: string) {
    if (!adminRemarks || !adminRemarks.trim()) {
      throw new BadRequestException({ errors: [{ code: 'remarks', message: 'Admin remarks are required.' }] });
    }
    const d = await this.mongo.findByMysqlId<PendingDecisionDoc>('refund_decisions', decisionId);
    if (!d) throw new NotFoundException({ errors: [{ code: 'decision', message: 'Decision not found' }] });
    if (d.status !== 'pending') throw new BadRequestException({ errors: [{ code: 'status', message: `Already ${d.status}` }] });

    const e = d.effects;
    const ledgerIds: number[] = [...(d.artefacts?.wallet_ledger_ids ?? [])];

    const moves: Array<['restaurant' | 'deliveryman', RefundEffects['restaurant_wallet'], number | null]> = [
      ['restaurant', e.restaurant_wallet, d.restaurant_id ?? null],
      ['deliveryman', e.deliveryman_wallet, d.delivery_man_id ?? null],
    ];
    for (const [actorType, w, actorId] of moves) {
      if (w.direction === 'none' || w.amount <= 0) continue;
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

  /** Admin waives a pending penalty → no partner money moves. */
  async rejectPending(decisionId: number, adminRemarks: string) {
    if (!adminRemarks || !adminRemarks.trim()) {
      throw new BadRequestException({ errors: [{ code: 'remarks', message: 'Admin remarks are required.' }] });
    }
    const d = await this.mongo.findByMysqlId<PendingDecisionDoc>('refund_decisions', decisionId);
    if (!d) throw new NotFoundException({ errors: [{ code: 'decision', message: 'Decision not found' }] });
    if (d.status !== 'pending') throw new BadRequestException({ errors: [{ code: 'status', message: `Already ${d.status}` }] });
    await this.mongo.updateOne('refund_decisions', { mysql_id: Number(decisionId) }, {
      status: 'rejected', admin_remarks: adminRemarks, reviewed_at: new Date(),
    });
    return { ok: true, decision_id: decisionId, status: 'rejected' };
  }

  /** Pending penalty reviews queue — drives the admin "Refund Reviews" page. */
  async listPending(limit = 50, offset = 0) {
    const filter = { status: 'pending' };
    const [rows, total] = await Promise.all([
      this.mongo.findMany<PendingDecisionDoc>('refund_decisions', filter, { sort: { mysql_id: -1 }, limit, skip: offset }),
      this.mongo.count('refund_decisions', filter),
    ]);
    const items = await Promise.all(rows.map(async (r) => {
      const o = await this.mongo.findByMysqlId<OrderDoc & { order_amount?: number }>('orders', Number(r.order_id));
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

  /** Recent audit rows for an order — admin can see the full history of
   *  what was applied + what wallet movements happened. */
  async historyFor(orderId: number) {
    const rows = await this.mongo.findMany<Record<string, unknown>>('refund_decisions', { order_id: orderId }, {
      sort: { mysql_id: -1 }, limit: 20,
    });
    return { order_id: orderId, decisions: rows };
  }

  /** Cross-order wallet ledger — used by the admin "Wallet ledger" page to
   *  audit penalties + credits paid out across all scenarios. */
  async ledger(limit = 100, offset = 0, actorType?: 'restaurant' | 'deliveryman') {
    const filter: Record<string, unknown> = {};
    if (actorType) filter.actor_type = actorType;
    const [rows, total] = await Promise.all([
      this.mongo.findMany<Record<string, unknown>>('wallet_ledger', filter, { sort: { mysql_id: -1 }, limit, skip: offset }),
      this.mongo.count('wallet_ledger', filter),
    ]);
    return { total, limit, offset, items: rows };
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private stageOf(o: OrderDoc): OrderStage {
    return {
      status: o.order_status ?? 'pending',
      has_delivery_man: o.mysql_delivery_man_id != null,
      is_delivered: o.delivered != null || o.order_status === 'delivered',
      cancelled_by: (o.canceled_by as OrderStage['cancelled_by']) ?? null,
    };
  }

  private async moneyOf(o: OrderDoc): Promise<OrderMoney> {
    const tax = Number(o.total_tax_amount ?? 0);
    const deliveryCharge = Number(o.delivery_charge ?? 0);
    const restDiscount = Number(o.restaurant_discount_amount ?? 0);
    const grandTotal = Number(o.order_amount ?? 0);

    // Platform fee + extra packaging are stored directly on the order document
    // (the original StackFood `order_transactions` table is never populated on
    // this Mongo backend), so read them from the order — exactly as the
    // settlement engine does.
    const additional = Number(o.additional_charge ?? 0);
    const packaging = Number(o.extra_packaging_amount ?? 0);

    // Item (food) value = sum of the line items, the same authoritative base the
    // settlement engine uses (settlement.service computeBreakdown). Fall back to
    // backing it out of order_amount only when the line items are unavailable.
    const details = await this.mongo.findMany<{ price?: number; quantity?: number }>(
      'order_details', { order_id: o.mysql_id },
    );
    const foodFromDetails = round2(details.reduce((s, d) => s + Number(d.price ?? 0) * Number(d.quantity ?? 0), 0));
    const itemTotal = foodFromDetails > 0
      ? foodFromDetails
      : Math.max(0, grandTotal - tax - deliveryCharge - additional - packaging + restDiscount - Number(o.coupon_discount_amount ?? 0));

    // Commission = the restaurant's configured rate applied to the food net of
    // any restaurant-funded discount (mirrors settlement.computeBreakdown), not
    // a hardcoded 20%.
    const restaurant = await this.mongo.findByMysqlId<{ comission?: number }>(
      'restaurants', Number(o.mysql_restaurant_id ?? 0),
    );
    const commissionPct = Math.max(0, Number(restaurant?.comission ?? 0));
    const commission = round2(Math.max(0, itemTotal - restDiscount) * (commissionPct / 100));

    return {
      item_total: round2(itemTotal),
      tax: round2(tax),
      delivery_charge: round2(deliveryCharge),
      packaging_amount: round2(packaging),
      additional_charge: round2(additional),
      admin_commission: commission,
      grand_total: round2(grandTotal),
    };
  }

  private async userIdFor(orderId: number): Promise<number | null> {
    const o = await this.mongo.findByMysqlId<OrderDoc>('orders', orderId);
    return o?.mysql_user_id ?? null;
  }

  /** Credit the customer's wallet with the refund + write an audit transaction,
   *  so the user actually sees the money back (PDF: "Refund to Whom = User"). */
  private async creditCustomerWallet(userId: number | null, amount: number, reason: string, orderId: number): Promise<void> {
    if (!userId || amount <= 0) return;
    const existing = await this.mongo.findOne<Record<string, unknown>>('wallets', { $or: [{ user_id: userId }, { mysql_user_id: userId }] });
    const newBalance = round2(safeNum(existing?.balance) + amount);
    if (existing) {
      await this.mongo.updateOne('wallets', { mysql_id: Number(existing.mysql_id) }, {
        balance: newBalance, total_earning: round2(safeNum(existing.total_earning) + amount), updated_at: new Date(),
      });
    } else {
      const wid = await this.mongo.nextMysqlId('wallets');
      await this.mongo.insertOne('wallets', { mysql_id: wid, user_id: userId, mysql_user_id: userId, balance: newBalance, total_earning: amount, created_at: new Date() });
    }
    const txId = await this.mongo.nextMysqlId('wallet_transactions');
    await this.mongo.insertOne('wallet_transactions', {
      mysql_id: txId, user_id: userId, mysql_user_id: userId, transaction_id: `REFUND_${orderId}_${txId}`,
      credit: amount, debit: 0, balance: newBalance, transaction_type: 'order_refund', reference: reason, created_at: new Date(),
    });
  }

  /** Apply a credit/debit to a restaurant or deliveryman wallet balance. */
  private async moveActorWallet(actorType: 'restaurant' | 'deliveryman', actorId: number | null, direction: 'credit' | 'debit', amount: number): Promise<void> {
    if (!actorId || amount <= 0) return;
    const coll = actorType === 'restaurant' ? 'restaurant_wallets' : 'delivery_man_wallets';
    const idField = actorType === 'restaurant' ? 'restaurant_id' : 'delivery_man_id';
    const existing = await this.mongo.findOne<Record<string, unknown>>(coll, { $or: [{ [idField]: actorId }, { [`mysql_${idField}`]: actorId }] });
    const delta = direction === 'credit' ? amount : -amount;
    const newBalance = round2(safeNum(existing?.balance) + delta);
    if (existing) {
      await this.mongo.updateOne(coll, { mysql_id: Number(existing.mysql_id) }, { balance: newBalance, updated_at: new Date() });
    } else {
      const wid = await this.mongo.nextMysqlId(coll);
      await this.mongo.insertOne(coll, { mysql_id: wid, [idField]: actorId, [`mysql_${idField}`]: actorId, balance: newBalance, total_earning: direction === 'credit' ? amount : 0, created_at: new Date() });
    }
  }

  private async writeLedger(entry: {
    actor_type: 'restaurant' | 'deliveryman';
    actor_id: number | null;
    order_id: number;
    direction: 'credit' | 'debit';
    amount: number;
    note: string;
    scenario: ScenarioKey;
  }): Promise<number> {
    const id = await this.mongo.nextMysqlId('wallet_ledger');
    await this.mongo.insertOne('wallet_ledger', {
      mysql_id: id,
      ...entry,
      created_at: new Date(),
    });
    return id;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Coerce a stored wallet value to a finite number. Some legacy wallet docs
 *  hold Decimal128 / decimal.js objects that Number() turns into NaN — treat
 *  those (and anything non-finite) as 0 so a refund never corrupts a balance. */
function safeNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = Number(typeof v === 'object' ? String(v) : v);
  return Number.isFinite(n) ? n : 0;
}
