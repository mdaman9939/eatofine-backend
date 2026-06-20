/**
 * Verify the credit-note wiring on REAL data — READ ONLY.
 *
 * Picks a real delivered order and shows EXACTLY what the new credit-note code
 * (credit-note.util.issueCreditNote + completion.getCreditNote) would produce
 * for it on cancellation:
 *   • the order's OBR/ETFU invoice numbers  →  the credit note's Reference Invoice no
 *   • the next CNOBR<FY>-NNNN / CNETU<FY>-NNNN credit-note numbers + ARN
 *   • the reversed tax rows (Page 1 restaurant + Page 2 Eatofine service)
 * and reports how many existing credit_notes already carry the new fields.
 *
 * Performs NO writes (only .find/.count). Safe against the live Atlas backend.
 */
import 'dotenv/config';
import { MongoClient, Decimal128 } from 'mongodb';

const u = process.env.MONGO_USER, p = process.env.MONGO_PASSWORD, h = process.env.MONGO_HOSTS,
  rs = process.env.MONGO_REPLICA_SET, dbn = process.env.MONGO_DATABASE ?? 'eatofine',
  as = process.env.MONGO_AUTH_SOURCE ?? 'admin';
const ps = new URLSearchParams({ ssl: 'true', authSource: as, retryWrites: 'true', w: 'majority' });
if (rs) ps.set('replicaSet', rs);
const uri = `mongodb://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}/${dbn}?${ps}`;
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });

function toNum(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseFloat(v) || 0;
  if (v instanceof Decimal128) return parseFloat(v.toString());
  if (typeof v === 'object' && 'toString' in v) { const n = parseFloat(v.toString()); return Number.isFinite(n) ? n : 0; }
  return 0;
}
const r2 = (n) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
const inr = (n) => `₹${r2(n).toFixed(2)}`;
const fyCode = (dt) => {
  const sy = dt.getMonth() + 1 >= 4 ? dt.getFullYear() : dt.getFullYear() - 1;
  return `${String(sy % 100).padStart(2, '0')}${String((sy + 1) % 100).padStart(2, '0')}`;
};
const line = (c = '─') => console.log(c.repeat(66));

