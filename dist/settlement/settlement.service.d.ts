import { MongoDataService } from '../mongo/mongo-data.service';
import { DmWalletService } from '../wallet/dm-wallet.service';
export type DiscountOwner = 'admin' | 'restaurant' | 'shared';
export interface SettlementBreakdown {
    food_amount: number;
    customer_payment: number;
    gross_order_amount: number;
    tax_amount: number;
    delivery_charge: number;
    platform_fee: number;
    admin_commission: number;
    admin_markup: number;
    admin_discount: number;
    restaurant_discount: number;
    platform_revenue: number;
    deliveryman_earning: number;
    admin_net: number;
    restaurant_earning: number;
    identity_ok: boolean;
}
export declare class SettlementService {
    private readonly mongo;
    private readonly dmWallet;
    private readonly logger;
    private indexesReady;
    constructor(mongo: MongoDataService, dmWallet: DmWalletService);
    private ensureIndexes;
    private resolveDiscounts;
    private computeBreakdown;
    private creditWalletOnce;
    private writeLedgerOnce;
    settleOrder(orderId: number): Promise<{
        ok: boolean;
        skipped?: boolean;
        reason?: string;
        settlement?: Record<string, unknown>;
    }>;
    getSettlement(orderId: number): Promise<Record<string, unknown> | null>;
    listSettlements(limit?: number, offset?: number): Promise<{
        total: number;
        items: Record<string, unknown>[];
    }>;
    requestWithdrawal(body: {
        actor_type: 'restaurant' | 'deliveryman';
        actor_id: number;
        amount: number;
    }): Promise<{
        ok: boolean;
        id: number;
    }>;
}
