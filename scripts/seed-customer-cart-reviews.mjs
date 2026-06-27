/**
 * Demo data for the CUSTOMER app's empty screens:
 *  1) My Cart  — seeds a few real food items into `carts` for the logged-in
 *     customer (default user #1, the one the demo orders belong to). Items are
 *     from ONE restaurant (StackFood carts are single-restaurant). The app's
 *     getCartDataOnline() (fires on login + cart open) will show them.
 *  2) Reviews  — adds a review on a subset of that user's delivered demo orders
 *     (food rating + comment) so products show reviews and those orders read as
 *     "reviewed". Plenty of demo orders are left un-reviewed to still test the flow.
 *
 * Tagged `seed_demo: true`. Idempotent. Undo: REMOVE=1 node ...
 * Override the customer: USER_ID=NN node ...
 */
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });
const u = process.env.MONGO_USER, p = process.env.MONGO_PASSWORD, h = process.env.MONGO_HOSTS, rs = process.env.MONGO_REPLICA_SET, dbn = process.env.MONGO_DATABASE ?? 'eatofine', as = process.env.MONGO_AUTH_SOURCE ?? 'admin';
const psp = new URLSearchParams({ ssl: 'true', authSource: as, retryWrites: 'true', w: 'majority' }); if (rs) psp.set('replicaSet', rs);
const client = new MongoClient(`mongodb://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}/${dbn}?${psp}`, { serverSelectionTimeoutMS: 15000 });
const REMOVE = process.env.REMOVE === '1';
const USER_ID = Number(process.env.USER_ID || 1);
const toN = (v) => { if (v == null) return 0; if (typeof v === 'number') return v; const n = parseFloat(String(v?.toString?.() ?? v)); return Number.isFinite(n) ? n : 0; };

const COMMENTS = [
  { rating: 5, comment: 'Absolutely delicious, will order again!' },
  { rating: 4, comment: 'Tasty and fresh, arrived hot.' },
  { rating: 5, comment: 'Great portion size and flavour.' },
  { rating: 4, comment: 'Good food, packaging was neat.' },
  { rating: 5, comment: 'Loved it — highly recommended.' },
  { rating: 3, comment: 'Decent, but could be a bit spicier.' },
];

try {
  await client.connect();
  const db = client.db(dbn);
  const nextId = async (coll) => { const t = await db.collection(coll).find({}, { projection: { mysql_id: 1 } }).sort({ mysql_id: -1 }).limit(1).toArray(); let n = (Number(t[0]?.mysql_id) || 0) + 1; return () => n++; };

  // ── Always clear our previous demo first (idempotent / REMOVE) ──
  const delCart = await db.collection('carts').deleteMany({ user_id: USER_ID, seed_demo: true });
  const delRev = await db.collection('reviews').deleteMany({ user_id: USER_ID, seed_demo: true });
  console.log(`Cleared previous demo → cart: ${delCart.deletedCount}, reviews: ${delRev.deletedCount}`);

  if (REMOVE) {
    console.log('\n✅ Demo cart + reviews removed.');
  } else {
    // ── 1) CART — 3 foods from a SINGLE active restaurant (StackFood carts are
    // single-restaurant). Pick the restaurant with the most active non-test foods,
    // then take 3 DISTINCT food ids from it. ──
    const matchFood = { status: { $in: [1, true] }, mysql_restaurant_id: { $ne: null }, name: { $not: { $regex: 'test|dummy|demo|sample', $options: 'i' } } };
    const grp = await db.collection('foods').aggregate([
      { $match: matchFood }, { $group: { _id: '$mysql_restaurant_id', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 1 },
    ]).toArray();
    const cartRest = grp[0]?._id ?? null;
    const raw = await db.collection('foods').find(
      { ...matchFood, mysql_restaurant_id: cartRest },
      { projection: { mysql_id: 1, name: 1, price: 1, mysql_restaurant_id: 1 } },
    ).toArray();
    const seenFood = new Set();
    const chosen = [];
    for (const f of raw) { const id = Number(f.mysql_id); if (!id || seenFood.has(id)) continue; seenFood.add(id); chosen.push(f); if (chosen.length === 3) break; }
    console.log(`  cart restaurant: #${cartRest} (${raw.length} foods)`);

    const cId = await nextId('carts');
    const now = new Date();
    let nCart = 0;
    for (let i = 0; i < chosen.length; i++) {
      const f = chosen[i];
      await db.collection('carts').insertOne({
        mysql_id: cId(), user_id: USER_ID, item_id: Number(f.mysql_id), is_guest: false, item_type: 'Food',
        price: String(toN(f.price) || 100), quantity: i + 1, variations: '[]', variation_options: '[]',
        add_on_ids: '[]', add_on_qtys: '[]', created_at: now, updated_at: now, seed_demo: true,
      });
      nCart++;
      console.log(`  cart + ${f.name ?? `food#${f.mysql_id}`} ×${i + 1} (₹${toN(f.price)})`);
    }

    // ── 2) REVIEWS — on a subset of this user's delivered demo orders ──
    const orders = await db.collection('orders').find(
      { mysql_user_id: USER_ID, order_status: 'delivered' },
      { projection: { mysql_id: 1, mysql_restaurant_id: 1, restaurant_id: 1 } },
    ).sort({ mysql_id: -1 }).limit(15).toArray();
    const rId = await nextId('reviews');
    let nRev = 0;
    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      const od = await db.collection('order_details').findOne({ order_id: o.mysql_id });
      if (!od || od.food_id == null) continue;
      const cm = COMMENTS[i % COMMENTS.length];
      await db.collection('reviews').insertOne({
        mysql_id: rId(), food_id: Number(od.food_id), restaurant_id: Number(o.mysql_restaurant_id ?? o.restaurant_id ?? 0) || null,
        user_id: USER_ID, order_id: Number(o.mysql_id), mysql_order_id: Number(o.mysql_id),
        rating: cm.rating, comment: cm.comment, attachment: '[]', reply: null, reply_at: null,
        item_campaign_id: null, status: 1, created_at: now, updated_at: now, seed_demo: true,
      });
      nRev++;
    }
    console.log(`\n✅ Seeded cart: ${nCart} item(s) for user #${USER_ID} | reviews: ${nRev}`);
    console.log('   My Cart will show items after the app re-fetches (login / open cart). Reviews show on products + those orders read as reviewed.');
    console.log('   Undo:  REMOVE=1 node scripts/seed-customer-cart-reviews.mjs');
  }
} catch (e) { console.error('ERROR:', e?.message ?? e); process.exitCode = 1; } finally { await client.close(); }
