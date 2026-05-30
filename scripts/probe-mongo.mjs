// Try both interpretations of the password the user shared.
import { MongoClient } from 'mongodb';

const HOST = 'ac-wwhajfd-shard-00-00.5kgahgx.mongodb.net:27017';

async function tryAuth(label, username, password) {
  const url = `mongodb://${HOST}/?ssl=true&directConnection=true&serverSelectionTimeoutMS=15000`;
  const client = new MongoClient(url, {
    auth: { username, password },
    authSource: 'admin',
    serverSelectionTimeoutMS: 15000,
  });
  console.log(`\n[${label}] user='${username}' pwd='${password}'`);
  try {
    await client.connect();
    const hello = await client.db('admin').command({ hello: 1 });
    console.log(`  ✅ AUTH OK — setName=${hello.setName}`);
    const dbs = await client.db('admin').admin().listDatabases();
    console.log(`  Databases:`, dbs.databases.map((d) => `${d.name} (${(d.sizeOnDisk / 1024).toFixed(1)} KB)`).join(', '));
    return { ok: true, password };
  } catch (err) {
    console.error(`  ❌ ${err.message}`);
    return { ok: false };
  } finally {
    await client.close();
  }
}

const r1 = await tryAuth('decoded', 'aman_admin', 'Aman@123456');
if (!r1.ok) await tryAuth('literal', 'aman_admin', 'Aman%40123456');
