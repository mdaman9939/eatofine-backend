// Normalise delivery_men phones to "+91XXXXXXXXXX" for the inconsistent rows
// (admin-entered without country code, or with a space). India-only demo, so
// we standardise on +91. Only touches rows that DON'T already equal the
// canonical "+91"+last10 form, and only when the number looks Indian
// (10 digits, 11 with leading 0, or 12 starting with 91).
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
  const coll = client.db('eatofine').collection('delivery_men');
  const rows = await coll.find({}, { projection: { mysql_id: 1, phone: 1 } }).toArray();
  let changed = 0;
  for (const r of rows) {
    const raw = String(r.phone ?? '');
    const digits = raw.replace(/\D/g, '');
    // Only normalise plausibly-Indian numbers.
    const looksIndian = digits.length === 10 || (digits.length === 11 && digits.startsWith('0')) || (digits.length === 12 && digits.startsWith('91'));
    if (!looksIndian) continue;
    const canonical = '+91' + digits.slice(-10);
    if (raw === canonical) continue;
    await coll.updateOne({ mysql_id: r.mysql_id }, { $set: { phone: canonical, updated_at: new Date() } });
    console.log(`id=${r.mysql_id}: ${JSON.stringify(raw)} -> ${canonical}`);
    changed++;
  }
  console.log(`normalised ${changed} row(s).`);
} catch (e) { console.error('ERROR:', e.message); } finally { await client.close(); }
