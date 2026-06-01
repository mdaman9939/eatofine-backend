import 'dotenv/config';
import { MongoClient } from 'mongodb';

const u=process.env.MONGO_USER, p=process.env.MONGO_PASSWORD, h=process.env.MONGO_HOSTS, rs=process.env.MONGO_REPLICA_SET, db=process.env.MONGO_DATABASE??'eatofine', as=process.env.MONGO_AUTH_SOURCE??'admin';
const ps=new URLSearchParams({ssl:'true',authSource:as,retryWrites:'true',w:'majority'}); if(rs) ps.set('replicaSet',rs);
const uri=`mongodb://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}/${db}?${ps}`;
const client=new MongoClient(uri,{serverSelectionTimeoutMS:15000});

try {
  await client.connect();
  const d = client.db(db);
  const r = await d.collection('restaurants').findOne({ mysql_vendor_id: 1 });
  console.log('restaurant_id =', r?.mysql_id);
  const w = await d.collection('restaurant_wallets').findOne({ $or: [{ mysql_restaurant_id: r?.mysql_id }, { restaurant_id: r?.mysql_id }, { mysql_vendor_id: 1 }] });
  console.log('\nWALLET RECORD:', w ? JSON.stringify(w, null, 2) : '❌ NOT FOUND');

  // Sample order details
  const orders = await d.collection('orders').find({ mysql_restaurant_id: r?.mysql_id }).limit(2).toArray();
  console.log('\n=== ORDER DATE FIELDS ===');
  for (const o of orders) {
    console.log(`\nOrder #${o.mysql_id}:`);
    Object.entries(o).forEach(([k, v]) => {
      if (k.includes('at') || k.includes('date') || k.includes('time')) {
        console.log(`  ${k}:`, JSON.stringify(v), `(${typeof v})`);
      }
    });
  }
} finally { await client.close(); }
