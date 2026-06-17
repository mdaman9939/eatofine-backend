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
export interface AdditionalChargeRow {
  charge_head?: string | null;
  charge_type?: string | null;
  amount?: number | null;
  gst_applicable?: boolean | number | null;
  gst_rate?: number | null;
  status?: boolean | number | null;
}

const isOn = (v: unknown): boolean => v === true || v === 1 || v === '1';

export function computeFlatAdditionalCharge(rows: AdditionalChargeRow[]): { amount: number; name: string } {
  const active = (Array.isArray(rows) ? rows : []).filter(
    (r) => isOn(r.status) && (r.charge_type ?? 'fixed') === 'fixed',
  );
  let total = 0;
  for (const r of active) {
    const base = Number(r.amount ?? 0) || 0;
    const gst = isOn(r.gst_applicable) ? base * (Number(r.gst_rate ?? 0) / 100) : 0;
    total += base + gst;
  }
  const name =
    active.length === 0 ? 'Additional Charge'
      : active.length === 1 ? (active[0].charge_head ?? 'Additional Charge')
        : 'Additional Charges';
  return { amount: Math.round(total * 100) / 100, name };
}
