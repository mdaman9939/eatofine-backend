/**
 * Backfill: every ALREADY-APPROVED restaurant (vendor) withdraw request that has
 * no linked disbursement gets one created — so approved payouts (e.g. vendor #3)
 * show by NAME under Restaurant Disbursement. New approvals do this automatically;
 * this catches the ones approved before that wiring existed. Idempotent.
 */
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });
const u = process.env.MONGO_USER, p = process.env.MONGO_PASSWORD, h = process.env.MONGO_HOSTS, rs = process.env.MONGO_REPLICA_SET, dbn = process.env.MONGO_DATABASE ?? 'eatofine', as = process.env.MONGO_AUTH_SOURCE ?? 'admin';
const ps = new URLSearchParams({ ssl: 'true', authSource: as, retryWrites: 'true', w: 'majority' }); if (rs) ps.set('replicaSet', rs);
const client = new MongoClient(`mongodb://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}/${dbn}?${ps}`, { serverSelectionTimeoutMS: 15000 });
const num = (v) => { if (v == null) return 0; if (typeof v === 'number') return v; const n = parseFloat(String(v?.toString?.() ?? v)); return Number.isFinite(n) ? n : 0; };
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

try {
  await client.connect();
  const db = client.db(dbn);

  // Approved VENDOR/restaurant requests (no delivery_man_id).
  const reqs = await db.collection('withdraw_requests').find({
    approved: true,
    $and: [
      { $or: [{ vendor_id: { $ne: null } }, { mysql_vendor_id: { $ne: null } }] },
      { $or: [{ delivery_man_id: null }, { delivery_man_id: { $exists: false } }] },
    ],
  }).toArray();

  let top = await db.collection('disbursements').find({}, { projection: { mysql_id: 1 } }).sort({ mysql_id: -1 }).limit(1).toArray();
  let nextId = (Number(top[0]?.mysql_id) || 0) + 1;

  let created = 0, skipped = 0;
  for (const w of reqs) {
    const wid = Number(w.mysql_id);
    const vendorId = Number(w.vendor_id ?? w.mysql_vendor_id ?? 0);
    const amt = r2(num(w.amount));
    if (!wid || !vendorId || amt <= 0) { skipped++; continue; }
    const exists = await db.collection('disbursements').findOne({ withdraw_request_id: wid });
    if (exists) { skipped++; continue; }
    const now = new Date();
    await db.collection('disbursements').insertOne({
      mysql_id: nextId++, mysql_vendor_id: vendorId, vendor_id: vendorId, withdraw_request_id: wid,
      total_amount: amt, status: 'pending', payment_method: 'cash', paid_out: false, wallet_managed: false,
      created_at: now, updated_at: now,
    });
    created++;
  }
  console.log(`Approved restaurant withdraw requests scanned: ${reqs.length}`);
  console.log(`✅ Disbursements created: ${created} | already-linked (skipped): ${skipped}`);
  console.log('   These now show by restaurant NAME under Restaurant Disbursement (status: pending → mark paid when transferred).');
} catch (e) {
  console.error('ERROR:', e?.message ?? e);
  process.exitCode = 1;
} finally {
  await client.close();
}
