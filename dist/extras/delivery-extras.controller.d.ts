import type { AuthedRequest } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';
export declare class DeliveryExtrasController {
    private readonly prisma;
    private readonly mongo;
    constructor(prisma: PrismaService, mongo: MongoDataService);
    private useMongo;
    private shapeDmOrder;
    private dmDetailsCountMap;
    profile(req: AuthedRequest): Promise<{
        id?: undefined;
        f_name?: undefined;
        l_name?: undefined;
        email?: undefined;
        phone?: undefined;
        image?: undefined;
        status?: undefined;
        application_status?: undefined;
        zone_id?: undefined;
        order_count?: undefined;
        todays_order_count?: undefined;
        this_week_order_count?: undefined;
        todays_earning?: undefined;
        this_week_earning?: undefined;
        this_month_earning?: undefined;
        all_time_earning?: undefined;
        balance?: undefined;
        total_earning?: undefined;
        collected_cash?: undefined;
        total_withdrawn?: undefined;
        pending_withdraw?: undefined;
    } | {
        id: number;
        f_name: {} | null;
        l_name: {} | null;
        email: {} | null;
        phone: {} | null;
        image: {} | null;
        status: {} | null;
        application_status: {} | null;
        zone_id: number | null;
        order_count: number;
        todays_order_count: number;
        this_week_order_count: number;
        todays_earning: number;
        this_week_earning: number;
        this_month_earning: number;
        all_time_earning: number;
        balance: number;
        total_earning: number;
        collected_cash: number;
        total_withdrawn: number;
        pending_withdraw: number;
    }>;
    updateProfile(req: AuthedRequest, body: {
        f_name?: string;
        l_name?: string;
        email?: string;
    }): Promise<{
        message: string;
    }>;
    toggleActive(): {
        message: string;
    };
    fcmToken(): {
        message: string;
    };
    remove(): {
        message: string;
    };
    allOrders(req: AuthedRequest): Promise<{
        id: number;
        user_id: number | null;
        restaurant_id: number;
        delivery_man_id: number | null;
        order_amount: number;
        details_count: number;
        order_status: string;
        order_type: string;
        payment_method: string;
        payment_status: string;
        delivery_address: {} | null;
        created_at: string;
        updated_at: string;
    }[] | {
        id: number;
        user_id: number | null;
        restaurant_id: number;
        order_amount: number;
        created_at: Date | null;
        updated_at: Date | null;
        zone_id: bigint | null;
        cutlery: boolean;
        vehicle_id: bigint | null;
        pending: Date | null;
        order_status: string;
        payment_status: string;
        payment_method: string | null;
        order_type: string;
        total_tax_amount: import("@prisma/client/runtime/library").Decimal;
        delivery_charge: import("@prisma/client/runtime/library").Decimal;
        coupon_discount_amount: import("@prisma/client/runtime/library").Decimal;
        additional_charge: number;
        restaurant_discount_amount: import("@prisma/client/runtime/library").Decimal;
        delivered: Date | null;
        delivery_man_id: bigint | null;
        confirmed: Date | null;
        processing: Date | null;
        canceled: Date | null;
        handover: Date | null;
        distance: number | null;
        cancellation_note: string | null;
        tax_type: string | null;
        is_guest: boolean;
        coupon_discount_title: string | null;
        transaction_reference: string | null;
        delivery_address_id: bigint | null;
        coupon_code: string | null;
        order_note: string | null;
        checked: boolean;
        delivery_type: string | null;
        delivery_type_charge: import("@prisma/client/runtime/library").Decimal;
        schedule_at: Date | null;
        callback: string | null;
        otp: string | null;
        accepted: Date | null;
        picked_up: Date | null;
        refund_requested: Date | null;
        refunded: Date | null;
        delivery_address: string | null;
        scheduled: boolean;
        original_delivery_charge: import("@prisma/client/runtime/library").Decimal;
        failed: Date | null;
        adjusment: import("@prisma/client/runtime/library").Decimal;
        edited: boolean;
        dm_tips: number;
        processing_time: string | null;
        free_delivery_by: string | null;
        refund_request_canceled: Date | null;
        cancellation_reason: string | null;
        canceled_by: string | null;
        tax_status: string | null;
        coupon_created_by: string | null;
        discount_on_product_by: string;
        subscription_id: bigint | null;
        tax_percentage: number | null;
        delivery_instruction: string | null;
        unavailable_item_note: string | null;
        partially_paid_amount: number;
        order_proof: string | null;
        cash_back_id: bigint | null;
        extra_packaging_amount: number;
        ref_bonus_amount: number;
        bring_change_amount: number | null;
        is_pos: boolean;
    }[]>;
    currentOrders(req: AuthedRequest): Promise<{
        id: number;
        user_id: number | null;
        restaurant_id: number;
        delivery_man_id: number | null;
        order_amount: number;
        details_count: number;
        order_status: string;
        order_type: string;
        payment_method: string;
        payment_status: string;
        delivery_address: {} | null;
        created_at: string;
        updated_at: string;
    }[]>;
    latestOrders(req: AuthedRequest): Promise<{
        id: number;
        user_id: number | null;
        restaurant_id: number;
        delivery_man_id: number | null;
        order_amount: number;
        details_count: number;
        order_status: string;
        order_type: string;
        payment_method: string;
        payment_status: string;
        delivery_address: {} | null;
        created_at: string;
        updated_at: string;
    }[]>;
    order(idStr?: string): Promise<{
        id: number;
        user_id: number | null;
        restaurant_id: number;
        delivery_man_id: number | null;
        order_amount: number;
        details_count: number;
        order_status: string;
        order_type: string;
        payment_method: string;
        payment_status: string;
        delivery_address: {} | null;
        created_at: string;
        updated_at: string;
    } | {
        id: number;
        user_id: number | null;
        restaurant_id: number;
        order_amount: number;
        created_at: Date | null;
        updated_at: Date | null;
        zone_id: bigint | null;
        cutlery: boolean;
        vehicle_id: bigint | null;
        pending: Date | null;
        order_status: string;
        payment_status: string;
        payment_method: string | null;
        order_type: string;
        total_tax_amount: import("@prisma/client/runtime/library").Decimal;
        delivery_charge: import("@prisma/client/runtime/library").Decimal;
        coupon_discount_amount: import("@prisma/client/runtime/library").Decimal;
        additional_charge: number;
        restaurant_discount_amount: import("@prisma/client/runtime/library").Decimal;
        delivered: Date | null;
        delivery_man_id: bigint | null;
        confirmed: Date | null;
        processing: Date | null;
        canceled: Date | null;
        handover: Date | null;
        distance: number | null;
        cancellation_note: string | null;
        tax_type: string | null;
        is_guest: boolean;
        coupon_discount_title: string | null;
        transaction_reference: string | null;
        delivery_address_id: bigint | null;
        coupon_code: string | null;
        order_note: string | null;
        checked: boolean;
        delivery_type: string | null;
        delivery_type_charge: import("@prisma/client/runtime/library").Decimal;
        schedule_at: Date | null;
        callback: string | null;
        otp: string | null;
        accepted: Date | null;
        picked_up: Date | null;
        refund_requested: Date | null;
        refunded: Date | null;
        delivery_address: string | null;
        scheduled: boolean;
        original_delivery_charge: import("@prisma/client/runtime/library").Decimal;
        failed: Date | null;
        adjusment: import("@prisma/client/runtime/library").Decimal;
        edited: boolean;
        dm_tips: number;
        processing_time: string | null;
        free_delivery_by: string | null;
        refund_request_canceled: Date | null;
        cancellation_reason: string | null;
        canceled_by: string | null;
        tax_status: string | null;
        coupon_created_by: string | null;
        discount_on_product_by: string;
        subscription_id: bigint | null;
        tax_percentage: number | null;
        delivery_instruction: string | null;
        unavailable_item_note: string | null;
        partially_paid_amount: number;
        order_proof: string | null;
        cash_back_id: bigint | null;
        extra_packaging_amount: number;
        ref_bonus_amount: number;
        bring_change_amount: number | null;
        is_pos: boolean;
    } | null>;
    orderDetails(idStr?: string): Promise<{
        id: number;
        order_id: number;
        food_id: {} | null;
        item_campaign_id: {} | null;
        price: number;
        quantity: number;
        tax_amount: number;
        discount_on_food: number;
        add_ons: {};
        total_add_on_price: number;
        variation: {};
        variant: {} | null;
        food_details: {} | null;
        food: {
            id: {} | null;
            name: string;
            image: string | null;
        };
    }[]>;
    acceptOrder(): {
        message: string;
    };
    updatePayment(): {
        message: string;
    };
    sendOtp(): {
        otp: string;
    };
    recordLocation(): {
        ok: boolean;
    };
    lastLocation(): {
        ok: boolean;
    };
    earningReport(req: AuthedRequest): Promise<{
        today: number;
        this_week: number;
        this_month: number;
        all_time: number;
    }>;
    disbursementReport(): {
        data: never[];
        total: number;
    };
    walletPayments(): {
        data: never[];
        total_size: number;
    };
    collectedCash(): {
        message: string;
    };
    walletAdjustment(): {
        message: string;
    };
    withdrawMethods(): Promise<{
        id: number;
        method_name: unknown;
        method_fields: unknown;
        is_default: unknown;
    }[]>;
    withdrawStore(): {
        message: string;
    };
    withdrawDefault(): {
        message: string;
    };
    withdrawDelete(): {
        message: string;
    };
    getWithdrawMethods(): Promise<{
        id: number;
        method_name: unknown;
        method_fields: unknown;
        is_default: unknown;
    }[]>;
    dmShift(): Promise<{
        id: number;
        name: unknown;
        start_time: unknown;
        end_time: unknown;
        is_full_day: unknown;
    }[]>;
    dmTopic(req: AuthedRequest): {
        topic: string;
    };
    submitReview(): {
        message: string;
    };
    notifications(): Promise<{
        id: number;
        title: unknown;
        description: unknown;
    }[]>;
    messageList(): {
        conversations: never[];
        total_size: number;
    };
    messageDetails(): {
        messages: never[];
    };
    messageSearch(): {
        conversations: never[];
    };
    messageSend(): {
        message: string;
    };
}
