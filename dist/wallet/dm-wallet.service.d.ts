import { MongoDataService } from '../mongo/mongo-data.service';
export declare class DmWalletService {
    private readonly mongo;
    private readonly logger;
    private indexing;
    constructor(mongo: MongoDataService);
    private ensureIndexes;
    private logTxn;
    credit(dmId: number, amount: number, type: string, reference: string, meta?: Record<string, unknown>): Promise<void>;
    reconcileTips(orderId: number): Promise<number>;
    private periodWindow;
    evaluateBonuses(dmId: number, whenIso?: string): Promise<number>;
    private readIncentiveConfig;
    private incentiveWindow;
    evaluateIncentives(dmId: number, whenIso?: string): Promise<boolean>;
    recordCod(dmId: number, orderId: number, amount: number): Promise<void>;
    getWallet(dmId: number): Promise<WalletDoc | null>;
    getPayoutSummary(dmId: number): Promise<{
        balance: number;
        total_earning: number;
        collected_cash: number;
        pending_withdraw: number;
        total_withdrawn: number;
        available_to_withdraw: number;
        net_position: number;
        cash_to_deposit: number;
    }>;
    recordCashDeposit(dmId: number, amount: number): Promise<{
        ok: boolean;
        deposited: number;
        collected_cash: number;
    }>;
    listTransactions(dmId: number, limit?: number): Promise<Array<{
        type: string;
        credit: number;
        debit: number;
        reference: string;
        at: Date | null;
    }>>;
}
interface WalletDoc {
    balance?: number;
    total_earning?: number;
    collected_cash?: number;
    total_withdrawn?: number;
    pending_withdraw?: number;
}
export {};
