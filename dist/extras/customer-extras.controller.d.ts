import type { AuthedRequest } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';
import { OrderLifecycleService } from '../lifecycle/order-lifecycle.service';
import { DmWalletService } from '../wallet/dm-wallet.service';
interface MulterFile {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
}
export declare class CustomerExtrasController {
    private readonly prisma;
    private readonly mongo;
    private readonly lifecycle;
    private readonly dmWallet;
    constructor(prisma: PrismaService, mongo: MongoDataService, lifecycle: OrderLifecycleService, dmWallet: DmWalletService);
    private useMongo;
    wishList(req: AuthedRequest): Promise<{
        product: {
            id: number;
            price: number;
            discount: number;
            tax: number;
            restaurant_id: number | null;
            category_id: number | null;
            image_full_url: string | null;
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
        restaurant: {
            id: number;
            name: string | null;
            logo: string | null;
            logo_full_url: string | null;
            cover_photo_full_url: string | null;
            address: string | null;
            avg_rating: number;
            rating_count: number;
            delivery_time: string;
            free_delivery: number;
            slug: string | null;
            open: number;
            active: boolean;
            status: number;
            restaurant_status: number;
            zone_id: number | null;
            foods_count: number;
            foods: {
                id: number;
                name: string | null;
                image: string | null;
                image_full_url: string | null;
                price: number;
                avg_rating: number;
                rating_count: number;
            }[];
        }[];
    }>;
    wishAdd(req: AuthedRequest, body: {
        food_id?: number;
        restaurant_id?: number;
    }): Promise<{
        message: string;
    }>;
    wishRemove(req: AuthedRequest, foodId?: string, restaurantId?: string): Promise<{
        message: string;
    }>;
    wishClear(req: AuthedRequest): Promise<{
        message: string;
    }>;
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
    updateProfile(req: AuthedRequest, image: MulterFile | undefined, body: {
        f_name?: string;
        l_name?: string;
        email?: string;
        phone?: string;
        image?: string;
    } | undefined): Promise<{
        errors: {
            code: string;
            message: string;
        }[];
        message?: undefined;
        image?: undefined;
    } | {
        message: string;
        image: {} | null;
        errors?: undefined;
    }>;
    private walletBalance;
    private setWalletBalance;
    walletTx(req: AuthedRequest, limitStr?: string, offsetStr?: string): Promise<{
        data: never[];
        total_size: number;
        limit: number;
        offset: number;
        balance?: undefined;
    } | {
        data: {
            id: number;
            credit: number;
            debit: number;
            balance: number;
            transaction_type: {} | null;
            reference: {} | null;
            created_at: {} | null;
        }[];
        total_size: number;
        limit: number;
        offset: number;
        balance: number;
    }>;
    walletBonuses(): Promise<{
        id: number;
    }[]>;
    addFund(req: AuthedRequest, body?: Record<string, unknown>): Promise<{
        message: string;
        errors?: undefined;
        balance?: undefined;
    } | {
        errors: {
            code: string;
            message: string;
        }[];
        message?: undefined;
        balance?: undefined;
    } | {
        message: string;
        balance: number;
        errors?: undefined;
    }>;
    loyaltyTx(req: AuthedRequest, limitStr?: string, offsetStr?: string): Promise<{
        data: {
            id: number;
            credit: number;
            debit: number;
            balance: number;
            transaction_type: {} | null;
            created_at: {} | null;
        }[];
        total_size: number;
        limit: number;
        offset: number;
    }>;
    pointTransfer(req: AuthedRequest, body?: Record<string, unknown>): Promise<{
        message: string;
        errors?: undefined;
        wallet_balance?: undefined;
        loyalty_balance?: undefined;
    } | {
        errors: {
            code: string;
            message: string;
        }[];
        message?: undefined;
        wallet_balance?: undefined;
        loyalty_balance?: undefined;
    } | {
        message: string;
        wallet_balance: number;
        loyalty_balance: number;
        errors?: undefined;
    }>;
    messageList(req: AuthedRequest, type?: string, offsetQ?: string, limitQ?: string): Promise<{
        conversations: {
            id: number;
            sender_id: number;
            sender_type: string;
            receiver_id: number;
            receiver_type: string;
            unread_message_count: number;
            last_message_id: null;
            last_message_time: {} | null;
            created_at: {} | null;
            updated_at: {} | null;
            sender: Record<string, unknown>;
            receiver: Record<string, unknown>;
            last_message: {
                id: null;
                conversation_id: number;
                sender_id: number;
                message: string;
                is_seen: number;
                files: never[];
            };
        }[];
        total_size: number;
        limit: number;
        offset: number;
    }>;
    messageDetails(req: AuthedRequest, convId?: string): Promise<{
        messages: {
            id: number;
            conversation_id: number;
            sender_type: string;
            sender_id: number;
            message: string;
            body: string;
            file_full_url: string[];
            is_seen: number;
            sent_by_me: boolean;
            created_at: string | Date | null;
        }[];
    }>;
    messageGet(req: AuthedRequest, convId?: string): Promise<{
        messages: {
            id: number;
            conversation_id: number;
            sender_type: string;
            sender_id: number;
            message: string;
            body: string;
            file_full_url: string[];
            is_seen: number;
            sent_by_me: boolean;
            created_at: string | Date | null;
        }[];
        total_size: number;
    }>;
    messageSearch(req: AuthedRequest, q?: string): Promise<{
        conversations: {
            id: number;
            name: string | null | undefined;
            type: string;
        }[];
    }>;
    messageSend(req: AuthedRequest, files: MulterFile[] | undefined, rawBody: {
        conversation_id?: number | string;
        counterpart_type?: string;
        counterpart_id?: number | string;
        receiver_type?: string;
        receiver_id?: number | string;
        message?: string;
        body?: string;
    } | undefined): Promise<{
        message: string;
        conversation_id?: undefined;
        id?: undefined;
        files?: undefined;
    } | {
        message: string;
        conversation_id: number;
        id: number;
        files: string[];
    }>;
    private saveChatImages;
    subscription(req: AuthedRequest): Promise<{
        data: {
            id: number;
            restaurant_id: number | null;
            plan_name: string | null;
            frequency: string | null;
            status: string;
            created_at: string | Date | null;
        }[];
    }>;
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
        details_count: number;
        restaurant: {
            id: number;
            name: string | null;
            logo: string | null;
            logo_full_url: string | null;
        } | null;
        delivery_address: Record<string, unknown>;
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
        dm_tips: number;
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
    }[]>;
    orderSubscriptionList(req: AuthedRequest): Promise<{
        data: {
            id: number;
            restaurant_id: number | null;
            subscription_id: number | null;
            order_status: string;
            order_amount: number;
            schedule_at: string | Date | null;
            created_at: string | Date | null;
        }[];
        total_size: number;
        limit: number;
        offset: number;
    }>;
    orderDetails(req: AuthedRequest, orderId: number): Promise<{
        id: number;
        food_id: number | null;
        order_id: number | null;
        price: number;
        tax_amount: number;
        total_add_on_price: number;
        item_campaign_id: number | null;
        discount_on_food: number | null;
        customer_name: string | null;
        customer_phone: string | null;
        customer_email: string | null;
        delivery_address: string | null;
        restaurant: {
            id: number;
            name: string | null;
            phone: string | null;
            email: string | null;
            address: string | null;
            logo: string | null;
            latitude: number | null;
            longitude: number | null;
        } | null;
        delivery_man: {
            id: number;
            f_name: string | null;
            l_name: string | null;
            phone: string | null;
        } | null;
        mysql_id: number;
        mysql_order_id?: number | null;
        mysql_food_id?: number | null;
        mysql_item_campaign_id?: number | null;
        legacy?: Record<string, unknown>;
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
        refund_reasons: {
            id: number;
            reason: string | null;
            status: number;
        }[];
    }>;
    refundRequest(req: AuthedRequest, body?: {
        order_id?: number | string;
        customer_reason?: string;
        customer_note?: string;
    }): Promise<{
        errors: {
            code: string;
            message: string;
        }[];
        message?: undefined;
    } | {
        message: string;
        errors?: undefined;
    }>;
    addTip(req: AuthedRequest, body?: {
        order_id?: number | string;
        amount?: number | string;
    }): Promise<{
        errors: {
            code: string;
            message: string;
        }[];
        message?: undefined;
        tip_total?: undefined;
        credited_to_rider?: undefined;
    } | {
        message: string;
        errors?: undefined;
        tip_total?: undefined;
        credited_to_rider?: undefined;
    } | {
        message: string;
        tip_total: number;
        credited_to_rider: number;
        errors?: undefined;
    }>;
    getOrderTax(): {
        total_tax_amount: number;
        tax_amount: number;
    };
    sendNotification(): {
        ok: boolean;
    };
    sendNotificationById(): {
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
export {};
