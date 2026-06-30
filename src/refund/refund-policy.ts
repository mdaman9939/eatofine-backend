/**
 * Refund + Cancellation Decision Matrix.
 *
 * Encodes the 13 scenarios from the spec PDF (`Refund and Cancellation Cases.pdf`).
 * Each scenario is a pure function of (order snapshot, scenario key) → effects.
 * No DB access here — this file stays a deterministic policy engine that the
 * RefundService can preview to admins before they confirm.
 *
 * Money math note: penalties are expressed as a composition of component fees
 * (admin_charge / packaging / delivery / etc) rather than raw rupees, so the
 * same scenario applied to two different orders correctly scales by their
 * own pricing. The "Item cost + GST" partial refund follows the same pattern.
 */

export type ScenarioKey =
  | 'USER_BEFORE_ACCEPT'
  | 'USER_AFTER_ACCEPT_NO_DM'
  | 'USER_AFTER_ACCEPT_WITH_DM'
  | 'ADMIN_USER_UNREACHABLE'
  | 'ADMIN_WRONG_ITEM_RESTAURANT'
  | 'ADMIN_MISSING_PACKET_DM'
  | 'ADMIN_RESTAURANT_FAULT_AFTER_DELIVERY'
  | 'ADMIN_RESTAURANT_FAULT_BEFORE_DELIVERY'
  | 'ADMIN_DM_FAULT_AFTER_DELIVERY'
  | 'ADMIN_DM_FAULT_BEFORE_DELIVERY'
  | 'RESTAURANT_REJECT_BEFORE_ACCEPT'
  | 'RESTAURANT_REJECT_AFTER_ACCEPT_NO_DM'
  | 'RESTAURANT_REJECT_AFTER_ACCEPT_WITH_DM';

export type CancelledBy = 'user' | 'admin' | 'restaurant';
export type PenaltyTarget = 'restaurant' | 'deliveryman' | null;
export type WalletDirection = 'credit' | 'debit' | 'none';

/** Money snapshot taken off the order at decision time. Everything we need
 *  to compute a refund without re-querying any other collection. */
export interface OrderMoney {
  item_total: number;           // pre-tax food cost (order_amount - tax - delivery + restaurant_discount)
  tax: number;                  // GST
  delivery_charge: number;
  packaging_amount: number;     // extra_packaging_amount
  additional_charge: number;    // platform / convenience / package fee
  situational_charge: number;   // surge / late-night / festival / weekend (part of delivery_charge)
  admin_commission: number;     // PPO / commission earned by platform on the food
  admin_commission_gst: number; // 18% GST on the admin commission (PPO charge)
  grand_total: number;          // amount actually paid by user
}

/** Reflects whether the order had a DM assigned and whether it was delivered.
 *  Used to gate which scenarios are even valid for a given order. */
export interface OrderStage {
  status: string;
  has_delivery_man: boolean;
  is_delivered: boolean;
  cancelled_by: CancelledBy | null;
}

export interface ScenarioDefinition {
  key: ScenarioKey;
  cancelled_by: CancelledBy;
  label: string;
  /** When an admin is browsing scenarios, only show ones the order's current
   *  stage actually allows. e.g. a delivered order can't be cancelled before
   *  the DM was assigned. */
  allowsStage: (s: OrderStage) => boolean;
  /** Pure decision producer. */
  decide: (money: OrderMoney) => RefundEffects;
}

