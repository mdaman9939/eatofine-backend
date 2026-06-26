/** READ-ONLY: inspect a delivery-man's wallet + order-derived earning to see why
 *  the rider app shows 0. Phone from arg or defaults to Karthika's. */
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });
const u = process.env.MONGO_USER, p = process.env.MONGO_PASSWORD, h = process.env.MONGO_HOSTS, rs = process.env.MONGO_REPLICA_SET, dbn = process.env.MONGO_DATABASE ?? 'eatofine', as = process.env.MONGO_AUTH_SOURCE ?? 'admin';
const ps = new URLSearchParams({ ssl: 'true', authSource: as, retryWrites: 'true', w: 'majority' }); if (rs) ps.set('replicaSet', rs);
const client = new MongoClient(`mongodb://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}/${dbn}?${ps}`, { serverSelectionTimeoutMS: 15000 });
const toNum = (v) => { if (v == null) return 0; if (typeof v === 'number') return v; const n = parseFloat(String(v?.toString?.() ?? v)); return Number.isFinite(n) ? n : 0; };

try {
  await client.connect();
  const db = client.db(dbn);
  const phoneFrag = (process.argv[2] ?? '9784451912').replace(/\D/g, '').slice(-10);
  const dms = await db.collection('delivery_men').find({ phone: { $regex: phoneFrag } }, { projection: { mysql_id: 1, f_name: 1, l_name: 1, phone: 1, type: 1 } }).toArray();
  console.log(`delivery_men matching ...${phoneFrag}: ${dms.length}`);
  for (const d of dms) {
    const id = Number(d.mysql_id);
    console.log(`\nDM #${id} ${d.f_name ?? ''} ${d.l_name ?? ''} (${d.phone}) type=${d.type ?? '—'}`);
    const w = await db.collection('delivery_man_wallets').findOne({ $or: [{ mysql_delivery_man_id: id }, { delivery_man_id: id }] });
    console.log('  wallet:', w ? JSON.stringify({ balance: toNum(w.balance), total_earning: toNum(w.total_earning), collected_cash: toNum(w.collected_cash), total_withdrawn: toNum(w.total_withdrawn), pending_withdraw: toNum(w.pending_withdraw) }) : 'NONE');
    const orders = await db.collection('orders').find({ mysql_delivery_man_id: id }).toArray();
    let delivered = 0, earn = 0;
    for (const o of orders) { if (o.order_status === 'delivered') { delivered++; earn += toNum(o.delivery_charge) + toNum(o.dm_tips); } }
    console.log(`  orders: ${orders.length} total, ${delivered} delivered, order-derived earning ₹${Math.round(earn * 100) / 100}`);
  }
} catch (e) { console.error('ERROR:', e?.message ?? e); process.exitCode = 1; } finally { await client.close(); }
