import type { MongoDataService } from '../mongo/mongo-data.service';

/**
 * Unified credit-note record + a single issuer used by every path that raises a
 * credit note (refund engine, refund-approval auto-issue, manual API). Keeps one
 * shape + one numbering scheme so the list/detail pages always have data.
 *
 * Numbering mirrors the invoice series:
 *   - CNOBR<FY>-NNNN  (restaurant "On Behalf of Restaurant" credit note)
 *   - CNETU<FY>-NNNN  (Eatofine service credit note) — shares the same NNNN
 * and the credit note carries a Reference Invoice no (the order's OBR/ETFU
 * invoice number, assigned on the order at invoice time) + an ARN.
 */
export type CreditNoteDoc = {
  mysql_id: number;
  credit_note_number: string;          // = CNOBR (kept so existing list code keeps working)
  credit_note_number_obr: string;      // CNOBR<FY>-NNNN
  credit_note_number_etu: string;      // CNETU<FY>-NNNN
  order_id: number;
  refund_id?: number | null;
  customer_id: number;
  restaurant_id: number | null;
  reference_invoice_no_obr?: string | null;  // = order.customer_invoice_number (OBR…)
  reference_invoice_no_etu?: string | null;  // = order.eatofine_invoice_number (ETFU…)
  reference_invoice_date?: Date | null;
  arn?: string | null;
  reason?: string | null;
  refund_amount: number;
  tax_reversed: number;
  delivery_reversed: number;
  total_credit: number;
  status: string;
  notes?: string | null;
  issued_by?: number | null;
  created_at?: Date | null;
  updated_at?: Date | null;
};

type OrderForCn = {
  mysql_id: number;
  mysql_user_id?: number | null;
  mysql_restaurant_id?: number | null;
  total_tax_amount?: number;
  delivery_charge?: number;
  customer_invoice_number?: string | null;
  eatofine_invoice_number?: string | null;
  delivered?: Date | null;
  created_at_legacy?: Date | null;
  created_at?: Date | null;
};

/** Indian financial-year code (Apr→Mar), e.g. 25-Sep-2025 → "2526". */
function fyCode(dt: Date): string {
  const sy = dt.getMonth() + 1 >= 4 ? dt.getFullYear() : dt.getFullYear() - 1;
  return `${String(sy % 100).padStart(2, '0')}${String((sy + 1) % 100).padStart(2, '0')}`;
}

/** Ensure the order carries an OBR/ETFU invoice number (assign + persist if it
 *  was never invoiced) so the credit note always has a Reference Invoice no. */
async function ensureInvoiceNumber(
  mongo: MongoDataService,
  order: OrderForCn,
  field: 'customer_invoice_number' | 'eatofine_invoice_number',
  prefix: 'OBR' | 'ETFU',
  fy: string,
): Promise<string> {
  const existing = order[field];
  if (existing) return existing;
  const seq = (await mongo.count('orders', { [field]: { $regex: `^${prefix}${fy}-` } })) + 1;
  const number = `${prefix}${fy}-${String(seq).padStart(4, '0')}`;
  await mongo.updateOne('orders', { mysql_id: Number(order.mysql_id) }, { [field]: number });
  return number;
}

/** Ensure the order carries its OBR + ETFU tax-invoice numbers (assign + persist
 *  if never invoiced). Used when a cancellation scenario requires an invoice to
 *  the user but raises NO credit note (e.g. zero-refund user-after-accept, or the
 *  admin user-unreachable case). Idempotent — returns the existing numbers if the
 *  order was already invoiced (on delivery or by a credit note). */
