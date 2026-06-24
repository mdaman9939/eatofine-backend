/**
 * Shared computation for the customer-facing "additional charge".
 *
 * The customer app (and customer-order pricing) supports ONE flat additional
 * charge that it reads from config (`additional_charge_status / _name / amount`)
 * and adds to the order total. The admin configures granular rows in
 * `additional_user_charges` (Platform Fee, Packaging Fee, …). We consolidate the
 * ACTIVE FIXED rows (amount + their GST) into that single flat value, so the
 * same number is shown by the app AND applied by the backend — they always
 * match, with no app change needed.
 *
 * Percentage-type charges depend on the cart subtotal and so cannot be folded
 * into a flat config value; those continue to apply only at POS (where the
 * subtotal is known at billing time).
 */
import { toNum } from './decimal';

export interface AdditionalChargeRow {
  charge_head?: string | null;
  charge_type?: string | null;
  amount?: number | null;
  gst_applicable?: boolean | number | null;
  gst_rate?: number | null;
  status?: boolean | number | null;
  // Order types this charge applies to (subset of ORDER_TYPES). When absent /
  // not an array the charge applies to EVERY order type — legacy rows that
  // predate this field are backfilled to an explicit list, so this permissive
  // default only ever affects a row created without order_types.
  order_types?: string[] | null;
}

/** The three order types a charge / GST can be scoped to. */
export const ORDER_TYPES = ['take_away', 'dine_in', 'delivery'] as const;
export type OrderTypeName = (typeof ORDER_TYPES)[number];

const isOn = (v: unknown): boolean => v === true || v === 1 || v === '1';

/** Coerce arbitrary input (array or CSV string) into a deduped list of the
 *  three valid order types. Used on write (admin form / API) and when reading
 *  the `food_gst_order_types` business setting. */
export function sanitizeOrderTypes(input: unknown): OrderTypeName[] {
  const arr = Array.isArray(input)
    ? input
    : typeof input === 'string' ? input.split(',') : [];
  const valid = arr
    .map((x) => String(x).trim())
    .filter((x): x is OrderTypeName => (ORDER_TYPES as readonly string[]).includes(x));
  return Array.from(new Set(valid));
}

/** Does this charge apply to the given order type? An unset/non-array
 *  `order_types` means "applies to all". No order-type context → no filter. */
export function chargeAppliesToOrderType(row: AdditionalChargeRow, orderType?: string | null): boolean {
  if (!orderType) return true;
  const types = Array.isArray(row.order_types) ? row.order_types : null;
  if (types === null) return true;
  return types.includes(orderType);
}

export function computeFlatAdditionalCharge(
  rows: AdditionalChargeRow[],
  orderType?: string | null,
): { amount: number; name: string } {
  const active = (Array.isArray(rows) ? rows : []).filter(
    (r) => isOn(r.status) && (r.charge_type ?? 'fixed') === 'fixed' && chargeAppliesToOrderType(r, orderType),
  );
  let total = 0;
  for (const r of active) {
    // Amounts may be migrated decimal.js objects → toNum decodes safely.
    const base = toNum(r.amount);
    const gst = isOn(r.gst_applicable) ? base * (toNum(r.gst_rate) / 100) : 0;
    total += base + gst;
  }
  const name =
    active.length === 0 ? 'Additional Charge'
      : active.length === 1 ? (active[0].charge_head ?? 'Additional Charge')
        : 'Additional Charges';
  return { amount: Math.round(total * 100) / 100, name };
}

/** Full additional charge for a KNOWN subtotal (POS / billing time): sums BOTH
 *  fixed and percentage active charges that apply to the order type, each with
 *  its own GST folded in. Percentage charges are computed on `subtotal` (which
 *  flat config can't do — hence POS-only). */
export function computeAdditionalChargeForSubtotal(
  rows: AdditionalChargeRow[],
  subtotal: number,
  orderType?: string | null,
): number {
  let total = 0;
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!isOn(r.status) || !chargeAppliesToOrderType(r, orderType)) continue;
    const base = (r.charge_type ?? 'fixed') === 'percentage'
      ? Math.max(0, toNum(subtotal)) * (toNum(r.amount) / 100)
      : toNum(r.amount);
    const gst = isOn(r.gst_applicable) ? base * (toNum(r.gst_rate) / 100) : 0;
    total += base + gst;
  }
  return Math.round(total * 100) / 100;
}
