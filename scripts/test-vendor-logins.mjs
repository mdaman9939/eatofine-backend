/**
 * Tests which vendors can actually log in with password "12345678".
 * Bcrypt-compares each vendor's stored hash and reports working creds.
 *
 * Usage:  node --env-file=.env scripts/test-vendor-logins.mjs
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcrypt';

const user = process.env.MONGO_USER;
const password = process.env.MONGO_PASSWORD;
const hosts = process.env.MONGO_HOSTS;
const replicaSet = process.env.MONGO_REPLICA_SET;
const database = process.env.MONGO_DATABASE ?? 'eatofine';
const authSource = process.env.MONGO_AUTH_SOURCE ?? 'admin';

const params = new URLSearchParams({
  ssl: 'true', authSource, retryWrites: 'true', w: 'majority',
});
if (replicaSet) params.set('replicaSet', replicaSet);

const uri = `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${hosts}/${database}?${params}`;
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });

const TEST_PASSWORD = '12345678';

try {
  await client.connect();
  const db = client.db(database);
  const vendors = await db.collection('vendors').find({}).limit(15).toArray();

  console.log(`\nTesting "${TEST_PASSWORD}" against ${vendors.length} vendors...\n`);
  const working = [];
  const broken = [];

  for (const v of vendors) {
    const name = `${v.f_name ?? ''} ${v.l_name ?? ''}`.trim() || v.email;
    if (!v.password) {
      broken.push({ name, email: v.email, reason: 'no password hash stored' });
      continue;
    }
    try {
      // Backend converts $2y$ (Laravel-compat seed hashes) → $2b$ before
      // comparing. Mirror that here so the test matches real auth behavior.
      const normalized = v.password.replace(/^\$2y\$/, '$2b$');
      const ok = await bcrypt.compare(TEST_PASSWORD, normalized);
      if (ok) {
        working.push({ name, email: v.email, phone: v.phone });
      } else {
        broken.push({ name, email: v.email, reason: 'password mismatch' });
      }
    } catch (err) {
      broken.push({ name, email: v.email, reason: `bcrypt error: ${err.message}` });
    }
  }

  console.log('═'.repeat(80));
  console.log(`✅ WORKING (${working.length}) — login with password "${TEST_PASSWORD}"`);
  console.log('═'.repeat(80));
  if (working.length === 0) {
    console.log('   ⚠️  NONE — no vendor accepts "12345678"');
  } else {
    console.table(working);
  }

  console.log('\n' + '═'.repeat(80));
  console.log(`❌ BROKEN (${broken.length}) — password "${TEST_PASSWORD}" does NOT work`);
  console.log('═'.repeat(80));
  if (broken.length > 0) console.table(broken);
} catch (err) {
  console.error('Failed:', err.message);
  process.exit(1);
} finally {
  await client.close();
}
