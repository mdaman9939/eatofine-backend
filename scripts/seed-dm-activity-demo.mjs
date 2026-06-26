/**
 * Demo rider activity so the delivery app's Earning Report + Transaction History
 * aren't empty: for every rider with a wallet, create a few DELIVERED orders
 * (delivery fee + tips) and matching dm_wallet_transactions, then set the wallet
 * balance = Σ(transactions) so My Account / Earning Report / history all agree.
 * Tagged `seed_activity: true`. Idempotent. Undo: REMOVE=1 node ...
 */
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });
const u = process.env.MONGO_USER, p = process.env.MONGO_PASSWORD, h = process.env.MONGO_HOSTS, rs = process.env.MONGO_REPLICA_SET, dbn = process.env.MONGO_DATABASE ?? 'eatofine', as = process.env.MONGO_AUTH_SOURCE ?? 'admin';
const psp = new URLSearchParams({ ssl: 'true', authSource: as, retryWrites: 'true', w: 'majority' }); if (rs) psp.set('replicaSet', rs);
const client = new MongoClient(`mongodb://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}/${dbn}?${psp}`, { serverSelectionTimeoutMS: 15000 });
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const REMOVE = process.env.REMOVE === '1';
const DAY = 86_400_000;

try {
  await client.connect();
  const db = client.db(dbn);
  const nextId = async (coll) => { const t = await db.collection(coll).find({}, { projection: { mysql_id: 1 } }).sort({ mysql_id: -1 }).limit(1).toArray(); let n = (Number(t[0]?.mysql_id) || 0) + 1; return () => n++; };

  const wallets = await db.collection('delivery_man_wallets').find({}, { projection: { mysql_delivery_man_id: 1, delivery_man_id: 1 } }).toArray();
  const riders = [...new Set(wallets.map((w) => Number(w.mysql_delivery_man_id ?? w.delivery_man_id ?? 0)).filter((x) => x > 0))];
  const rest = await db.collection('restaurants').findOne({}, { projection: { mysql_id: 1 } });
  const usr = await db.collection('users').findOne({}, { projection: { mysql_id: 1 } });
  const restId = Number(rest?.mysql_id ?? 0) || null, userId = Number(usr?.mysql_id ?? 0) || null;

  const oId = await nextId('orders');
  const tId = await nextId('dm_wallet_transactions');
  const N = 5;
  let nOrders = 0, nTxns = 0;

  for (const dmId of riders) {
    // wipe our own previous activity for this rider (idempotent / REMOVE).
    await db.collection('orders').deleteMany({ mysql_delivery_man_id: dmId, seed_activity: true });
    await db.collection('dm_wallet_transactions').deleteMany({ mysql_delivery_man_id: dmId, seed_activity: true });

    if (!REMOVE) {
      for (let i = 0; i < N; i++) {
        const dc = 50 + i * 5;                      // 50,55,60,65,70
        const tip = [25, 0, 20, 0, 30][i] ?? 0;
        const ts = new Date(Date.now() - i * DAY - i * 3_600_000);
        const orderId = oId();
        await db.collection('orders').insertOne({
          mysql_id: orderId, mysql_user_id: userId, mysql_restaurant_id: restId, mysql_delivery_man_id: dmId,
          order_amount: r2(220 + i * 40), delivery_charge: dc, dm_tips: tip, total_tax_amount: 0,
          order_status: 'delivered', payment_method: 'cash_on_delivery', payment_status: 'paid', order_type: 'delivery',
          created_at: ts, delivered: ts, seed_activity: true,
        });
        nOrders++;
        await db.collection('dm_wallet_transactions').insertOne({ mysql_id: tId(), mysql_delivery_man_id: dmId, delivery_man_id: dmId, credit: dc, debit: 0, type: 'delivery_fee', reference: `delivery#order:${orderId}`, order_id: orderId, created_at: ts, seed_activity: true });
        nTxns++;
        if (tip > 0) { await db.collection('dm_wallet_transactions').insertOne({ mysql_id: tId(), mysql_delivery_man_id: dmId, delivery_man_id: dmId, credit: tip, debit: 0, type: 'tip', reference: `tip#order:${orderId}`, order_id: orderId, created_at: ts, seed_activity: true }); nTxns++; }
      }
    }

    // balance = Σ(all the rider's wallet transactions credit − debit).
    const agg = await db.collection('dm_wallet_transactions').aggregate([
      { $match: { $or: [{ mysql_delivery_man_id: dmId }, { delivery_man_id: dmId }] } },
      { $group: { _id: null, c: { $sum: { $ifNull: ['$credit', 0] } }, d: { $sum: { $ifNull: ['$debit', 0] } } } },
    ]).toArray();
    const bal = r2((agg[0]?.c ?? 0) - (agg[0]?.d ?? 0));
    await db.collection('delivery_man_wallets').updateOne(
      { $or: [{ mysql_delivery_man_id: dmId }, { delivery_man_id: dmId }] },
      { $set: { balance: bal, total_earning: bal, updated_at: new Date() }, $unset: { seed_demo_amount: '' } },
    );
  }

  console.log(`${REMOVE ? 'Removed activity for' : 'Seeded activity for'} ${riders.length} riders | orders: ${nOrders} | wallet txns: ${nTxns}`);
  console.log(REMOVE ? '\n✅ Demo rider activity removed; balances recomputed from remaining transactions.' : '\n✅ Earning Report + Transaction History + balance now populated (all derived from these orders/txns).');
  if (!REMOVE) console.log('   Undo:  REMOVE=1 node scripts/seed-dm-activity-demo.mjs');
} catch (e) { console.error('ERROR:', e?.message ?? e); process.exitCode = 1; } finally { await client.close(); }
