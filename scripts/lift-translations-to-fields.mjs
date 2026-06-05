/**
 * One-shot fix: for every restaurant where `translations` is a JSON string
 * containing {locale, key, value} entries, parse it and lift the English
 * `name` and `address` values onto the top-level fields so the My
 * Restaurant screen reflects what the vendor typed in Edit Restaurant.
 *
 * The new code path (vendor-extras.controller.ts → basicInfo) already
 * does this on save, but existing records that were saved by the older
 * stub need a one-time backfill.
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const u=process.env.MONGO_USER,p=process.env.MONGO_PASSWORD,h=process.env.MONGO_HOSTS,rs=process.env.MONGO_REPLICA_SET,dbn=process.env.MONGO_DATABASE??'eatofine',as=process.env.MONGO_AUTH_SOURCE??'admin';
const ps=new URLSearchParams({ssl:'true',authSource:as,retryWrites:'true',w:'majority'});if(rs)ps.set('replicaSet',rs);
const uri=`mongodb://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}/${dbn}?${ps}`;
const client=new MongoClient(uri,{serverSelectionTimeoutMS:15000});

function pick(translations, key) {
  if (!Array.isArray(translations)) return null;
  const hit = translations.find(t => t?.locale === 'en' && t?.key === key)
           ?? translations.find(t => t?.key === key);
  return hit?.value ?? null;
}

try {
  await client.connect();
  const db = client.db(dbn);

  const all = await db.collection('restaurants').find({
    translations: { $exists: true, $ne: null },
  }).toArray();

  let fixed = 0, skipped = 0;
  for (const r of all) {
    let translations = r.translations;
    // Flutter sends translations as a JSON-encoded STRING; old save code
    // stored it as-is.  Parse it back to an array before lifting.
    if (typeof translations === 'string') {
      try { translations = JSON.parse(translations); } catch { translations = null; }
    }
    if (!Array.isArray(translations) || translations.length === 0) {
      skipped++;
      continue;
    }
    const enName = pick(translations, 'name');
    const enAddress = pick(translations, 'address');
    const update = { translations };  // re-write as array, not string
    if (enName && enName !== r.name) update.name = enName;
    if (enAddress && enAddress !== r.address) update.address = enAddress;
    if (Object.keys(update).length === 1 && update.translations === r.translations) {
      skipped++;
      continue;
    }
    update.updated_at = new Date();
    await db.collection('restaurants').updateOne({ _id: r._id }, { $set: update });
    console.log(`  ✓ #${r.mysql_id}  name: ${r.name} → ${update.name ?? r.name}  |  address: ${(r.address||'').slice(0,30)} → ${(update.address||r.address||'').slice(0,30)}`);
    fixed++;
  }

  console.log(`\nFixed: ${fixed}  Skipped: ${skipped}`);
} catch (err) {
  console.error('❌', err.message);
  process.exit(1);
} finally { await client.close(); }
