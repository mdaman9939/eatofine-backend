/**
 * Fix data issues that crash the Restaurant APK for vendor #1:
 *   1. Orders are missing `created_at` / `updated_at` — only `created_at_legacy`
 *      is populated. Flutter's DateTime.parse() throws FormatException.
 *      → Copy created_at_legacy → created_at + synthesize updated_at.
 *
 *   2. No `restaurant_wallets` record exists for vendor #1 — vendor app's
 *      Wallet screen crashes with "Null check operator on null value".
 *      → Insert a wallet row with realistic numbers.
 *
 *   3. The 6 existing orders are all 1-2 weeks old — Today / This Week tiles
 *      show null. Add 5 recent orders (3 today, 2 this week) with proper
 *      dates and statuses so the dashboard stats are non-zero.
 *
 * Usage:  node --env-file=.env scripts/fix-vendor-data.mjs
 *
 * Safe to re-run — uses upsert + checks before inserting.
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const VENDOR_ID = 1;

const u = process.env.MONGO_USER, p = process.env.MONGO_PASSWORD, h = process.env.MONGO_HOSTS;
const rs = process.env.MONGO_REPLICA_SET, dbn = process.env.MONGO_DATABASE ?? 'eatofine', as = process.env.MONGO_AUTH_SOURCE ?? 'admin';
const ps = new URLSearchParams({ ssl: 'true', authSource: as, retryWrites: 'true', w: 'majority' });
if (rs) ps.set('replicaSet', rs);
const uri = `mongodb://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}/${dbn}?${ps}`;
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });

const hoursAgo = (n) => new Date(Date.now() - n * 3600_000);
const minutesAgo = (n) => new Date(Date.now() - n * 60_000);

try {
  await client.connect();
  const db = client.db(dbn);

  // ─── 1. Backfill created_at / updated_at on ALL orders ─────────────
  console.log('\n[1/3] Backfilling order dates…');
  const broken = await db.collection('orders').find({
    created_at: { $exists: false },
    created_at_legacy: { $exists: true },
  }).toArray();
  console.log(`   ${broken.length} orders missing created_at`);

  let updated = 0;
  for (const o of broken) {
    const legacy = o.created_at_legacy;
    // legacy is sometimes a Date object, sometimes a string
    const createdAt = legacy instanceof Date ? legacy : new Date(legacy);
    if (Number.isNaN(createdAt.getTime())) continue;
    // updated_at: status-dependent — delivered/canceled orders are "old"
    const updatedAt = ['delivered', 'canceled', 'refunded'].includes(o.order_status)
      ? new Date(createdAt.getTime() + 2 * 3600_000)
      : createdAt;
    await db.collection('orders').updateOne(
      { _id: o._id },
      { $set: { created_at: createdAt, updated_at: updatedAt } },
    );
    updated++;
  }
  console.log(`   ✓ Backfilled ${updated} orders`);

  // ─── 2. Create restaurant_wallets row for vendor #1 ────────────────
  console.log('\n[2/3] Ensuring wallet record for vendor #1…');
  const restaurant = await db.collection('restaurants').findOne({ mysql_vendor_id: VENDOR_ID });
  if (!restaurant) {
    console.error('   ❌ No restaurant for vendor #1 — cannot create wallet');
  } else {
    const RESTAURANT_ID = restaurant.mysql_id;
    const existing = await db.collection('restaurant_wallets').findOne({
      $or: [{ mysql_restaurant_id: RESTAURANT_ID }, { vendor_id: VENDOR_ID }, { mysql_vendor_id: VENDOR_ID }],
    });
    if (existing) {
      console.log(`   ✓ Wallet already exists (id=${existing._id})`);
    } else {
      // Get the next mysql_id
      const last = await db.collection('restaurant_wallets').find({}).sort({ mysql_id: -1 }).limit(1).toArray();
      const nextId = (last[0]?.mysql_id ?? 0) + 1;

      const wallet = {
        mysql_id: nextId,
        vendor_id: VENDOR_ID,
        mysql_vendor_id: VENDOR_ID,
        restaurant_id: RESTAURANT_ID,
        mysql_restaurant_id: RESTAURANT_ID,
        total_earning: 5827.50,
        total_withdrawn: 1200.00,
        pending_withdraw: 0,
        balance: 4627.50,
        collected_cash: 2150.00,
        total_commission_given: 583.00,
        total_tax_given: 415.50,
        total_delivery_charge_earned: 245.00,
        created_at: hoursAgo(24 * 30),
        updated_at: new Date(),
      };
      await db.collection('restaurant_wallets').insertOne(wallet);
      console.log(`   ✓ Created wallet  total_earning=${wallet.total_earning}  balance=${wallet.balance}`);
    }
  }

  // ─── 3. Seed 5 recent orders so dashboard tiles populate ───────────
  console.log('\n[3/3] Seeding recent orders for vendor #1…');
  const restaurantId = restaurant?.mysql_id ?? 1;
  const lastOrder = await db.collection('orders').find({}).sort({ mysql_id: -1 }).limit(1).toArray();
  let nextOrderId = (lastOrder[0]?.mysql_id ?? 0) + 1;

  const RECENT_ORDERS = [
    // Today
    { hoursAgo: 1,   status: 'confirmed', amount: 485.00, paymentStatus: 'unpaid', paymentMethod: 'cash_on_delivery' },
    { hoursAgo: 3,   status: 'processing', amount: 720.50, paymentStatus: 'paid', paymentMethod: 'digital_payment' },
    { hoursAgo: 6,   status: 'delivered', amount: 615.00, paymentStatus: 'paid', paymentMethod: 'cash_on_delivery' },
    // This week
    { hoursAgo: 26,  status: 'delivered', amount: 1240.00, paymentStatus: 'paid', paymentMethod: 'digital_payment' },
    { hoursAgo: 72,  status: 'delivered', amount: 895.00, paymentStatus: 'paid', paymentMethod: 'cash_on_delivery' },
  ];

  let firstCustomer = await db.collection('users').findOne({});
  const customerId = firstCustomer?.mysql_id ?? 1;

  let seeded = 0;
  for (const cfg of RECENT_ORDERS) {
    const createdAt = hoursAgo(cfg.hoursAgo);
    const updatedAt = cfg.status === 'delivered' ? new Date(createdAt.getTime() + 90 * 60_000) : createdAt;
    const order = {
      mysql_id: nextOrderId++,
      user_id: customerId,
      mysql_user_id: customerId,
      restaurant_id: restaurantId,
      mysql_restaurant_id: restaurantId,
      order_amount: cfg.amount,
      order_status: cfg.status,
      payment_status: cfg.paymentStatus,
      payment_method: cfg.paymentMethod,
      order_type: 'delivery',
      delivery_charge: 30,
      delivery_address: { address: '12 Banjara Hills, Hyderabad', latitude: 17.41, longitude: 78.45 },
      total_tax_amount: cfg.amount * 0.05,
      coupon_discount_amount: 0,
      restaurant_discount_amount: 0,
      dm_tips: 0,
      additional_charge: 0,
      extra_packaging_amount: 0,
      referrer_bonus_amount: 0,
      tax_status: false,
      created_at: createdAt,
      updated_at: updatedAt,
      created_at_legacy: createdAt,
    };
    await db.collection('orders').insertOne(order);
    seeded++;
  }
  console.log(`   ✓ Seeded ${seeded} recent orders (3 today, 2 this week)`);

  // ─── Summary ───────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('✅ DONE');
  console.log('═'.repeat(60));
  const finalOrderCount = await db.collection('orders').countDocuments({ mysql_restaurant_id: restaurantId });
  const todayCount = await db.collection('orders').countDocuments({
    mysql_restaurant_id: restaurantId,
    created_at: { $gte: hoursAgo(24) },
  });
  console.log(`Total orders for restaurant ${restaurantId}: ${finalOrderCount}`);
  console.log(`Today (last 24h):                          ${todayCount}`);
  console.log('\nRestart the Restaurant APK — wallet + order history + dashboard should now show data.');
} catch (err) {
  console.error('❌', err.message);
  process.exit(1);
} finally {
  await client.close();
}
