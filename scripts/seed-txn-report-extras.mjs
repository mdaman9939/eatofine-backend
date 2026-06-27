// Make the Transaction Report look real: fill the columns that are ₹0 on
// freshly-seeded orders (coupon/restaurant discount, admin discount, platform
// additional charge, extra packaging, deliverymen tips).
//
// SAFETY — everything stays internally consistent so nothing downstream breaks:
//   order_amount_new = base − (coupon+adminDisc+restDisc) + (additional+packaging)
// With that adjustment the report's reverse-computed item cost is UNCHANGED
// (= base − tax − delivery) and the invoice total still equals order_amount.
// Tips are paid on top (separate column) and do NOT change order_amount; we set
// dm_tips_paid_out = dm_tips so DmWalletService won't re-credit a rider.
//
// Idempotent: only touches orders without demo_seed_extras, and tags them.
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const u = process.env.MONGO_USER, p = process.env.MONGO_PASSWORD, h = process.env.MONGO_HOSTS;
const rs = process.env.MONGO_REPLICA_SET, dbn = process.env.MONGO_DATABASE ?? 'eatofine', as = process.env.MONGO_AUTH_SOURCE ?? 'admin';
const ps = new URLSearchParams({ ssl: 'true', authSource: as, retryWrites: 'true', w: 'majority' });
if (rs) ps.set('replicaSet', rs);
const client = new MongoClient(`mongodb://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}/${dbn}?${ps}`, { serverSelectionTimeoutMS: 20000 });

const num = (v) => (v == null ? 0 : Number(v) || 0);
const r2 = (n) => Math.round(n * 100) / 100;

await client.connect();
const db = client.db(dbn);
const orders = db.collection('orders');

const candidates = await orders.find({ demo_seed_extras: { $ne: true } }).sort({ mysql_id: -1 }).toArray();
let touched = 0;
for (const o of candidates) {
  const id = Number(o.mysql_id) || 0;
  const base = num(o.order_amount);
  const tax = num(o.total_tax_amount);
  const delivery = num(o.delivery_charge);
  if (base <= 60) continue; // too small to layer demo charges on safely
  const isDelivery = o.order_type === 'delivery' || o.order_type === 'home_delivery';

  // Deterministic, varied values (by order id) so it looks organic, not uniform.
  let coupon = id % 2 === 0 ? 20 + (id % 5) * 10 : 0;            // ₹20–60 on ~half
  let adminDisc = id % 5 === 0 ? 10 + (id % 3) * 10 : 0;          // ₹10–30 on ~1/5
  let restDisc = id % 4 === 0 ? 15 + (id % 3) * 10 : 0;           // ₹15–35 on ~1/4
  const additional = 10 + (id % 4) * 5;                           // ₹10–25 platform fee (most)
  const packaging = id % 3 === 0 ? 5 + (id % 3) * 5 : 0;          // ₹5–15 packaging on ~1/3
  const tips = isDelivery && id % 3 === 1 ? 10 + (id % 5) * 10 : 0; // ₹10–50 tip on some delivery orders

  // Keep total discount under 40% of the item value so order_amount stays sane.
  const itemValue = Math.max(0, base - tax - delivery);
  const discountCap = r2(itemValue * 0.4);
  let totalDisc = coupon + adminDisc + restDisc;
  if (totalDisc > discountCap) {
    const scale = discountCap / totalDisc;
    coupon = r2(coupon * scale); adminDisc = r2(adminDisc * scale); restDisc = r2(restDisc * scale);
    totalDisc = r2(coupon + adminDisc + restDisc);
  }

  const orderAmountNew = r2(base - totalDisc + additional + packaging);
  if (orderAmountNew <= 0) continue;

  const set = {
    coupon_discount_amount: r2(coupon),
    admin_discount_amount: r2(adminDisc),
    restaurant_discount_amount: r2(restDisc),
    additional_charge: r2(additional),
    extra_packaging_amount: r2(packaging),
    order_amount: orderAmountNew,
    demo_seed_extras: true,
  };
  if (tips > 0) { set.dm_tips = r2(tips); set.dm_tips_paid_out = r2(tips); }
  if (coupon > 0 && !o.coupon_code) set.coupon_code = `DEMO${(id % 90) + 10}`;

  await orders.updateOne({ _id: o._id }, { $set: set });
  touched++;
}

const withCoupon = await orders.countDocuments({ coupon_discount_amount: { $gt: 0 } });
const withAdmin = await orders.countDocuments({ admin_discount_amount: { $gt: 0 } });
const withRest = await orders.countDocuments({ restaurant_discount_amount: { $gt: 0 } });
const withAdd = await orders.countDocuments({ additional_charge: { $gt: 0 } });
const withTips = await orders.countDocuments({ dm_tips: { $gt: 0 } });
console.log(`touched ${touched} orders.`);
console.log(`now > 0 : coupon=${withCoupon} adminDisc=${withAdmin} restDisc=${withRest} additional=${withAdd} tips=${withTips}`);
await client.close();
