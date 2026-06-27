// Demo seeder so the admin Transaction Report shows data in the two columns/
// filters that are otherwise empty on freshly-seeded data:
//   1. "Situational Charges" — splits a surge/weekend portion out of the existing
//      delivery_charge on some delivery orders (does NOT change order_amount; the
//      report shows Delivery Fee = delivery_charge − situational_charge).
//   2. "Campaign orders" filter — tags some orders with mysql_item_campaign_id
//      (pointing at an existing campaigns row) so the Category Type = Campaign
//      filter returns them.
// Idempotent: only touches orders that don't already have the field, and tags
// each with demo_seed_situational / demo_seed_campaign.
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const u = process.env.MONGO_USER, p = process.env.MONGO_PASSWORD, h = process.env.MONGO_HOSTS;
const rs = process.env.MONGO_REPLICA_SET, dbn = process.env.MONGO_DATABASE ?? 'eatofine', as = process.env.MONGO_AUTH_SOURCE ?? 'admin';
const ps = new URLSearchParams({ ssl: 'true', authSource: as, retryWrites: 'true', w: 'majority' });
if (rs) ps.set('replicaSet', rs);
const client = new MongoClient(`mongodb://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}/${dbn}?${ps}`, { serverSelectionTimeoutMS: 20000 });

const num = (v) => (v == null ? 0 : Number(v) || 0);
const r2 = (n) => Math.round(n * 100) / 100;

await client.connect();
const db = client.db(dbn);
const orders = db.collection('orders');

// ── 1. Situational charges: split a portion out of existing delivery fee ──
const sitCandidates = await orders.find({
  order_type: { $in: ['delivery', 'home_delivery'] },
  situational_charge: { $exists: false },
  delivery_charge: { $gt: 20 },
}).sort({ mysql_id: -1 }).limit(18).toArray();

let sitDone = 0;
for (let i = 0; i < sitCandidates.length; i++) {
  const o = sitCandidates[i];
  const delivery = num(o.delivery_charge);
  // Alternate flavours so the demo looks varied: weekend ~30%, surge ~40%, festival flat ₹25.
  const kind = i % 3;
  let situational = kind === 0 ? r2(delivery * 0.3) : kind === 1 ? r2(delivery * 0.4) : 25;
  situational = Math.min(situational, r2(delivery - 5)); // leave at least ₹5 base delivery
  if (situational <= 0) continue;
  await orders.updateOne({ _id: o._id }, { $set: { situational_charge: situational, demo_seed_situational: true } });
  sitDone++;
}

// ── 2. Campaign orders: tag some orders with an existing campaign id ──
const campaigns = await db.collection('campaigns').find({}).limit(10).toArray();
const campaignIds = campaigns.map((c) => Number(c.mysql_id)).filter((n) => Number.isFinite(n) && n > 0);
let campDone = 0;
if (campaignIds.length) {
  const campCandidates = await orders.find({
    mysql_item_campaign_id: { $exists: false },
  }).sort({ mysql_id: -1 }).limit(12).toArray();
  for (let i = 0; i < campCandidates.length; i++) {
    const o = campCandidates[i];
    const cid = campaignIds[i % campaignIds.length];
    await orders.updateOne({ _id: o._id }, { $set: { mysql_item_campaign_id: cid, demo_seed_campaign: true } });
    campDone++;
  }
}

console.log(`situational backfilled on ${sitDone} orders; campaign tagged on ${campDone} orders.`);
console.log(`campaigns available: ${campaignIds.length} (ids: ${campaignIds.join(', ')})`);
console.log(`now: orders with situational_charge = ${await orders.countDocuments({ situational_charge: { $gt: 0 } })}`);
console.log(`now: orders with mysql_item_campaign_id = ${await orders.countDocuments({ mysql_item_campaign_id: { $ne: null } })}`);
await client.close();
