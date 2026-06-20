"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.creditCustomerWallet = creditCustomerWallet;
const round2 = (n) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
const safeNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};
async function creditCustomerWallet(mongo, input) {
    const userId = input.userId != null ? Number(input.userId) : null;
    const amount = round2(input.amount);
    if (!userId || amount <= 0) {
        return { credited: false, alreadyCredited: false, newBalance: 0, transactionId: null };
    }
    if (input.refundId != null) {
        const dup = await mongo.findOne('wallet_transactions', { refund_id: Number(input.refundId) });
        if (dup) {
            return {
                credited: false,
                alreadyCredited: true,
                newBalance: safeNum(dup.balance),
                transactionId: Number(dup.mysql_id),
            };
        }
    }
    const wallet = await mongo.findOne('wallets', { $or: [{ user_id: userId }, { mysql_user_id: userId }] });
    const newBalance = round2(safeNum(wallet?.balance) + amount);
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
    if (wallet) {
        await mongo.updateOne('wallets', { mysql_id: Number(wallet.mysql_id) }, {
            balance: newBalance,
            total_earning: round2(safeNum(wallet.total_earning) + amount),
            updated_at: new Date(),
        });
    }
    else {
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
//# sourceMappingURL=customer-wallet.util.js.map