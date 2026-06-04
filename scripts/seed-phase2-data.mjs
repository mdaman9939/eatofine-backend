/**
 * Seeds CRUD collections used by Phase-2 features so the admin tables
 * have something to show on first load:
 *   • promotional_banners (4 rows)
 *   • email_templates (8 templates)
 *   • dm_bonuses (4 rules)
 *   • dm_incentives (5 entries: 3 pending + 2 history)
 *   • subscriptions (2 entries — meal plans)
 *   • activity_logs (5 sample audit entries)
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

  // 1. Promotional banners
  console.log('[1/6] Promotional banners…');
  let added = 0;
  let nextBId = await nextId(db, 'promotional_banners');
  const BANNERS = [
    { title: '🎉 Weekend feast — 30% off', subtitle: 'Use code WEEKEND', type: 'coupon', target: 'WEEKEND', cta_text: 'Order now' },
    { title: '🍕 Pizza Hub launch', subtitle: 'New restaurant in Faridabad', type: 'restaurant', target: '2', cta_text: 'Explore' },
    { title: '🔥 Diwali specials', subtitle: 'Festival menu live now', type: 'banner', target: 'diwali-2026', cta_text: 'See offers' },
    { title: '💸 Refer & earn ₹100', subtitle: 'Invite friends, both earn', type: 'banner', target: 'referral', cta_text: 'Invite' },
  ];
  for (const b of BANNERS) {
    const exists = await db.collection('promotional_banners').findOne({ title: b.title });
    if (exists) continue;
    await db.collection('promotional_banners').insertOne({
      mysql_id: nextBId++, ...b, status: true, zone_id: 1,
      created_at: daysAgo(Math.floor(Math.random() * 15)), updated_at: new Date(),
    });
    added++;
  }
  summary.promotional_banners = added;
  console.log(`   ✓ ${added}`);

  // 2. Email templates
  console.log('\n[2/6] Email templates…');
  added = 0;
  let nextETId = await nextId(db, 'email_templates');
  const TEMPLATES = [
    { event: 'order_placed', audience: 'customer', subject: 'Order #{{order_id}} confirmed!', body: '<p>Hi {{customer_name}},</p><p>Your order from {{restaurant_name}} is on its way!</p>' },
    { event: 'order_delivered', audience: 'customer', subject: 'Order delivered — enjoy your meal!', body: '<p>Hope you enjoy it, {{customer_name}}!</p><p>Please rate your experience.</p>' },
    { event: 'refund_processed', audience: 'customer', subject: 'Refund of ₹{{amount}} processed', body: '<p>Your refund for order #{{order_id}} has been processed.</p>' },
    { event: 'order_canceled', audience: 'customer', subject: 'Order #{{order_id}} canceled', body: '<p>We\'re sorry — your order was canceled. Reason: {{cancel_reason}}.</p>' },
    { event: 'forgot_password', audience: 'customer', subject: 'Reset your Eatofine password', body: '<p>Click below to reset your password.</p><p><a href="{{reset_url}}">Reset password</a></p>' },
    { event: 'new_order', audience: 'vendor', subject: '🔔 New order #{{order_id}} for {{restaurant_name}}', body: '<p>Accept within 5 minutes.</p>' },
    { event: 'payout_sent', audience: 'vendor', subject: 'Your earnings of ₹{{amount}} have been disbursed', body: '<p>Bank transfer initiated.</p>' },
    { event: 'application_approved', audience: 'dm', subject: 'Welcome to Eatofine!', body: '<p>You\'re approved! Start accepting orders today.</p>' },
  ];
  for (const t of TEMPLATES) {
    const exists = await db.collection('email_templates').findOne({ event: t.event, audience: t.audience });
    if (exists) continue;
    await db.collection('email_templates').insertOne({
      mysql_id: nextETId++, ...t, status: true,
      created_at: daysAgo(Math.floor(Math.random() * 30) + 10), updated_at: new Date(),
    });
    added++;
  }
  summary.email_templates = added;
  console.log(`   ✓ ${added}`);

  // 3. DM bonuses
  console.log('\n[3/6] DM bonuses…');
  added = 0;
  let nextDbId = await nextId(db, 'dm_bonuses');
  const BONUSES = [
    { name: 'Peak-hour bonus', type: 'rule', amount: 50, trigger: '10 deliveries between 6-10 PM' },
    { name: 'Weekend warrior', type: 'rule', amount: 100, trigger: '15 deliveries Saturday + Sunday' },
    { name: 'Festival bonus (Diwali)', type: 'manual', amount: 200, trigger: 'Diwali week' },
    { name: 'Referral bonus', type: 'rule', amount: 500, trigger: 'Refer + onboard new DM' },
  ];
  for (const b of BONUSES) {
    const exists = await db.collection('dm_bonuses').findOne({ name: b.name });
    if (exists) continue;
    await db.collection('dm_bonuses').insertOne({
      mysql_id: nextDbId++, ...b, status: true,
      claims_30d: Math.floor(Math.random() * 50) + 5,
      created_at: daysAgo(Math.floor(Math.random() * 90) + 10), updated_at: new Date(),
    });
    added++;
  }
  summary.dm_bonuses = added;
  console.log(`   ✓ ${added}`);

  // 4. DM incentives
  console.log('\n[4/6] DM incentives…');
  added = 0;
  let nextDiId = await nextId(db, 'dm_incentives');
  const INCENTIVES = [
    { dm_id: 1, period: '27 May–2 Jun', deliveries: 84, claim_amount: 500, status: 'pending' },
    { dm_id: 2, period: '27 May–2 Jun', deliveries: 67, claim_amount: 400, status: 'pending' },
    { dm_id: 3, period: '27 May–2 Jun', deliveries: 72, claim_amount: 450, status: 'pending' },
    { dm_id: 4, period: '20–26 May', deliveries: 92, claim_amount: 550, status: 'approved' },
    { dm_id: 5, period: '20–26 May', deliveries: 40, claim_amount: 250, status: 'rejected', reason: 'Below 50-delivery threshold' },
  ];
  for (const inc of INCENTIVES) {
    const exists = await db.collection('dm_incentives').findOne({ dm_id: inc.dm_id, period: inc.period });
    if (exists) continue;
    await db.collection('dm_incentives').insertOne({
      mysql_id: nextDiId++, ...inc,
      created_at: daysAgo(Math.floor(Math.random() * 5) + 1), updated_at: new Date(),
    });
    added++;
  }
  summary.dm_incentives = added;
  console.log(`   ✓ ${added}`);

  // 5. Subscriptions
  console.log('\n[5/6] Subscriptions…');
  added = 0;
  let nextSId = await nextId(db, 'subscriptions');
  const SUBS = [
    { mysql_user_id: 1, mysql_restaurant_id: 1, plan: 'Office lunch combo', frequency: 'Weekdays 1 PM', status: 'active' },
    { mysql_user_id: 2, mysql_restaurant_id: 2, plan: 'Family dinner', frequency: 'Sun 7 PM', status: 'paused' },
  ];
  for (const s of SUBS) {
    const exists = await db.collection('subscriptions').findOne({ mysql_user_id: s.mysql_user_id, mysql_restaurant_id: s.mysql_restaurant_id });
    if (exists) continue;
    await db.collection('subscriptions').insertOne({
      mysql_id: nextSId++, ...s,
      start_date: daysAgo(Math.floor(Math.random() * 60) + 30),
      created_at: daysAgo(Math.floor(Math.random() * 60) + 30), updated_at: new Date(),
    });
    added++;
  }
  summary.subscriptions = added;
  console.log(`   ✓ ${added}`);

  // 6. Activity logs
  console.log('\n[6/6] Activity logs…');
  added = 0;
  let nextAlId = await nextId(db, 'activity_logs');
  const LOGS = [
    { admin_email: 'admin@admin.com', action: 'Vendor approved', target: 'Pizza Hub (id=2)', ip: '127.0.0.1' },
    { admin_email: 'admin@admin.com', action: 'Refund processed', target: 'Order #178 · ₹615', ip: '127.0.0.1' },
    { admin_email: 'admin@admin.com', action: 'Settings updated', target: 'theme.primary_color', ip: '127.0.0.1' },
    { admin_email: 'admin@admin.com', action: 'Wallet credit', target: 'Aarav Sharma · ₹100', ip: '127.0.0.1' },
    { admin_email: 'admin@admin.com', action: 'DM incentive approved', target: 'Rajesh Kumar · ₹500', ip: '127.0.0.1' },
    { admin_email: 'admin@admin.com', action: 'Zone created', target: 'Faridabad / NCR', ip: '127.0.0.1' },
    { admin_email: 'admin@admin.com', action: 'Restaurant rejected', target: 'Spice Garden', ip: '127.0.0.1' },
  ];
  for (const log of LOGS) {
    await db.collection('activity_logs').insertOne({
      mysql_id: nextAlId++, ...log,
      created_at: new Date(Date.now() - Math.floor(Math.random() * 7) * 86_400_000 - Math.floor(Math.random() * 86_400_000)),
    });
    added++;
  }
  summary.activity_logs = added;
  console.log(`   ✓ ${added}`);

  console.log('\n' + '═'.repeat(60));
  console.log('✅ DONE');
  console.log('═'.repeat(60));
  console.table(summary);
} catch (err) {
  console.error('❌', err.message);
  process.exit(1);
} finally {
  await client.close();
}
