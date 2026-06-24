// Migrated MySQL DECIMAL columns landed in Mongo as decimal.js objects ({s,e,d}).
// In the delivery-charge collections this is silently catastrophic: plain
// Number({s,e,d}) is NaN, and a NaN surge multiplier collapses the whole
// delivery fee to ₹0 (the symptom reported in POS). This converts every such
// field back to a plain number so any reader — including the currently deployed
// backend — computes correctly. Idempotent: only rewrites object-valued fields.
// Pass DRY_RUN=1 to preview.
import { MongoClient } from 'mongodb';

const HOSTS = [
  'ac-wwhajfd-shard-00-00.5kgahgx.mongodb.net:27017',
  'ac-wwhajfd-shard-00-01.5kgahgx.mongodb.net:27017',
  'ac-wwhajfd-shard-00-02.5kgahgx.mongodb.net:27017',
].join(',');
const url = `mongodb://${HOSTS}/eatofine?ssl=true&replicaSet=atlas-fv6e0i-shard-0&authSource=admin&serverSelectionTimeoutMS=20000`;
const client = new MongoClient(url, { auth: { username: 'aman_admin', password: 'Aman%40123456' }, serverSelectionTimeoutMS: 20000 });
const DRY = process.env.DRY_RUN === '1';

// Same decode as src/common/decimal.ts toNum.
function dec(x, fallback) {
  if (x == null) return fallback;
  if (typeof x === 'number') return Number.isFinite(x) ? x : fallback;
  if (typeof x === 'string') { const n = parseFloat(x); return Number.isFinite(n) ? n : fallback; }
  if (typeof x === 'object') {
    if (x.$numberDecimal != null) { const n = parseFloat(String(x.$numberDecimal)); return Number.isFinite(n) ? n : fallback; }
    if (Array.isArray(x.d) && typeof x.e === 'number' && typeof x.s === 'number') {
      let digits = String(x.d[0] ?? '0');
      for (let i = 1; i < x.d.length; i++) digits += String(x.d[i]).padStart(7, '0');
      const intLen = x.e + 1;
      let s;
      if (intLen <= 0) s = '0.' + '0'.repeat(-intLen) + digits;
      else if (intLen >= digits.length) s = digits + '0'.repeat(intLen - digits.length);
      else s = digits.slice(0, intLen) + '.' + digits.slice(intLen);
      const n = x.s * (parseFloat(s) || 0);
      return Number.isFinite(n) ? n : fallback;
    }
  }
  return fallback;
}
const isObj = (v) => v != null && typeof v === 'object';

// collection -> { field: defaultIfUndecodable }
const TARGETS = {
  surge_pricing_grid: { multiplier: 1 },
  user_delivery_slabs: { min_km: 0, max_km: 0, base_charge: 0, extra_per_km: 0, gst_rate: 0 },
  user_delivery_surcharges: { amount: 0, gst_rate: 0 },
  vehicles: { extra_charges: 0, starting_coverage_area: 0, maximum_coverage_area: 0 },
  free_delivery_settings: { min_order_value: 0 },
};

try {
  await client.connect();
  const db = client.db('eatofine');
  for (const [coll, fields] of Object.entries(TARGETS)) {
    const docs = await db.collection(coll).find({}).toArray();
    let fixedDocs = 0; let fixedFields = 0;
    for (const d of docs) {
      const set = {};
      for (const [f, def] of Object.entries(fields)) {
        if (isObj(d[f])) { set[f] = dec(d[f], def); fixedFields++; }
      }
      if (Object.keys(set).length) {
        fixedDocs++;
        if (!DRY) await db.collection(coll).updateOne({ _id: d._id }, { $set: set });
      }
    }
    console.log(`${coll}: ${docs.length} docs, ${DRY ? 'would fix' : 'fixed'} ${fixedFields} field(s) across ${fixedDocs} doc(s)`);
  }
  console.log('DONE');
} catch (e) {
  console.error('ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await client.close();
}
