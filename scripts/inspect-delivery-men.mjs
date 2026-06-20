// READ-ONLY: list delivery_men phone formats + status to debug login 401.
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
  const rows = await client.db('eatofine').collection('delivery_men')
    .find({}, { projection: { mysql_id: 1, f_name: 1, l_name: 1, phone: 1, application_status: 1, status: 1, password: 1 } })
    .sort({ mysql_id: -1 }).limit(40).toArray();
  console.log(`total shown: ${rows.length}`);
  for (const r of rows) {
    const hasPw = r.password ? `${String(r.password).slice(0,4)}…(${String(r.password).length})` : 'NONE';
    console.log(`id=${r.mysql_id}  phone=${JSON.stringify(r.phone)}  app_status=${r.application_status}  status=${r.status}  name="${(r.f_name||'')+' '+(r.l_name||'')}".trim  pw=${hasPw}`);
  }
} catch (e) { console.error('ERROR:', e.message); } finally { await client.close(); }
