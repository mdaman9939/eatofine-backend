// Targeted fix: the "Aman Ji" restaurant (id=35) is approval_status='approved'
// and active=true, but status=false — so POS (which lists status===true) hides
// it. Enable status so it becomes selectable again. Guarded to ONLY touch an
// already-approved restaurant, so we can't accidentally enable a blocked one.
import { MongoClient } from 'mongodb';

const HOSTS = [
  'ac-wwhajfd-shard-00-00.5kgahgx.mongodb.net:27017',
  'ac-wwhajfd-shard-00-01.5kgahgx.mongodb.net:27017',
  'ac-wwhajfd-shard-00-02.5kgahgx.mongodb.net:27017',
].join(',');
const url = `mongodb://${HOSTS}/eatofine?ssl=true&replicaSet=atlas-fv6e0i-shard-0&authSource=admin&serverSelectionTimeoutMS=20000`;
const client = new MongoClient(url, { auth: { username: 'aman_admin', password: 'Aman%40123456' }, serverSelectionTimeoutMS: 20000 });

const RESTAURANT_ID = 35;

try {
  await client.connect();
  const rests = client.db('eatofine').collection('restaurants');

  const before = await rests.findOne({ mysql_id: RESTAURANT_ID }, { projection: { name: 1, status: 1, active: 1, approval_status: 1, mysql_zone_id: 1 } });
  console.log('BEFORE:', JSON.stringify(before));

  if (!before) { console.log('Restaurant not found — nothing to do.'); }
  else if (before.approval_status !== 'approved') {
    console.log(`Skipped: approval_status is "${before.approval_status}", not "approved". Approve it from Joining Requests instead.`);
  } else if (before.status === true) {
    console.log('Already status=true — no change needed.');
  } else {
    const res = await rests.updateOne(
      { mysql_id: RESTAURANT_ID, approval_status: 'approved' },
      { $set: { status: true, active: true, updated_at: new Date() } },
    );
    console.log(`Updated ${res.modifiedCount} document(s).`);
    const after = await rests.findOne({ mysql_id: RESTAURANT_ID }, { projection: { name: 1, status: 1, active: 1, approval_status: 1, mysql_zone_id: 1 } });
    console.log('AFTER:', JSON.stringify(after));
  }
} catch (e) {
  console.error('ERROR:', e.message);
} finally {
  await client.close();
}
