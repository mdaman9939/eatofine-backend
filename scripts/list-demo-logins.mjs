/**
 * Lists ready-to-use demo credentials for vendor (restaurant owner) +
 * employee accounts. Seed password for ALL seeded accounts is `12345678`
 * (bcrypt-hashed in DB — see SeedService line ~97).
 *
 * Usage:  node scripts/list-demo-logins.mjs
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const user = process.env.MONGO_USER;
const password = process.env.MONGO_PASSWORD;
const hosts = process.env.MONGO_HOSTS;
const replicaSet = process.env.MONGO_REPLICA_SET;
const database = process.env.MONGO_DATABASE ?? 'eatofine';
const authSource = process.env.MONGO_AUTH_SOURCE ?? 'admin';

if (!user || !password || !hosts) {
  console.error('Missing env vars: MONGO_USER / MONGO_PASSWORD / MONGO_HOSTS');
  process.exit(1);
}

const params = new URLSearchParams({
  ssl: 'true', authSource, retryWrites: 'true', w: 'majority',
});
if (replicaSet) params.set('replicaSet', replicaSet);

const uri = `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${hosts}/${database}?${params}`;

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });

function row(r) {
  const name = `${r.f_name ?? ''} ${r.l_name ?? ''}`.trim() || '—';
  return {
    id: r.mysql_id ?? r._id?.toString().slice(-6),
    name,
    email: r.email,
    phone: r.phone ?? '—',
  };
}

try {
  await client.connect();
  const db = client.db(database);

  console.log('\n' + '═'.repeat(80));
  console.log('🍽️   RESTAURANT OWNERS (vendors) — login via Restaurant APK');
  console.log('═'.repeat(80));
  const vendors = await db.collection('vendors').find({}).limit(10).toArray();
  if (vendors.length === 0) {
    console.log('   (no vendor records — seed the DB first)');
  } else {
    console.log('   Password for all seeded accounts:  12345678');
    console.log('   Login endpoint:  POST /api/v1/auth/vendor/login');
    console.log('   Login by email OR phone.\n');
    console.table(vendors.map(row));
  }

  console.log('\n' + '═'.repeat(80));
  console.log('👨‍💼   ADMIN EMPLOYEES — login via Admin Panel');
  console.log('═'.repeat(80));
  const employees = await db.collection('employees').find({}).limit(10).toArray();
  if (employees.length === 0) {
    console.log('   (no employee records found)');
  } else {
    console.log('   Password for all seeded accounts:  12345678');
    console.log('   Login URL:  http://localhost:3001/login\n');
    console.table(employees.map(row));
  }

  console.log('\n' + '═'.repeat(80));
  console.log('🛵   DELIVERY MEN — login via Delivery APK');
  console.log('═'.repeat(80));
  const dms = await db.collection('delivery_men').find({}).limit(10).toArray();
  if (dms.length === 0) {
    console.log('   (no delivery_men records found)');
  } else {
    console.log('   Password for all seeded accounts:  12345678');
    console.log('   Login endpoint:  POST /api/v1/auth/delivery-man/login (by phone)\n');
    console.table(dms.map(row));
  }

  console.log('\n' + '═'.repeat(80));
  console.log('👤   CUSTOMERS — login via Customer APK');
  console.log('═'.repeat(80));
  const customers = await db.collection('users').find({}).limit(10).toArray();
  if (customers.length === 0) {
    console.log('   (no customer records found)');
  } else {
    console.log('   Password for all seeded accounts:  12345678');
    console.log('   Login endpoint:  POST /api/v1/auth/login (by email or phone)\n');
    console.table(customers.map(row));
  }

  console.log('\n' + '═'.repeat(80));
  console.log('🔑   ROOT ADMIN — for admin panel');
  console.log('═'.repeat(80));
  console.log('   Email:     admin@admin.com');
  console.log('   Password:  12345678');
  console.log('   URL:       http://localhost:3001/login\n');
} catch (err) {
  console.error('❌ Failed:', err.message);
  process.exit(1);
} finally {
  await client.close();
}
