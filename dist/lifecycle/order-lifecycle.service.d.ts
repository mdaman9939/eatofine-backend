import { MongoDataService } from '../mongo/mongo-data.service';
import { FcmService } from '../notifications/fcm.service';
import { type CancelReason } from './order-lifecycle.constants';
type Actor = 'customer' | 'restaurant' | 'admin' | 'delivery_partner' | 'system';
export declare class OrderLifecycleService {
    private readonly mongo;
    private readonly fcm;
    private readonly logger;
    constructor(mongo: MongoDataService, fcm: FcmService);
    log(orderId: number, fromStatus: string | undefined, toStatus: string, by: Actor, reason?: string | null): Promise<void>;
    private tokenForUser;
    private tokenForRestaurant;
    private tokenForDeliveryMan;
    private push;
    private refundStatusForCancel;
    cancelOrder(orderId: number, reason: CancelReason, by: Actor): Promise<{
        ok: boolean;
        skipped?: boolean;
        status?: string;
        cancel_reason?: string;
        refund_status?: string;
        reason?: string;
    }>;
    canCancel(order: {
        order_status?: string;
    }, by: Exclude<Actor, 'delivery_partner' | 'system'>): boolean;
    handleDeliveryRejection(orderId: number, rejectingDmId: number): Promise<{
        ok: boolean;
        reassigned_to?: number;
        cancelled?: boolean;
    }>;
    private findAvailableRider;
    autoCancelStalePending(): Promise<{
        cancelled: number;
    }>;
    recordTransition(orderId: number, fromStatus: string | undefined, toStatus: string, by: Actor): Promise<void>;
    private creditCustomerWallet;
    private processRefund;
    processPendingRefunds(): Promise<{
        processed: number;
    }>;
    assertTransition(orderType: string | undefined, fromStatus: string | undefined, toStatus: string): void;
}
export {};
