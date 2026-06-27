/**
 * Make the Order Report look real: fill the columns that were ₹0 (additional /
 * platform charge, situational/surge charge, deliverymen tip, admin discount,
 * coupon) with realistic values — WITHOUT touching `order_amount`.
 *
 * Why order_amount is left alone: it's the net payable + the basis for revenue,
 * settlement, earnings and dashboard reports. The Order Report DERIVES the item
 * value as the residual (order_amount + discounts − tax − delivery − additional −
 * situational), so adding these charges just redistributes the existing total —
 * the breakdown still sums to order_amount and nothing else changes.
 *
 * Idempotent + reversible: only fills fields that are currently 0, tags the order
 * `report_demo_backfill: true`, and skips already-tagged orders on re-run.
 *
 * Undo (Mongo shell):
 *   db.orders.updateMany({report_demo_backfill:true},
 *     {$set:{additional_charge:0,situational_charge:0,dm_tips:0,admin_discount_amount:0},
 *      $unset:{report_demo_backfill:""}})
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const u = process.env.MONGO_USER, p = process.env.MONGO_PASSWORD, h = process.env.MONGO_HOSTS,
  rs = process.env.MONGO_REPLICA_SET, dbn = process.env.MONGO_DATABASE ?? 'eatofine', as = process.env.MONGO_AUTH_SOURCE ?? 'admin';
const ps = new URLSearchParams({ ssl: 'true', authSource: as, retryWrites: 'true', w: 'majority' });
if (rs) ps.set('replicaSet', rs);
const client = new MongoClient(`mongodb://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}/${dbn}?${ps}`, { serverSelectionTimeoutMS: 15000 });

const num = (v) => (v == null ? 0 : Number(v) || 0);
const r2 = (n) => Math.round(n * 100) / 100;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

try {
  await client.connect();
  const db = client.db(dbn);
  const orders = await db.collection('orders').find({}, {
    projection: {
      mysql_id: 1, order_amount: 1, total_tax_amount: 1, delivery_charge: 1,
      coupon_discount_amount: 1, restaurant_discount_amount: 1, additional_charge: 1,
      situational_charge: 1, dm_tips: 1, admin_discount_amount: 1, order_type: 1,
      report_demo_backfill: 1,
    },
  }).toArray();

  let updated = 0, skipped = 0;
  for (const o of orders) {
    if (o.report_demo_backfill) { skipped++; continue; }
    const orderAmount = num(o.order_amount);
    const tax = num(o.total_tax_amount);
    const delivery = num(o.delivery_charge);
    const coupon = num(o.coupon_discount_amount);
    const restDiscount = num(o.restaurant_discount_amount);
    const existingAdditional = num(o.additional_charge);
    // The item value already inside this order (residual of the breakdown).
    const trueItem = r2(orderAmount + coupon + restDiscount - tax - delivery - existingAdditional);
    if (trueItem <= 10) { skipped++; continue; } // too small to carve charges safely

    const update = {};

    // Platform / additional charge — a small fee on (almost) every order.
    let additionalNow = existingAdditional;
    if (existingAdditional <= 0) {
      additionalNow = clamp(r2(trueItem * 0.04), 8, 25);
      update.additional_charge = additionalNow;
    }

    // Situational charge (surge / late-night / festival) — on ~40% of orders.
    if (num(o.situational_charge) <= 0 && Math.random() < 0.4) {
      let s = clamp(r2(trueItem * 0.05), 12, 40);
      const cap = r2(trueItem * 0.4 - additionalNow); // keep item comfortably positive
      if (s > cap) s = cap;
      if (s >= 5) update.situational_charge = s;
    }

    // Deliverymen tip — on ~45% of orders.
    if (num(o.dm_tips) <= 0 && Math.random() < 0.45) {
      update.dm_tips = pick([10, 15, 20, 25, 30, 40, 50]);
    }

    // Admin discount — on ~25% of orders.
    if (num(o.admin_discount_amount) <= 0 && Math.random() < 0.25) {
      update.admin_discount_amount = pick([10, 15, 20, 25]);
    }

    // Coupon (restaurant discount) — on ~30% of orders. Raises the displayed item
    // by the coupon (item − coupon = net), so order_amount stays the same.
    if (coupon <= 0 && Math.random() < 0.3) {
      update.coupon_discount_amount = pick([20, 25, 30, 40, 50, 60]);
    }

    if (Object.keys(update).length) {
      update.report_demo_backfill = true;
      update.updated_at = new Date();
      await db.collection('orders').updateOne({ mysql_id: o.mysql_id }, { $set: update });
      updated++;
    } else {
      skipped++;
    }
  }
  console.log(`✅ Order Report demo backfill — updated ${updated}, skipped ${skipped}, total ${orders.length}. order_amount left UNCHANGED on every order.`);
} catch (e) {
  console.error('ERROR:', e?.message ?? e);
  process.exitCode = 1;
} finally {
  await client.close();
}
