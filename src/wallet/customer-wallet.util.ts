import type { MongoDataService } from '../mongo/mongo-data.service';

/**
 * Single, idempotent customer-wallet credit — reuses the exact wallet mechanism
 * the rest of the app already relies on:
 *   • the running balance the customer app shows is Σ(credit − debit) over the
 *     `wallet_transactions` collection (customer.service.info), so the ledger row
 *     is the authoritative entry and is written first;
 *   • `wallets.balance` is kept in sync as the cached balance.
 *
 * Idempotent on `refund_id`: a given refund credits the wallet at most once, so
 * re-approving / retrying never double-credits.
 */

const round2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
const safeNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export interface CustomerWalletCreditResult {
  /** true ⇒ a new credit was applied just now. */
  credited: boolean;
  /** true ⇒ this refund had already been credited (idempotent no-op). */
  alreadyCredited: boolean;
  newBalance: number;
  transactionId: number | null;
}

export async function creditCustomerWallet(
  mongo: MongoDataService,
  input: {
    userId: number | null;
    amount: number;
    orderId?: number | null;
    refundId?: number | null;
    reason: string;
    /** wallet_transactions.transaction_type — defaults to 'refund'. */
    type?: string;
  },
): Promise<CustomerWalletCreditResult> {
  const userId = input.userId != null ? Number(input.userId) : null;
  const amount = round2(input.amount);
  if (!userId || amount <= 0) {
    return { credited: false, alreadyCredited: false, newBalance: 0, transactionId: null };
  }

  // ── Idempotency — never credit the same refund twice ──────────────────────
  if (input.refundId != null) {
    const dup = await mongo.findOne<{ mysql_id: number; balance?: number }>(
      'wallet_transactions',
      { refund_id: Number(input.refundId) },
    );
    if (dup) {
      return {
        credited: false,
        alreadyCredited: true,
        newBalance: safeNum(dup.balance),
        transactionId: Number(dup.mysql_id),
      };
    }
  }

  const wallet = await mongo.findOne<Record<string, unknown>>(
    'wallets',
    { $or: [{ user_id: userId }, { mysql_user_id: userId }] },
  );
  const newBalance = round2(safeNum(wallet?.balance) + amount);

  // 1. Authoritative ledger entry (what the customer app reads) — written first
  //    so idempotency stays reliable even if the cached balance update fails.
  const txId = await mongo.nextMysqlId('wallet_transactions');
  await mongo.insertOne('wallet_transactions', {
    mysql_id: txId,
    user_id: userId,
    mysql_user_id: userId,
    transaction_id: `REFUND_${input.orderId ?? 0}_${txId}`,
    refund_id: input.refundId != null ? Number(input.refundId) : null,
    order_id: input.orderId != null ? Number(input.orderId) : null,
    credit: amount,
    debit: 0,
    balance: newBalance,
    transaction_type: input.type ?? 'refund',
    reference: input.reason,
    created_at: new Date(),
    updated_at: new Date(),
  });

  // 2. Cached balance on the wallet record.
  if (wallet) {
    await mongo.updateOne('wallets', { mysql_id: Number(wallet.mysql_id) }, {
      balance: newBalance,
      total_earning: round2(safeNum(wallet.total_earning) + amount),
      updated_at: new Date(),
    });
  } else {
    const wid = await mongo.nextMysqlId('wallets');
    await mongo.insertOne('wallets', {
      mysql_id: wid,
      user_id: userId,
      mysql_user_id: userId,
      balance: newBalance,
      total_earning: amount,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  return { credited: true, alreadyCredited: false, newBalance, transactionId: txId };
}
