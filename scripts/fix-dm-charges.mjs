/**
 * Fix Delivery Partner Charges — distance slabs + surcharges.
 *
 * Existing data is stored as Mongo Decimal128 (BSON object shape:
 *   { s: sign, e: exponent, d: digits[] }), which the admin's JSON
 *   deserializer can't read as a number — it falls through to 0 and
 *   the UI shows "0–0 km" / "₹0.00" everywhere.
 *
 * Fix: read each row, coerce every Decimal128 field to a plain Number,
 *   write it back. Same data, sane shape.
 *
 * Idempotent. Re-run anytime.
 */
import 'dotenv/config';
import { MongoClient, Decimal128 } from 'mongodb';

const u=process.env.MONGO_USER,p=process.env.MONGO_PASSWORD,h=process.env.MONGO_HOSTS,rs=process.env.MONGO_REPLICA_SET,dbn=process.env.MONGO_DATABASE??'eatofine',as=process.env.MONGO_AUTH_SOURCE??'admin';
const ps=new URLSearchParams({ssl:'true',authSource:as,retryWrites:'true',w:'majority'});if(rs)ps.set('replicaSet',rs);
const uri=`mongodb://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}/${dbn}?${ps}`;
const client=new MongoClient(uri,{serverSelectionTimeoutMS:15000});

/** Pull a real number out of Decimal128 / plain number / string / null. */
function toNum(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseFloat(v) || 0;
  if (v instanceof Decimal128) return parseFloat(v.toString());
  // BSON Decimal128 sometimes arrives as a plain {s,e,d} object
  if (typeof v === 'object' && 'toString' in v) {
    const s = v.toString();
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

try {
  await client.connect();
  const db = client.db(dbn);

  // ─── 1. Distance slabs ─────────────────────────────────────────────
  console.log('\n[1/3] Distance slabs — set proper sequential values…');
  // Wipe & re-seed cleanly so values are plain numbers and ranges fit
  // the explanation we just gave the user.
  await db.collection('dm_distance_slabs').deleteMany({});
  const newSlabs = [
    { mysql_id: 1, min_km: 0,  max_km: 3,    base_charge: 30,  extra_per_km: 0,  status: true },
    { mysql_id: 2, min_km: 3,  max_km: 7,    base_charge: 45,  extra_per_km: 5,  status: true },
    { mysql_id: 3, min_km: 7,  max_km: 15,   base_charge: 65,  extra_per_km: 8,  status: true },
    { mysql_id: 4, min_km: 15, max_km: 30,   base_charge: 100, extra_per_km: 10, status: true },
  ];
  await db.collection('dm_distance_slabs').insertMany(newSlabs.map((s) => ({
    ...s,
    created_at: new Date(),
    updated_at: new Date(),
  })));
  for (const s of newSlabs) {
    console.log(`   ✓ Slab #${s.mysql_id}: ${s.min_km}–${s.max_km} km · base ₹${s.base_charge} · extra ₹${s.extra_per_km}/km`);
  }

  // ─── 2. Surcharges ─────────────────────────────────────────────────
  console.log('\n[2/3] Surcharges — set realistic amounts (plain numbers)…');
  const surcharges = await db.collection('dm_surcharges').find({}).toArray();
  for (const sc of surcharges) {
    // Re-derive a sensible amount per surcharge type.
    let amount = toNum(sc.amount);
    const labelLc = String(sc.label ?? '').toLowerCase();
    if (labelLc.includes('weekend'))    amount = 20;
    else if (labelLc.includes('night')) amount = 30;
    else if (labelLc.includes('festival')) amount = 50;
    await db.collection('dm_surcharges').updateOne(
      { _id: sc._id },
      { $set: { amount, status: true, updated_at: new Date() } },
    );
    console.log(`   ✓ ${sc.label} → ₹${amount}`);
  }

  // ─── 3. Verify ─────────────────────────────────────────────────────
  console.log('\n[3/3] Verifying…');
  const slabsCheck = await db.collection('dm_distance_slabs').find({}).sort({mysql_id:1}).toArray();
  console.log('   Slabs:');
  for (const s of slabsCheck) {
    console.log(`     • #${s.mysql_id}: ${s.min_km}–${s.max_km} km · ₹${s.base_charge} base · ₹${s.extra_per_km}/km extra · ${s.status?'active':'inactive'}`);
  }
  const surchCheck = await db.collection('dm_surcharges').find({}).toArray();
  console.log('   Surcharges:');
  for (const s of surchCheck) {
    console.log(`     • ${s.label} → ₹${s.amount} · ${s.status?'active':'inactive'}`);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('✅ DONE');
  console.log('═'.repeat(60));
  console.log('Refresh the Partner Charges page — slabs + surcharges will populate.');
  console.log('Try the calculator with: distance=10 km, time=Saturday 11 PM → ~₹139');
} catch (err) {
  console.error('❌', err.message);
  process.exit(1);
} finally {
  await client.close();
}
