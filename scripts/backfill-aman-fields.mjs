// Backfill the standard rating/counter fields on Aman Ji (id 35) so its
// document matches seeded restaurants. Only sets fields that are missing.
import { MongoClient } from 'mongodb';

const HOSTS = [
  'ac-wwhajfd-shard-00-00.5kgahgx.mongodb.net:27017',
  'ac-wwhajfd-shard-00-01.5kgahgx.mongodb.net:27017',
  'ac-wwhajfd-shard-00-02.5kgahgx.mongodb.net:27017',
].join(',');
const url = `mongodb://${HOSTS}/eatofine?ssl=true&replicaSet=atlas-fv6e0i-shard-0&authSource=admin&serverSelectionTimeoutMS=20000`;
const client = new MongoClient(url, { auth: { username: 'aman_admin', password: 'Aman%40123456' }, serverSelectionTimeoutMS: 20000 });

try {
  await client.connect();
  const rests = client.db('eatofine').collection('restaurants');
  const r = await rests.findOne({ mysql_id: 35 });
  if (!r) { console.log('not found'); }
  else {
    const set = {};
    const defaults = { avg_rating: 0, rating_count: 0, order_count: 0, foods_count: 0, minimum_shipping_charge: 0 };
    for (const [k, v] of Object.entries(defaults)) if (r[k] === undefined || r[k] === null) set[k] = v;
    if (Object.keys(set).length === 0) console.log('nothing missing');
    else {
      set.updated_at = new Date();
      const res = await rests.updateOne({ mysql_id: 35 }, { $set: set });
      console.log('set:', JSON.stringify(set), 'modified:', res.modifiedCount);
    }
  }
} catch (e) {
  console.error('ERROR:', e.message);
} finally {
  await client.close();
}
