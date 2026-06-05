/**
 * Seed wallet_payments + account_transactions for vendor #1 (Demo Restaurant)
 * so the Payment History screen shows real data instead of "No transaction yet!"
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const u=process.env.MONGO_USER,p=process.env.MONGO_PASSWORD,h=process.env.MONGO_HOSTS,rs=process.env.MONGO_REPLICA_SET,dbn=process.env.MONGO_DATABASE??'eatofine',as=process.env.MONGO_AUTH_SOURCE??'admin';
const ps=new URLSearchParams({ssl:'true',authSource:as,retryWrites:'true',w:'majority'});if(rs)ps.set('replicaSet',rs);
const uri=`mongodb://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}/${dbn}?${ps}`;
const client=new MongoClient(uri,{serverSelectionTimeoutMS:15000});

const daysAgo = (n) => new Date(Date.now() - n * 86_400_000);

try {
  await client.connect();
  const db = client.db(dbn);

  const VENDOR_ID = 1;
  const RESTAURANT_ID = 1;

  const existing = await db.collection('wallet_payments').countDocuments({
    $or: [{ vendor_id: VENDOR_ID }, { mysql_vendor_id: VENDOR_ID }],
  });
  console.log(`Existing wallet_payments for vendor #${VENDOR_ID}: ${existing}`);

  if (existing >= 5) {
    console.log('Already seeded. Skipping.');
    process.exit(0);
  }

  const last = await db.collection('wallet_payments').find({}).sort({ mysql_id: -1 }).limit(1).toArray();
  let nextId = (last[0]?.mysql_id ?? 0) + 1;

  const PAYMENTS = [
    { hoursAgo: 5,   amount: 615.00, method: 'cash_collected',    type: 'credit', note: 'Cash collected for order #196' },
    { hoursAgo: 28,  amount: 720.50, method: 'wallet_credit',     type: 'credit', note: 'Order delivered #195' },
    { hoursAgo: 50,  amount: 1240.00,method: 'wallet_credit',     type: 'credit', note: 'Order delivered #194' },
    { hoursAgo: 96,  amount: 200.00, method: 'commission_debit',  type: 'debit',  note: 'Platform commission - week' },
    { hoursAgo: 168, amount: 895.00, method: 'wallet_credit',     type: 'credit', note: 'Order delivered #193' },
    { hoursAgo: 240, amount: 1200.00,method: 'manual_withdraw',   type: 'debit',  note: 'Withdraw to bank account' },
    { hoursAgo: 312, amount: 485.00, method: 'wallet_credit',     type: 'credit', note: 'Order delivered #192' },
  ];

  let added = 0;
  for (const p of PAYMENTS) {
    const createdAt = new Date(Date.now() - p.hoursAgo * 3600_000);
    await db.collection('wallet_payments').insertOne({
      mysql_id: nextId++,
      vendor_id: VENDOR_ID,
      mysql_vendor_id: VENDOR_ID,
      restaurant_id: RESTAURANT_ID,
      mysql_restaurant_id: RESTAURANT_ID,
      amount: p.amount,
      transaction_id: `TXN-${nextId}-${Date.now().toString(36).slice(-6).toUpperCase()}`,
      payment_method: p.method,
      type: p.type,
      paid_amount: p.amount,
      note: p.note,
      status: 'completed',
      created_at: createdAt,
      updated_at: createdAt,
    });
    added++;

    // Also write to account_transactions (vendor app reads from either)
    await db.collection('account_transactions').insertOne({
      mysql_id: await db.collection('account_transactions').estimatedDocumentCount() + added + 1000,
      from_user_id: p.type === 'credit' ? null : VENDOR_ID,
      to_user_id: p.type === 'credit' ? VENDOR_ID : null,
      from_user_type: p.type === 'credit' ? 'admin' : 'vendor',
      to_user_type: p.type === 'credit' ? 'vendor' : 'admin',
      mysql_vendor_id: VENDOR_ID,
      restaurant_id: RESTAURANT_ID,
      amount: p.amount,
      transaction_type: p.method,
      paid_by: p.method === 'cash_collected' ? 'customer' : 'system',
      note: p.note,
      created_at: createdAt,
      updated_at: createdAt,
    });
  }
  console.log(`✓ Added ${added} wallet_payments + ${added} account_transactions`);

  const total = await db.collection('wallet_payments').countDocuments({ mysql_vendor_id: VENDOR_ID });
  console.log(`Total wallet_payments for vendor #${VENDOR_ID} now: ${total}`);
} catch (err) {
  console.error('❌', err.message);
  process.exit(1);
} finally { await client.close(); }
