/**
 * Seeds:
 *   1. newsletter_subscribers — 12 sample subscribers
 *   2. 3 pending restaurants (status=false, approval_status=pending)
 *   3. 3 pending delivery men (application_status=pending)
 *   4. Default public_pages content for the 6 legal pages
 *
 * Idempotent — skips if data already exists.
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const u=process.env.MONGO_USER,p=process.env.MONGO_PASSWORD,h=process.env.MONGO_HOSTS,rs=process.env.MONGO_REPLICA_SET,dbn=process.env.MONGO_DATABASE??'eatofine',as=process.env.MONGO_AUTH_SOURCE??'admin';
const ps=new URLSearchParams({ssl:'true',authSource:as,retryWrites:'true',w:'majority'});if(rs)ps.set('replicaSet',rs);
const uri=`mongodb://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}/${dbn}?${ps}`;
const client=new MongoClient(uri,{serverSelectionTimeoutMS:15000});

const daysAgo = (n) => new Date(Date.now() - n * 86_400_000);

async function nextId(db, coll) {
  const last = await db.collection(coll).find({}).sort({ mysql_id: -1 }).limit(1).toArray();
  return (last[0]?.mysql_id ?? 0) + 1;
}

try {
  await client.connect();
  const db = client.db(dbn);
  const summary = {};

  // ── 1. Newsletter subscribers ──────────────────────────────────────
  console.log('[1/4] Newsletter subscribers…');
  const SUBSCRIBERS = [
    { email: 'amit.s@example.com',   source: 'Footer (Home)' },
    { email: 'priya.gupta@example.com', source: 'About Us page' },
    { email: 'rohit.kumar@example.com', source: 'Footer (Restaurants)' },
    { email: 'sneha.patel@example.com', source: 'Footer (Home)' },
    { email: 'vikram.singh@example.com', source: 'Blog signup' },
    { email: 'aditi.sharma@example.com', source: 'Footer (Home)' },
    { email: 'rajesh.iyer@example.com', source: 'About Us page' },
    { email: 'neha.kapoor@example.com', source: 'Footer (Restaurants)' },
    { email: 'arjun.mehta@example.com', source: 'Promo popup' },
    { email: 'kavya.r@example.com',   source: 'Footer (Home)' },
    { email: 'manish.j@example.com', source: 'Blog signup' },
    { email: 'pooja.dixit@example.com', source: 'Footer (Home)' },
  ];
  let nextSubId = await nextId(db, 'newsletter_subscribers');
  let addedSubs = 0;
  for (const sub of SUBSCRIBERS) {
    const exists = await db.collection('newsletter_subscribers').findOne({ email: sub.email });
    if (exists) continue;
    await db.collection('newsletter_subscribers').insertOne({
      mysql_id: nextSubId++,
      email: sub.email,
      source: sub.source,
      status: 'active',
      created_at: daysAgo(Math.floor(Math.random() * 60)),
      updated_at: new Date(),
    });
    addedSubs++;
  }
  summary.newsletter_subscribers = addedSubs;
  console.log(`   ✓ Added ${addedSubs} subscribers`);

  // ── 2. Pending restaurants ─────────────────────────────────────────
  console.log('\n[2/4] Pending restaurants…');
  const PENDING_RESTAURANTS = [
    { name: 'Spice Garden', email: 'rakesh@spicegarden.com', phone: '+919812340001', address: 'A-12, Banjara Hills, Hyderabad 500034', city: 'Hyderabad' },
    { name: 'Burger Hub', email: 'anita@burgerhub.in', phone: '+919812340002', address: '4th Block, Koramangala, Bengaluru 560034', city: 'Bengaluru' },
    { name: 'Tandoor Express', email: 'manoj@tandoor.in', phone: '+919812340003', address: 'Sector 18, Noida 201301', city: 'Noida' },
  ];
  let nextRestId = await nextId(db, 'restaurants');
  let addedRest = 0;
  for (const r of PENDING_RESTAURANTS) {
    const exists = await db.collection('restaurants').findOne({ email: r.email });
    if (exists) continue;
    await db.collection('restaurants').insertOne({
      mysql_id: nextRestId++,
      name: r.name,
      email: r.email,
      phone: r.phone,
      address: r.address,
      logo: null,
      cover_photo: null,
      status: false,
      approval_status: 'pending',
      delivery: true,
      take_away: true,
      minimum_order: 100,
      mysql_zone_id: 1,
      mysql_vendor_id: null,
      created_at: daysAgo(Math.floor(Math.random() * 7) + 1),
      updated_at: new Date(),
    });
    addedRest++;
  }
  summary.pending_restaurants = addedRest;
  console.log(`   ✓ Added ${addedRest} pending restaurants`);

  // ── 3. Pending delivery men ────────────────────────────────────────
  console.log('\n[3/4] Pending delivery men…');
  const PENDING_DMS = [
    { f_name: 'Vikram', l_name: 'Singh', email: 'vikram.dm@example.com', phone: '+919876512340', vehicle: 'Bike' },
    { f_name: 'Sunil',  l_name: 'Yadav', email: 'sunil.dm@example.com', phone: '+919876512341', vehicle: 'Cycle' },
    { f_name: 'Mohan',  l_name: 'Lal',   email: 'mohan.dm@example.com', phone: '+919876512342', vehicle: 'Bike' },
  ];
  let nextDmId = await nextId(db, 'delivery_men');
  let addedDms = 0;
  // bcrypt hash of "12345678" using Laravel-compat $2y$ prefix (matches existing seed)
  const passwordHash = '$2y$10$01wPDWI68vv6OZ.ABc.jKuM4w0FwAfYpQjGdQ6.q5oR0FU0Awthl6';
  for (const dm of PENDING_DMS) {
    const exists = await db.collection('delivery_men').findOne({ email: dm.email });
    if (exists) continue;
    await db.collection('delivery_men').insertOne({
      mysql_id: nextDmId++,
      f_name: dm.f_name,
      l_name: dm.l_name,
      email: dm.email,
      phone: dm.phone,
      password: passwordHash,
      mysql_zone_id: 1,
      application_status: 'pending',
      status: false,
      vehicle_id: 1,
      created_at: daysAgo(Math.floor(Math.random() * 5) + 1),
      updated_at: new Date(),
    });
    addedDms++;
  }
  summary.pending_delivery_men = addedDms;
  console.log(`   ✓ Added ${addedDms} pending delivery men`);

  // ── 4. Default public pages ────────────────────────────────────────
  console.log('\n[4/4] Default public pages content…');
  const PAGES = [
    { slug: 'terms-and-conditions', title: 'Terms & Conditions', content: `# Terms & Conditions\n\nWelcome to **Eatofine**! By using our platform, you agree to these terms.\n\n## 1. Acceptance of Terms\nBy accessing or using our service, you agree to be bound by these terms.\n\n## 2. User Responsibilities\nYou are responsible for the accuracy of the information you provide.\n\n## 3. Orders and Payment\nAll orders are subject to acceptance by the restaurant.` },
    { slug: 'privacy-policy', title: 'Privacy Policy', content: `# Privacy Policy\n\nYour privacy is important to us. This policy explains how we collect, use, and protect your data.\n\n## What we collect\n- Name, phone, email\n- Delivery addresses\n- Order history\n\n## How we use it\n- Process orders\n- Communicate updates\n- Improve our service` },
    { slug: 'about-us', title: 'About Us', content: `# About Eatofine\n\nEatofine is India's fastest-growing multi-vendor food delivery platform connecting customers, restaurants, and delivery partners.\n\n## Our Mission\nMake food delivery effortless for everyone in the chain — customer, vendor, rider.\n\n## Our Story\nFounded in 2025, we serve 29 restaurants across multiple zones with a fleet of dedicated delivery partners.` },
    { slug: 'refund-policy', title: 'Refund Policy', content: `# Refund Policy\n\n## When refunds are issued\n- Order not delivered\n- Wrong items received\n- Quality issues with food\n\n## Process\nRequest a refund via the app within 24 hours of delivery. Approved refunds are credited to your wallet within 1-2 business days.` },
    { slug: 'shipping-policy', title: 'Shipping Policy', content: `# Shipping Policy\n\n## Delivery zones\nWe deliver across configured zones. Check serviceability by entering your address in the app.\n\n## ETAs\nTypical delivery time: 30-45 minutes\n\n## Charges\nDelivery fee = min ship + per-km × distance, capped at max ship value.` },
    { slug: 'cancellation-policy', title: 'Cancellation Policy', content: `# Cancellation Policy\n\n## Customer-initiated cancellation\n- Before restaurant accepts: free cancellation, full refund\n- After restaurant accepts: cancellation fee may apply\n- After food is being prepared: refund only if quality issue\n\n## Restaurant-initiated\nIf the restaurant cancels, you get a full refund automatically.` },
  ];
  let nextPageId = await nextId(db, 'public_pages');
  let addedPages = 0;
  for (const p of PAGES) {
    const exists = await db.collection('public_pages').findOne({ slug: p.slug });
    if (exists) continue;
    await db.collection('public_pages').insertOne({
      mysql_id: nextPageId++,
      slug: p.slug,
      title: p.title,
      content: p.content,
      created_at: new Date(),
      updated_at: new Date(),
    });
    addedPages++;
  }
  summary.public_pages = addedPages;
  console.log(`   ✓ Added ${addedPages} pages`);

  console.log('\n' + '═'.repeat(60));
  console.log('✅ DONE');
  console.log('═'.repeat(60));
  console.table(summary);
} catch (err) {
  console.error('❌', err.message);
  console.error(err.stack);
  process.exit(1);
} finally {
  await client.close();
}
