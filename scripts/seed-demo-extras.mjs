/**
 * Seed DEMO data for admin pages that are otherwise empty, so the platform can
 * be demoed end-to-end. Every record is tagged `demo_seed: true` and uses
 * `.test` emails / "Demo" names, so it is easy to find and clean later.
 *
 * IDEMPOTENT: re-running skips any collection that already has demo records.
 * Run:  node scripts/seed-demo-extras.mjs
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const u = process.env.MONGO_USER, p = process.env.MONGO_PASSWORD, h = process.env.MONGO_HOSTS,
  rs = process.env.MONGO_REPLICA_SET, dbn = process.env.MONGO_DATABASE ?? 'eatofine',
  as = process.env.MONGO_AUTH_SOURCE ?? 'admin';
const ps = new URLSearchParams({ ssl: 'true', authSource: as, retryWrites: 'true', w: 'majority' });
if (rs) ps.set('replicaSet', rs);
const client = new MongoClient(`mongodb://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}/${dbn}?${ps}`, { serverSelectionTimeoutMS: 20000 });

const now = new Date();
const inDays = (n) => new Date(Date.now() + n * 86400000);

try {
  await client.connect();
  const db = client.db(dbn);

  const nextId = async (coll) => {
    const t = await db.collection(coll).find({}, { projection: { mysql_id: 1 }, sort: { mysql_id: -1 }, limit: 1 }).toArray();
    return (t[0]?.mysql_id ? Number(t[0].mysql_id) : 0) + 1;
  };
  const seed = async (coll, docs) => {
    const have = await db.collection(coll).countDocuments({ demo_seed: true });
    if (have > 0) { console.log(`• ${coll}: already has ${have} demo record(s) — skipped`); return; }
    let id = await nextId(coll);
    const rows = docs.map((d, i) => ({ mysql_id: id + i, ...d, demo_seed: true, created_at: now, updated_at: now }));
    await db.collection(coll).insertMany(rows);
    console.log(`✓ ${coll}: inserted ${rows.length} demo record(s) (ids ${id}..${id + rows.length - 1})`);
  };

  // ── Attributes (Foods → Attributes & Tags → Attributes) ──────────────
  await seed('attributes', [
    { name: 'Spicy' }, { name: 'Vegan' }, { name: 'Gluten-Free' }, { name: 'Bestseller' }, { name: 'New Arrival' },
  ]);

  // ── Cashback offers (Rewards → Cashback) ─────────────────────────────
  await seed('cash_backs', [
    { title: 'Festive Cashback', customer_id: ['all'], cashback_type: 'percentage', cashback_amount: 10, min_purchase: 299, max_discount: 100, start_date: now, end_date: inDays(30), limit: 1, status: true },
    { title: 'Flat ₹50 Back', customer_id: ['all'], cashback_type: 'amount', cashback_amount: 50, min_purchase: 499, max_discount: 50, start_date: now, end_date: inDays(45), limit: 2, status: true },
    { title: 'Weekend Treat', customer_id: ['all'], cashback_type: 'percentage', cashback_amount: 15, min_purchase: 199, max_discount: 75, start_date: now, end_date: inDays(15), limit: 1, status: false },
  ]);

  // ── Employees (Staff → Employees) — stored in `admins`, role_id != 1 ──
  await seed('admins', [
    { f_name: 'Riya', l_name: 'Sharma', email: 'riya.demo@eatofine.test', phone: '+919900000001', role_id: 2, zone_id: 1, status: true },
    { f_name: 'Karan', l_name: 'Mehta', email: 'karan.demo@eatofine.test', phone: '+919900000002', role_id: 2, zone_id: 1, status: true },
    { f_name: 'Neha', l_name: 'Gupta', email: 'neha.demo@eatofine.test', phone: '+919900000003', role_id: 3, zone_id: 1, status: true },
  ]);

  // ── Pending delivery-man applications (Delivery Men → Joining Requests) ─
  await seed('delivery_men', [
    { f_name: 'Demo', l_name: 'Rider A', email: 'rider.a.demo@eatofine.test', phone: '+919800000001', application_status: 'pending', status: false, active: false, mysql_zone_id: 1, identity_type: 'driving_license', identity_number: 'DL-DEMO-001' },
    { f_name: 'Demo', l_name: 'Rider B', email: 'rider.b.demo@eatofine.test', phone: '+919800000002', application_status: 'pending', status: false, active: false, mysql_zone_id: 1, identity_type: 'passport', identity_number: 'PP-DEMO-002' },
    { f_name: 'Demo', l_name: 'Rider C', email: 'rider.c.demo@eatofine.test', phone: '+919800000003', application_status: 'pending', status: false, active: false, mysql_zone_id: 1, identity_type: 'nid', identity_number: 'NID-DEMO-003' },
  ]);

  console.log('\nDone. Demo data is tagged { demo_seed: true } and can be removed later.');
} catch (e) {
  console.log('ERROR:', e.message);
} finally {
  await client.close();
}
