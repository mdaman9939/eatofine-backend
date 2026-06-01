/**
 * Update vendor #1's wallet with realistic demo numbers.
 * Existing record has total_earning=0 (Decimal128 zero) — replace with plain numbers.
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const u=process.env.MONGO_USER,p=process.env.MONGO_PASSWORD,h=process.env.MONGO_HOSTS,rs=process.env.MONGO_REPLICA_SET,dbn=process.env.MONGO_DATABASE??'eatofine',as=process.env.MONGO_AUTH_SOURCE??'admin';
const ps=new URLSearchParams({ssl:'true',authSource:as,retryWrites:'true',w:'majority'});if(rs)ps.set('replicaSet',rs);
const uri=`mongodb://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}/${dbn}?${ps}`;
const client=new MongoClient(uri,{serverSelectionTimeoutMS:15000});

try {
  await client.connect();
  const db=client.db(dbn);

  const result = await db.collection('restaurant_wallets').updateOne(
    { vendor_id: 1 },
    { $set: {
      total_earning: 5827.50,
      balance: 4627.50,
      collected_cash: 2150.00,
      total_withdrawn: 1200.00,
      pending_withdraw: 0,
      total_commission_given: 583.00,
      total_tax_given: 415.50,
      total_delivery_charge_earned: 245.00,
      updated_at: new Date(),
    } },
  );
  console.log('matched:', result.matchedCount, 'modified:', result.modifiedCount);

  // Verify
  const w = await db.collection('restaurant_wallets').findOne({ vendor_id: 1 });
  console.log('AFTER UPDATE:', { total_earning: w?.total_earning, balance: w?.balance, collected_cash: w?.collected_cash });
} finally { await client.close(); }
