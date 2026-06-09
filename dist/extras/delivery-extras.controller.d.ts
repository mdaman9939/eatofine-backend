import type { AuthedRequest } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';
export declare class DeliveryExtrasController {
    private readonly prisma;
    private readonly mongo;
    constructor(prisma: PrismaService, mongo: MongoDataService);
    private useMongo;
    private shapeDmOrder;
    private dmUserMap;
    private dmRestaurantMap;
    private dmDetailsCountMap;
    private shapeDmOrderList;
    private dmOrderCount;
    profile(req: AuthedRequest): Promise<{
        id?: undefined;
        f_name?: undefined;
        l_name?: undefined;
        email?: undefined;
        phone?: undefined;
        image?: undefined;
        image_full_url?: undefined;
        identity_image?: undefined;
        status?: undefined;
        active?: undefined;
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
        image_full_url: string | null;
        identity_image: string | null;
        status: {} | null;
        active: number;
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
    } | {
        id: number;
        f_name: string | null;
        l_name: string | null;
        email: string | null;
        phone: string;
        image: string | null;
        status: boolean;
        application_status: import("@prisma/client").$Enums.delivery_men_application_status;
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
        image_full_url?: undefined;
        identity_image?: undefined;
        active?: undefined;
    }>;
    private saveImage;
    updateProfile(req: AuthedRequest, body?: Record<string, unknown>, files?: {
        image?: Express.Multer.File[];
    }): Promise<{
        message: string;
        image?: undefined;
    } | {
        message: string;
        image: string | undefined;
    }>;
    toggleActive(req: AuthedRequest, body?: Record<string, unknown>): Promise<{
        message: string;
        active: number;
    } | {
        message: string;
        active?: undefined;
    }>;
    fcmToken(): {
        message: string;
    };
    remove(): {
        message: string;
    };
    allOrders(req: AuthedRequest, offsetQ?: string, limitQ?: string, status?: string): Promise<{
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
        restaurant_name: {} | null;
        restaurant_address: {} | null;
        restaurant_phone: {} | null;
        restaurant_lat: string | null;
        restaurant_lng: string | null;
        restaurant_logo_full_url: string | null;
        restaurant_delivery_time: {};
        restaurant_model: {} | null;
        customer: {
            id: number;
            f_name: {} | null;
            l_name: {} | null;
            phone: {} | null;
            email: {} | null;
            image_full_url: string | null;
        } | null;
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
        processing: Date | null;
        scheduled: boolean;
        subscription_id: bigint | null;
        schedule_at: Date | null;
        delivery_address: string | null;
        confirmed: Date | null;
        handover: Date | null;
        picked_up: Date | null;
        canceled: Date | null;
        refunded: Date | null;
        failed: Date | null;
        distance: number | null;
        cancellation_note: string | null;
        tax_type: string | null;
        is_guest: boolean;
        order_note: string | null;
        coupon_discount_title: string | null;
        transaction_reference: string | null;
        delivery_address_id: bigint | null;
        coupon_code: string | null;
        checked: boolean;
        delivery_type: string | null;
        delivery_type_charge: import("@prisma/client/runtime/library").Decimal;
        callback: string | null;
        otp: string | null;
        accepted: Date | null;
        refund_requested: Date | null;
        original_delivery_charge: import("@prisma/client/runtime/library").Decimal;
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
    }[] | {
        total_size: number;
        limit: number;
        offset: number;
        order_count: {
            all: number;
            pending: number;
            confirmed: number;
            accepted: number;
            processing: number;
            handover: number;
            picked_up: number;
            delivered: number;
            canceled: number;
            refund_requested: number;
            refunded: number;
            refund_request_canceled: number;
            failed: number;
        };
        orders: {
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
            restaurant_name: {} | null;
            restaurant_address: {} | null;
            restaurant_phone: {} | null;
            restaurant_lat: string | null;
            restaurant_lng: string | null;
            restaurant_logo_full_url: string | null;
            restaurant_delivery_time: {};
            restaurant_model: {} | null;
            customer: {
                id: number;
                f_name: {} | null;
                l_name: {} | null;
                phone: {} | null;
                email: {} | null;
                image_full_url: string | null;
            } | null;
        }[];
    } | {
        total_size: number;
        limit: number;
        offset: number;
        order_count: {
            all: number;
        };
        orders: {
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
            processing: Date | null;
            scheduled: boolean;
            subscription_id: bigint | null;
            schedule_at: Date | null;
            delivery_address: string | null;
            confirmed: Date | null;
            handover: Date | null;
            picked_up: Date | null;
            canceled: Date | null;
            refunded: Date | null;
            failed: Date | null;
            distance: number | null;
            cancellation_note: string | null;
            tax_type: string | null;
            is_guest: boolean;
            order_note: string | null;
            coupon_discount_title: string | null;
            transaction_reference: string | null;
            delivery_address_id: bigint | null;
            coupon_code: string | null;
            checked: boolean;
            delivery_type: string | null;
            delivery_type_charge: import("@prisma/client/runtime/library").Decimal;
            callback: string | null;
            otp: string | null;
            accepted: Date | null;
            refund_requested: Date | null;
            original_delivery_charge: import("@prisma/client/runtime/library").Decimal;
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
        }[];
    }>;
    currentOrders(req: AuthedRequest, status?: string): Promise<{
        total_size: number;
        limit: number;
        offset: number;
        order_count: {
            all: number;
            pending: number;
            confirmed: number;
            accepted: number;
            processing: number;
            handover: number;
            picked_up: number;
            delivered: number;
            canceled: number;
            refund_requested: number;
            refunded: number;
            refund_request_canceled: number;
            failed: number;
        };
        orders: {
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
            restaurant_name: {} | null;
            restaurant_address: {} | null;
            restaurant_phone: {} | null;
            restaurant_lat: string | null;
            restaurant_lng: string | null;
            restaurant_logo_full_url: string | null;
            restaurant_delivery_time: {};
            restaurant_model: {} | null;
            customer: {
                id: number;
                f_name: {} | null;
                l_name: {} | null;
                phone: {} | null;
                email: {} | null;
                image_full_url: string | null;
            } | null;
        }[];
    } | {
        total_size: number;
        limit: number;
        offset: number;
        order_count: {
            all: number;
        };
        orders: never[];
    }>;
    latestOrders(req: AuthedRequest): Promise<{
        orders: {
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
            restaurant_name: {} | null;
            restaurant_address: {} | null;
            restaurant_phone: {} | null;
            restaurant_lat: string | null;
            restaurant_lng: string | null;
            restaurant_logo_full_url: string | null;
            restaurant_delivery_time: {};
            restaurant_model: {} | null;
            customer: {
                id: number;
                f_name: {} | null;
                l_name: {} | null;
                phone: {} | null;
                email: {} | null;
                image_full_url: string | null;
            } | null;
        }[];
        total_size: number;
    }>;
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
        restaurant_name: {} | null;
        restaurant_address: {} | null;
        restaurant_phone: {} | null;
        restaurant_lat: string | null;
        restaurant_lng: string | null;
        restaurant_logo_full_url: string | null;
        restaurant_delivery_time: {};
        restaurant_model: {} | null;
        customer: {
            id: number;
            f_name: {} | null;
            l_name: {} | null;
            phone: {} | null;
            email: {} | null;
            image_full_url: string | null;
        } | null;
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
        processing: Date | null;
        scheduled: boolean;
        subscription_id: bigint | null;
        schedule_at: Date | null;
        delivery_address: string | null;
        confirmed: Date | null;
        handover: Date | null;
        picked_up: Date | null;
        canceled: Date | null;
        refunded: Date | null;
        failed: Date | null;
        distance: number | null;
        cancellation_note: string | null;
        tax_type: string | null;
        is_guest: boolean;
        order_note: string | null;
        coupon_discount_title: string | null;
        transaction_reference: string | null;
        delivery_address_id: bigint | null;
        coupon_code: string | null;
        checked: boolean;
        delivery_type: string | null;
        delivery_type_charge: import("@prisma/client/runtime/library").Decimal;
        callback: string | null;
        otp: string | null;
        accepted: Date | null;
        refund_requested: Date | null;
        original_delivery_charge: import("@prisma/client/runtime/library").Decimal;
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
        food_details: {
            id: {} | null;
            name: string;
            image: string | null;
            image_full_url: string | null;
            price: number;
            quantity: number;
        };
        food: {
            id: {} | null;
            name: string;
            image: string | null;
            image_full_url: string | null;
        };
    }[]>;
    acceptOrder(req: AuthedRequest, body?: Record<string, unknown>): Promise<{
        errors: {
            code: string;
            message: string;
        }[];
        message?: undefined;
    } | {
        message: string;
        errors?: undefined;
    }>;
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
    messageList(req: AuthedRequest): Promise<{
        conversations: {
            id: number;
            type: string;
            user_id: number | null;
            name: string;
            last_message: {} | null;
            last_message_at: {} | null;
            unread: {};
        }[];
        total_size: number;
    }>;
    messageDetails(req: AuthedRequest, convId?: string): Promise<{
        messages: {
            id: number;
            sender_type: unknown;
            sender_id: number | null;
            body: unknown;
            sent_by_me: boolean;
            created_at: {} | null;
        }[];
    }>;
    messageSearch(req: AuthedRequest, q?: string): Promise<{
        conversations: {
            id: number;
            name: {};
        }[];
    }>;
    messageSend(req: AuthedRequest, body?: {
        conversation_id?: number;
        user_id?: number;
        body?: string;
    }): Promise<{
        message: string;
        errors?: undefined;
        conversation_id?: undefined;
    } | {
        errors: {
            code: string;
            message: string;
        }[];
        message?: undefined;
        conversation_id?: undefined;
    } | {
        message: string;
        conversation_id: number;
        errors?: undefined;
    }>;
}
