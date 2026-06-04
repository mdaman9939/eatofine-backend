/**
 * Replace DB image fields that point to filenames not on disk with
 * `default.png` (which we just placed in every storage subfolder).
 *
 * Skips files that DO exist on disk (so real images keep working).
 *
 * Coverage:
 *   • users.image                      → /storage/profile/default.png
 *   • vendors.image                    → /storage/vendor/default.png
 *   • delivery_men.image               → /storage/profile/default.png
 *   • restaurants.logo / cover_photo   → /storage/restaurant/default.png
 *   • foods.image                      → /storage/product/default.png
 *   • categories.image                 → /storage/category/default.png
 *   • banners.image                    → /storage/banner/default.png
 *   • cuisines.image                   → /storage/cuisine/default.png
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORAGE_ROOT = resolve(__dirname, '../storage/app/public');

const u=process.env.MONGO_USER,p=process.env.MONGO_PASSWORD,h=process.env.MONGO_HOSTS,rs=process.env.MONGO_REPLICA_SET,dbn=process.env.MONGO_DATABASE??'eatofine',as=process.env.MONGO_AUTH_SOURCE??'admin';
const ps=new URLSearchParams({ssl:'true',authSource:as,retryWrites:'true',w:'majority'});if(rs)ps.set('replicaSet',rs);
const uri=`mongodb://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}/${dbn}?${ps}`;
const client=new MongoClient(uri,{serverSelectionTimeoutMS:15000});

function fileExists(folder, filename) {
  if (!filename) return false;
  const path = resolve(STORAGE_ROOT, folder, filename);
  return existsSync(path);
}

async function fixField(db, collection, folder, field) {
  const all = await db.collection(collection).find({ [field]: { $ne: null, $exists: true } }).toArray();
  let fixed = 0;
  for (const doc of all) {
    const filename = doc[field];
    if (typeof filename !== 'string' || filename === 'default.png') continue;
    if (!fileExists(folder, filename)) {
      await db.collection(collection).updateOne(
        { _id: doc._id },
        { $set: { [field]: 'default.png' } },
      );
      fixed++;
    }
  }
  return { collection, field, total: all.length, fixed };
}

try {
  await client.connect();
  const db = client.db(dbn);

  console.log(`\nStorage root: ${STORAGE_ROOT}\n`);
  console.log('Scanning DB image fields…\n');

  const reports = [];
  reports.push(await fixField(db, 'users',         'profile',    'image'));
  reports.push(await fixField(db, 'vendors',       'vendor',     'image'));
  reports.push(await fixField(db, 'delivery_men',  'profile',    'image'));
  reports.push(await fixField(db, 'restaurants',   'restaurant', 'logo'));
  reports.push(await fixField(db, 'restaurants',   'restaurant/cover', 'cover_photo'));
  reports.push(await fixField(db, 'foods',         'product',    'image'));
  reports.push(await fixField(db, 'categories',    'category',   'image'));
  reports.push(await fixField(db, 'banners',       'banner',     'image'));
  reports.push(await fixField(db, 'cuisines',      'cuisine',    'image'));
  reports.push(await fixField(db, 'admins',        'profile',    'image'));

  console.log('═'.repeat(70));
  console.log('✅ DONE');
  console.log('═'.repeat(70));
  console.table(reports);

  const totalFixed = reports.reduce((s, r) => s + r.fixed, 0);
  console.log(`\nTotal records redirected to default.png: ${totalFixed}`);
} catch (err) {
  console.error('❌', err.message);
  process.exit(1);
} finally { await client.close(); }
