/** READ-ONLY: inspect Curry Express (restaurant mysql_id=3) wallet to see why the
 *  admin Wallets page (8036.8 / COD 0) differs from the restaurant app (withdrawable
 *  6925.60 / cash 4711.40). Prints the restaurant + every matching restaurant_wallets
 *  doc + the orders-derived earning the app computes. */
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const u = process.env.MONGO_USER, p = process.env.MONGO_PASSWORD, h = process.env.MONGO_HOSTS,
  rs = process.env.MONGO_REPLICA_SET, dbn = process.env.MONGO_DATABASE ?? 'eatofine', as = process.env.MONGO_AUTH_SOURCE ?? 'admin';
const ps = new URLSearchParams({ ssl: 'true', authSource: as, retryWrites: 'true', w: 'majority' });
if (rs) ps.set('replicaSet', rs);
const client = new MongoClient(`mongodb://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}/${dbn}?${ps}`, { serverSelectionTimeoutMS: 15000 });
const toNum = (v) => { if (v == null) return 0; if (typeof v === 'number') return v; const n = parseFloat(String(v?.toString?.() ?? v)); return Number.isFinite(n) ? n : 0; };

try {
  await client.connect();
  const db = client.db(dbn);
  const RID = 3;
  const rest = await db.collection('restaurants').findOne({ mysql_id: RID }, { projection: { mysql_id: 1, name: 1, mysql_vendor_id: 1, vendor_id: 1, comission: 1 } });
  console.log('RESTAURANT:', JSON.stringify(rest));
  const vid = Number(rest?.mysql_vendor_id ?? rest?.vendor_id ?? 0);

  const wallets = await db.collection('restaurant_wallets').find({
    $or: [{ mysql_restaurant_id: RID }, { vendor_id: vid }, { mysql_vendor_id: vid }],
  }).toArray();
  console.log(`\nrestaurant_wallets docs matching (rid=${RID} / vendor=${vid}): ${wallets.length}`);
  for (const w of wallets) {
    console.log('  keys:', Object.keys(w).filter((k) => k !== '_id').join(','));
    console.log('   →', JSON.stringify({
      _id: String(w._id), mysql_restaurant_id: w.mysql_restaurant_id, vendor_id: w.vendor_id, mysql_vendor_id: w.mysql_vendor_id,
      balance: toNum(w.balance), total_earning: toNum(w.total_earning), collected_cash: toNum(w.collected_cash),
      pending_withdraw: toNum(w.pending_withdraw), total_withdrawn: toNum(w.total_withdrawn), seed_demo_amount: toNum(w.seed_demo_amount),
    }));
  }

  // Replicate the app's order-derived earning/cash (vendor-extras logic).
  const orders = await db.collection('orders').find({ mysql_restaurant_id: RID }).toArray();
  const rate = Number(rest?.comission ?? 0) || 10;
  let computedEarning = 0, computedCash = 0, delivered = 0;
  for (const o of orders) {
    if (o.order_status !== 'delivered') continue;
    delivered++;
    const amount = toNum(o.order_amount), tax = toNum(o.total_tax_amount), del = toNum(o.delivery_charge);
    const coupon = toNum(o.coupon_discount_amount), rd = toNum(o.restaurant_discount_amount), extra = toNum(o.additional_charge);
    let item = amount + coupon + rd - tax - del - extra; if (item <= 0) item = Math.max(0, amount - tax - del) || amount;
    computedEarning += item - (item * rate) / 100;
    if (String(o.payment_method) === 'cash_on_delivery') computedCash += amount;
  }
  console.log(`\nORDERS: ${orders.length} total, ${delivered} delivered. commission=${rate}%`);
  console.log('  app-computed (when total_earning<=0):', JSON.stringify({ computedEarning: Math.round(computedEarning * 100) / 100, computedCash: Math.round(computedCash * 100) / 100 }));
} catch (e) {
  console.error('ERROR:', e?.message ?? e);
  process.exitCode = 1;
} finally {
  await client.close();
}
