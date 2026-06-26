/**
 * Add DEMO funds to every CUSTOMER, RESTAURANT and DELIVERY-MAN wallet so the
 * apps show a balance. Idempotent + reversible: each wallet stores how much demo
 * we added (`seed_demo_amount`), so re-running NEVER stacks, and the amount can
 * be cleanly subtracted back out. Real balances are preserved (we add on top).
 *
 * Demo amounts (edit here): customer ₹1000, restaurant ₹5000, rider ₹1500.
 *
 * Remove later — re-run this with REMOVE=1:
 *   REMOVE=1 node scripts/seed-wallets-demo.mjs
 */
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
// Load .env from the stackfood-api root regardless of the current working dir.
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const u = process.env.MONGO_USER, p = process.env.MONGO_PASSWORD, h = process.env.MONGO_HOSTS,
  rs = process.env.MONGO_REPLICA_SET, dbn = process.env.MONGO_DATABASE ?? 'eatofine',
  as = process.env.MONGO_AUTH_SOURCE ?? 'admin';
const ps = new URLSearchParams({ ssl: 'true', authSource: as, retryWrites: 'true', w: 'majority' });
if (rs) ps.set('replicaSet', rs);
const uri = `mongodb://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}/${dbn}?${ps}`;
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });

const REMOVE = process.env.REMOVE === '1';
const AMT = { customer: 1000, restaurant: 5000, dm: 1500 };
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
/** Coerce number / string / Decimal128 / {s,e,d} → plain number. */
function toNum(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') return parseFloat(v) || 0;
  if (typeof v === 'object') { const n = parseFloat(v.toString?.() ?? ''); return Number.isFinite(n) ? n : 0; }
  return 0;
}

try {
  await client.connect();
  const db = client.db(dbn);
  const nextId = async (coll) => {
    const top = await db.collection(coll).find({}, { projection: { mysql_id: 1 } }).sort({ mysql_id: -1 }).limit(1).toArray();
    let n = (Number(top[0]?.mysql_id) || 0) + 1;
    return () => n++;
  };

  /** Idempotently set a wallet doc's balance to (real + demo). `extraSet` lets us
   *  also bump total_earning etc. Returns the new balance. */
  async function applyWallet(coll, filter, baseDoc, balanceField, alsoEarning) {
    const cur = await db.collection(coll).findOne(filter);
    const prior = toNum(cur?.seed_demo_amount);
    const base = toNum(cur?.[balanceField]) - prior;              // strip our previous demo
    const add = REMOVE ? 0 : AMT[baseDoc._kind];
    const bal = round2(Math.max(0, base + add));
    const set = { [balanceField]: bal, seed_demo_amount: add, updated_at: new Date() };
    if (alsoEarning) {
      const baseEarn = toNum(cur?.total_earning) - prior;
      set.total_earning = round2(Math.max(bal, baseEarn + add));   // keep stored branch active
    }
    if (cur) {
      await db.collection(coll).updateOne(filter, { $set: set });
    } else if (!REMOVE) {
      const idFn = await nextId(coll);
      await db.collection(coll).insertOne({ mysql_id: idFn(), ...baseDoc.fields, ...set, created_at: new Date() });
    }
    return bal;
  }

  // ── 1. CUSTOMER wallets (wallets.balance + a tagged ledger credit) ──────────
  const users = await db.collection('users').find({}, { projection: { mysql_id: 1 } }).limit(2000).toArray();
  const wtId = await nextId('wallet_transactions');
  let nC = 0;
  for (const usr of users) {
    const uid = Number(usr.mysql_id); if (!uid) continue;
    await db.collection('wallet_transactions').deleteMany({ mysql_user_id: uid, seed_demo: true });
    if (!REMOVE) {
      await db.collection('wallet_transactions').insertOne({
        mysql_id: wtId(), mysql_user_id: uid, user_id: uid, credit: AMT.customer, debit: 0,
        transaction_type: 'add_fund', reference: 'demo_add_fund', created_at: new Date(), seed_demo: true,
      });
    }
    await applyWallet('wallets', { mysql_user_id: uid },
      { _kind: 'customer', fields: { mysql_user_id: uid, user_id: uid } }, 'balance', false);
    nC++;
  }
  console.log(`${REMOVE ? 'Reverted' : 'Funded'} ${nC} customer wallets ${REMOVE ? '' : `(+₹${AMT.customer} each)`}`);

  // ── 2. RESTAURANT wallets — INTENTIONALLY SKIPPED ───────────────────────────
  // The vendor app DERIVES the restaurant wallet from delivered orders (it ignores
  // a stored balance unless a real settlement ledger exists). Writing a balance
  // here only created a phantom amount the app never shows + duplicate docs, so
  // restaurant balances are NOT seeded. (Cleanup: scripts/fix-wallet-data.mjs.)
  console.log('Restaurant: skipped — wallet is order-derived in the app, not a stored balance.');

  // ── 3. DELIVERY-MAN wallets (delivery_man_wallets + tagged ledger credit) ───
  const dms = await db.collection('delivery_men').find({}, { projection: { mysql_id: 1 } }).limit(2000).toArray();
  const dtId = await nextId('dm_wallet_transactions');
  let nD = 0;
  for (const d of dms) {
    const did = Number(d.mysql_id); if (!did) continue;
    await db.collection('dm_wallet_transactions').deleteMany({ mysql_delivery_man_id: did, seed_demo: true });
    if (!REMOVE) {
      await db.collection('dm_wallet_transactions').insertOne({
        mysql_id: dtId(), delivery_man_id: did, mysql_delivery_man_id: did, credit: AMT.dm, debit: 0,
        type: 'add_fund', reference: 'demo_add_fund', created_at: new Date(), seed_demo: true,
      });
    }
    await applyWallet('delivery_man_wallets', { mysql_delivery_man_id: did },
      { _kind: 'dm', fields: { mysql_delivery_man_id: did, delivery_man_id: did } }, 'balance', true);
    nD++;
  }
  console.log(`${REMOVE ? 'Reverted' : 'Funded'} ${nD} delivery-man wallets ${REMOVE ? '' : `(+₹${AMT.dm} each)`}`);

  console.log(`\n✅ ${REMOVE ? 'Demo wallet funds removed.' : 'Demo funds added to all 3 wallet types. Idempotent — safe to re-run.'}`);
  if (!REMOVE) console.log('   Remove later:  REMOVE=1 node scripts/seed-wallets-demo.mjs');
} catch (e) {
  console.error('ERROR:', e?.message ?? e);
  process.exitCode = 1;
} finally {
  await client.close();
}
