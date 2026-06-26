/** READ-ONLY: detect duplicate / wrongly-keyed wallet docs across all 3 wallet
 *  collections (my seed keyed by mysql_*; originals may use vendor_id/user_id/
 *  delivery_man_id → dups + admin/app divergence). */
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });
const u = process.env.MONGO_USER, p = process.env.MONGO_PASSWORD, h = process.env.MONGO_HOSTS, rs = process.env.MONGO_REPLICA_SET, dbn = process.env.MONGO_DATABASE ?? 'eatofine', as = process.env.MONGO_AUTH_SOURCE ?? 'admin';
const ps = new URLSearchParams({ ssl: 'true', authSource: as, retryWrites: 'true', w: 'majority' }); if (rs) ps.set('replicaSet', rs);
const client = new MongoClient(`mongodb://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}/${dbn}?${ps}`, { serverSelectionTimeoutMS: 15000 });

function dupReport(name, docs, keyFn) {
  const map = new Map();
  let noMysql = 0, seed = 0;
  for (const w of docs) {
    const k = keyFn(w);
    map.set(k, (map.get(k) ?? 0) + 1);
    if (w.seed_demo_amount != null) seed++;
  }
  const dupKeys = [...map.entries()].filter(([, c]) => c > 1);
  console.log(`\n${name}: ${docs.length} docs | unique owners: ${map.size} | DUP owners: ${dupKeys.length} | seed_demo tagged: ${seed}`);
  if (dupKeys.length) console.log('   dup owner ids (first 10):', dupKeys.slice(0, 10).map(([k, c]) => `${k}×${c}`).join(', '));
}

try {
  await client.connect();
  const db = client.db(dbn);

  const cw = await db.collection('wallets').find({}).toArray();
  dupReport('CUSTOMER wallets', cw, (w) => Number(w.mysql_user_id ?? w.user_id ?? 0));
  console.log('   keyed-by-user_id-only (no mysql_user_id):', cw.filter((w) => w.mysql_user_id == null && w.user_id != null).length);

  const rw = await db.collection('restaurant_wallets').find({}).toArray();
  dupReport('RESTAURANT wallets', rw, (w) => Number(w.mysql_restaurant_id ?? w.restaurant_id ?? w.vendor_id ?? w.mysql_vendor_id ?? 0));
  console.log('   has vendor_id key:', rw.filter((w) => w.vendor_id != null || w.mysql_vendor_id != null).length, '| has mysql_restaurant_id key:', rw.filter((w) => w.mysql_restaurant_id != null).length);

  const dw = await db.collection('delivery_man_wallets').find({}).toArray();
  dupReport('DM wallets', dw, (w) => Number(w.mysql_delivery_man_id ?? w.delivery_man_id ?? 0));
  console.log('   keyed-by-delivery_man_id-only (no mysql_delivery_man_id):', dw.filter((w) => w.mysql_delivery_man_id == null && w.delivery_man_id != null).length);
} catch (e) {
  console.error('ERROR:', e?.message ?? e);
  process.exitCode = 1;
} finally {
  await client.close();
}
