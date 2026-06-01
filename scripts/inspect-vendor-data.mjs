/**
 * Inspect what data exists in MongoDB for a specific vendor.
 * Usage:  node --env-file=.env scripts/inspect-vendor-data.mjs [vendor_id=1]
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const vendorId = parseInt(process.argv[2] ?? '1', 10);

const user = process.env.MONGO_USER;
const password = process.env.MONGO_PASSWORD;
const hosts = process.env.MONGO_HOSTS;
const replicaSet = process.env.MONGO_REPLICA_SET;
const database = process.env.MONGO_DATABASE ?? 'eatofine';
const authSource = process.env.MONGO_AUTH_SOURCE ?? 'admin';

const params = new URLSearchParams({ ssl: 'true', authSource, retryWrites: 'true', w: 'majority' });
if (replicaSet) params.set('replicaSet', replicaSet);
const uri = `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${hosts}/${database}?${params}`;
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });

try {
  await client.connect();
  const db = client.db(database);

  console.log(`\n🔍 Inspecting data for vendor_id=${vendorId}\n`);

  // Vendor record
  const vendor = await db.collection('vendors').findOne({ mysql_id: vendorId });
  console.log('VENDOR:', vendor ? `${vendor.f_name} ${vendor.l_name} (${vendor.email})` : '❌ NOT FOUND');

  // Linked restaurant
  const restaurant = await db.collection('restaurants').findOne({ mysql_vendor_id: vendorId });
  console.log('RESTAURANT:', restaurant ? `id=${restaurant.mysql_id} "${restaurant.name}"` : '❌ NONE LINKED');

  const restaurantId = restaurant?.mysql_id;

  // Orders linked to this restaurant
  if (restaurantId) {
    const orderCount = await db.collection('orders').countDocuments({ mysql_restaurant_id: restaurantId });
    console.log(`ORDERS (restaurant_id=${restaurantId}):`, orderCount);

    // Sample one order to see date fields
    const sample = await db.collection('orders').findOne({ mysql_restaurant_id: restaurantId });
    if (sample) {
      console.log('  Sample order keys:', Object.keys(sample).filter(k => k.includes('date') || k.includes('_at') || k.includes('time')).slice(0, 10).join(', '));
      console.log('  Sample created_at:', sample.created_at, '(type:', typeof sample.created_at + ')');
      console.log('  Sample updated_at:', sample.updated_at, '(type:', typeof sample.updated_at + ')');
      console.log('  Sample order_status:', sample.order_status);
      console.log('  Sample order_amount:', sample.order_amount);
    }

    // Status breakdown
    const statuses = await db.collection('orders').aggregate([
      { $match: { mysql_restaurant_id: restaurantId } },
      { $group: { _id: '$order_status', count: { $sum: 1 } } },
    ]).toArray();
    console.log('  By status:', statuses.map(s => `${s._id}=${s.count}`).join(', ') || '(none)');
  }

  // Wallet
  const walletCollections = ['vendor_wallets', 'restaurant_wallets', 'wallets'];
  for (const coll of walletCollections) {
    try {
      const count = await db.collection(coll).countDocuments();
      const forVendor = await db.collection(coll).findOne({ $or: [
        { mysql_vendor_id: vendorId },
        { vendor_id: vendorId },
        { mysql_restaurant_id: restaurantId ?? -1 },
        { restaurant_id: restaurantId ?? -1 },
      ]});
      console.log(`COLLECTION '${coll}':`, count, 'docs total |', forVendor ? `vendor record EXISTS` : 'no record for this vendor');
    } catch {
      console.log(`COLLECTION '${coll}': (does not exist)`);
    }
  }

  // List all collections to see what's there
  console.log('\nALL COLLECTIONS WITH "wallet" / "earning" / "transaction":');
  const all = await db.listCollections().toArray();
  for (const c of all) {
    if (/wallet|earning|transaction|disburs/i.test(c.name)) {
      const cnt = await db.collection(c.name).countDocuments();
      console.log(`  ${c.name}: ${cnt} docs`);
    }
  }
} finally {
  await client.close();
}
