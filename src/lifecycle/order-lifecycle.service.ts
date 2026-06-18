import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { MongoDataService } from '../mongo/mongo-data.service';
import { FcmService } from '../notifications/fcm.service';
import {
  CANCEL_MESSAGE_CUSTOMER,
  CANCEL_MESSAGE_RESTAURANT,
  FLOW,
  NOTIFY_DELIVERY_ON_CANCEL,
  REFUND_STATUS,
  STATUS_LABELS,
  TERMINAL_STATUSES,
  normaliseStatus,
  type CancelReason,
  type OrderType,
} from './order-lifecycle.constants';

const r2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

type Actor = 'customer' | 'restaurant' | 'admin' | 'delivery_partner' | 'system';

interface OrderDoc {
  mysql_id: number;
  mysql_user_id?: number | null;
  mysql_restaurant_id?: number | null;
  mysql_delivery_man_id?: number | null;
  mysql_zone_id?: number | null;
  order_status?: string;
  order_type?: string;
  payment_method?: string | null;
  payment_status?: string | null;
  order_amount?: number;
}

/**
 * Central order lifecycle engine. Owns the rules that the spec defines:
 * cancellation cases (+ cancel_reason / refund_status), auto-cancellation,
 * delivery-partner re-assignment, audit logging and event notifications.
 * The existing status-update endpoints delegate the cross-cutting parts here, so
 * the rules live in one place and the apps need no change.
 */
@Injectable()
export class OrderLifecycleService {
  private readonly logger = new Logger('OrderLifecycle');

  constructor(
    private readonly mongo: MongoDataService,
    private readonly fcm: FcmService,
  ) {}

