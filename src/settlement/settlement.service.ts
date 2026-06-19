import { Injectable, Logger } from '@nestjs/common';
import { MongoDataService } from '../mongo/mongo-data.service';
import { DmWalletService } from '../wallet/dm-wallet.service';

/**
 * Pay-Per-Order settlement engine (Zomato/Swiggy/Stripe style).
 *
 * Runs ONLY when an order is DELIVERED. Idempotent and duplicate-proof:
 *   • A UNIQUE index on settlements(mysql_order_id, mysql_restaurant_id) means a
 *     second settlement can never be inserted — the first writer "claims" it.
 *   • Each money leg (restaurant credit, deliveryman credit, admin credit,
 *     platform-revenue / tax / discount ledger) is itself guarded by a UNIQUE
 *     ledger row, so a crash-and-retry resumes safely without double-crediting.
 *   • Wallet balances move via atomic `$inc` (no read-modify-write race).
 *
 * Money is never lost: the restaurant leg is the *residual* of the accounting
 * identity, so the four destinations (restaurant, deliveryman, tax, admin) sum
 * exactly to the customer payment.
 */

const r2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export type DiscountOwner = 'admin' | 'restaurant' | 'shared';

interface OrderDoc {
  mysql_id: number;
  mysql_restaurant_id?: number;
  mysql_delivery_man_id?: number | null;
  order_status?: string;
  order_type?: string;
  payment_method?: string;
  order_amount?: number;
  total_tax_amount?: number;
  delivery_charge?: number;
  additional_charge?: number;
  extra_packaging_amount?: number;
  coupon_discount_amount?: number;
  restaurant_discount_amount?: number;
  admin_discount_amount?: number;
  discount_owner?: string;
  coupon_code?: string | null;
}

interface OrderDetailDoc {
  order_id?: number;
  price?: number;
  quantity?: number;
}

interface RestaurantDoc {
  mysql_id: number;
  comission?: number;
  admin_markup?: number;
  restaurant_model?: string;
}

interface CouponDoc {
  mysql_id: number;
  code?: string;
  discount_owner?: string;
  discount_type?: string;
  admin_discount_amount?: number;
  restaurant_discount_amount?: number;
}

export interface SettlementBreakdown {
  food_amount: number;          // gross menu value of the items
  customer_payment: number;     // what the customer actually paid
  gross_order_amount: number;   // alias of customer_payment (BRD wording)
  tax_amount: number;
  delivery_charge: number;
  platform_fee: number;
  admin_commission: number;
  admin_markup: number;
  admin_discount: number;       // admin-funded discount (promo expense)
  restaurant_discount: number;  // restaurant-funded discount
  platform_revenue: number;     // commission + platform fee (+ undelivered delivery)
  deliveryman_earning: number;
  admin_net: number;            // platform_revenue − admin_discount (admin cash)
  restaurant_earning: number;   // residual → keeps the identity exact
  identity_ok: boolean;
}

@Injectable()
export class SettlementService {
  private readonly logger = new Logger('Settlement');
  private indexesReady = false;

  constructor(
    private readonly mongo: MongoDataService,
    private readonly dmWallet: DmWalletService,
  ) {}

