// ─────────────────────────────────────────────────────────────────────────────
// One-time reconciliation for the NEW delivery model.
//
// OLD rule: at settlement the rider was credited the USER delivery fee, and admin
//           kept only commission + additional.
// NEW rule: admin keeps the USER delivery fee; the rider is paid the DELIVERY-
//           PARTNER SLAB amount (funded from admin).  admin margin = fee − payout.
//
// This script finds orders already SETTLED under the old rule (settlements with no
// `partner_payout` field) and moves the delta between the rider and admin wallets
// so their balances match the new model. Restaurant + tax + GST are UNAFFECTED
// (the restaurant leg is a residual that doesn't change; the delivery change is a
// pure transfer between admin and rider).
//
//   node scripts/reconcile-delivery-payout.mjs           → DRY-RUN (default, safe)
//   APPLY=1 node scripts/reconcile-delivery-payout.mjs    → actually adjust wallets
//
// Idempotent: an already-reconciled settlement (reconciled_delivery=true, or a
// wallet_transaction_ledger row with leg='reconcile_delivery') is skipped, so
// re-running APPLY never double-adjusts.
// ─────────────────────────────────────────────────────────────────────────────
import { MongoClient } from 'mongodb';

const HOSTS = [
  'ac-wwhajfd-shard-00-00.5kgahgx.mongodb.net:27017',
  'ac-wwhajfd-shard-00-01.5kgahgx.mongodb.net:27017',
  'ac-wwhajfd-shard-00-02.5kgahgx.mongodb.net:27017',
].join(',');
const url = `mongodb://${HOSTS}/eatofine?ssl=true&replicaSet=atlas-fv6e0i-shard-0&authSource=admin&serverSelectionTimeoutMS=20000`;
const client = new MongoClient(url, { auth: { username: 'aman_admin', password: 'Aman%40123456' }, serverSelectionTimeoutMS: 20000 });

const APPLY = process.env.APPLY === '1';

// decimal.js / $numberDecimal safe decode (same as src/common/decimal.ts toNum).
function dec(x, fallback = 0) {
  if (x == null) return fallback;
  if (typeof x === 'number') return Number.isFinite(x) ? x : fallback;
  if (typeof x === 'string') { const n = parseFloat(x); return Number.isFinite(n) ? n : fallback; }
  if (typeof x === 'object') {
    if (x.$numberDecimal != null) { const n = parseFloat(String(x.$numberDecimal)); return Number.isFinite(n) ? n : fallback; }
    if (Array.isArray(x.d) && typeof x.e === 'number' && typeof x.s === 'number') {
      let digits = String(x.d[0] ?? '0');
      for (let i = 1; i < x.d.length; i++) digits += String(x.d[i]).padStart(7, '0');
      const intLen = x.e + 1;
      let s;
      if (intLen <= 0) s = '0.' + '0'.repeat(-intLen) + digits;
      else if (intLen >= digits.length) s = digits + '0'.repeat(intLen - digits.length);
      else s = digits.slice(0, intLen) + '.' + digits.slice(intLen);
      const n = x.s * (parseFloat(s) || 0);
      return Number.isFinite(n) ? n : fallback;
    }
  }
  return fallback;
}
const r2 = (n) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

