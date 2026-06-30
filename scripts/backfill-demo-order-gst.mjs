/**
 * The DM-earning demo orders (seed-dm-activity-demo, tagged seed_activity) were
 * created with total_tax_amount=0 and no platform/situational charges, so the
 * Order Report / GST Report show ₹0 for their GST columns. This enriches each
 * demo order with a realistic, self-consistent money breakdown so those columns
 * populate — matching how the Order Report endpoint derives the split:
 *   food GST   = foodSubtotal × food_gst_rate%   (sec 9(5), default 5%)
 *   delivery / additional / situational are stored GST-INCLUSIVE (endpoint
 *   extracts their 18% via ×18/118), and order_amount = net payable = the sum.
 * Idempotent — the food subtotal is read from order_details (never overwritten),
 * so re-running recomputes the same values. Undo: REMOVE the demo orders entirely
 * with `REMOVE=1 node scripts/seed-dm-activity-demo.mjs`.
 */
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });
const u = process.env.MONGO_USER, p = process.env.MONGO_PASSWORD, h = process.env.MONGO_HOSTS, rs = process.env.MONGO_REPLICA_SET, dbn = process.env.MONGO_DATABASE ?? 'eatofine', as = process.env.MONGO_AUTH_SOURCE ?? 'admin';
const psp = new URLSearchParams({ ssl: 'true', authSource: as, retryWrites: 'true', w: 'majority' }); if (rs) psp.set('replicaSet', rs);
const client = new MongoClient(`mongodb://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}/${dbn}?${psp}`, { serverSelectionTimeoutMS: 15000 });
const num = (v) => (v == null ? 0 : Number(v) || 0);
const r2 = (n) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

try {
  await client.connect();
  const db = client.db(dbn);
  const gd = await db.collection('business_settings').findOne({ key: 'food_gst_rate' });
  const foodRate = (() => { const n = parseFloat(String(gd?.value ?? gd?.key_value ?? '5')); return Number.isFinite(n) && n >= 0 ? n : 5; })();

  const orders = await db.collection('orders').find({ seed_activity: true }).toArray();
  let n = 0;
  for (const o of orders) {
    // Food subtotal from the (untouched) order_details lines — idempotent anchor.
    const dets = await db.collection('order_details').find({ order_id: o.mysql_id }).toArray();
    const foodSubtotal = dets.length
      ? r2(dets.reduce((s, d) => s + num(d.price) * (num(d.quantity) || 1), 0))
      : num(o.order_amount);
    if (!(foodSubtotal > 0)) continue;

    const delivery = num(o.delivery_charge);
    const additional = 12;                                   // platform/convenience fee (GST-inclusive)
    const situational = Number(o.mysql_id) % 2 === 0 ? 18 : 0; // surge on alternate orders (GST-inclusive)
    const foodGst = r2((foodSubtotal * foodRate) / 100);
    const deliveryGstIncl = r2((delivery * 18) / 118);       // delivery stored GST-inclusive
    const totalTax = r2(foodGst + deliveryGstIncl);          // order's stored tax (food + delivery)
    const orderAmount = r2(foodSubtotal + totalTax + delivery + additional + situational); // net payable

    await db.collection('orders').updateOne(
      { mysql_id: o.mysql_id },
      { $set: { total_tax_amount: totalTax, additional_charge: additional, situational_charge: situational, order_amount: orderAmount, food_gst_rate: foodRate, updated_at: new Date() } },
    );
    n++;
  }
  console.log(`✅ Enriched ${n} demo orders with GST + platform/situational charges (food GST @ ${foodRate}%, services @ 18%).`);
  console.log('   Order Report + GST Report columns now populate for these orders too.');
  console.log('   Undo: REMOVE=1 node scripts/seed-dm-activity-demo.mjs (removes the demo orders entirely).');
} catch (e) { console.error('ERROR:', e?.message ?? e); process.exitCode = 1; } finally { await client.close(); }
