import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MongoDataService } from '../mongo/mongo-data.service';
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
  delivered?: Date | null;
  canceled_by?: string | null;
}

interface OrderTxnDoc {
  order_id?: number;
  additional_charge?: number;
  extra_packaging_amount?: number;
  admin_commission?: number;
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
 *   - The PDF spec encodes 14 scenarios. Spreading those across each
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

    // 2. Refund record (if money flowing back to user)
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

    // 3. Credit note (if scenario requires)
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

    // 4. Wallet ledger — restaurant
    if (effects.restaurant_wallet.direction !== 'none' && effects.restaurant_wallet.amount > 0) {
      const id = await this.writeLedger({
        actor_type: 'restaurant',
        actor_id: (await this.mongo.findByMysqlId<OrderDoc>('orders', orderId))?.mysql_restaurant_id ?? null,
        order_id: orderId,
        direction: effects.restaurant_wallet.direction,
        amount: effects.restaurant_wallet.amount,
        note: effects.restaurant_wallet.note,
        scenario: scenario.key,
      });
      artefacts.wallet_ledger_ids.push(id);
    }

    // 5. Wallet ledger — deliveryman
    if (effects.deliveryman_wallet.direction !== 'none' && effects.deliveryman_wallet.amount > 0) {
      const id = await this.writeLedger({
        actor_type: 'deliveryman',
        actor_id: (await this.mongo.findByMysqlId<OrderDoc>('orders', orderId))?.mysql_delivery_man_id ?? null,
        order_id: orderId,
        direction: effects.deliveryman_wallet.direction,
        amount: effects.deliveryman_wallet.amount,
        note: effects.deliveryman_wallet.note,
        scenario: scenario.key,
      });
      artefacts.wallet_ledger_ids.push(id);
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
    const itemTotal = Math.max(0, grandTotal - tax - deliveryCharge + restDiscount - Number(o.coupon_discount_amount ?? 0));

    // Platform/packaging/commission live on order_transactions in the original
    // StackFood schema. Pull them if the row exists; otherwise approximate
    // (commission = 20% of item, packaging = 0, additional_charge = 0).
    const txn = await this.mongo.findOne<OrderTxnDoc>('order_transactions', { order_id: o.mysql_id });
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

  private async userIdFor(orderId: number): Promise<number | null> {
    const o = await this.mongo.findByMysqlId<OrderDoc>('orders', orderId);
    return o?.mysql_user_id ?? null;
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