export async function ensureOrderInvoice(
  mongo: MongoDataService,
  orderId: number,
): Promise<{ obr: string; etu: string } | null> {
  const order = await mongo.findByMysqlId<OrderForCn>('orders', Number(orderId));
  if (!order) return null;
  const invDate = new Date((order.delivered ?? order.created_at_legacy ?? order.created_at) ?? new Date());
  const fy = fyCode(invDate);
  const obr = await ensureInvoiceNumber(mongo, order, 'customer_invoice_number', 'OBR', fy);
  const etu = await ensureInvoiceNumber(mongo, order, 'eatofine_invoice_number', 'ETFU', fy);
  return { obr, etu };
}

/**
 * Raise (or return the existing) credit note for an order. Idempotent on
 * refund_id when supplied, else on order_id — so the two auto-trigger paths
 * never double-issue. Returns null only when the order is missing / amount ≤ 0.
 */
export async function issueCreditNote(
  mongo: MongoDataService,
  input: {
    orderId: number;
    refundId?: number | null;
    amount: number;
    reason?: string | null;
    notes?: string | null;
    issuedBy?: number | null;
  },
): Promise<{ record: CreditNoteDoc | null; alreadyExisted: boolean }> {
  const orderId = Number(input.orderId);
  const amount = Number(input.amount);
  if (!orderId || !(amount > 0)) return { record: null, alreadyExisted: false };

  // Idempotency — one credit note per refund (or per order when no refund id).
  const dupFilter = input.refundId != null ? { refund_id: Number(input.refundId) } : { order_id: orderId };
  const existing = await mongo.findOne<CreditNoteDoc>('credit_notes', dupFilter);
  if (existing) return { record: existing, alreadyExisted: true };

  const order = await mongo.findByMysqlId<OrderForCn>('orders', orderId);
  if (!order) return { record: null, alreadyExisted: false };

  // Reference invoice numbers come from the order (the SAME numbers stamped at
  // invoice time); assign them now if the order was never invoiced.
  const invDate = new Date((order.delivered ?? order.created_at_legacy ?? order.created_at) ?? new Date());
  const invFy = fyCode(invDate);
  const refObr = await ensureInvoiceNumber(mongo, order, 'customer_invoice_number', 'OBR', invFy);
  const refEtu = await ensureInvoiceNumber(mongo, order, 'eatofine_invoice_number', 'ETFU', invFy);

  // Credit-note number series is keyed to the credit-note (cancellation) date.
  const today = new Date();
  const cnFy = fyCode(today);
  const seq = (await mongo.count('credit_notes', { credit_note_number_obr: { $regex: `^CNOBR${cnFy}-` } })) + 1;
  const nnnn = String(seq).padStart(4, '0');
  const cnObr = `CNOBR${cnFy}-${nnnn}`;
  const cnEtu = `CNETU${cnFy}-${nnnn}`;
  const arn = `ARN${cnFy}${String(seq).padStart(6, '0')}`;

  const record: CreditNoteDoc = {
    mysql_id: await mongo.nextMysqlId('credit_notes'),
    credit_note_number: cnObr,
    credit_note_number_obr: cnObr,
    credit_note_number_etu: cnEtu,
    order_id: orderId,
    refund_id: input.refundId != null ? Number(input.refundId) : null,
    customer_id: Number(order.mysql_user_id ?? 0),
    restaurant_id: order.mysql_restaurant_id != null ? Number(order.mysql_restaurant_id) : null,
    reference_invoice_no_obr: refObr,
    reference_invoice_no_etu: refEtu,
    reference_invoice_date: invDate,
    arn,
    reason: input.reason ?? null,
    refund_amount: amount,
    // Informational components of the order; the credited TOTAL is `amount`
    // (refund_amount already equals grand_total for full / item+tax for partial).
    tax_reversed: Number(order.total_tax_amount ?? 0),
    delivery_reversed: Number(order.delivery_charge ?? 0),
    total_credit: amount,
    status: 'issued',
    notes: input.notes ?? null,
    issued_by: input.issuedBy ?? null,
    created_at: today,
    updated_at: today,
  };
  await mongo.insertOne<CreditNoteDoc>('credit_notes', record);
  return { record, alreadyExisted: false };
}
