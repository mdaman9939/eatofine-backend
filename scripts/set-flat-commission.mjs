/**
 * Set a FLAT 5% commission across the platform (client decision):
 *   1. business_settings.admin_commission = 5  → default for NEW restaurant
 *      self-registrations.
 *   2. every restaurant's `comission` = 5. The previous value is preserved once
 *      in `comission_before_flat5` so it's reversible.
 * Idempotent. Override the rate: RATE=10 node scripts/set-flat-commission.mjs
 * Revert: REVERT=1 restores each restaurant's comission_before_flat5.
 */
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });
const u = process.env.MONGO_USER, p = process.env.MONGO_PASSWORD, h = process.env.MONGO_HOSTS, rs = process.env.MONGO_REPLICA_SET, dbn = process.env.MONGO_DATABASE ?? 'eatofine', as = process.env.MONGO_AUTH_SOURCE ?? 'admin';
const ps = new URLSearchParams({ ssl: 'true', authSource: as, retryWrites: 'true', w: 'majority' }); if (rs) ps.set('replicaSet', rs);
const client = new MongoClient(`mongodb://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}/${dbn}?${ps}`, { serverSelectionTimeoutMS: 15000 });
const RATE = Number(process.env.RATE || 5);
const REVERT = process.env.REVERT === '1';

try {
  await client.connect();
  const db = client.db(dbn);
  const rests = await db.collection('restaurants').find({}, { projection: { mysql_id: 1, name: 1, comission: 1, comission_before_flat5: 1 } }).toArray();

  // Current distribution (for the record).
  const dist = {};
  for (const r of rests) { const k = r.comission == null ? 'unset' : String(r.comission); dist[k] = (dist[k] || 0) + 1; }
  console.log(`Restaurants: ${rests.length} | current commission distribution: ${JSON.stringify(dist)}`);

  if (REVERT) {
    let n = 0;
    for (const r of rests) {
      if (r.comission_before_flat5 !== undefined) {
        await db.collection('restaurants').updateOne({ mysql_id: r.mysql_id }, { $set: { comission: r.comission_before_flat5, updated_at: new Date() }, $unset: { comission_before_flat5: '' } });
        n++;
      }
    }
    console.log(`\n✅ Reverted ${n} restaurants to their original commission.`);
  } else {
    let n = 0;
    for (const r of rests) {
      const set = { comission: RATE, updated_at: new Date() };
      // Preserve the original ONCE (so a later REVERT can restore it).
      if (r.comission_before_flat5 === undefined) set.comission_before_flat5 = r.comission ?? null;
      await db.collection('restaurants').updateOne({ mysql_id: r.mysql_id }, { $set: set });
      n++;
    }
    // Default for new self-registrations (auth-extras reads bs.getNumber('admin_commission')).
    await db.collection('business_settings').updateOne(
      { key: 'admin_commission' },
      { $set: { key: 'admin_commission', value: String(RATE), key_value: String(RATE), updated_at: new Date() } },
      { upsert: true },
    );
    console.log(`\n✅ Set ALL ${n} restaurants to ${RATE}% commission + default admin_commission = ${RATE} (new registrations).`);
    console.log('   Original values backed up in restaurants.comission_before_flat5.');
    console.log(`   Revert: REVERT=1 node scripts/set-flat-commission.mjs`);
  }
} catch (e) { console.error('ERROR:', e?.message ?? e); process.exitCode = 1; } finally { await client.close(); }
