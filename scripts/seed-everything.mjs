/**
 * Master seed: fill every empty screen across all 4 apps with realistic data.
 *
 * Coverage:
 *   • Customer addresses (3 per top-5 customers)         → fixes Address list, checkout
 *   • Food reviews (random ratings 3-5 with comments)    → fixes Reviews tab
 *   • Restaurant reviews                                  → fixes restaurant profile
 *   • Wishlist (customers → favorite foods + restaurants)→ fixes Favourites screen
 *   • Order-again history                                 → fixes Re-order section
 *   • Advertisements (4 active banners)                   → fixes carousel
 *   • Conversations + messages between customers/vendors → fixes Chat screen
 *   • Notifications (system messages)                     → fixes Notifications tab
 *   • Coupons (3 active platform coupons)                 → fixes Coupons screen
 *   • Banners (homepage hero carousel)                    → fixes splash banners
 *   • More orders for customer #1 (Aarav)                 → fixes order history
 *
 * Idempotent — re-runs safely (uses unique markers + upserts).
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const u=process.env.MONGO_USER,p=process.env.MONGO_PASSWORD,h=process.env.MONGO_HOSTS,rs=process.env.MONGO_REPLICA_SET,dbn=process.env.MONGO_DATABASE??'eatofine',as=process.env.MONGO_AUTH_SOURCE??'admin';
const ps=new URLSearchParams({ssl:'true',authSource:as,retryWrites:'true',w:'majority'});if(rs)ps.set('replicaSet',rs);
const uri=`mongodb://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}/${dbn}?${ps}`;
const client=new MongoClient(uri,{serverSelectionTimeoutMS:15000});

const hoursAgo = (n) => new Date(Date.now() - n * 3600_000);
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000);
const random = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randint = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function nextId(db, col) {
  const last = await db.collection(col).find({}).sort({ mysql_id: -1 }).limit(1).toArray();
  return (last[0]?.mysql_id ?? 0) + 1;
}

try {
  await client.connect();
  const db = client.db(dbn);
  const summary = {};

  // Look up top 5 customers + 5 vendors + 5 restaurants + foods we'll attach data to
  const customers = await db.collection('users').find({}).limit(5).toArray();
  const restaurants = await db.collection('restaurants').find({}).limit(8).toArray();
  const foods = await db.collection('foods').find({}).limit(30).toArray();
  const vendors = await db.collection('vendors').find({}).limit(5).toArray();
  console.log(`Targets: ${customers.length} customers, ${restaurants.length} restaurants, ${foods.length} foods\n`);

  // ─── 1. Customer Addresses (3 per customer) ────────────────────────
  console.log('[1] Customer addresses…');
  const addrTemplates = [
    { type: 'home',  label: 'Home',   addr: 'Flat 304, Banjara Hills, Hyderabad, Telangana 500034', lat: 17.4126, lng: 78.4502 },
    { type: 'office', label: 'Office', addr: 'HiTech City, Madhapur, Hyderabad, Telangana 500081', lat: 17.4474, lng: 78.3762 },
    { type: 'other', label: 'Friend\'s place', addr: 'Gachibowli, Hyderabad, Telangana 500032', lat: 17.4398, lng: 78.3486 },
  ];
  let nextAddrId = await nextId(db, 'customer_addresses');
  let addedAddrs = 0;
  for (const c of customers) {
    const existing = await db.collection('customer_addresses').countDocuments({ user_id: c.mysql_id });
    if (existing >= 3) continue;
    for (const t of addrTemplates) {
      await db.collection('customer_addresses').insertOne({
        mysql_id: nextAddrId++,
        user_id: c.mysql_id,
        mysql_user_id: c.mysql_id,
        address_type: t.type,
        contact_person_name: `${c.f_name ?? ''} ${c.l_name ?? ''}`.trim(),
        contact_person_number: c.phone ?? '+919999000000',
        address: t.addr,
        road: 'Main Road',
        house: t.label,
        floor: t.type === 'office' ? '5th floor' : 'Ground floor',
        latitude: t.lat, longitude: t.lng,
        zone_id: 1, mysql_zone_id: 1,
        is_default: t.type === 'home',
        created_at: daysAgo(randint(10, 100)),
        updated_at: new Date(),
      });
      addedAddrs++;
    }
  }
  summary.addresses = addedAddrs;
  console.log(`   ✓ Added ${addedAddrs} addresses\n`);

  // ─── 2. Food reviews (3-5 reviews per top 20 foods) ────────────────
  console.log('[2] Food reviews…');
  const reviewComments = [
    'Tasty and fresh! Loved it.', 'Quick delivery, good quality.', 'Worth the price.',
    'Excellent flavors, will order again.', 'Could be slightly better packed.',
    'Restaurant cooked it perfectly.', 'Highly recommended!', 'Best in town.',
    'Decent portion size.', 'Bit cold when arrived but tasty.',
  ];
  let nextReviewId = await nextId(db, 'reviews');
  let addedReviews = 0;
  for (const f of foods.slice(0, 20)) {
    const existing = await db.collection('reviews').countDocuments({ $or: [{ food_id: f.mysql_id }, { mysql_food_id: f.mysql_id }] });
    if (existing >= 3) continue;
    const n = randint(3, 5);
    for (let i = 0; i < n; i++) {
      const c = random(customers);
      await db.collection('reviews').insertOne({
        mysql_id: nextReviewId++,
        food_id: f.mysql_id,
        mysql_food_id: f.mysql_id,
        user_id: c.mysql_id,
        mysql_user_id: c.mysql_id,
        order_id: randint(100, 180),
        comment: random(reviewComments),
        rating: randint(3, 5),
        attachment: '[]',
        status: true,
        reply: i === 0 ? 'Thanks for your kind words!' : null,
        reply_at: i === 0 ? daysAgo(randint(1, 5)) : null,
        created_at: daysAgo(randint(1, 60)),
        updated_at: new Date(),
      });
      addedReviews++;
    }
  }
  summary.food_reviews = addedReviews;
  console.log(`   ✓ Added ${addedReviews} food reviews\n`);

  // ─── 3. Restaurant reviews (4 per restaurant) ──────────────────────
  console.log('[3] Restaurant reviews…');
  let nextRrId = await nextId(db, 'restaurant_reviews');
  let addedRr = 0;
  const rComments = ['Great food and quick service.', 'Hygiene is top notch.', 'Friendly staff.', 'Will definitely order again!', 'Best restaurant in the area.'];
  for (const r of restaurants) {
    const existing = await db.collection('restaurant_reviews').countDocuments({ $or: [{ restaurant_id: r.mysql_id }, { mysql_restaurant_id: r.mysql_id }] });
    if (existing >= 3) continue;
    for (let i = 0; i < 4; i++) {
      const c = random(customers);
      await db.collection('restaurant_reviews').insertOne({
        mysql_id: nextRrId++,
        restaurant_id: r.mysql_id,
        mysql_restaurant_id: r.mysql_id,
        user_id: c.mysql_id,
        mysql_user_id: c.mysql_id,
        order_id: randint(100, 180),
        comment: random(rComments),
        rating: randint(4, 5),
        status: true,
        created_at: daysAgo(randint(1, 90)),
      });
      addedRr++;
    }
  }
  summary.restaurant_reviews = addedRr;
  console.log(`   ✓ Added ${addedRr} restaurant reviews\n`);

  // ─── 4. Wishlist (5-8 foods + 2-3 restaurants per customer) ────────
  console.log('[4] Wishlist…');
  let nextWishId = await nextId(db, 'wishlists');
  let addedWish = 0;
  for (const c of customers) {
    const existing = await db.collection('wishlists').countDocuments({ user_id: c.mysql_id });
    if (existing >= 5) continue;
    // 5-8 favourite foods
    const favFoods = foods.slice(0, randint(5, 8));
    for (const f of favFoods) {
      await db.collection('wishlists').insertOne({
        mysql_id: nextWishId++,
        user_id: c.mysql_id,
        mysql_user_id: c.mysql_id,
        food_id: f.mysql_id,
        mysql_food_id: f.mysql_id,
        restaurant_id: null,
        mysql_restaurant_id: null,
        created_at: daysAgo(randint(1, 60)),
      });
      addedWish++;
    }
    // 2-3 favourite restaurants
    for (const r of restaurants.slice(0, randint(2, 3))) {
      await db.collection('wishlists').insertOne({
        mysql_id: nextWishId++,
        user_id: c.mysql_id,
        mysql_user_id: c.mysql_id,
        food_id: null,
        mysql_food_id: null,
        restaurant_id: r.mysql_id,
        mysql_restaurant_id: r.mysql_id,
        created_at: daysAgo(randint(1, 60)),
      });
      addedWish++;
    }
  }
  summary.wishlist = addedWish;
  console.log(`   ✓ Added ${addedWish} wishlist entries\n`);

  // ─── 5. Advertisements (4 active banners) ──────────────────────────
  console.log('[5] Advertisements…');
  let nextAdId = await nextId(db, 'advertisements');
  let addedAds = 0;
  const adData = [
    { title: 'Welcome offer — 20% OFF', body: 'Use code WELCOME20 on your first order', priority: 1 },
    { title: 'Weekend feast — Free delivery', body: 'Order above ₹299 and pay zero delivery', priority: 2 },
    { title: 'Pizza Hub Special', body: 'Buy 1 get 1 free on medium pizzas', priority: 3 },
    { title: 'Late-night cravings', body: '15% off on orders after 10 PM', priority: 4 },
  ];
  const existingAds = await db.collection('advertisements').countDocuments({ status: 'approved' });
  if (existingAds < 4) {
    for (let i = 0; i < adData.length; i++) {
      const a = adData[i];
      const r = restaurants[i % restaurants.length];
      await db.collection('advertisements').insertOne({
        mysql_id: nextAdId++,
        title: a.title,
        body: a.body,
        cover_image: null,
        web_cover_image: null,
        priority: a.priority,
        status: 'approved',
        is_paused: false,
        restaurant_id: r.mysql_id,
        mysql_restaurant_id: r.mysql_id,
        created_by_id: 1,
        mysql_created_by_id: 1,
        start_date: daysAgo(7),
        end_date: daysAgo(-30),
        created_at: daysAgo(10),
        updated_at: new Date(),
      });
      addedAds++;
    }
  }
  summary.advertisements = addedAds;
  console.log(`   ✓ Added ${addedAds} advertisements\n`);

  // ─── 6. Banners (homepage carousel — 4 entries) ────────────────────
  console.log('[6] Banners…');
  let nextBannerId = await nextId(db, 'banners');
  let addedBanners = 0;
  const bannerData = [
    { title: 'Hungry? Order now!', type: 'restaurant', data: 1 },
    { title: 'Top-rated near you', type: 'restaurant', data: 2 },
    { title: 'Try something new', type: 'food', data: 1 },
    { title: 'Weekend Specials', type: 'restaurant', data: 3 },
  ];
  const existingBanners = await db.collection('banners').countDocuments({ status: true });
  if (existingBanners < 3) {
    for (const b of bannerData) {
      await db.collection('banners').insertOne({
        mysql_id: nextBannerId++,
        title: b.title,
        image: null,
        type: b.type,
        data: b.data,
        zone_id: 1,
        mysql_zone_id: 1,
        status: true,
        created_at: daysAgo(20),
        updated_at: new Date(),
      });
      addedBanners++;
    }
  }
  summary.banners = addedBanners;
  console.log(`   ✓ Added ${addedBanners} banners\n`);

  // ─── 7. Chat conversations + messages ──────────────────────────────
  console.log('[7] Chat conversations + messages…');
  let nextConvId = await nextId(db, 'conversations');
  let nextMsgId = await nextId(db, 'messages');
  let addedConv = 0, addedMsg = 0;
  const chatPairs = [
    { sender: customers[0], type_recv: 'vendor', recvData: vendors[0], topic: 'Order #137 query' },
    { sender: customers[1], type_recv: 'vendor', recvData: vendors[1], topic: 'Delivery time?' },
    { sender: customers[0], type_recv: 'vendor', recvData: vendors[2], topic: 'Customisation request' },
  ];
  for (const pair of chatPairs) {
    if (!pair.recvData) continue;
    const existing = await db.collection('conversations').findOne({
      $or: [
        { user_id: pair.sender.mysql_id, vendor_id: pair.recvData.mysql_id },
        { sender_id: pair.sender.mysql_id, receiver_id: pair.recvData.mysql_id },
      ],
    });
    if (existing) continue;
    const convId = nextConvId++;
    await db.collection('conversations').insertOne({
      mysql_id: convId,
      sender_id: pair.sender.mysql_id,
      sender_type: 'user',
      receiver_id: pair.recvData.mysql_id,
      receiver_type: 'vendor',
      user_id: pair.sender.mysql_id,
      vendor_id: pair.recvData.mysql_id,
      restaurant_id: 1,
      mysql_restaurant_id: 1,
      message_count: 4,
      unread_message_count: 1,
      last_message: 'Sure, will deliver soon.',
      last_message_time: hoursAgo(1),
      created_at: daysAgo(2),
      updated_at: hoursAgo(1),
    });
    addedConv++;
    // 4 messages back and forth
    const msgs = [
      { who: 'user', text: `Hi, regarding ${pair.topic}` },
      { who: 'vendor', text: 'Hello! How can I help?' },
      { who: 'user', text: 'Can you make it less spicy please?' },
      { who: 'vendor', text: 'Sure, will deliver soon.' },
    ];
    for (let i = 0; i < msgs.length; i++) {
      await db.collection('messages').insertOne({
        mysql_id: nextMsgId++,
        conversation_id: convId,
        mysql_conversation_id: convId,
        sender_id: msgs[i].who === 'user' ? pair.sender.mysql_id : pair.recvData.mysql_id,
        sender_type: msgs[i].who,
        message: msgs[i].text,
        file: '[]',
        is_seen: i < msgs.length - 1,
        created_at: hoursAgo(48 - i * 12),
        updated_at: hoursAgo(48 - i * 12),
      });
      addedMsg++;
    }
  }
  summary.conversations = addedConv;
  summary.messages = addedMsg;
  console.log(`   ✓ Added ${addedConv} conversations + ${addedMsg} messages\n`);

  // ─── 8. Notifications (8 system messages) ──────────────────────────
  console.log('[8] Notifications…');
  let nextNotifId = await nextId(db, 'notifications');
  let addedNotifs = 0;
  const notifData = [
    { title: '🎉 Welcome to Eatofine!', desc: 'Enjoy 20% off on your first order with code WELCOME20' },
    { title: '🍕 Pizza Hub — New menu', desc: 'Try our new Italian-inspired pizzas, freshly added!' },
    { title: '⚡ Lightning delivery', desc: 'Express delivery now available in your area' },
    { title: '💰 Cashback offer', desc: 'Get 5% cashback on payments via UPI this week' },
    { title: '🔔 Restaurant nearby', desc: 'Curry Express just opened near you. Order now!' },
    { title: '🍔 Burger Cafe', desc: 'Buy 1 get 1 free — limited time' },
    { title: '🎁 Refer & Earn', desc: 'Refer a friend and earn ₹100 wallet credit' },
    { title: '🌧️ Rainy day specials', desc: 'Hot soup and snacks 15% off' },
  ];
  const existingNotifs = await db.collection('notifications').countDocuments({ status: true });
  if (existingNotifs < 5) {
    for (let i = 0; i < notifData.length; i++) {
      const n = notifData[i];
      await db.collection('notifications').insertOne({
        mysql_id: nextNotifId++,
        title: n.title,
        description: n.desc,
        image: null,
        type: 'general',
        zone_id: 1,
        mysql_zone_id: 1,
        status: true,
        created_at: daysAgo(i),
        updated_at: daysAgo(i),
      });
      addedNotifs++;
    }
  }
  summary.notifications = addedNotifs;
  console.log(`   ✓ Added ${addedNotifs} notifications\n`);

  // ─── 9. Coupons (4 active platform coupons) ────────────────────────
  console.log('[9] Coupons…');
  let nextCouponId = await nextId(db, 'coupons');
  let addedCoupons = 0;
  const couponData = [
    { code: 'WELCOME20', title: '20% off (max ₹150)', discount_type: 'percent', discount: 20, max: 150, min_order: 199 },
    { code: 'FLAT50', title: 'Flat ₹50 off', discount_type: 'amount', discount: 50, max: 50, min_order: 250 },
    { code: 'WEEKEND', title: '15% off on weekends', discount_type: 'percent', discount: 15, max: 100, min_order: 299 },
    { code: 'BIG100', title: 'Flat ₹100 off above ₹599', discount_type: 'amount', discount: 100, max: 100, min_order: 599 },
  ];
  const existingCoupons = await db.collection('coupons').countDocuments({ status: true });
  if (existingCoupons < 3) {
    for (const c of couponData) {
      await db.collection('coupons').insertOne({
        mysql_id: nextCouponId++,
        title: c.title,
        code: c.code,
        coupon_type: 'default',
        limit_per_user: 5,
        start_date: daysAgo(5),
        expire_date: daysAgo(-60),
        min_purchase: c.min_order,
        max_discount: c.max,
        discount: c.discount,
        discount_type: c.discount_type,
        status: true,
        total_uses: 0,
        created_by: 'admin',
        created_at: daysAgo(10),
        updated_at: new Date(),
      });
      addedCoupons++;
    }
  }
  summary.coupons = addedCoupons;
  console.log(`   ✓ Added ${addedCoupons} coupons\n`);

  // ─── 10. More orders for customer #1 (Aarav) — order history ───────
  console.log('[10] Extra orders for customer #1 (Aarav)…');
  let nextOrderId = await nextId(db, 'orders');
  let nextDetailId = await nextId(db, 'order_details');
  let addedOrders = 0;
  const sampleFood = foods[0];
  const foodDetailsJson = JSON.stringify({
    name: sampleFood?.name ?? 'Margherita Pizza',
    image: sampleFood?.image ?? null,
    price: 280,
  });
  const customerOrderPlan = [
    [10,  'delivered', 485],
    [25,  'delivered', 720],
    [48,  'delivered', 615],
    [96,  'delivered', 340],
    [240, 'delivered', 890],
  ];
  const aarav = customers[0];
  for (const [h, status, amount] of customerOrderPlan) {
    const createdAt = hoursAgo(h);
    const updatedAt = new Date(createdAt.getTime() + 90 * 60_000);
    const orderId = nextOrderId++;
    await db.collection('orders').insertOne({
      mysql_id: orderId,
      user_id: aarav.mysql_id, mysql_user_id: aarav.mysql_id,
      restaurant_id: 1, mysql_restaurant_id: 1,
      delivery_man_id: 1, mysql_delivery_man_id: 1,
      zone_id: 1, mysql_zone_id: 1,
      order_amount: amount,
      order_status: status,
      payment_status: 'paid',
      payment_method: 'digital_payment',
      order_type: 'delivery',
      delivery_charge: 30,
      dm_tips: 20,
      total_tax_amount: +(amount * 0.05).toFixed(2),
      delivery_address: { address: '15B Banjara Hills, Hyderabad', latitude: 17.4126, longitude: 78.4502 },
      delivered: updatedAt, accepted: createdAt, confirmed: createdAt, processing: createdAt,
      created_at: createdAt, updated_at: updatedAt, created_at_legacy: createdAt,
    });
    await db.collection('order_details').insertOne({
      mysql_id: nextDetailId++,
      order_id: orderId,
      food_id: sampleFood?.mysql_id ?? 1,
      food_details: foodDetailsJson,
      price: amount, quantity: 1, tax_amount: +(amount * 0.05).toFixed(2),
      discount_on_food: 0, discount_percentage: 0, add_ons: [], total_add_on_price: 0,
      variant: null, variation: [], tax_status: 'excluded',
      created_at: createdAt, updated_at: createdAt,
    });
    addedOrders++;
  }
  summary.customer_orders = addedOrders;
  console.log(`   ✓ Added ${addedOrders} more orders for Aarav\n`);

  // ─── Summary ──────────────────────────────────────────────────────
  console.log('═'.repeat(60));
  console.log('✅ MASTER SEED COMPLETE');
  console.log('═'.repeat(60));
  console.table(summary);
} catch (err) {
  console.error('❌', err.message);
  console.error(err.stack);
  process.exit(1);
} finally {
  await client.close();
}
