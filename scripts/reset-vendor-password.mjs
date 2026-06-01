/**
 * Reset a single vendor's password.
 *
 * Hashes the new password with bcrypt + Laravel-compat $2y$ prefix (matches
 * how SeedService stores hashes — see src/mongo/seed.service.ts:98). The
 * backend's verifyPassword() converts $2y$ → $2b$ before comparing, so this
 * works with the existing auth flow.
 *
 * Usage:  node --env-file=.env scripts/reset-vendor-password.mjs <email> <newPassword>
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcrypt';

const [, , emailArg, passwordArg] = process.argv;
const email = emailArg ?? 'demo@restaurant.com';
const newPassword = passwordArg ?? '12345678';

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

try {
  await client.connect();
  const db = client.db(database);

  // 1. Find vendor
  const vendor = await db.collection('vendors').findOne({ email });
  if (!vendor) {
    console.error(`❌ No vendor found with email: ${email}`);
    process.exit(1);
  }
  console.log(`✓ Found vendor:  ${vendor.f_name ?? ''} ${vendor.l_name ?? ''}  (id=${vendor.mysql_id})`);

  // 2. Generate new hash (Laravel-compat $2y$ prefix)
  const hash = (await bcrypt.hash(newPassword, 10)).replace(/^\$2b\$/, '$2y$');
  console.log(`✓ Generated hash:  ${hash.slice(0, 20)}…`);

  // 3. Update
  const result = await db.collection('vendors').updateOne(
    { email },
    { $set: { password: hash, updated_at: new Date() } },
  );
  if (result.modifiedCount !== 1) {
    console.error(`❌ Update failed — modifiedCount=${result.modifiedCount}`);
    process.exit(1);
  }
  console.log(`✓ Updated 1 vendor record`);

  // 4. Verify by reading back and comparing
  const verify = await db.collection('vendors').findOne({ email });
  const normalized = verify.password.replace(/^\$2y\$/, '$2b$');
  const ok = await bcrypt.compare(newPassword, normalized);
  if (!ok) {
    console.error(`❌ Verification failed — re-read hash does not match "${newPassword}"`);
    process.exit(1);
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`✅ SUCCESS — vendor login is now active`);
  console.log('═'.repeat(60));
  console.log(`   Email:     ${email}`);
  console.log(`   Password:  ${newPassword}`);
  console.log(`   Endpoint:  POST /api/v1/auth/vendor/login`);
} catch (err) {
  console.error('❌ Failed:', err.message);
  process.exit(1);
} finally {
  await client.close();
}