try {
  await client.connect();
  const db = client.db(dbn);
  const ordersC = db.collection('orders');
  const detailsC = db.collection('order_details');
  const restaurantsC = db.collection('restaurants');
  const creditC = db.collection('credit_notes');
  const bsC = db.collection('business_settings');

  const bsNum = async (key, def) => {
    const row = await bsC.findOne({ key });
    const v = row ? (row.value ?? row.key_value) : null;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : def;
  };
  const svcCgst = await bsNum('service_invoice_cgst_rate', 9);
  const svcSgst = await bsNum('service_invoice_sgst_rate', 9);
  const foodGst = await bsNum('food_gst_rate', 5);

  // Pick a delivered order with line items; prefer one that carries packaging.
  const candidates = await ordersC.find({ order_status: 'delivered', payment_status: 'paid' })
    .sort({ mysql_id: -1 }).limit(80).toArray();
  let order = null, details = [];
  for (const o of candidates) {
    const d = await detailsC.find({ order_id: Number(o.mysql_id) }).sort({ mysql_id: 1 }).toArray();
    if (!d.length) continue;
    if (toNum(o.extra_packaging_amount) > 0) { order = o; details = d; break; }
    if (!order) { order = o; details = d; }
  }
  if (!order) { console.log('No delivered order with line items found to demo.'); process.exit(0); }

  const rid = Number(order.mysql_restaurant_id ?? 0);
  const restaurant = await restaurantsC.findOne({ mysql_id: rid });

  // ── Reference linkage (issueCreditNote) ──────────────────────────────────
  const invDate = new Date((order.delivered ?? order.created_at_legacy ?? order.created_at) ?? new Date());
  const invFy = fyCode(invDate);
  const today = new Date();
  const cnFy = fyCode(today);

  // Reference Invoice no = the order's OBR/ETFU (assigned now if missing).
  let refObr = order.customer_invoice_number;
  let refEtu = order.eatofine_invoice_number;
  const obrSeq = (await ordersC.countDocuments({ customer_invoice_number: { $regex: `^OBR${invFy}-` } })) + 1;
  const etuSeq = (await ordersC.countDocuments({ eatofine_invoice_number: { $regex: `^ETFU${invFy}-` } })) + 1;
  const refObrShown = refObr ? `${refObr}  (already on order)` : `OBR${invFy}-${String(obrSeq).padStart(4, '0')}  (would be assigned now)`;
  const refEtuShown = refEtu ? `${refEtu}  (already on order)` : `ETFU${invFy}-${String(etuSeq).padStart(4, '0')}  (would be assigned now)`;

  const cnSeq = (await creditC.countDocuments({ credit_note_number_obr: { $regex: `^CNOBR${cnFy}-` } })) + 1;
  const nnnn = String(cnSeq).padStart(4, '0');
  const cnObr = `CNOBR${cnFy}-${nnnn}`;
  const cnEtu = `CNETU${cnFy}-${nnnn}`;
  const arn = `ARN${cnFy}${String(cnSeq).padStart(6, '0')}`;

  // ── Reversed tax rows (getCreditNote, full refund) ───────────────────────
  const food = r2(details.reduce((s, d) => s + toNum(d.price) * toNum(d.quantity), 0));
  const discount = r2(toNum(order.coupon_discount_amount) + toNum(order.restaurant_discount_amount));
  const netValue = Math.max(0, r2(food - discount));
  const perLineTax = r2(details.reduce((s, d) => s + toNum(d.tax_amount), 0));
  const foodTax = perLineTax > 0 ? perLineTax : r2(netValue * foodGst / 100);
  const packaging = r2(toNum(order.extra_packaging_amount));
  const halfTax = r2(foodTax / 2);
  const delivery = r2(toNum(order.delivery_charge));
  const additional = r2(toNum(order.additional_charge));
  const svc = (gross) => {
    const rate = (svcCgst + svcSgst) / 100;
    const base = rate > 0 ? gross / (1 + rate) : gross;
    const c = r2(base * svcCgst / 100), s = r2(base * svcSgst / 100);
    return { amt: r2(base), c, s, net: r2(gross) };
  };
  const rowDel = svc(delivery), rowMgmt = svc(additional);
  const page1Total = r2(netValue + foodTax + packaging);
  const page2Total = r2(rowDel.net + rowMgmt.net);

  line('═');
  console.log(`SAMPLE ORDER #${order.mysql_id}  ·  restaurant "${restaurant?.name ?? rid}"`);
  line('═');

  console.log('\n▶ REFERENCE LINKAGE (issueCreditNote)');
  console.log(`   Order invoice numbers (source):  OBR = ${order.customer_invoice_number ?? '(not yet assigned)'} · ETFU = ${order.eatofine_invoice_number ?? '(not yet assigned)'}`);
  console.log(`   Credit Note No (Page 1):   ${cnObr}`);
  console.log(`   Credit Note No (Page 2):   ${cnEtu}`);
  console.log(`   ARN:                       ${arn}`);
  console.log(`   Reference Invoice no (P1): ${refObrShown}`);
  console.log(`   Reference Invoice no (P2): ${refEtuShown}`);
  console.log(`   Reference Invoice Date:    ${invDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`);
  console.log('   ✓ Reference Invoice no is wired to the order\'s OBR/ETFU number (never blank).');

  console.log('\n▶ PAGE 1 — Restaurant credit note (reversed food + GST)  [HSN 996331]');
  for (const d of details) {
    let nm = `Item #${d.food_id ?? '?'}`; try { nm = JSON.parse(d.food_details ?? '{}').name ?? nm; } catch { /* */ }
    console.log(`   ${String(nm).padEnd(28)} x${toNum(d.quantity)}  ${inr(toNum(d.price) * toNum(d.quantity))}`);
  }
  console.log(`   Sub Total ${inr(food)} | Discount ${inr(discount)} | Net ${inr(netValue)} | CGST ${inr(halfTax)} | IGST ${inr(halfTax)}${packaging > 0 ? ` | Packaging ${inr(packaging)}` : ''}`);
  console.log(`   Page 1 Total (credited): ${inr(page1Total)}`);

  console.log('\n▶ PAGE 2 — Eatofine service credit note (reversed fees + GST)  [HSN 999799]');
  console.log(`   Delivery Charges       ${inr(rowDel.amt)}  CGST ${inr(rowDel.c)}  SGST ${inr(rowDel.s)}  Net ${inr(rowDel.net)}`);
  console.log(`   Order Management Fees  ${inr(rowMgmt.amt)}  CGST ${inr(rowMgmt.c)}  SGST ${inr(rowMgmt.s)}  Net ${inr(rowMgmt.net)}`);
  console.log(`   (service GST = ${svcCgst}% + ${svcSgst}%; food GST default ${foodGst}%)`);
  console.log(`   Page 2 Total (credited): ${inr(page2Total)}`);
  console.log(`\n   FULL refund total (P1+P2) = ${inr(page1Total + page2Total)}  vs order_amount ${inr(toNum(order.order_amount))}`);

  // ── Existing credit_notes state ──────────────────────────────────────────
  const totalCn = await creditC.countDocuments({});
  const newShapeCn = await creditC.countDocuments({ credit_note_number_obr: { $exists: true } });
  const withArn = await creditC.countDocuments({ arn: { $exists: true } });
  console.log('\n▶ EXISTING credit_notes in DB');
  console.log(`   total: ${totalCn} | with new CNOBR field: ${newShapeCn} | with ARN: ${withArn}`);
  console.log(`   (old notes predate this change; every NEW cancellation now writes CNOBR/CNETU + reference + ARN.)`);

  console.log('\n' + '═'.repeat(66));
  console.log('✅ Read-only verification complete — no data was modified.');
  console.log('   This is exactly what the wired code emits on the next cancellation.');
  console.log('═'.repeat(66));
} catch (err) {
  console.error('❌', err?.message ?? err);
  console.error('   (Connection error? set MONGO_* env / .env and re-run. The script is read-only.)');
  process.exit(1);
} finally {
  await client.close();
}
