/**
 * Fix wallet-data divergence so the admin Wallets page == each app.
 *  1. RESTAURANT: my seed wrote a stored balance/total_earning, but the vendor
 *     app DERIVES the wallet from delivered orders (ignores stored balance unless
 *     total_earning>0). Reset the seed pollution (balance/total_earning/cash → 0,
 *     drop seed_demo_amount) so BOTH the app and the (now order-derived) admin
 *     compute the same value. Real withdrawn/pending are preserved.
 *  2. DM: merge duplicate delivery_man_wallets (the seed keyed by
 *     mysql_delivery_man_id, some originals by delivery_man_id) into ONE doc per
 *     rider so the app + admin read the same balance.
 *  Idempotent.
 */
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });
const u = process.env.MONGO_USER, p = process.env.MONGO_PASSWORD, h = process.env.MONGO_HOSTS, rs = process.env.MONGO_REPLICA_SET, dbn = process.env.MONGO_DATABASE ?? 'eatofine', as = process.env.MONGO_AUTH_SOURCE ?? 'admin';
const ps = new URLSearchParams({ ssl: 'true', authSource: as, retryWrites: 'true', w: 'majority' }); if (rs) ps.set('replicaSet', rs);
const client = new MongoClient(`mongodb://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}/${dbn}?${ps}`, { serverSelectionTimeoutMS: 15000 });
const toNum = (v) => { if (v == null) return 0; if (typeof v === 'number') return v; const n = parseFloat(String(v?.toString?.() ?? v)); return Number.isFinite(n) ? n : 0; };
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

try {
  await client.connect();
  const db = client.db(dbn);

  // 1. RESTAURANT — reset seed pollution → order-derived everywhere.
  const rRes = await db.collection('restaurant_wallets').updateMany(
    { seed_demo_amount: { $exists: true } },
    { $set: { balance: 0, total_earning: 0, collected_cash: 0, updated_at: new Date() }, $unset: { seed_demo_amount: '' } },
  );
  console.log(`Restaurant: reset ${rRes.modifiedCount} seed wallet doc(s) → wallet now derived from delivered orders (matches the app).`);

  // 2. DM — merge duplicate wallets into one doc per rider.
  const dw = await db.collection('delivery_man_wallets').find({}).toArray();
  const groups = new Map();
  for (const w of dw) {
    const id = Number(w.mysql_delivery_man_id ?? w.delivery_man_id ?? 0);
    if (!id) continue;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(w);
  }
  let merged = 0;
  for (const [id, docs] of groups) {
    if (docs.length < 2) continue;
    docs.sort((a, b) => (b.mysql_delivery_man_id ? 1 : 0) - (a.mysql_delivery_man_id ? 1 : 0));
    const primary = docs[0];
    const sum = (k) => r2(docs.reduce((s, d) => s + toNum(d[k]), 0));
    await db.collection('delivery_man_wallets').updateOne({ _id: primary._id }, {
      $set: {
        mysql_delivery_man_id: id, delivery_man_id: id,
        balance: sum('balance'), total_earning: sum('total_earning'), collected_cash: sum('collected_cash'),
        pending_withdraw: sum('pending_withdraw'), total_withdrawn: sum('total_withdrawn'), updated_at: new Date(),
      },
    });
    for (const d of docs.slice(1)) await db.collection('delivery_man_wallets').deleteOne({ _id: d._id });
    merged++;
  }
  console.log(`DM: merged ${merged} duplicate rider wallet(s) → one wallet per rider.`);

  console.log('\n✅ Done. Restaurant Wallets now match the vendor app (order-derived); DM wallets de-duplicated.');
} catch (e) {
  console.error('ERROR:', e?.message ?? e);
  process.exitCode = 1;
} finally {
  await client.close();
}
