/**
 * Seed DEMO data for the DM reward flow so the admin Reports pages aren't empty:
 *   • Reports → Delivery Men Withdrawal Request  ← dm_reward_claims
 *   • Reports → DM Disbursement                  ← approved claims + tips
 *
 * Everything is tagged `seed_demo: true` and the script is idempotent: it wipes
 * its OWN previous demo rows first, then re-inserts. It NEVER touches real data.
 *
 * Remove later (Mongo shell):
 *   db.dm_reward_claims.deleteMany({ seed_demo: true })
 *   db.dm_wallet_transactions.deleteMany({ seed_demo: true, type: 'tip' })
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const u = process.env.MONGO_USER, p = process.env.MONGO_PASSWORD, h = process.env.MONGO_HOSTS,
  rs = process.env.MONGO_REPLICA_SET, dbn = process.env.MONGO_DATABASE ?? 'eatofine',
  as = process.env.MONGO_AUTH_SOURCE ?? 'admin';
const ps = new URLSearchParams({ ssl: 'true', authSource: as, retryWrites: 'true', w: 'majority' });
if (rs) ps.set('replicaSet', rs);
const uri = `mongodb://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}/${dbn}?${ps}`;
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });

const hoursAgo = (n) => new Date(Date.now() - n * 3600 * 1000);
const daysAgo = (n) => new Date(Date.now() - n * 24 * 3600 * 1000);

try {
  await client.connect();
  const db = client.db(dbn);

  // 1) Wipe our own previous demo rows so re-runs don't pile up.
  const dc = await db.collection('dm_reward_claims').deleteMany({ seed_demo: true });
  const dt = await db.collection('dm_wallet_transactions').deleteMany({ seed_demo: true, type: 'tip' });
  console.log(`Cleared previous demo → ${dc.deletedCount} claims, ${dt.deletedCount} tips`);

  // 2) Use up to 3 REAL riders (so names + tip-name resolution look real); else fabricate.
  const realRiders = await db.collection('delivery_men')
    .find({}, { projection: { mysql_id: 1, f_name: 1, l_name: 1 } }).limit(3).toArray();
  const R = realRiders.length
    ? realRiders.map((r) => ({ id: Number(r.mysql_id), name: [r.f_name, r.l_name].filter(Boolean).join(' ') || `Rider #${r.mysql_id}` }))
    : [{ id: 9001, name: 'Rahul Verma' }, { id: 9002, name: 'Amit Singh' }, { id: 9003, name: 'Suresh Kumar' }];
  while (R.length < 3) R.push({ id: 9000 + R.length + 1, name: `Demo Rider ${R.length + 1}` });
  console.log(`Riders: ${R.map((x) => `${x.name}(#${x.id})`).join(', ')}`);

  // 3) Sequential mysql_id helper per collection.
  const nextIdFn = async (coll) => {
    const top = await db.collection(coll).find({}, { projection: { mysql_id: 1 } }).sort({ mysql_id: -1 }).limit(1).toArray();
    let n = (Number(top[0]?.mysql_id) || 0) + 1;
    return () => n++;
  };
  const claimId = await nextIdFn('dm_reward_claims');
  const txnId = await nextIdFn('dm_wallet_transactions');

  // 4) Reward claims — mix of pending / approved / rejected, bonus + incentive.
  const claims = [
    { dm: R[0], name: 'Weekly 20 orders → ₹200', type: 'bonus', period: 'weekly', threshold: 20, deliveries: 22, amount: 200, status: 'pending', requested: hoursAgo(2) },
    { dm: R[1], name: 'Daily 10 orders → ₹100', type: 'incentive', period: 'daily', threshold: 10, deliveries: 12, amount: 100, status: 'pending', requested: hoursAgo(5) },
    { dm: R[2], name: 'Monthly 200 orders → ₹1000', type: 'bonus', period: 'monthly', threshold: 200, deliveries: 205, amount: 1000, status: 'approved', requested: daysAgo(2), decided: daysAgo(1) },
    { dm: R[0], name: 'Weekend warrior → ₹150', type: 'bonus', period: 'weekly', threshold: 15, deliveries: 18, amount: 150, status: 'approved', requested: daysAgo(3), decided: daysAgo(3) },
    { dm: R[1], name: 'Festival push → ₹300', type: 'incentive', period: 'weekly', threshold: 30, deliveries: 25, amount: 300, status: 'rejected', reason: 'Target not met on review', requested: daysAgo(1), decided: hoursAgo(12) },
  ];
  let bid = 9100;
  const claimDocs = claims.map((c, i) => ({
    mysql_id: claimId(),
    dm_id: c.dm.id, dm_name: c.dm.name,
    bonus_id: bid++, bonus_name: c.name, type: c.type,
    period: c.period, period_key: `${c.period}:demo-${i}`,
    threshold: c.threshold, deliveries: c.deliveries, amount: c.amount,
    status: c.status, reason: c.reason ?? null,
    requested_at: c.requested,
    decided_at: c.decided ?? null,
    credited_at: c.status === 'approved' ? (c.decided ?? null) : null,
    created_at: c.requested, updated_at: c.decided ?? c.requested,
    seed_demo: true,
  }));
  await db.collection('dm_reward_claims').insertMany(claimDocs);
  console.log(`Inserted ${claimDocs.length} reward claims (2 pending, 2 approved, 1 rejected)`);

  // 5) Customer tips → dm_wallet_transactions (type 'tip') for the disbursement report.
  const tips = [
    { dm: R[0], amount: 25, order: 100101, at: hoursAgo(6) },
    { dm: R[1], amount: 40, order: 100102, at: daysAgo(1) },
    { dm: R[2], amount: 15, order: 100103, at: daysAgo(2) },
  ];
  const tipDocs = tips.map((t) => ({
    mysql_id: txnId(),
    delivery_man_id: t.dm.id, mysql_delivery_man_id: t.dm.id,
    credit: t.amount, debit: 0, type: 'tip', reference: `tip#order:${t.order}`,
    order_id: t.order, created_at: t.at, seed_demo: true,
  }));
  await db.collection('dm_wallet_transactions').insertMany(tipDocs);
  console.log(`Inserted ${tipDocs.length} customer tips`);

  console.log('\n✅ Demo data ready:');
  console.log('   • Withdrawal Request page → 5 claims (2 pending you can Approve/Reject)');
  console.log('   • DM Disbursement page    → 2 approved rewards + 3 tips, with timestamps');
} catch (e) {
  console.error('ERROR:', e?.message ?? e);
  process.exitCode = 1;
} finally {
  await client.close();
}
