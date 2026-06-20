import type { MongoDataService } from '../mongo/mongo-data.service';
export interface CustomerWalletCreditResult {
    credited: boolean;
    alreadyCredited: boolean;
    newBalance: number;
    transactionId: number | null;
}
export declare function creditCustomerWallet(mongo: MongoDataService, input: {
    userId: number | null;
    amount: number;
    orderId?: number | null;
    refundId?: number | null;
    reason: string;
    type?: string;
}): Promise<CustomerWalletCreditResult>;
