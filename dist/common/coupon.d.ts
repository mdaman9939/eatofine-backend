import type { MongoDataService } from '../mongo/mongo-data.service';
export interface CouponComputation {
    applied: boolean;
    couponCode: string | null;
    couponMysqlId: number | null;
    couponDiscount: number;
    couponOwner: string;
    adminDiscount: number;
    restaurantDiscount: number;
    reason?: string;
}
export declare function validateAndComputeCoupon(mongo: MongoDataService, input: {
    code?: string | null;
    orderAmount: number;
    restaurantId?: number | null;
}): Promise<CouponComputation>;
export declare function incrementCouponUses(mongo: MongoDataService, couponMysqlId: number | null): Promise<void>;
