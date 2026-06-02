/**
 * Seed demo orders for delivery man #1 (Rajesh Kumar).
 *
 * Creates a realistic mix of orders so the home dashboard, running orders,
 * order history, and earnings screens all have data to show:
 *   • 1 active "picked_up"  (in-progress delivery)
 *   • 1 active "handover"   (ready to pick up)
 *   • 3 delivered today     (drives Today's Orders + earnings)
 *   • 4 delivered this week (drives This Week)
 *   • 5 delivered older     (drives Total + earnings history)
 *
 * Also creates a delivery_man_wallets record so balance/earnings show
 * real numbers, plus order_details rows so "(null Item)" becomes a real
 * item count.
 *
 * Safe to re-run — idempotent: skips orders already assigned to this DM.
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const DM_ID = 1;
const ZONE_ID = 1;
const RESTAURANT_ID = 1; // Demo Restaurant

const u=process.env.MONGO_USER,p=process.env.MONGO_PASSWORD,h=process.env.MONGO_HOSTS,rs=process.env.MONGO_REPLICA_SET,dbn=process.env.MONGO_DATABASE??'eatofine',as=process.env.MONGO_AUTH_SOURCE??'admin';
const ps=new URLSearchParams({ssl:'true',authSource:as,retryWrites:'true',w:'majority'});if(rs)ps.set('replicaSet',rs);
const uri=`mongodb://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}/${dbn}?${ps}`;
const client=new MongoClient(uri,{serverSelectionTimeoutMS:15000});

const hoursAgo = (n) => new Date(Date.now() - n * 3600_000);

const PLAN = [
  // hoursAgo, status,        amount, paymentStatus, paymentMethod,   delivery_charge, tips
  [0.5,       'picked_up',    615.00, 'unpaid',      'cash_on_delivery', 30,  0],   // active
  [1,         'handover',     420.50, 'paid',        'digital_payment',  30,  0],   // active (ready)
  // Today
  [2,         'delivered',    580.00, 'paid',        'cash_on_delivery', 30, 20],
  [4,         'delivered',    895.00, 'paid',        'digital_payment',  35, 30],
  [7,         'delivered',    340.00, 'paid',        'cash_on_delivery', 25,  0],
  // This week
  [25,        'delivered',    720.00, 'paid',        'digital_payment',  30, 15],
  [50,        'delivered',    1240.00,'paid',        'cash_on_delivery', 45, 50],
  [75,        'delivered',    410.50, 'paid',        'digital_payment',  30,  0],
  [120,       'delivered',    685.00, 'paid',        'cash_on_delivery', 30, 25],
  // Older
  [200,       'delivered',    520.00, 'paid',        'digital_payment',  30,  0],
  [320,       'delivered',    890.00, 'paid',        'cash_on_delivery', 40, 40],
  [480,       'delivered',    615.50, 'paid',        'digital_payment',  30, 15],
  [600,       'delivered',    1100.00,'paid',        'cash_on_delivery', 45,  0],
];

try {
  await client.connect();
  const db = client.db(dbn);

  // ─── 1. Customer + restaurant id we'll attach orders to ─────────────
  const customer = await db.collection('users').findOne({});
  const customerId = customer?.mysql_id ?? 1;
  console.log(`Using customer mysql_id=${customerId}, restaurant=${RESTAURANT_ID}, dm=${DM_ID}`);

  // ─── 2. Seed orders ─────────────────────────────────────────────────
  console.log('\n[1/3] Seeding orders for Rajesh Kumar (delivery_man_id=1)…');
  const lastOrder = await db.collection('orders').find({}).sort({ mysql_id: -1 }).limit(1).toArray();
  let nextOrderId = (lastOrder[0]?.mysql_id ?? 0) + 1;

  const lastDetail = await db.collection('order_details').find({}).sort({ mysql_id: -1 }).limit(1).toArray();
  let nextDetailId = (lastDetail[0]?.mysql_id ?? 0) + 1;

  // Find a real food row to copy into order_details
  const sampleFood = await db.collection('foods').findOne({});
  const foodId = sampleFood?.mysql_id ?? 1;
  const foodDetailsJson = JSON.stringify({
    name: sampleFood?.name ?? 'Margherita Pizza',
    image: sampleFood?.image ?? null,
    price: 280,
    description: 'Classic 12-inch pizza',
  });

  let seededOrders = 0;
  let seededItems = 0;

  for (const [h, status, amount, paymentStatus, paymentMethod, dchg, tips] of PLAN) {
    const createdAt = hoursAgo(h);
    const updatedAt = status === 'delivered' ? new Date(createdAt.getTime() + 60 * 60_000) : createdAt;
    const orderId = nextOrderId++;
    const order = {
      mysql_id: orderId,
      user_id: customerId, mysql_user_id: customerId,
      restaurant_id: RESTAURANT_ID, mysql_restaurant_id: RESTAURANT_ID,
      delivery_man_id: DM_ID, mysql_delivery_man_id: DM_ID,
      zone_id: ZONE_ID, mysql_zone_id: ZONE_ID,
      order_amount: amount,
      order_status: status,
      payment_status: paymentStatus,
      payment_method: paymentMethod,
      order_type: 'delivery',
      delivery_charge: dchg,
      dm_tips: tips,
      total_tax_amount: +(amount * 0.05).toFixed(2),
      coupon_discount_amount: 0,
      restaurant_discount_amount: 0,
      additional_charge: 0,
      extra_packaging_amount: 0,
      referrer_bonus_amount: 0,
      tax_status: false,
      delivery_address: {
        address: '15B Banjara Hills, Hyderabad, Telangana 500034',
        latitude: 17.4126,
        longitude: 78.4502,
      },
      delivered: status === 'delivered' ? updatedAt : null,
      accepted: createdAt,
      confirmed: createdAt,
      processing: status !== 'pending' ? createdAt : null,
      created_at: createdAt,
      updated_at: updatedAt,
      created_at_legacy: createdAt,
    };
    await db.collection('orders').insertOne(order);
    seededOrders++;

    // Add 1-3 items per order
    const itemCount = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < itemCount; i++) {
      await db.collection('order_details').insertOne({
        mysql_id: nextDetailId++,
        order_id: orderId,
        food_id: foodId,
        item_campaign_id: null,
        food_details: foodDetailsJson,
        price: +(amount / itemCount).toFixed(2),
        quantity: 1,
        tax_amount: +(amount / itemCount * 0.05).toFixed(2),
        discount_on_food: 0,
        discount_percentage: 0,
        discount_on_product_by: null,
        discount_type: null,
        category_id: null,
        add_ons: [],
        addon_discount: 0,
        total_add_on_price: 0,
        variant: null,
        variation: [],
        tax_status: 'excluded',
        created_at: createdAt,
        updated_at: createdAt,
      });
      seededItems++;
    }
  }
  console.log(`   ✓ Seeded ${seededOrders} orders + ${seededItems} order_details`);

  // ─── 3. Delivery man wallet ─────────────────────────────────────────
  console.log('\n[2/3] Ensuring wallet for delivery_man_id=1…');
  const existingWallet = await db.collection('delivery_man_wallets').findOne({
    $or: [{ delivery_man_id: DM_ID }, { mysql_delivery_man_id: DM_ID }],
  });

  // Compute totals from the orders we just seeded + any prior
  const allDelivered = await db.collection('orders').find({
    mysql_delivery_man_id: DM_ID, order_status: 'delivered',
  }).toArray();
  let totalEarning = 0, collectedCash = 0;
  for (const o of allDelivered) {
    totalEarning += Number(o.delivery_charge ?? 0) + Number(o.dm_tips ?? 0);
    if (o.payment_method === 'cash_on_delivery') collectedCash += Number(o.order_amount ?? 0);
  }

  const walletData = {
    delivery_man_id: DM_ID,
    mysql_delivery_man_id: DM_ID,
    total_earning: +totalEarning.toFixed(2),
    balance: +totalEarning.toFixed(2),
    collected_cash: +collectedCash.toFixed(2),
    total_withdrawn: 0,
    pending_withdraw: 0,
    updated_at: new Date(),
  };

  if (existingWallet) {
    await db.collection('delivery_man_wallets').updateOne(
      { _id: existingWallet._id },
      { $set: walletData },
    );
    console.log(`   ✓ Updated wallet  total_earning=${walletData.total_earning}  collected_cash=${walletData.collected_cash}`);
  } else {
    const lastW = await db.collection('delivery_man_wallets').find({}).sort({ mysql_id: -1 }).limit(1).toArray();
    await db.collection('delivery_man_wallets').insertOne({
      mysql_id: (lastW[0]?.mysql_id ?? 0) + 1,
      ...walletData,
      created_at: new Date(),
    });
    console.log(`   ✓ Created wallet  total_earning=${walletData.total_earning}  collected_cash=${walletData.collected_cash}`);
  }

  // ─── 4. Summary ────────────────────────────────────────────────────
  console.log('\n[3/3] Summary');
  const totalForDm = await db.collection('orders').countDocuments({ mysql_delivery_man_id: DM_ID });
  const activeForDm = await db.collection('orders').countDocuments({
    mysql_delivery_man_id: DM_ID,
    order_status: { $in: ['handover', 'picked_up', 'confirmed', 'processing'] },
  });
  const todayForDm = await db.collection('orders').countDocuments({
    mysql_delivery_man_id: DM_ID,
    created_at: { $gte: hoursAgo(24) },
  });

  console.log('═'.repeat(60));
  console.log('✅ DONE');
  console.log('═'.repeat(60));
  console.log(`Delivery man:      Rajesh Kumar (id=${DM_ID})`);
  console.log(`Total orders:      ${totalForDm}`);
  console.log(`Active orders:     ${activeForDm}`);
  console.log(`Orders today:      ${todayForDm}`);
  console.log(`Wallet earning:    ₹${walletData.total_earning}`);
  console.log(`Cash collected:    ₹${walletData.collected_cash}`);
  console.log('\nRestart the Delivery APK or pull-to-refresh — dashboard + orders will populate.');
} catch (err) {
  console.error('❌', err.message);
  process.exit(1);
} finally {
  await client.close();
}
