// Backfill the per-order-type charge model so existing installs behave EXACTLY
// as they did under the old all-or-nothing `charges_on_takeaway_dinein` toggle:
//
//   • additional_user_charges rows missing `order_types` get an explicit list —
//     ['delivery'] when the toggle was OFF, all three when it was ON. (The old
//     behaviour: charges applied to delivery always, and to take_away/dine_in
//     only when the toggle was on.) Without this, the new reader treats a row
//     with no order_types as "applies to every type" → it would start charging
//     take_away/dine_in on installs that had the toggle OFF.
//
//   • `food_gst_order_types` business setting is seeded from the same toggle so
//     food GST + extra packaging keep their previous scope.
//
// Idempotent: only writes rows/keys that are missing. Pass DRY_RUN=1 to preview.
import { MongoClient } from 'mongodb';

const HOSTS = [
  'ac-wwhajfd-shard-00-00.5kgahgx.mongodb.net:27017',
  'ac-wwhajfd-shard-00-01.5kgahgx.mongodb.net:27017',
  'ac-wwhajfd-shard-00-02.5kgahgx.mongodb.net:27017',
].join(',');
const url = `mongodb://${HOSTS}/eatofine?ssl=true&replicaSet=atlas-fv6e0i-shard-0&authSource=admin&serverSelectionTimeoutMS=20000`;
const client = new MongoClient(url, { auth: { username: 'aman_admin', password: 'Aman%40123456' }, serverSelectionTimeoutMS: 20000 });
const DRY = process.env.DRY_RUN === '1';

try {
  await client.connect();
  const db = client.db('eatofine');
  const settings = db.collection('business_settings');
  const charges = db.collection('additional_user_charges');

  // 1. Resolve the legacy toggle.
  const toggleDoc = await settings.findOne({ key: 'charges_on_takeaway_dinein' });
  const tv = toggleDoc?.value ?? toggleDoc?.key_value;
  const toggleOn = tv === '1' || tv === 'true' || tv === 1 || tv === true;
  const legacyTypes = toggleOn ? ['take_away', 'dine_in', 'delivery'] : ['delivery'];
  console.log(`charges_on_takeaway_dinein = ${JSON.stringify(tv)} -> legacy order types: ${legacyTypes.join(',')}`);

  // 2. Backfill additional_user_charges missing a valid order_types array.
  const all = await charges.find({}).toArray();
  const needing = all.filter((c) => !Array.isArray(c.order_types));
  console.log(`additional_user_charges: ${all.length} total, ${needing.length} missing order_types`);
  if (!DRY) {
    for (const c of needing) {
      await charges.updateOne({ _id: c._id }, { $set: { order_types: legacyTypes, updated_at: new Date() } });
    }
  }
  console.log(`${DRY ? '[dry-run] would set' : 'set'} order_types on ${needing.length} charge(s)`);

  // 3. Seed food_gst_order_types if absent (CSV string, matching the admin panel).
  const gstDoc = await settings.findOne({ key: 'food_gst_order_types' });
  if (gstDoc) {
    console.log(`food_gst_order_types already set: ${JSON.stringify(gstDoc.value ?? gstDoc.key_value)} — left unchanged`);
  } else {
    const csv = legacyTypes.join(',');
    if (!DRY) {
      const maxDoc = await settings.find({}).sort({ mysql_id: -1 }).limit(1).next();
      const mysql_id = (Number(maxDoc?.mysql_id) || 0) + 1;
      const now = new Date();
      await settings.insertOne({ mysql_id, key: 'food_gst_order_types', value: csv, created_at: now, updated_at: now });
    }
    console.log(`${DRY ? '[dry-run] would seed' : 'seeded'} food_gst_order_types = ${csv}`);
  }

  console.log('DONE');
} catch (e) {
  console.error('ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await client.close();
}