try {
  await client.connect();
  const db = client.db('eatofine');

  // Active partner-charge slabs (base_charge + extra_per_km "long-trip reward").
  // NOTE: situational surcharges (weekend/festival/late-night) are NOT re-applied
  // here — reconciliation uses the base slab, which is the dominant amount. Review
  // the dry-run before applying.
  const slabs = (await db.collection('dm_distance_slabs').find({}).toArray())
    .map((s) => ({ min: dec(s.min_km), max: dec(s.max_km), base: dec(s.base_charge), reward: dec(s.extra_per_km), status: s.status }))
    .filter((s) => s.status === 1 || s.status === true)
    .sort((a, b) => a.min - b.min);

  const partnerSlab = (distanceKm) => {
    if (!(distanceKm > 0)) return 0;
    const slab = slabs.find((s) => distanceKm >= s.min && distanceKm <= s.max);
    return slab ? r2(slab.base + slab.reward) : 0;
  };

  // Settlements written under the OLD rule = those without a partner_payout field.
  const oldSettlements = await db.collection('settlements').find({
    settlement_completed: true,
    partner_payout: { $exists: false },
    reconciled_delivery: { $ne: true },
  }).toArray();

  let considered = 0, changed = 0, skippedNoDm = 0, alreadyDone = 0;
  let totalDeltaRider = 0, totalDeltaAdmin = 0;
  const sample = [];

  for (const s of oldSettlements) {
    const orderId = Number(s.mysql_order_id);
    const dmId = s.mysql_delivery_man_id != null ? Number(s.mysql_delivery_man_id) : 0;
    if (!dmId) { skippedNoDm++; continue; } // take-away / dine-in / no rider → no delivery change
    considered++;

    const order = await db.collection('orders').findOne({ mysql_id: orderId });
    if (!order) continue;

    const deliveryFee = r2(dec(order.delivery_charge));
    const dist = dec(order.distance);
    const slabPayout = partnerSlab(dist);
    const newPayout = slabPayout > 0 ? slabPayout : deliveryFee;      // fallback to fee (same as settlement)
    const oldCredit = r2(dec(s.deliveryman_earning));                 // what the rider got under the old rule (= fee)
    const deltaRider = r2(newPayout - oldCredit);
    const deltaAdmin = r2(-deltaRider);
    if (deltaRider === 0) { continue; }

    // Idempotency guard: skip if a reconcile ledger row already exists.
    const already = await db.collection('wallet_transaction_ledger').findOne({ mysql_order_id: orderId, leg: 'reconcile_delivery' });
    if (already) { alreadyDone++; continue; }

    changed++;
    totalDeltaRider = r2(totalDeltaRider + deltaRider);
    totalDeltaAdmin = r2(totalDeltaAdmin + deltaAdmin);
    if (sample.length < 15) sample.push({ order: orderId, dm: dmId, distance: dist, fee: deliveryFee, oldRider: oldCredit, newRider: newPayout, deltaRider, deltaAdmin });

    if (APPLY) {
      // Claim the reconcile leg first (unique-ish guard). If two runs race, the
      // second findOne above skips; this insert makes the intent auditable.
      await db.collection('wallet_transaction_ledger').insertOne({
        mysql_order_id: orderId, leg: 'reconcile_delivery', wallet_type: 'reconcile',
        old_rider_credit: oldCredit, new_rider_payout: newPayout,
        delta_rider: deltaRider, delta_admin: deltaAdmin, created_at: new Date(),
      });
      // Move the delta: rider wallet ± deltaRider, admin wallet ± deltaAdmin.
      await db.collection('delivery_man_wallets').updateOne(
        { mysql_delivery_man_id: dmId },
        { $inc: { balance: deltaRider, total_earning: deltaRider } },
        { upsert: true },
      );
      await db.collection('admin_wallet').updateOne(
        { key: 'platform' },
        { $inc: { balance: deltaAdmin, total_earning: deltaAdmin } },
        { upsert: true },
      );
      // Bring the settlement record onto the new schema for audit/reporting.
      await db.collection('settlements').updateOne(
        { _id: s._id },
        { $set: {
          user_delivery_fee: deliveryFee,
          partner_payout: newPayout,
          deliveryman_earning: newPayout,
          admin_delivery_margin: r2(deliveryFee - newPayout),
          admin_net: r2(dec(s.admin_net) + deltaAdmin),
          reconciled_delivery: true,
          reconciled_delivery_at: new Date(),
        } },
      );
    }
  }

  console.log('─'.repeat(64));
  console.log(`Mode              : ${APPLY ? 'APPLY (wallets adjusted)' : 'DRY-RUN (no changes)'}`);
  console.log(`Active slabs      : ${slabs.length}`);
  console.log(`Old settlements   : ${oldSettlements.length}`);
  console.log(`  with a rider    : ${considered}`);
  console.log(`  take-away/no DM : ${skippedNoDm}`);
  console.log(`  already reconc. : ${alreadyDone}`);
  console.log(`  to change       : ${changed}`);
  console.log(`Σ delta to riders : ${totalDeltaRider >= 0 ? '+' : ''}${totalDeltaRider}`);
  console.log(`Σ delta to admin  : ${totalDeltaAdmin >= 0 ? '+' : ''}${totalDeltaAdmin}  (must equal −Σ rider)`);
  console.log('─'.repeat(64));
  console.log('Sample (first 15):');
  for (const x of sample) console.log(`  #${x.order} dm${x.dm} ${x.distance}km fee=${x.fee} rider ${x.oldRider}→${x.newRider} (Δrider ${x.deltaRider >= 0 ? '+' : ''}${x.deltaRider}, Δadmin ${x.deltaAdmin >= 0 ? '+' : ''}${x.deltaAdmin})`);
  if (!APPLY) console.log('\nDRY-RUN only. Re-run with  APPLY=1  to move the deltas.');
  console.log('DONE');
} catch (e) {
  console.error('ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await client.close();
}
