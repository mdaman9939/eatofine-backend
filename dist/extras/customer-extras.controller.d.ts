import type { AuthedRequest } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';
export declare class CustomerExtrasController {
    private readonly prisma;
    private readonly mongo;
    constructor(prisma: PrismaService, mongo: MongoDataService);
    private useMongo;
    wishList(): {
        product: never[];
        restaurant: never[];
    };
    wishAdd(): {
        message: string;
    };
    wishRemove(): {
        message: string;
    };
    wishClear(): {
        message: string;
    };
    notifications(): Promise<{
        id: number;
        title: string | null;
        description: string | null;
        image: string | null;
        created_at: string | Date | null;
    }[]>;
    fcmToken(): {
        message: string;
    };
    updateZoneGet(): {
        ok: boolean;
    };
    updateZonePost(): {
        ok: boolean;
    };
    updateProfile(req: AuthedRequest, body: {
        f_name?: string;
        l_name?: string;
        email?: string;
        image?: string;
    }): Promise<{
        message: string;
    }>;
    walletTx(): {
        data: never[];
        total_size: number;
        limit: number;
        offset: number;
    };
    walletBonuses(): never[];
    addFund(): {
        message: string;
    };
    loyaltyTx(): {
        data: never[];
        total_size: number;
        limit: number;
        offset: number;
    };
    pointTransfer(): {
        message: string;
    };
    messageList(): {
        conversations: never[];
        total_size: number;
    };
    messageDetails(): {
        messages: never[];
    };
    messageGet(): {
        messages: never[];
        total_size: number;
    };
    messageSearch(): {
        conversations: never[];
    };
    messageSend(): {
        message: string;
    };
    subscription(): {
        data: never[];
    };
    updateInterest(): {
        ok: boolean;
    };
    suggestedFoods(): Promise<{
        products: {
            id: number;
            price: number;
            discount: number;
            tax: number;
            restaurant_id: number | null;
            category_id: number | null;
            mysql_id: number;
            name?: string | null;
            description?: string | null;
            image?: string | null;
            mysql_restaurant_id?: number | null;
            mysql_category_id?: number | null;
            status?: boolean | null;
            avg_rating?: number | null;
            legacy?: Record<string, unknown>;
        }[];
    } | {
        products: {
            id: number;
            price: number;
            discount: number;
            tax: number;
            restaurant_id: number;
            category_id: number | null;
            add_ons: string | null;
            attributes: string | null;
            variations: string | null;
            created_at: Date | null;
            updated_at: Date | null;
            name: string | null;
            status: boolean;
            image: string | null;
            order_count: number;
            rating: string | null;
            veg: boolean;
            slug: string | null;
            description: string | null;
            discount_type: string;
            recommended: boolean;
            avg_rating: number;
            item_stock: number;
            stock_type: string;
            category_ids: string | null;
            choice_options: string | null;
            tax_type: string;
            available_time_starts: Date | null;
            available_time_ends: Date | null;
            rating_count: number;
            maximum_cart_quantity: number | null;
            is_halal: boolean;
            sell_count: number;
        }[];
    }>;
    orderAgain(): never[];
    runningOrders(req: AuthedRequest): Promise<{
        id: number;
        user_id: number | null;
        restaurant_id: number;
        order_amount: number;
        mysql_id: number;
        mysql_user_id?: number | null;
        mysql_restaurant_id?: number | null;
        order_status?: string | null;
        legacy?: Record<string, unknown>;
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
        handover: Date | null;
        picked_up: Date | null;
        canceled: Date | null;
        refunded: Date | null;
        failed: Date | null;
        scheduled: boolean;
        schedule_at: Date | null;
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
        callback: string | null;
        otp: string | null;
        accepted: Date | null;
        refund_requested: Date | null;
        delivery_address: string | null;
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
    orderSubscriptionList(): {
        data: never[];
        total_size: number;
        limit: number;
        offset: number;
    };
    orderDetails(req: AuthedRequest, orderId: number): Promise<{
        id: number;
        food_id: number | null;
        order_id: number | null;
        price: number;
        tax_amount: number;
        total_add_on_price: number;
        item_campaign_id: number | null;
        discount_on_food: number | null;
        mysql_id: number;
        mysql_order_id?: number | null;
        mysql_food_id?: number | null;
        mysql_item_campaign_id?: number | null;
        legacy?: Record<string, unknown>;
    }[] | {
        id: number;
        food_id: number | null;
        order_id: number | null;
        price: number;
        tax_amount: number;
        total_add_on_price: number;
        item_campaign_id: number | null;
        discount_on_food: number | null;
        add_ons: string | null;
        created_at: Date | null;
        updated_at: Date | null;
        discount_type: string;
        category_id: number | null;
        food_details: string | null;
        quantity: number;
        variation: string | null;
        tax_status: string | null;
        discount_on_product_by: string | null;
        variant: string | null;
        discount_percentage: number | null;
        addon_discount: number | null;
    }[]>;
    cancelOrder(req: AuthedRequest, body: {
        order_id?: number;
        _method?: string;
        reason?: string;
    }): Promise<{
        message: string;
    }>;
    switchPaymentMethod(): {
        message: string;
    };
    refundReasons(): Promise<{
        id: number;
        reason: string | null;
    }[]>;
    refundRequest(req: AuthedRequest, body: {
        order_id?: number;
        customer_reason?: string;
        customer_note?: string;
    }): Promise<{
        message: string;
    }>;
    getOrderTax(): {
        total_tax_amount: number;
        tax_amount: number;
    };
    sendNotification(): {
        ok: boolean;
    };
    checkRestaurantValidation(): {
        message: string;
    };
    offlinePayment(): {
        message: string;
    };
    offlinePaymentUpdate(): {
        message: string;
    };
    foodList(idsStr?: string): Promise<{
        id: number;
        price: number;
        tax: number;
        discount: number;
        restaurant_id: number;
        category_id: number | null;
        mysql_id: number;
        name?: string | null;
        description?: string | null;
        image?: string | null;
        mysql_restaurant_id?: number | null;
        mysql_category_id?: number | null;
        status?: boolean | null;
        avg_rating?: number | null;
        legacy?: Record<string, unknown>;
    }[] | {
        id: number;
        price: number;
        tax: number;
        discount: number;
        restaurant_id: number;
        category_id: number | null;
        add_ons: string | null;
        attributes: string | null;
        variations: string | null;
        created_at: Date | null;
        updated_at: Date | null;
        name: string | null;
        status: boolean;
        image: string | null;
        order_count: number;
        rating: string | null;
        veg: boolean;
        slug: string | null;
        description: string | null;
        discount_type: string;
        recommended: boolean;
        avg_rating: number;
        item_stock: number;
        stock_type: string;
        category_ids: string | null;
        choice_options: string | null;
        tax_type: string;
        available_time_starts: Date | null;
        available_time_ends: Date | null;
        rating_count: number;
        maximum_cart_quantity: number | null;
        is_halal: boolean;
        sell_count: number;
    }[]>;
    cartAddMultiple(): {
        message: string;
    };
    deleteAddress(req: AuthedRequest, addressId: number): Promise<{
        message: string;
    }>;
    updateAddress(id: number, req: AuthedRequest, body: {
        address?: string;
        contact_person_name?: string;
        contact_person_number?: string;
        address_type?: string;
        latitude?: string;
        longitude?: string;
    }): Promise<{
        message: string;
    }>;
    setDefaultAddress(): {
        message: string;
    };
    removeAccount(): {
        message: string;
    };
}
