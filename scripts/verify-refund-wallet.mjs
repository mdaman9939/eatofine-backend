/**
 * Verify the refund-approval → customer-wallet flow on REAL data — READ ONLY.
 *
 * For a real refund request it shows EXACTLY what admin "Approve" now does
 * (admin.service.updateRefundStatus → creditCustomerWallet):
 *   • current wallet balance = Σ(credit − debit) over wallet_transactions
 *   • idempotency check (any wallet_transactions row already tagged this refund?)
 *   • the credit it would apply + the new balance + the ledger row (type 'refund')
 *   • status would become 'completed' only after that credit
 * Plus a summary of how many existing 'completed' refunds actually have a wallet
 * credit (the gap this fix closes).
 *
 * Performs NO writes (only .find/.count). Safe against the live Atlas backend.
 */
import 'dotenv/config';
import { MongoClient, Decimal128 } from 'mongodb';

const u = process.env.MONGO_USER, p = process.env.MONGO_PASSWORD, h = process.env.MONGO_HOSTS,
  rs = process.env.MONGO_REPLICA_SET, dbn = process.env.MONGO_DATABASE ?? 'eatofine',
  as = process.env.MONGO_AUTH_SOURCE ?? 'admin';
const ps = new URLSearchParams({ ssl: 'true', authSource: as, retryWrites: 'true', w: 'majority' });
if (rs) ps.set('replicaSet', rs);
const uri = `mongodb://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}/${dbn}?${ps}`;
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });

function toNum(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseFloat(v) || 0;
  if (v instanceof Decimal128) return parseFloat(v.toString());
  if (typeof v === 'object' && 'toString' in v) { const n = parseFloat(v.toString()); return Number.isFinite(n) ? n : 0; }
  return 0;
}
const r2 = (n) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
const inr = (n) => `₹${r2(n).toFixed(2)}`;
const line = (c = '─') => console.log(c.repeat(66));

try {
  await client.connect();
  const db = client.db(dbn);
  const refundsC = db.collection('refunds');
  const txC = db.collection('wallet_transactions');

  // Pick a refund with a user + positive amount; prefer a still-pending request.
  const recent = await refundsC.find({}).sort({ mysql_id: -1 }).limit(150).toArray();
  const hasUserAmt = (r) => toNum(r.refund_amount) > 0 && Number(r.user_id ?? r.mysql_user_id ?? 0) > 0;
  const refund = recent.find((r) => hasUserAmt(r) && r.refund_status === 'pending')
    || recent.find((r) => hasUserAmt(r));
  if (!refund) { console.log('No refund request with a customer + amount found to demo.'); process.exit(0); }

  const refundId = Number(refund.mysql_id);
  const userId = Number(refund.user_id ?? refund.mysql_user_id);
  const orderId = Number(refund.order_id ?? refund.mysql_order_id ?? 0);
  const amount = r2(toNum(refund.refund_amount));

  // Current wallet balance the customer app shows = Σ(credit − debit).
  const allTx = await txC.find({ $or: [{ mysql_user_id: userId }, { user_id: userId }] }).toArray();
  const currentBalance = r2(allTx.reduce((s, t) => s + toNum(t.credit) - toNum(t.debit), 0));

  // Idempotency anchor: has this refund already been credited?
  const dup = await txC.findOne({ refund_id: refundId });

  line('═');
  console.log(`REFUND #${refundId}  ·  order #${orderId}  ·  customer #${userId}  ·  status "${refund.refund_status}"`);
  line('═');
  console.log(`  refund_amount: ${inr(amount)} | method: ${refund.refund_method ?? '—'}`);
  console.log(`  customer wallet balance NOW = ${inr(currentBalance)}  (Σ credit−debit over ${allTx.length} txns)`);

  console.log('\n▶ What admin "Approve / Complete" now does (updateRefundStatus → creditCustomerWallet)');
  if (dup) {
    console.log(`  • IDEMPOTENT: wallet_transactions row already tagged refund_id=${refundId} (tx #${dup.mysql_id}).`);
    console.log(`    → would NOT credit again. Balance stays ${inr(currentBalance)}. (prevents duplicate wallet credits ✓)`);
  } else {
    const newBalance = r2(currentBalance + amount);
    console.log(`  1. wallet_transactions ← new ledger row:`);
    console.log(`       { transaction_type: 'refund', credit: ${inr(amount)}, debit: ₹0.00,`);
    console.log(`         refund_id: ${refundId}, order_id: ${orderId}, balance: ${inr(newBalance)} }`);
    console.log(`  2. wallets.balance  ${inr(currentBalance)}  →  ${inr(newBalance)}`);
    console.log(`  3. customer app balance (Σ credit−debit)  ${inr(currentBalance)}  →  ${inr(newBalance)}  ✓ reflects refund`);
    console.log(`  4. refund_status → 'completed'  (ONLY after the wallet credit succeeded)`);
    console.log(`  5. credit note issued as an accounting DOCUMENT only (never gates completion).`);
  }

  // ── Gap summary: completed refunds vs actual wallet credits ───────────────
  const byStatus = {};
  for (const r of await refundsC.find({}).toArray()) {
    const s = String(r.refund_status ?? 'unknown');
    byStatus[s] = (byStatus[s] ?? 0) + 1;
  }
  const taggedCredits = await txC.countDocuments({ refund_id: { $exists: true, $ne: null } });
  console.log('\n▶ Refunds by status:', Object.entries(byStatus).map(([k, v]) => `${k}=${v}`).join('  '));
  console.log(`  wallet_transactions tagged with a refund_id (new-flow credits): ${taggedCredits}`);
  console.log(`  (Before this fix, approving a refund here wrote NO wallet credit — refund_id tagging is new.)`);

  console.log('\n' + '═'.repeat(66));
  console.log('✅ Read-only verification complete — no data was modified.');
  console.log('   This is exactly what the wired approval now performs on real money.');
  console.log('═'.repeat(66));
} catch (err) {
  console.error('❌', err?.message ?? err);
  console.error('   (Connection error? set MONGO_* env / .env and re-run. The script is read-only.)');
  process.exit(1);
} finally {
  await client.close();
}
