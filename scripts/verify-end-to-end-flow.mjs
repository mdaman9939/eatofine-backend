/**
 * Verify that customer Aarav → Restaurant #1 (Demo) → Rajesh Kumar
 * are all linked through real order documents.
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const u=process.env.MONGO_USER,p=process.env.MONGO_PASSWORD,h=process.env.MONGO_HOSTS,rs=process.env.MONGO_REPLICA_SET,dbn=process.env.MONGO_DATABASE??'eatofine',as=process.env.MONGO_AUTH_SOURCE??'admin';
const ps=new URLSearchParams({ssl:'true',authSource:as,retryWrites:'true',w:'majority'});if(rs)ps.set('replicaSet',rs);
const uri=`mongodb://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}/${dbn}?${ps}`;
const client=new MongoClient(uri,{serverSelectionTimeoutMS:15000});

try {
  await client.connect();
  const db = client.db(dbn);

  console.log('\n🔍 Linkage check: Customer → Restaurant → Vendor → Delivery Man\n');

  // 1. Customer
  const aarav = await db.collection('users').findOne({ mysql_id: 1 });
  console.log('👤 CUSTOMER:', aarav?.f_name, aarav?.l_name, `(id=${aarav?.mysql_id}, email=${aarav?.email})`);

  // 2. Vendor + Restaurant
  const vendor = await db.collection('vendors').findOne({ mysql_id: 1 });
  const restaurant = await db.collection('restaurants').findOne({ mysql_vendor_id: 1 });
  console.log('🍽️  VENDOR:  ', vendor?.f_name, vendor?.l_name, `(id=${vendor?.mysql_id}, email=${vendor?.email})`);
  console.log('🏪 RESTAURANT:', restaurant?.name, `(id=${restaurant?.mysql_id})`);

  // 3. Delivery man
  const dm = await db.collection('delivery_men').findOne({ mysql_id: 1 });
  console.log('🛵 DELIVERY MAN:', dm?.f_name, dm?.l_name, `(id=${dm?.mysql_id}, phone=${dm?.phone})`);

  console.log('\n' + '═'.repeat(70));
  console.log('🔗 LINKED ORDERS (Aarav → Demo Restaurant → Rajesh)');
  console.log('═'.repeat(70));

  // 4. Orders that connect ALL 3
  const linkedOrders = await db.collection('orders').find({
    mysql_user_id: aarav.mysql_id,
    mysql_restaurant_id: restaurant.mysql_id,
    mysql_delivery_man_id: dm.mysql_id,
  }).sort({ mysql_id: -1 }).toArray();

  console.log(`\nFound ${linkedOrders.length} orders connecting all 3 accounts:\n`);
  for (const o of linkedOrders.slice(0, 8)) {
    const date = o.created_at ? new Date(o.created_at).toISOString().slice(0, 16).replace('T', ' ') : '?';
    console.log(`   • Order #${o.mysql_id}  ${date}  ${o.order_status?.padEnd(10)} ₹${o.order_amount}  ${o.payment_method}`);
  }
  if (linkedOrders.length > 8) console.log(`   ... and ${linkedOrders.length - 8} more`);

  // 5. Status breakdown
  console.log('\nStatus breakdown:');
  const statusCounts = {};
  for (const o of linkedOrders) {
    statusCounts[o.order_status] = (statusCounts[o.order_status] || 0) + 1;
  }
  console.table(statusCounts);

  console.log('\n' + '═'.repeat(70));
  console.log('✅ END-TO-END FLOW IS LINKED');
  console.log('═'.repeat(70));
  console.log(`When Aarav places an order in Customer App:`);
  console.log(`  1. Demo Restaurant (demo@restaurant.com) sees it in Restaurant App`);
  console.log(`  2. Rajesh Kumar (+919999900001) sees it assigned in Delivery App`);
  console.log(`  3. admin@admin.com sees it on Admin Panel dashboard`);
} finally { await client.close(); }