export interface RefundEffects {
  /** Money refunded to the user. */
  refund_amount: number;
  refund_to_user: boolean;
  /** True ⇒ a tax invoice was/will be raised for the user. */
  generate_invoice: boolean;
  /** True ⇒ a credit note will be raised. */
  generate_credit_note: boolean;
  penalty: {
    target: PenaltyTarget;
    amount: number;
    /** Human-readable breakdown of what the penalty is composed of. */
    components: string[];
  };
  restaurant_wallet: {
    direction: WalletDirection;
    /** Amount in INR. For 'none' direction this is 0. */
    amount: number;
    note: string;
  };
  deliveryman_wallet: {
    direction: WalletDirection;
    amount: number;
    note: string;
  };
  /** Where the order should land in the lifecycle once applied. */
  final_order_status: 'canceled' | 'refunded';
  /** Short description displayed in the admin preview pane. */
  summary: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Net a credit-then-debit pair into a single ledger movement. If the net is
 *  negative, the wallet ends up debited; if positive, it's a credit; zero
 *  becomes a no-op. Keeps the ledger auditable without splitting one
 *  scenario into two correlated rows. */
function netted(net: number, baseNote: string): { direction: WalletDirection; amount: number; note: string } {
  const abs = Math.abs(net);
  if (abs < 0.01) return { direction: 'none', amount: 0, note: `${baseNote} (net ₹0)` };
  return {
    direction: net > 0 ? 'credit' : 'debit',
    amount: Math.round(abs * 100) / 100,
    note: `${baseNote} (net ₹${net > 0 ? '+' : '-'}${abs.toFixed(2)})`,
  };
}

/**
 * The 13-row decision matrix. Each row maps a real-world cancellation
 * scenario to its money + wallet + invoice consequences.
 */
export const SCENARIOS: Record<ScenarioKey, ScenarioDefinition> = {
  // ── User-initiated ─────────────────────────────────────────────────────
  USER_BEFORE_ACCEPT: {
    key: 'USER_BEFORE_ACCEPT',
    cancelled_by: 'user',
    label: 'User cancelled before restaurant accepted',
    allowsStage: (s) => !s.is_delivered && (s.status === 'pending' || s.status === 'failed'),
    decide: (m) => ({
      refund_amount: r2(m.grand_total),
      refund_to_user: true,
      generate_invoice: false,
      generate_credit_note: false,
      penalty: { target: null, amount: 0, components: [] },
      restaurant_wallet: { direction: 'none', amount: 0, note: 'order never accepted' },
      deliveryman_wallet: { direction: 'none', amount: 0, note: 'no DM assigned' },
      final_order_status: 'canceled',
      summary: 'Full refund to user. No invoice. No party is penalised.',
    }),
  },

  USER_AFTER_ACCEPT_NO_DM: {
    key: 'USER_AFTER_ACCEPT_NO_DM',
    cancelled_by: 'user',
    label: 'User cancelled after restaurant accepted (no DM assigned)',
    allowsStage: (s) => !s.is_delivered && (s.status === 'confirmed' || s.status === 'processing') && !s.has_delivery_man,
    decide: (m) => ({
      refund_amount: 0,
      refund_to_user: false,
      generate_invoice: true,
      generate_credit_note: false,
      penalty: { target: null, amount: 0, components: [] },
      restaurant_wallet: { direction: 'credit', amount: r2(m.item_total - m.admin_commission), note: 'Normal cycle — order accepted by restaurant before cancel' },
      deliveryman_wallet: { direction: 'none', amount: 0, note: 'no DM was assigned' },
      final_order_status: 'canceled',
      summary: 'Zero refund. Restaurant earns the item value (normal cycle). Invoice raised.',
    }),
  },

  USER_AFTER_ACCEPT_WITH_DM: {
    key: 'USER_AFTER_ACCEPT_WITH_DM',
    cancelled_by: 'user',
    label: 'User cancelled after restaurant accepted (DM already assigned)',
    allowsStage: (s) => !s.is_delivered && s.has_delivery_man && (s.status === 'confirmed' || s.status === 'processing' || s.status === 'handover'),
    decide: (m) => ({
      refund_amount: 0,
      refund_to_user: false,
      generate_invoice: true,
      generate_credit_note: false,
      penalty: { target: null, amount: 0, components: [] },
      restaurant_wallet: { direction: 'credit', amount: r2(m.item_total - m.admin_commission), note: 'Normal cycle — accepted before cancel' },
      deliveryman_wallet: { direction: 'credit', amount: r2(m.delivery_charge), note: 'Normal cycle — DM was already dispatched' },
      final_order_status: 'canceled',
      summary: 'Zero refund. Restaurant + DM both earn (normal cycle). Invoice raised.',
    }),
  },

  // ── Admin-initiated ────────────────────────────────────────────────────
  ADMIN_USER_UNREACHABLE: {
    key: 'ADMIN_USER_UNREACHABLE',
    cancelled_by: 'admin',
    label: 'Admin cancel — DM reached but user not contactable',
    allowsStage: (s) => !s.is_delivered && s.has_delivery_man,
    decide: (m) => ({
      refund_amount: 0,
      refund_to_user: false,
      generate_invoice: true,
      generate_credit_note: false,
      penalty: { target: null, amount: 0, components: [] },
      restaurant_wallet: { direction: 'credit', amount: r2(m.item_total - m.admin_commission), note: 'Normal cycle — restaurant fulfilled its side' },
      deliveryman_wallet: { direction: 'credit', amount: r2(m.delivery_charge), note: 'Normal cycle — DM reached delivery address' },
      final_order_status: 'canceled',
      summary: 'Zero refund. Both restaurant + DM earn since both did their job.',
    }),
  },

  ADMIN_WRONG_ITEM_RESTAURANT: {
    key: 'ADMIN_WRONG_ITEM_RESTAURANT',
    cancelled_by: 'admin',
    label: 'Admin — wrong / missing item (restaurant fault)',
    allowsStage: () => true,
    decide: (m) => {
      const refund = r2(m.item_total + m.tax);
      const restNet = r2((m.item_total - m.admin_commission) - refund);
      return {
        refund_amount: refund,
        refund_to_user: true,
        generate_invoice: true,
        generate_credit_note: true,
        penalty: { target: 'restaurant', amount: refund, components: ['Item cost', 'GST'] },
        restaurant_wallet: netted(restNet, 'Normal cycle item earnings, refund-source debited'),
        deliveryman_wallet: { direction: 'credit', amount: r2(m.delivery_charge), note: 'Normal cycle — DM delivered fine' },
        final_order_status: 'refunded',
        summary: `Partial refund (item + GST = ₹${refund}). Sourced from restaurant wallet.`,
      };
    },
  },

  ADMIN_MISSING_PACKET_DM: {
    key: 'ADMIN_MISSING_PACKET_DM',
    cancelled_by: 'admin',
    label: 'Admin — number of missing packets (DM fault)',
    allowsStage: (s) => s.has_delivery_man,
    decide: (m) => {
      const refund = r2(m.item_total + m.tax);
      const dmNet = r2(m.delivery_charge - refund);
      return {
        refund_amount: refund,
        refund_to_user: true,
        generate_invoice: true,
        generate_credit_note: true,
        penalty: { target: 'deliveryman', amount: refund, components: ['Item cost', 'GST'] },
        restaurant_wallet: { direction: 'credit', amount: r2(m.item_total - m.admin_commission), note: 'Normal cycle — restaurant prepared the order correctly' },
        deliveryman_wallet: netted(dmNet, 'Normal delivery credit minus refund-source'),
        final_order_status: 'refunded',
        summary: `Partial refund (item + GST = ₹${refund}). Sourced from DM wallet.`,
      };
    },
  },

  ADMIN_RESTAURANT_FAULT_AFTER_DELIVERY: {
    key: 'ADMIN_RESTAURANT_FAULT_AFTER_DELIVERY',
    cancelled_by: 'admin',
    label: 'Admin (after delivery) — wrong/damaged/packaging/veg-nonveg (restaurant fault)',
    allowsStage: (s) => s.is_delivered,
    decide: (m) => {
      // PDF: Penalty = Additional Fee + Situation Fee + Delivery fee + any other.
      const penaltyAmt = r2(m.additional_charge + m.situational_charge + m.delivery_charge + m.packaging_amount);
      const restNet = r2((m.item_total - m.admin_commission) - (m.item_total + penaltyAmt));
      return {
        refund_amount: r2(m.grand_total),
        refund_to_user: true,
        generate_invoice: true,
        generate_credit_note: true,
        penalty: {
          target: 'restaurant',
          amount: penaltyAmt,
          components: ['Additional charge', 'Situational charges', 'Delivery fee', 'Other fees'],
        },
        restaurant_wallet: netted(restNet, `Normal cycle credit reversed + penalty ₹${penaltyAmt}`),
        deliveryman_wallet: { direction: 'credit', amount: r2(m.delivery_charge), note: 'Normal cycle — DM delivered as instructed' },
        final_order_status: 'refunded',
        summary: `Full refund to user. Restaurant debited normal credit + penalty of ₹${penaltyAmt}.`,
      };
    },
  },

  ADMIN_RESTAURANT_FAULT_BEFORE_DELIVERY: {
    key: 'ADMIN_RESTAURANT_FAULT_BEFORE_DELIVERY',
    cancelled_by: 'admin',
    label: 'Admin (before delivery) — wrong/damaged/packaging/veg-nonveg (restaurant fault)',
    allowsStage: (s) => !s.is_delivered,
    decide: (m) => {
      // PDF: Penalty = PPO charge & GST + Additional Fee + Situation Fee + Delivery fee + any other.
      const penaltyAmt = r2(m.admin_commission + m.admin_commission_gst + m.additional_charge + m.situational_charge + m.delivery_charge + m.packaging_amount);
      return {
        refund_amount: r2(m.grand_total),
        refund_to_user: true,
        generate_invoice: false,
        generate_credit_note: false,
        penalty: {
          target: 'restaurant',
          amount: penaltyAmt,
          components: ['PPO charge', 'GST on commission', 'Additional charge', 'Situational charges', 'Delivery fee', 'Other fees'],
        },
        restaurant_wallet: { direction: 'debit', amount: penaltyAmt, note: `Penalty ₹${penaltyAmt} for restaurant fault before delivery` },
        deliveryman_wallet: { direction: 'credit', amount: r2(m.delivery_charge), note: 'Normal cycle — DM was already on the way' },
        final_order_status: 'canceled',
        summary: `Full refund to user. No invoice. Restaurant penalty ₹${penaltyAmt}.`,
      };
    },
  },

  ADMIN_DM_FAULT_AFTER_DELIVERY: {
    key: 'ADMIN_DM_FAULT_AFTER_DELIVERY',
    cancelled_by: 'admin',
    label: 'Admin (after delivery) — DM ran away / not delivered / damaged',
    allowsStage: (s) => s.is_delivered && s.has_delivery_man,
    decide: (m) => {
      const dmNet = r2(m.delivery_charge - m.grand_total);
      return {
        refund_amount: r2(m.grand_total),
        refund_to_user: true,
        generate_invoice: true,
        generate_credit_note: true,
        penalty: { target: 'deliveryman', amount: r2(m.grand_total), components: ['Total order cost'] },
        restaurant_wallet: { direction: 'credit', amount: r2(m.item_total - m.admin_commission), note: 'Normal cycle — restaurant fulfilled its side' },
        deliveryman_wallet: netted(dmNet, `Normal delivery credit minus total order cost ₹${r2(m.grand_total)}`),
        final_order_status: 'refunded',
        summary: `Full refund. DM debited full order cost ₹${r2(m.grand_total)}.`,
      };
    },
  },

  ADMIN_DM_FAULT_BEFORE_DELIVERY: {
    key: 'ADMIN_DM_FAULT_BEFORE_DELIVERY',
    cancelled_by: 'admin',
    label: 'Admin (before delivery) — DM ran away / not delivered / damaged',
    allowsStage: (s) => !s.is_delivered && s.has_delivery_man,
    decide: (m) => ({
      refund_amount: r2(m.grand_total),
      refund_to_user: true,
      generate_invoice: false,
      generate_credit_note: false,
      penalty: { target: 'deliveryman', amount: r2(m.grand_total), components: ['Total order cost'] },
      restaurant_wallet: { direction: 'credit', amount: r2(m.item_total - m.admin_commission), note: 'Normal cycle — restaurant prepared as ordered' },
      deliveryman_wallet: { direction: 'debit', amount: r2(m.grand_total), note: 'Penalty only — no normal-cycle credit' },
      final_order_status: 'canceled',
      summary: `Full refund. No invoice. DM penalised the entire ₹${r2(m.grand_total)} order cost.`,
    }),
  },

  // ── Restaurant-initiated ───────────────────────────────────────────────
  RESTAURANT_REJECT_BEFORE_ACCEPT: {
    key: 'RESTAURANT_REJECT_BEFORE_ACCEPT',
    cancelled_by: 'restaurant',
    label: 'Restaurant rejected before accepting',
    allowsStage: (s) => s.status === 'pending',
    decide: (m) => ({
      refund_amount: r2(m.grand_total),
      refund_to_user: true,
      generate_invoice: false,
      generate_credit_note: false,
      penalty: { target: null, amount: 0, components: [] },
      restaurant_wallet: { direction: 'none', amount: 0, note: 'No penalty — rejected before acceptance' },
      deliveryman_wallet: { direction: 'none', amount: 0, note: 'no DM was involved' },
      final_order_status: 'canceled',
      summary: 'Full refund. No penalty. Order never entered the restaurant\'s queue.',
    }),
  },

  RESTAURANT_REJECT_AFTER_ACCEPT_NO_DM: {
    key: 'RESTAURANT_REJECT_AFTER_ACCEPT_NO_DM',
    cancelled_by: 'restaurant',
    label: 'Restaurant rejected after accepting (no DM assigned)',
    allowsStage: (s) => (s.status === 'confirmed' || s.status === 'processing') && !s.has_delivery_man,
    decide: (m) => {
      // PDF: Penalty = Admin Charge only (PPO/Commission) + GST.
      const penaltyAmt = r2(m.admin_commission + m.admin_commission_gst);
      return {
        refund_amount: r2(m.grand_total),
        refund_to_user: true,
        generate_invoice: false,
        generate_credit_note: false,
        penalty: {
          target: 'restaurant',
          amount: penaltyAmt,
          components: ['Admin charge (PPO/Commission)', 'GST on commission'],
        },
        restaurant_wallet: { direction: 'debit', amount: penaltyAmt, note: `Penalty ₹${penaltyAmt} for rejecting after accepting` },
        deliveryman_wallet: { direction: 'none', amount: 0, note: 'no DM was involved' },
        final_order_status: 'canceled',
        summary: `Full refund. Restaurant penalty ₹${penaltyAmt} (admin charge + GST).`,
      };
    },
  },

  RESTAURANT_REJECT_AFTER_ACCEPT_WITH_DM: {
    key: 'RESTAURANT_REJECT_AFTER_ACCEPT_WITH_DM',
    cancelled_by: 'restaurant',
    label: 'Restaurant rejected after accepting (DM already assigned)',
    allowsStage: (s) => s.has_delivery_man && !s.is_delivered && (s.status === 'confirmed' || s.status === 'processing' || s.status === 'handover'),
    decide: (m) => {
      // PDF: Penalty = Admin Charge (PPO/Commission) + Additional Fee + Situation Fee + Delivery fee + any other.
      const penaltyAmt = r2(m.admin_commission + m.additional_charge + m.situational_charge + m.delivery_charge + m.packaging_amount);
      return {
        refund_amount: r2(m.grand_total),
        refund_to_user: true,
        generate_invoice: false,
        generate_credit_note: false,
        penalty: {
          target: 'restaurant',
          amount: penaltyAmt,
          components: ['Admin charge (PPO/Commission)', 'Additional charge', 'Situational charges', 'Delivery fee', 'Other fees'],
        },
        restaurant_wallet: { direction: 'debit', amount: penaltyAmt, note: `Penalty ₹${penaltyAmt} including DM dispatch cost` },
        deliveryman_wallet: { direction: 'credit', amount: r2(m.delivery_charge), note: 'Compensated for dispatch — restaurant pays' },
        final_order_status: 'canceled',
        summary: `Full refund. Restaurant penalty ₹${penaltyAmt}, DM credited delivery fee.`,
      };
    },
  },
};

/** List of all scenarios — useful for the admin dropdown. */
export function listScenarios(): Array<Pick<ScenarioDefinition, 'key' | 'cancelled_by' | 'label'>> {
  return Object.values(SCENARIOS).map((s) => ({ key: s.key, cancelled_by: s.cancelled_by, label: s.label }));
}

/**
 * Pick the restaurant-rejection scenario from the order's stage at reject time.
 * Used by the auto-trigger when a restaurant cancels from the vendor app:
 *   - still pending (not accepted yet) → no penalty
 *   - accepted, no rider yet           → admin charge + GST penalty
 *   - accepted, rider already assigned → admin charge + delivery + GST penalty
 */
export function scenarioForRestaurantReject(preStatus: string, hasDeliveryMan: boolean): ScenarioKey {
  const s = String(preStatus || '').toLowerCase();
  const notAccepted = s === 'pending' || s === 'failed' || s === '';
  if (notAccepted) return 'RESTAURANT_REJECT_BEFORE_ACCEPT';
  return hasDeliveryMan ? 'RESTAURANT_REJECT_AFTER_ACCEPT_WITH_DM' : 'RESTAURANT_REJECT_AFTER_ACCEPT_NO_DM';
}

/**
 * Pick the user-cancellation scenario from the order's stage at cancel time:
 *   - still pending (not accepted)        → full refund, no party earns (row 1)
 *   - accepted, no rider yet              → ZERO refund, restaurant earns (row 2)
 *   - accepted, rider already assigned    → ZERO refund, restaurant + DM earn (row 3)
 * A user may only cancel before food prep (pending/confirmed) — see lifecycle
 * canCancel — so these three cover every reachable user-cancel state.
 */
export function scenarioForUserCancel(preStatus: string, hasDeliveryMan: boolean): ScenarioKey {
  const s = String(preStatus || '').toLowerCase();
  const notAccepted = s === 'pending' || s === 'failed' || s === '';
  if (notAccepted) return 'USER_BEFORE_ACCEPT';
  return hasDeliveryMan ? 'USER_AFTER_ACCEPT_WITH_DM' : 'USER_AFTER_ACCEPT_NO_DM';
}

export function getScenario(key: ScenarioKey): ScenarioDefinition | null {
  return SCENARIOS[key] ?? null;
}

/** Filter the scenario catalogue to those applicable for an order's current
 *  stage. Driven by each scenario's allowsStage() predicate. */
export function applicableScenarios(stage: OrderStage): Array<Pick<ScenarioDefinition, 'key' | 'cancelled_by' | 'label'>> {
  return Object.values(SCENARIOS)
    .filter((s) => s.allowsStage(stage))
    .map((s) => ({ key: s.key, cancelled_by: s.cancelled_by, label: s.label }));
}
