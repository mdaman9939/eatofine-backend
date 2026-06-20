// READ-ONLY: inspect the "Aman Ji" restaurant + zones to debug POS visibility.
import { MongoClient } from 'mongodb';

const HOSTS = [
  'ac-wwhajfd-shard-00-00.5kgahgx.mongodb.net:27017',
  'ac-wwhajfd-shard-00-01.5kgahgx.mongodb.net:27017',
  'ac-wwhajfd-shard-00-02.5kgahgx.mongodb.net:27017',
].join(',');

const url = `mongodb://${HOSTS}/eatofine?ssl=true&replicaSet=atlas-fv6e0i-shard-0&authSource=admin&serverSelectionTimeoutMS=20000`;
const client = new MongoClient(url, {
  auth: { username: 'aman_admin', password: 'Aman%40123456' },
  serverSelectionTimeoutMS: 20000,
});

try {
  await client.connect();
  const db = client.db('eatofine');

  console.log('\n=== ZONES ===');
  const zones = await db.collection('zones').find({}).project({ mysql_id: 1, name: 1, status: 1 }).toArray();
  for (const z of zones) console.log(`  zone mysql_id=${z.mysql_id}  name=${JSON.stringify(z.name)}  status=${z.status}`);

  console.log('\n=== RESTAURANTS matching /aman/i or aman@gmail.com ===');
  const rests = await db.collection('restaurants').find({
    $or: [
      { name: { $regex: 'aman', $options: 'i' } },
      { email: 'aman@gmail.com' },
      { phone: { $regex: '7896541230' } },
    ],
  }).toArray();
  if (rests.length === 0) console.log('  (none found)');
  for (const r of rests) {
    console.log(`  mysql_id=${r.mysql_id}  name=${JSON.stringify(r.name)}`);
    console.log(`     status=${r.status}  active=${r.active}  approval_status=${r.approval_status}`);
    console.log(`     zone_id=${r.zone_id}  mysql_zone_id=${r.mysql_zone_id}  vendor=${r.mysql_vendor_id}`);
    console.log(`     email=${r.email}  phone=${r.phone}  created_at=${r.created_at}`);
  }

  console.log('\n=== order #355 restaurant link (sanity) ===');
  const o = await db.collection('orders').findOne({ mysql_id: 355 }, { projection: { mysql_id: 1, mysql_restaurant_id: 1, mysql_zone_id: 1, order_type: 1, order_status: 1 } });
  console.log('  order 355:', JSON.stringify(o));
} catch (e) {
  console.error('ERROR:', e.message);
} finally {
  await client.close();
}
