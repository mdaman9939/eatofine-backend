/**
 * The rider app's Incentive screen (reward-progress) only lists bonus/incentive
 * rules that have a THRESHOLD (target deliveries) > 0 — a reward with no target
 * isn't claimable. The admin's demo rules had an amount but "No threshold set",
 * so the app showed "No offer available". This sets a demo threshold + period on
 * any active rule that's missing them so the offers appear. Idempotent — rules
 * that already have a threshold are left untouched (admin can edit any time).
 */
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });
const u = process.env.MONGO_USER, p = process.env.MONGO_PASSWORD, h = process.env.MONGO_HOSTS, rs = process.env.MONGO_REPLICA_SET, dbn = process.env.MONGO_DATABASE ?? 'eatofine', as = process.env.MONGO_AUTH_SOURCE ?? 'admin';
const ps = new URLSearchParams({ ssl: 'true', authSource: as, retryWrites: 'true', w: 'majority' }); if (rs) ps.set('replicaSet', rs);
const client = new MongoClient(`mongodb://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}/${dbn}?${ps}`, { serverSelectionTimeoutMS: 15000 });

// Sensible per-rule demo targets (by name keyword); default = 10 deliveries / week.
function targetFor(name) {
  const n = String(name ?? '').toLowerCase();
  if (n.includes('peak')) return { threshold: 10, period: 'daily' };
  if (n.includes('weekend')) return { threshold: 15, period: 'weekly' };
  if (n.includes('festival') || n.includes('diwali')) return { threshold: 20, period: 'weekly' };
  if (n.includes('referral')) return { threshold: 5, period: 'monthly' };
  return { threshold: 10, period: 'weekly' };
}

try {
  await client.connect();
  const db = client.db(dbn);
  const rules = await db.collection('dm_bonuses').find({ status: { $in: [true, 1] } }).toArray();
  const valid = ['daily', 'weekly', 'monthly'];
  let updated = 0;
  for (const b of rules) {
    const set = {};
    if (!(Number(b.threshold) > 0)) set.threshold = targetFor(b.name).threshold;
    if (!valid.includes(String(b.period))) set.period = targetFor(b.name).period;
    if (Object.keys(set).length) {
      set.updated_at = new Date();
      await db.collection('dm_bonuses').updateOne({ mysql_id: b.mysql_id }, { $set: set });
      console.log(`  ${b.name ?? `#${b.mysql_id}`} → threshold ${set.threshold ?? b.threshold} / ${set.period ?? b.period} (₹${b.amount})`);
      updated++;
    }
  }
  console.log(`\n✅ Active reward rules: ${rules.length} | set demo threshold/period on: ${updated}`);
  console.log('   The rider app Incentive screen will now list these as offers (with the rider\'s delivered-count progress).');
} catch (e) { console.error('ERROR:', e?.message ?? e); process.exitCode = 1; } finally { await client.close(); }
