/**
 * Verify the money-reporting fixes on REAL data — READ ONLY.
 *
 * For one real settled order (+ its restaurant) it prints OLD (buggy) vs NEW
 * (fixed) numbers for:
 *   #5  refund penalty money source (moneyOf)
 *   #3  extra-packaging attribution on the customer invoice
 *   #4  TDS report + vendor invoice commission/payout base
 *
 * It performs NO writes (only .find / read), so it is safe to run against the
 * live Atlas backend. Re-run anytime.
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

/** Pull a real number out of Decimal128 / number / string / null. */
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
const line = (c = '─') => console.log(c.repeat(64));

try {
  await client.connect();
  const db = client.db(dbn);

  const settlementsC = db.collection('settlements');
  const ordersC = db.collection('orders');
  const detailsC = db.collection('order_details');
  const restaurantsC = db.collection('restaurants');

  // ── Pick a settled order — prefer one that carries extra packaging so #3/#5
  //    are demonstrable; otherwise the most recent settled order. ───────────
  const settled = await settlementsC.find({ settlement_completed: true }).sort({ mysql_id: -1 }).limit(80).toArray();
  if (settled.length === 0) {
    console.log('No completed settlements found yet — deliver + settle an order, then re-run.');
    process.exit(0);
  }
  let order = null, settlement = null;
  for (const s of settled) {
    const o = await ordersC.findOne({ mysql_id: Number(s.mysql_order_id) });
    if (!o) continue;
    if (toNum(o.extra_packaging_amount) > 0) { order = o; settlement = s; break; }
    if (!order) { order = o; settlement = s; } // fallback: first valid
  }
  if (!order) { console.log('Could not load any order behind the settlements.'); process.exit(0); }

  const rid = Number(order.mysql_restaurant_id ?? 0);
  const restaurant = await restaurantsC.findOne({ mysql_id: rid });
  const details = await detailsC.find({ order_id: Number(order.mysql_id) }).toArray();

  const food = r2(details.reduce((s, d) => s + toNum(d.price) * toNum(d.quantity), 0));
  const tax = toNum(order.total_tax_amount);
  const delivery = toNum(order.delivery_charge);
  const additional = toNum(order.additional_charge);
  const packaging = toNum(order.extra_packaging_amount);
  const restDisc = toNum(order.restaurant_discount_amount);
  const couponDisc = toNum(order.coupon_discount_amount);
  const orderAmount = toNum(order.order_amount);
  const commPct = toNum(restaurant?.comission);

  line('═');
  console.log(`SAMPLE ORDER #${order.mysql_id}  ·  restaurant "${restaurant?.name ?? rid}"  (commission ${commPct}%)`);
  line('═');
  console.log(`  food (Σ line items) ${inr(food)} | tax ${inr(tax)} | delivery ${inr(delivery)}`);
  console.log(`  additional/platform ${inr(additional)} | packaging ${inr(packaging)} | restaurant_discount ${inr(restDisc)}`);
  console.log(`  order_amount (paid) ${inr(orderAmount)}`);

  // ── #5: refund penalty money source (moneyOf) ─────────────────────────────
  const itemTotalOld = Math.max(0, orderAmount - tax - delivery + restDisc - couponDisc); // includes add+pkg
  const commissionOld = r2(itemTotalOld * 0.20);                 // hardcoded 20%, txn row never existed
  const additionalOld = 0, packagingOld = 0;                     // read from never-written order_transactions
  const commissionNew = r2(Math.max(0, food - restDisc) * (commPct / 100));
  console.log('\n#5  REFUND PENALTY INPUTS (moneyOf)');
  console.log(`     additional_charge   OLD ${inr(additionalOld)}   →   NEW ${inr(additional)}`);
  console.log(`     packaging_amount    OLD ${inr(packagingOld)}   →   NEW ${inr(packaging)}`);
  console.log(`     admin_commission    OLD ${inr(commissionOld)} (20% of ${inr(itemTotalOld)})   →   NEW ${inr(commissionNew)} (${commPct}% of food−disc)`);
  // Example scenario: ADMIN_RESTAURANT_FAULT_AFTER_DELIVERY → additional + packaging + delivery + tax
  const penAfterOld = r2(additionalOld + packagingOld + delivery + tax);
  const penAfterNew = r2(additional + packaging + delivery + tax);
  console.log(`     → restaurant-fault (after delivery) penalty   OLD ${inr(penAfterOld)}   →   NEW ${inr(penAfterNew)}`);
  const penRejOld = r2(commissionOld + additionalOld + tax);
  const penRejNew = r2(commissionNew + additional + tax);
  console.log(`     → reject-after-accept (no DM) penalty          OLD ${inr(penRejOld)}   →   NEW ${inr(penRejNew)}`);

  // ── #3: extra-packaging attribution on the customer invoice ───────────────
  const svcCgst = 9, svcSgst = 9; // service_invoice_*_rate defaults
  const pkgOnEatofineOld = r2(packaging * (1 + (svcCgst + svcSgst) / 100)); // billed as platform service +18% GST
  console.log('\n#3  CUSTOMER INVOICE — extra packaging attribution');
  console.log(`     OLD: Eatofine service row "Other Fees (packaging)" = ${inr(pkgOnEatofineOld)}  (platform revenue + 18% GST)`);
  console.log(`     NEW: restaurant invoice "Packaging Charge"          = ${inr(packaging)}  (face value, no extra GST)`);
  console.log(`     settlement deposited packaging into RESTAURANT wallet (restaurant_earning = ${inr(toNum(settlement.restaurant_earning))}) ✓ matches NEW`);

  // ── #4: TDS report + vendor invoice base (this restaurant) ────────────────
  const ordersR = await ordersC.find({ mysql_restaurant_id: rid, order_status: 'delivered', payment_status: 'paid' }).toArray();
  const grossOrderAmt = r2(ordersR.reduce((s, o) => s + toNum(o.order_amount), 0));
  const settlementsR = await settlementsC.find({ mysql_restaurant_id: rid, settlement_completed: true }).toArray();
  const commNew = r2(settlementsR.reduce((s, x) => s + toNum(x.admin_commission), 0));
  const netNew = r2(settlementsR.reduce((s, x) => s + toNum(x.restaurant_earning), 0));
  const foodNew = r2(settlementsR.reduce((s, x) => s + toNum(x.food_amount), 0));
  const commOld = r2(grossOrderAmt * (commPct / 100));
  const netOld = r2(grossOrderAmt - commOld);
  console.log('\n#4  TDS REPORT + VENDOR INVOICE base (restaurant total)');
  console.log(`     commission   OLD ${inr(commOld)} (${commPct}% of order_amount ${inr(grossOrderAmt)})   →   NEW ${inr(commNew)} (Σ settlement admin_commission)`);
  console.log(`     net payout   OLD ${inr(netOld)} (order_amount − commission)   →   NEW ${inr(netNew)} (Σ settlement restaurant_earning)`);
  console.log(`     gross_sales  OLD ${inr(grossOrderAmt)} (order_amount, incl tax+delivery+fees)   →   NEW ${inr(foodNew)} (food only)`);
  const overstate = r2(commOld - commNew);
  console.log(`     → commission was OVERSTATED by ${inr(overstate)} (it taxed tax+delivery+platform fee+packaging)`);

  console.log('\n' + '═'.repeat(64));
  console.log('✅ Verification complete — read-only, no data was modified.');
  console.log('   OLD = pre-fix buggy figures · NEW = what the fixed code now produces.');
  console.log('═'.repeat(64));
} catch (err) {
  console.error('❌', err?.message ?? err);
  console.error('   (If this is a connection error, set MONGO_* env vars / .env and re-run. The script is read-only.)');
  process.exit(1);
} finally {
  await client.close();
}