  // ── Audit log ───────────────────────────────────────────────────────────
  /** Append an immutable status-change row to `order_status_logs`. */
  async log(orderId: number, fromStatus: string | undefined, toStatus: string, by: Actor, reason?: string | null): Promise<void> {
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
    } catch (e) {
      this.logger.warn(`audit log failed for order ${orderId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  private async tokenForUser(userId?: number | null): Promise<string | null> {
    if (!userId) return null;
    const u = await this.mongo.findOne<{ fcm_token?: string }>('users', { mysql_id: Number(userId) });
    return u?.fcm_token ?? null;
  }
  private async tokenForRestaurant(restaurantId?: number | null): Promise<string | null> {
    if (!restaurantId) return null;
    const r = await this.mongo.findOne<{ mysql_vendor_id?: number }>('restaurants', { mysql_id: Number(restaurantId) });
    if (!r?.mysql_vendor_id) return null;
    const v = await this.mongo.findOne<{ fcm_token?: string }>('vendors', { mysql_id: Number(r.mysql_vendor_id) });
    return v?.fcm_token ?? null;
  }
  private async tokenForDeliveryMan(dmId?: number | null): Promise<string | null> {
    if (!dmId) return null;
    const d = await this.mongo.findOne<{ fcm_token?: string }>('delivery_men', { mysql_id: Number(dmId) });
    return d?.fcm_token ?? null;
  }
  private async push(token: string | null, title: string, body: string, orderId: number, type: string): Promise<void> {
    if (!token) return;
    await this.fcm.sendToToken(token, { title, body }, { type, order_id: orderId, title }).catch(() => undefined);
  }

  /** Refund state a cancellation should produce: prepaid → pending, COD → none. */
  private refundStatusForCancel(order: OrderDoc): string {
    const isCod = (order.payment_method ?? 'cash_on_delivery') === 'cash_on_delivery';
    if (isCod) return REFUND_STATUS.NOT_REQUIRED;
    return order.payment_status === 'paid' ? REFUND_STATUS.PENDING : REFUND_STATUS.NOT_REQUIRED;
  }

  // ── Cancellation (Cases 1–6) ──────────────────────────────────────────────
  /**
   * Canonical cancellation. `restaurant_not_responded` → auto_cancelled (Case 1);
   * everything else → canceled. Sets cancel_reason + refund_status, logs, and
   * notifies the right audiences. Idempotent on already-terminal orders.
   */
  async cancelOrder(orderId: number, reason: CancelReason, by: Actor): Promise<{ ok: boolean; skipped?: boolean; status?: string; cancel_reason?: string; refund_status?: string; reason?: string }> {
    const order = await this.mongo.findByMysqlId<OrderDoc>('orders', orderId);
    if (!order) return { ok: false, reason: 'order_not_found' };
    if (TERMINAL_STATUSES.has(String(order.order_status))) {
      return { ok: false, skipped: true, reason: `already_${order.order_status}` };
    }
    const toStatus = reason === 'restaurant_not_responded' ? 'auto_cancelled' : 'canceled';
    // Prepaid order → start + complete the refund automatically (credit wallet).
    let refundStatus = this.refundStatusForCancel(order);
    if (refundStatus === REFUND_STATUS.PENDING) {
      refundStatus = await this.processRefund(order);
    }
    await this.mongo.updateOne('orders', { mysql_id: Number(orderId) }, {
      order_status: toStatus,
      cancel_reason: reason,
      cancellation_reason: reason, // keep legacy field in sync
      canceled_by: by,
      refund_status: refundStatus,
      canceled: new Date(),
      updated_at: new Date(),
    });
    await this.log(orderId, order.order_status, toStatus, by, reason);

    // Notify: customer + restaurant always; delivery partner only for the
    // reasons the spec lists (and only if a rider was assigned).
    const [custTok, restTok] = await Promise.all([
      this.tokenForUser(order.mysql_user_id),
      this.tokenForRestaurant(order.mysql_restaurant_id),
    ]);
    await this.push(custTok, 'Order cancelled', CANCEL_MESSAGE_CUSTOMER[reason], orderId, 'order_cancelled');
    await this.push(restTok, 'Order cancelled', CANCEL_MESSAGE_RESTAURANT[reason], orderId, 'order_cancelled');
    if (NOTIFY_DELIVERY_ON_CANCEL.has(reason) && order.mysql_delivery_man_id) {
      const dmTok = await this.tokenForDeliveryMan(order.mysql_delivery_man_id);
      await this.push(dmTok, 'Order cancelled', 'Order cancelled', orderId, 'order_cancelled');
    }

    return { ok: true, status: toStatus, cancel_reason: reason, refund_status: refundStatus };
  }

  /** Whether the given actor may cancel from the order's current state. */
  canCancel(order: { order_status?: string }, by: Exclude<Actor, 'delivery_partner' | 'system'>): boolean {
    const s = normaliseStatus(String(order.order_status ?? ''));
    if (TERMINAL_STATUSES.has(s)) return false;
    if (by === 'admin') return true; // any active state
    return s === 'pending' || s === 'confirmed'; // customer & restaurant: before prep
  }

  // ── Case 6: delivery partner rejects ──────────────────────────────────────
  /**
   * A rider rejecting an order must NOT cancel it. Unassign the rider and try to
   * assign another in the same zone; if none is available, only THEN cancel with
   * `delivery_partner_unavailable`. The order stays at ready_for_pickup meanwhile.
   */
  async handleDeliveryRejection(orderId: number, rejectingDmId: number): Promise<{ ok: boolean; reassigned_to?: number; cancelled?: boolean }> {
    const order = await this.mongo.findByMysqlId<OrderDoc>('orders', orderId);
    if (!order) return { ok: false };
    // Unassign the rejecting rider; keep the order status unchanged.
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
    // No rider available → cancel per the spec.
    await this.cancelOrder(orderId, 'delivery_partner_unavailable', 'system');
    return { ok: true, cancelled: true };
  }

  /** Find an approved rider in the order's zone, excluding the one who rejected. */
  private async findAvailableRider(order: OrderDoc, excludeDmId: number): Promise<number | null> {
    const filter: Record<string, unknown> = {
      mysql_id: { $ne: Number(excludeDmId) },
      $or: [{ application_status: 'approved' }, { application_status: { $exists: false } }],
    };
    if (order.mysql_zone_id != null) filter.mysql_zone_id = Number(order.mysql_zone_id);
    const riders = await this.mongo.findMany<{ mysql_id: number; status?: boolean | number }>('delivery_men', filter, { limit: 20 });
    const active = riders.find((r) => r.status === true || r.status === 1 || r.status === undefined) ?? riders[0];
    return active ? Number(active.mysql_id) : null;
  }

  // ── Case 1: auto-cancel stale pending orders ──────────────────────────────
  /** Cancel every order still `pending` 60s after creation. Called by the cron. */
  async autoCancelStalePending(): Promise<{ cancelled: number }> {
    const cutoff = new Date(Date.now() - 60_000);
    const stale = await this.mongo.findMany<OrderDoc & { pending?: Date; created_at?: Date }>(
      'orders',
      {
        order_status: 'pending',
        $or: [{ pending: { $lte: cutoff } }, { pending: { $exists: false }, created_at: { $lte: cutoff } }],
      },
      { limit: 500, sort: { mysql_id: 1 } },
    );
    let cancelled = 0;
    for (const o of stale) {
      const res = await this.cancelOrder(Number(o.mysql_id), 'restaurant_not_responded', 'system');
      if (res.ok) cancelled++;
    }
    if (cancelled) this.logger.log(`auto-cancelled ${cancelled} unresponded pending order(s)`);
    return { cancelled };
  }

  // ── Forward transitions (audit + notify) ──────────────────────────────────
  /**
   * Record a forward status change made by an entry point (admin/vendor/rider):
   * writes the audit log and notifies the customer with the right message. The
   * caller still performs the DB write + its own side effects (settlement, etc.).
   */
  async recordTransition(orderId: number, fromStatus: string | undefined, toStatus: string, by: Actor): Promise<void> {
    const canonical = normaliseStatus(toStatus);
    await this.log(orderId, fromStatus, canonical, by);
    const label = STATUS_LABELS[canonical]?.customer;
    if (label) {
      const order = await this.mongo.findByMysqlId<OrderDoc>('orders', orderId);
      const tok = await this.tokenForUser(order?.mysql_user_id);
      await this.push(tok, 'Order update', label, orderId, 'order_status');
    }
  }

  // ── Refund processing (real money back to wallet) ─────────────────────────
  /** Credit a full refund to the customer's wallet + log a wallet transaction. */
  private async creditCustomerWallet(userId: number, amount: number): Promise<void> {
    const w = await this.mongo.findOne<{ mysql_id: number; balance?: number; total_earning?: number }>(
      'wallets', { $or: [{ user_id: userId }, { mysql_user_id: userId }] },
    );
    if (w) {
      await this.mongo.updateOne('wallets', { mysql_id: Number(w.mysql_id) }, {
        balance: r2(Number(w.balance ?? 0) + amount),
        total_earning: r2(Number(w.total_earning ?? 0) + amount),
        updated_at: new Date(),
      });
    } else {
      const id = await this.mongo.nextMysqlId('wallets');
      await this.mongo.insertOne('wallets', {
        mysql_id: id, user_id: userId, mysql_user_id: userId,
        balance: amount, total_earning: amount, created_at: new Date(), updated_at: new Date(),
      });
    }
    const txId = await this.mongo.nextMysqlId('wallet_transactions');
    await this.mongo.insertOne('wallet_transactions', {
      mysql_id: txId, user_id: userId, credit: amount, debit: 0,
      transaction_type: 'order_refund', reference: 'order_refund', created_at: new Date(),
    });
  }

  /** Refund a cancelled prepaid order to the customer wallet. Returns the new
   *  refund_status (processed / failed / not_required). */
  private async processRefund(order: OrderDoc): Promise<string> {
    const amount = r2(Number(order.order_amount ?? 0));
    const uid = order.mysql_user_id != null ? Number(order.mysql_user_id) : 0;
    if (!uid || amount <= 0) return REFUND_STATUS.NOT_REQUIRED;
    try {
      await this.creditCustomerWallet(uid, amount);
      const rid = await this.mongo.nextMysqlId('refunds');
      await this.mongo.insertOne('refunds', {
        mysql_id: rid, order_id: Number(order.mysql_id), user_id: uid,
        refund_amount: amount, refund_method: 'wallet', refund_status: 'completed',
        reason: 'order_cancelled', created_at: new Date(),
      });
      const tok = await this.tokenForUser(uid);
      await this.push(tok, 'Refund processed', `₹${amount.toFixed(2)} refunded to your wallet`, Number(order.mysql_id), 'refund');
      return REFUND_STATUS.PROCESSED;
    } catch (e) {
      this.logger.warn(`refund failed for order ${order.mysql_id}: ${e instanceof Error ? e.message : String(e)}`);
      return REFUND_STATUS.FAILED;
    }
  }

  /** Sweep any orders left in refund_status=pending (e.g. a prior failure) and
   *  retry. Safe to run on a schedule. */
  async processPendingRefunds(): Promise<{ processed: number }> {
    const pending = await this.mongo.findMany<OrderDoc>('orders', { refund_status: REFUND_STATUS.PENDING }, { limit: 200 });
    let processed = 0;
    for (const o of pending) {
      const st = await this.processRefund(o);
      await this.mongo.updateOne('orders', { mysql_id: Number(o.mysql_id) }, { refund_status: st, updated_at: new Date() });
      if (st === REFUND_STATUS.PROCESSED) processed++;
    }
    return { processed };
  }

  // ── Strict per-order-type transition validation ───────────────────────────
  /**
   * Reject invalid forward transitions: a status that isn't part of the order
   * type's flow (e.g. `served` on a delivery order) or a move backwards. Cancels
   * are validated separately. Off by default — set STRICT_ORDER_TRANSITIONS=1 to
   * enforce (so it can be enabled once the apps emit the new statuses cleanly).
   */
  assertTransition(orderType: string | undefined, fromStatus: string | undefined, toStatus: string): void {
    if ((process.env.STRICT_ORDER_TRANSITIONS ?? '0') !== '1') return;
    const to = normaliseStatus(toStatus);
    if (to === 'canceled' || to === 'auto_cancelled') return;
    const type: OrderType = (['delivery', 'take_away', 'dine_in'].includes(String(orderType)) ? orderType : 'delivery') as OrderType;
    const flow = FLOW[type];
    const toIdx = flow.indexOf(to);
    if (toIdx === -1) {
      throw new BadRequestException({ errors: [{ code: 'transition', message: `'${to}' is not a valid status for a ${type} order` }] });
    }
    const from = normaliseStatus(fromStatus ?? '');
    const fromIdx = flow.indexOf(from);
    if (fromIdx !== -1 && toIdx < fromIdx) {
      throw new BadRequestException({ errors: [{ code: 'transition', message: `cannot move a ${type} order back from '${from}' to '${to}'` }] });
    }
  }
}