  private async ensureIndexes(): Promise<void> {
    if (this.indexesReady) return;
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

  // ── Discount / coupon ownership ────────────────────────────────────────
  /**
   * Splits every discount on the order into admin-funded vs restaurant-funded.
   * Honours explicit order fields first, then the coupon's ownership:
   *   • coupon discount_owner = admin       → 100% admin-funded
   *   • coupon discount_owner = restaurant  → 100% restaurant-funded
   *   • coupon discount_owner = shared      → split by the coupon's configured
   *     admin/restaurant amounts (proportionally to the actual discount)
   */
  private async resolveDiscounts(order: OrderDoc): Promise<{
    admin: number;
    restaurant: number;
    coupon: CouponDoc | null;
    owner: DiscountOwner;
  }> {
    // The order carries the AUTHORITATIVE split — placeOrder resolved the
    // coupon's owner at checkout and wrote admin_discount_amount /
    // restaurant_discount_amount. We trust those (no re-splitting here, or the
    // discount would be double-counted).
    const admin = r2(Math.max(0, num(order.admin_discount_amount)));
    const restaurant = r2(Math.max(0, num(order.restaurant_discount_amount)));
    const owner: DiscountOwner =
      (order.discount_owner as DiscountOwner) ||
      (restaurant > 0 && admin === 0 ? 'restaurant' : 'admin');

    // Look up the coupon only to enrich the discount ledger (id / code), not to
    // recompute the split.
    let coupon: CouponDoc | null = null;
    if (num(order.coupon_discount_amount) > 0 && order.coupon_code) {
      coupon = await this.mongo.findOne<CouponDoc>('coupons', { code: order.coupon_code });
    }

    return { admin, restaurant, coupon, owner };
  }

  // ── Accounting ─────────────────────────────────────────────────────────
  private computeBreakdown(
    order: OrderDoc,
    restaurant: RestaurantDoc | null,
    foodAmount: number,
    discounts: { admin: number; restaurant: number },
  ): SettlementBreakdown {
    const customerPayment = r2(num(order.order_amount));
    const tax = r2(num(order.total_tax_amount));
    const deliveryCharge = r2(num(order.delivery_charge));
    const platformFee = r2(num(order.additional_charge));
    const hasDeliveryMan = order.mysql_delivery_man_id != null && Number(order.mysql_delivery_man_id) > 0;

    // Commission is charged on what the restaurant actually sells for, i.e. the
    // menu value minus any RESTAURANT-funded discount. Admin-funded discounts do
    // not reduce the commission base (the restaurant still sells at full price).
    const commissionBase = Math.max(0, r2(foodAmount - discounts.restaurant));
    const commissionPct = Math.max(0, num(restaurant?.comission));
    const adminCommission = r2((commissionBase * commissionPct) / 100);
    const adminMarkup = r2(num(restaurant?.admin_markup));

    // Delivery fee is the deliveryman's earning; if no DM is attached it stays
    // with the platform (so nothing is lost).
    const deliverymanEarning = hasDeliveryMan ? deliveryCharge : 0;
    const undeliveredDelivery = hasDeliveryMan ? 0 : deliveryCharge;

    const platformRevenue = r2(adminCommission + platformFee + adminMarkup + undeliveredDelivery);

    // Restaurant earning is the RESIDUAL — guarantees the identity holds and no
    // money is ever lost:
    //   customer_payment + admin_discount
    //     = restaurant_earning + platform_revenue + deliveryman_earning + tax
    const restaurantEarning = r2(
      customerPayment + discounts.admin - platformRevenue - deliverymanEarning - tax,
    );
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

  // ── Idempotent money legs ──────────────────────────────────────────────
  /** Credit a wallet exactly once per (order, leg). Returns true if it credited
   *  now, false if this leg was already settled (idempotent replay). */
  private async creditWalletOnce(
    orderId: number,
    leg: 'restaurant' | 'deliveryman' | 'admin',
    walletCollection: string,
    matchFilter: Record<string, unknown>,
    seed: Record<string, unknown>,
    amount: number,
    meta: Record<string, unknown>,
  ): Promise<boolean> {
    if (amount === 0) return false;
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
    if (!claimed) return false;
    await this.mongo.increment(
      walletCollection,
      matchFilter,
      { balance: r2(amount), total_earning: r2(amount) },
      { ...seed, created_at: new Date() },
    );
    return true;
  }

  /** Insert a single per-order ledger row, idempotently. */
  private async writeLedgerOnce(collection: string, orderId: number, doc: Record<string, unknown>): Promise<void> {
    await this.mongo.tryInsertUnique(collection, {
      mysql_order_id: orderId,
      ...doc,
      created_at: new Date(),
    });
  }

  // ── Public entry point ─────────────────────────────────────────────────
  /**
   * Settle a single delivered order. Safe to call any number of times from any
   * source (status update, retry, queue, cron) — it credits wallets and writes
   * ledgers at most once.
   */
  async settleOrder(orderId: number): Promise<{ ok: boolean; skipped?: boolean; reason?: string; settlement?: Record<string, unknown> }> {
    const order = await this.mongo.findByMysqlId<OrderDoc>('orders', orderId);
    if (!order) return { ok: false, reason: 'order_not_found' };

    // Settlement runs ONLY for a terminal-success order — 'delivered' (delivery)
    // or 'completed' (take-away / dine-in). Never for pending/confirmed/
    // processing/out_for_delivery/canceled/auto_cancelled/refunded.
    if (order.order_status !== 'delivered' && order.order_status !== 'completed') {
      return { ok: false, skipped: true, reason: `not_terminal (${order.order_status ?? 'unknown'})` };
    }
    const restaurantId = order.mysql_restaurant_id != null ? Number(order.mysql_restaurant_id) : null;
    if (!restaurantId) return { ok: false, reason: 'order_has_no_restaurant' };

    await this.ensureIndexes();

    // ── Idempotency claim ──────────────────────────────────────────────
    let settlement = await this.mongo.findOne<Record<string, unknown>>('settlements', {
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
        // Lost the race — another worker is settling. Re-read; skip if done.
        settlement = await this.mongo.findOne<Record<string, unknown>>('settlements', {
          mysql_order_id: orderId,
          mysql_restaurant_id: restaurantId,
        });
        if (settlement?.settlement_completed) {
          return { ok: true, skipped: true, reason: 'already_settled', settlement };
        }
      }
    }

    // ── Compute ────────────────────────────────────────────────────────
    const details = await this.mongo.findMany<OrderDetailDoc>('order_details', { order_id: orderId });
    const foodAmount = r2(details.reduce((s, d) => s + num(d.price) * num(d.quantity), 0));
    const restaurant = await this.mongo.findByMysqlId<RestaurantDoc>('restaurants', restaurantId);
    const discounts = await this.resolveDiscounts(order);
    const b = this.computeBreakdown(order, restaurant, foodAmount, discounts);

    if (!b.identity_ok) {
      this.logger.warn(`Order ${orderId}: accounting identity mismatch — stored anyway for audit.`);
    }

    // ── Money legs (each idempotent) ───────────────────────────────────
    await this.creditWalletOnce(
      orderId, 'restaurant', 'restaurant_wallets',
      { mysql_restaurant_id: restaurantId },
      { restaurant_id: restaurantId },
      b.restaurant_earning,
      { owner_id: restaurantId, reference: `settlement#${orderId}` },
    );

    const dmId = order.mysql_delivery_man_id != null ? Number(order.mysql_delivery_man_id) : 0;
    if (dmId > 0) {
      await this.creditWalletOnce(
        orderId, 'deliveryman', 'delivery_man_wallets',
        { mysql_delivery_man_id: dmId },
        { delivery_man_id: dmId },
        b.deliveryman_earning,
        { owner_id: dmId, reference: `settlement#${orderId}` },
      );
      // Extra rider earning channels — each idempotent, best-effort so a hiccup
      // here never blocks the core settlement:
      //   • tips    — pay any tip added before delivery
      //   • bonuses — award completion bonuses whose threshold is now met
      //   • COD     — track cash collected on a cash-on-delivery order
      await this.dmWallet.reconcileTips(orderId).catch(() => undefined);
      await this.dmWallet.evaluateBonuses(dmId).catch(() => undefined);
      // Auto-raise a pending incentive claim when the rider hits the configured
      // period delivery target (admin approves to pay — never auto-credits).
      await this.dmWallet.evaluateIncentives(dmId).catch(() => undefined);
      if ((order.payment_method ?? 'cash_on_delivery') === 'cash_on_delivery') {
        await this.dmWallet.recordCod(dmId, orderId, Number(order.order_amount ?? 0)).catch(() => undefined);
      }
    }

    await this.creditWalletOnce(
      orderId, 'admin', 'admin_wallet',
      { key: 'platform' },
      {},
      b.admin_net,
      { owner_id: 0, reference: `settlement#${orderId}` },
    );

    // ── Ledgers ────────────────────────────────────────────────────────
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

    // ── Finalise the settlement record ─────────────────────────────────
    await this.mongo.updateOne(
      'settlements',
      { mysql_order_id: orderId, mysql_restaurant_id: restaurantId },
      {
        ...b,
        order_type: order.order_type ?? null,
        payment_method: order.payment_method ?? null,
        discount_owner: discounts.owner,
        settlement_completed: true,
        completed_at: new Date(),
        updated_at: new Date(),
      },
    );

    const finalDoc = await this.mongo.findOne<Record<string, unknown>>('settlements', {
      mysql_order_id: orderId,
      mysql_restaurant_id: restaurantId,
    });
    return { ok: true, settlement: finalDoc ?? undefined };
  }

  /** Read a settlement (admin inspection). */
  async getSettlement(orderId: number): Promise<Record<string, unknown> | null> {
    return this.mongo.findOne('settlements', { mysql_order_id: Number(orderId) });
  }

  /** List recent settlements (admin). */
  async listSettlements(limit = 50, offset = 0): Promise<{ total: number; items: Record<string, unknown>[] }> {
    const [items, total] = await Promise.all([
      this.mongo.findMany('settlements', {}, { sort: { mysql_id: -1 }, limit, skip: offset }),
      this.mongo.count('settlements', {}),
    ]);
    return { total, items };
  }

  /**
   * Record a withdrawal request against a wallet (restaurant or deliveryman).
   * Append-only to the withdrawal_ledger; does not move the balance until an
   * admin approves (status transitions handled by the payout flow).
   */
  async requestWithdrawal(body: {
    actor_type: 'restaurant' | 'deliveryman';
    actor_id: number;
    amount: number;
  }): Promise<{ ok: boolean; id: number }> {
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
}
