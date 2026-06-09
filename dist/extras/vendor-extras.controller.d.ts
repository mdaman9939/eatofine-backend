import type { AuthedRequest } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';
export declare class VendorExtrasController {
    private readonly prisma;
    private readonly mongo;
    constructor(prisma: PrismaService, mongo: MongoDataService);
    private useMongo;
    private vendorRestaurant;
    private vendorRestaurantIds;
    private static readonly ONGOING_STATUSES;
    private hashPassword;
    private parseJsonish;
    profile(req: AuthedRequest): Promise<{
        id?: undefined;
        f_name?: undefined;
        l_name?: undefined;
        email?: undefined;
        phone?: undefined;
        image?: undefined;
        status?: undefined;
        cash_in_hands?: undefined;
        balance?: undefined;
        total_earning?: undefined;
        withdraw_able_balance?: undefined;
        Payable_Balance?: undefined;
        pending_withdraw?: undefined;
        total_withdrawn?: undefined;
        adjust_able?: undefined;
        over_flow_warning?: undefined;
        over_flow_block_warning?: undefined;
        dynamic_balance?: undefined;
        dynamic_balance_type?: undefined;
        show_pay_now_button?: undefined;
        order_count?: undefined;
        product_count?: undefined;
        review_count?: undefined;
        todays_order_count?: undefined;
        this_week_order_count?: undefined;
        this_month_order_count?: undefined;
        todays_earning?: undefined;
        this_week_earning?: undefined;
        this_month_earning?: undefined;
        member_since_days?: undefined;
        subscription?: undefined;
        subscription_other_data?: undefined;
        subscription_transactions?: undefined;
        roles?: undefined;
        employee_info?: undefined;
        image_full_url?: undefined;
        restaurants?: undefined;
    } | {
        id: number;
        f_name: string | null;
        l_name: string | null;
        email: string | null;
        phone: string | null;
        image: string | null;
        status: boolean | null;
        cash_in_hands: number;
        balance: number;
        total_earning: number;
        withdraw_able_balance: number;
        Payable_Balance: number;
        pending_withdraw: number;
        total_withdrawn: number;
        adjust_able: boolean;
        over_flow_warning: boolean;
        over_flow_block_warning: boolean;
        dynamic_balance: number;
        dynamic_balance_type: string;
        show_pay_now_button: boolean;
        order_count: number;
        product_count: number;
        review_count: number;
        todays_order_count: number;
        this_week_order_count: number;
        this_month_order_count: number;
        todays_earning: number;
        this_week_earning: number;
        this_month_earning: number;
        member_since_days: number;
        subscription: null;
        subscription_other_data: null;
        subscription_transactions: boolean;
        roles: never[];
        employee_info: null;
        image_full_url: string;
        restaurants: {
            id: number;
            name: string | null;
            logo: string | null;
            logo_full_url: string;
            cover_photo: string | null;
            cover_photo_full_url: string;
            status: boolean | null;
            address: string | null;
            phone: string | null;
            comission: number | null;
            minimum_order: number;
            delivery: boolean | null;
            take_away: boolean | null;
            restaurant_model: string | null;
        }[];
    } | {
        id: number;
        f_name: string;
        l_name: string | null;
        email: string;
        phone: string;
        image: string | null;
        status: boolean | null;
        restaurants: {
            id: number;
            comission: number | null;
            minimum_order: number;
            name: string;
            status: boolean;
            phone: string;
            logo: string | null;
            address: string | null;
            delivery: boolean;
            take_away: boolean;
            restaurant_model: string | null;
        }[];
        cash_in_hands?: undefined;
        balance?: undefined;
        total_earning?: undefined;
        withdraw_able_balance?: undefined;
        Payable_Balance?: undefined;
        pending_withdraw?: undefined;
        total_withdrawn?: undefined;
        adjust_able?: undefined;
        over_flow_warning?: undefined;
        over_flow_block_warning?: undefined;
        dynamic_balance?: undefined;
        dynamic_balance_type?: undefined;
        show_pay_now_button?: undefined;
        order_count?: undefined;
        product_count?: undefined;
        review_count?: undefined;
        todays_order_count?: undefined;
        this_week_order_count?: undefined;
        this_month_order_count?: undefined;
        todays_earning?: undefined;
        this_week_earning?: undefined;
        this_month_earning?: undefined;
        member_since_days?: undefined;
        subscription?: undefined;
        subscription_other_data?: undefined;
        subscription_transactions?: undefined;
        roles?: undefined;
        employee_info?: undefined;
        image_full_url?: undefined;
    }>;
    updateProfile(req: AuthedRequest, body?: Record<string, unknown>, files?: {
        image?: Express.Multer.File[];
    }): Promise<{
        message: string;
    }>;
    fcmToken(req: AuthedRequest, body?: Record<string, unknown>): Promise<{
        message: string;
    }>;
    toggleActive(req: AuthedRequest, body: {
        status?: boolean;
    }): Promise<{
        message: string;
    }>;
    toggleOpen(req: AuthedRequest, body?: Record<string, unknown>): Promise<{
        message: string;
        active: boolean;
    } | {
        message: string;
        active?: undefined;
    }>;
    announce(req: AuthedRequest, body?: Record<string, unknown>): Promise<{
        message: string;
    }>;
    bankInfo(req: AuthedRequest, body?: Record<string, unknown>): Promise<{
        message: string;
    }>;
    private buildStorageUrl;
    private storageDir;
    private saveUploaded;
    basicInfo(req: AuthedRequest, body?: Record<string, unknown>, files?: {
        logo?: Express.Multer.File[];
        cover_photo?: Express.Multer.File[];
        meta_image?: Express.Multer.File[];
    }): Promise<{
        message: string;
    }>;
    businessSetup(req: AuthedRequest, body?: Record<string, unknown>): Promise<{
        message: string;
    }>;
    addDineInTable(req: AuthedRequest, body?: Record<string, unknown>): Promise<{
        message: string;
        tables: string[];
    } | {
        message: string;
        tables?: undefined;
    }>;
    remove(): {
        message: string;
    };
    private shapeOrder;
    private vendorUserMap;
    private detailsCountMap;
    currentOrders(req: AuthedRequest): Promise<{
        id: number;
        user_id: number | null;
        restaurant_id: number;
        order_amount: number;
        details_count: number;
        order_status: string;
        order_type: string;
        payment_method: string;
        payment_status: string;
        delivery_address: {} | null;
        created_at: string;
        updated_at: string;
        customer: {
            id: number;
            f_name: {} | null;
            l_name: {} | null;
            phone: {} | null;
            email: {} | null;
            image_full_url: string | null;
        } | null;
        mysql_id: number;
        mysql_user_id?: number | null;
        mysql_restaurant_id?: number | null;
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
    }[]>;
    completedOrders(req: AuthedRequest): Promise<{
        orders: {
            id: number;
            user_id: number | null;
            restaurant_id: number;
            order_amount: number;
            details_count: number;
            order_status: string;
            order_type: string;
            payment_method: string;
            payment_status: string;
            delivery_address: {} | null;
            created_at: string;
            updated_at: string;
            customer: {
                id: number;
                f_name: {} | null;
                l_name: {} | null;
                phone: {} | null;
                email: {} | null;
                image_full_url: string | null;
            } | null;
            mysql_id: number;
            mysql_user_id?: number | null;
            mysql_restaurant_id?: number | null;
            legacy?: Record<string, unknown>;
        }[];
        total_size: number;
    } | {
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
        total_size: number;
    }>;
    vendorOrder(idStr?: string): Promise<{
        id: number;
        user_id: number | null;
        restaurant_id: number;
        order_amount: number;
        details_count: number;
        order_status: string;
        order_type: string;
        payment_method: string;
        payment_status: string;
        delivery_address: {} | null;
        created_at: string;
        updated_at: string;
        customer: {
            id: number;
            f_name: {} | null;
            l_name: {} | null;
            phone: {} | null;
            email: {} | null;
            image_full_url: string | null;
        } | null;
        mysql_id: number;
        mysql_user_id?: number | null;
        mysql_restaurant_id?: number | null;
        legacy?: Record<string, unknown>;
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
    updateOrder(): {
        message: string;
    };
    sendOrderOtp(): {
        otp: string;
        message: string;
    };
    customerAddressUpdate(): {
        message: string;
    };
    products(req: AuthedRequest, limitStr?: string, offsetStr?: string): Promise<{
        products: {
            id: number;
            price: number;
            tax: number;
            discount: number;
            restaurant_id: number;
            category_id: number | null;
            rating_count: number;
            avg_rating: number;
            rating: {};
            image: string;
            image_full_url: string;
            meta_image_full_url: string;
            stock_type: {};
            item_stock: number;
            sell_count: number;
            status: {};
            mysql_id: number;
            name?: string | null;
            description?: string | null;
            mysql_restaurant_id?: number | null;
            mysql_category_id?: number | null;
            legacy?: Record<string, unknown>;
        }[];
        total_size: number;
        limit: number;
        offset: number;
    } | {
        products: {
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
        }[];
        total_size: number;
        limit: number;
        offset: number;
    }>;
    productDetails(idStr?: string): Promise<{
        id: number;
        price: number;
        tax: number;
        discount: number;
        restaurant_id: number;
        category_id: number | null;
        rating_count: number;
        avg_rating: number;
        rating: {};
        image: string;
        image_full_url: string;
        meta_image_full_url: string;
        stock_type: {};
        item_stock: number;
        mysql_id: number;
        name?: string | null;
        description?: string | null;
        mysql_restaurant_id?: number | null;
        mysql_category_id?: number | null;
        legacy?: Record<string, unknown>;
    } | {
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
    } | null>;
    productSearch(req: AuthedRequest, name?: string): Promise<{
        products: {
            id: number;
            price: number;
            tax: number;
            discount: number;
            restaurant_id: number;
            category_id: number | null;
            image: string;
            image_full_url: string;
            status: {};
            mysql_id: number;
            name?: string | null;
            description?: string | null;
            mysql_restaurant_id?: number | null;
            mysql_category_id?: number | null;
            legacy?: Record<string, unknown>;
        }[];
        total_size: number;
    }>;
    productStatusGet(query?: Record<string, unknown>): Promise<{
        message: string;
    }>;
    productStatus(body?: Record<string, unknown>, query?: Record<string, unknown>): Promise<{
        message: string;
    }>;
    productRecommendedGet(query?: Record<string, unknown>): Promise<{
        message: string;
    }>;
    productRecommended(body?: Record<string, unknown>, query?: Record<string, unknown>): Promise<{
        message: string;
    }>;
    updateStock(body?: Record<string, unknown>): Promise<{
        message: string;
    }>;
    productStore(req: AuthedRequest, body?: Record<string, unknown>, files?: {
        image?: Express.Multer.File[];
        meta_image?: Express.Multer.File[];
    }): Promise<{
        message: string;
        errors?: undefined;
        id?: undefined;
    } | {
        errors: {
            code: string;
            message: string;
        }[];
        message?: undefined;
        id?: undefined;
    } | {
        message: string;
        id: number;
        errors?: undefined;
    }>;
    productUpdate(body?: Record<string, unknown>, files?: {
        image?: Express.Multer.File[];
        meta_image?: Express.Multer.File[];
    }): Promise<{
        message: string;
        errors?: undefined;
        matched?: undefined;
        modified?: undefined;
    } | {
        errors: {
            code: string;
            message: string;
        }[];
        message?: undefined;
        matched?: undefined;
        modified?: undefined;
    } | {
        message: string;
        matched: number;
        modified: number;
        errors?: undefined;
    }>;
    private parseProductTranslations;
    productDelete(body?: Record<string, unknown>, idQ?: string): Promise<{
        message: string;
    }>;
    productReviews(req: AuthedRequest, productIdStr?: string, restaurantIdStr?: string, search?: string): Promise<{
        id: number;
        food_id: number;
        user_id: number;
        comment: string | null;
        rating: number;
        reply: string | null;
    }[] | {
        id: number;
        food_id: number | null;
        user_id: number | null;
        order_id: number | null;
        comment: string | null;
        rating: number | null;
        reply: string | null;
        food_name: string | null;
        food_image_full_url: string | null;
        customer_name: string | null;
        customer_phone: string | null;
        customer: {
            id: number;
            f_name: string | null;
            l_name: string | null;
            phone: string | null;
            image_full_url: string | null;
        } | null;
        created_at: string | Date | null;
        updated_at: string | Date | null;
    }[]>;
    productReply(body?: Record<string, unknown>): Promise<{
        message: string;
    }>;
    productLimits(): {
        remaining: string;
    };
    categories(): Promise<{
        id: number;
        name: string | null;
        image: string | null;
        status: boolean | null;
    }[]>;
    childCategories(idStr?: string): Promise<{
        id: number;
        name: string | null;
        image: string | null;
        status: boolean | null;
    }[]>;
    childCategoriesByPath(idStr: string): Promise<{
        id: number;
        name: string | null;
        image: string | null;
        status: boolean | null;
    }[]>;
    categoryProducts(req: AuthedRequest, categoryIdStr?: string, limitStr?: string, offsetStr?: string): Promise<{
        total_size: number;
        limit: number;
        offset: number;
        products: {
            id: number;
            price: number;
            tax: number;
            discount: number;
            restaurant_id: number;
            category_id: number | null;
            rating_count: number;
            avg_rating: number;
            rating: {};
            image: string;
            image_full_url: string;
            stock_type: {};
            item_stock: number;
            status: {};
            mysql_id: number;
            name?: string | null;
            description?: string | null;
            mysql_restaurant_id?: number | null;
            mysql_category_id?: number | null;
            legacy?: Record<string, unknown>;
        }[];
    }>;
    vendorAddons(req: AuthedRequest): Promise<{
        id: number;
        restaurant_id: number;
        addon_category_id: number | null;
        price: number;
        mysql_id: number;
        mysql_restaurant_id?: number | null;
        mysql_addon_category_id?: number | null;
        name?: string | null;
        legacy?: Record<string, unknown>;
    }[] | {
        id: number;
        restaurant_id: number;
        addon_category_id: number | null;
        price: number;
        created_at: Date | null;
        updated_at: Date | null;
        name: string | null;
        status: boolean;
        stock_type: string;
        sell_count: number;
        addon_stock: number;
    }[] | {
        addons: never[];
    }>;
    addonStore(req: AuthedRequest, body?: Record<string, unknown>): Promise<{
        message: string;
        errors?: undefined;
        id?: undefined;
    } | {
        errors: {
            code: string;
            message: string;
        }[];
        message?: undefined;
        id?: undefined;
    } | {
        message: string;
        id: number;
        errors?: undefined;
    }>;
    addonUpdatePut(body?: Record<string, unknown>): Promise<{
        message: string;
        errors?: undefined;
    } | {
        errors: {
            code: string;
            message: string;
        }[];
        message?: undefined;
    }>;
    addonUpdate(body?: Record<string, unknown>): Promise<{
        message: string;
        errors?: undefined;
    } | {
        errors: {
            code: string;
            message: string;
        }[];
        message?: undefined;
    }>;
    addonDeletePost(body?: Record<string, unknown>, idQ?: string): Promise<{
        message: string;
    }>;
    addonDelete(body?: Record<string, unknown>, idQ?: string): Promise<{
        message: string;
    }>;
    attributes(): Promise<{
        id: number;
        name: string | null;
    }[]>;
    vendorDmList(req: AuthedRequest): Promise<{
        id: number;
        f_name: string | null;
        l_name: string | null;
        phone: string | null;
        status: boolean | null;
        application_status: string | null;
    }[] | {
        delivery_men: never[];
        total_size: number;
    }>;
    getDmList(req: AuthedRequest): Promise<{
        id: number;
        f_name: string | null;
        l_name: string | null;
        phone: string | null;
        status: boolean | null;
        application_status: string | null;
    }[] | {
        delivery_men: never[];
        total_size: number;
    }>;
    dmPreview(idStr?: string): Promise<{
        id: number;
        f_name: string | null;
        l_name: string | null;
        phone: string | null;
        status: boolean | null;
        application_status: string | null;
    } | null>;
    dmStore(req: AuthedRequest, body?: Record<string, unknown>, files?: {
        image?: Express.Multer.File[];
    }): Promise<{
        message: string;
        errors?: undefined;
        id?: undefined;
    } | {
        errors: {
            code: string;
            message: string;
        }[];
        message?: undefined;
        id?: undefined;
    } | {
        message: string;
        id: number;
        errors?: undefined;
    }>;
    dmUpdate(body?: Record<string, unknown>, files?: {
        image?: Express.Multer.File[];
    }): Promise<{
        message: string;
        errors?: undefined;
    } | {
        errors: {
            code: string;
            message: string;
        }[];
        message?: undefined;
    }>;
    dmDelete(body?: Record<string, unknown>, idQ?: string): Promise<{
        message: string;
    }>;
    dmStatus(body?: Record<string, unknown>): Promise<{
        message: string;
    }>;
    dmAssign(body?: Record<string, unknown>): Promise<{
        message: string;
    }>;
    private shapeCoupon;
    vendorCouponList(req: AuthedRequest): Promise<{
        data: {} | null;
        customer_id: {};
        restaurant_name: string | null;
        id: number;
        title: {} | null;
        code: {} | null;
        coupon_type: {};
        discount: number;
        discount_type: {};
        min_purchase: number;
        max_discount: number;
        start_date: {} | null;
        expire_date: {} | null;
        limit: {} | null;
        status: {};
        total_uses: number;
        restaurant_id: {} | null;
    }[]>;
    vendorCouponStore(req: AuthedRequest, body?: Record<string, unknown>): Promise<{
        message: string;
        errors?: undefined;
        id?: undefined;
    } | {
        errors: {
            code: string;
            message: string;
        }[];
        message?: undefined;
        id?: undefined;
    } | {
        message: string;
        id: number;
        errors?: undefined;
    }>;
    vendorCouponUpdatePut(body?: Record<string, unknown>): Promise<{
        message: string;
        errors?: undefined;
    } | {
        errors: {
            code: string;
            message: string;
        }[];
        message?: undefined;
    }>;
    vendorCouponUpdate(body?: Record<string, unknown>): Promise<{
        message: string;
        errors?: undefined;
    } | {
        errors: {
            code: string;
            message: string;
        }[];
        message?: undefined;
    }>;
    vendorCouponStatus(body?: Record<string, unknown>): Promise<{
        message: string;
    }>;
    vendorCouponDeletePost(body?: Record<string, unknown>, idQ?: string): Promise<{
        message: string;
    }>;
    vendorCouponDelete(body?: Record<string, unknown>, idQ?: string): Promise<{
        message: string;
    }>;
    vendorCouponView(idStr?: string): Promise<{}>;
    walletPaymentList(): {
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
        method_name: string | null;
        method_fields: {} | null;
        is_default: number | boolean | null;
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
        method_name: string | null;
        method_fields: {} | null;
        is_default: number | boolean | null;
    }[]>;
    getWithdrawList(req: AuthedRequest): Promise<{
        data: {
            id: number;
            amount: number;
            approved: {};
            withdraw_method_id: {} | null;
            created_at: {} | null;
        }[];
        total_size: number;
    }>;
    requestWithdraw(req: AuthedRequest, body?: Record<string, unknown>): Promise<{
        message: string;
        errors?: undefined;
        id?: undefined;
    } | {
        errors: {
            code: string;
            message: string;
        }[];
        message?: undefined;
        id?: undefined;
    } | {
        message: string;
        id: number;
        errors?: undefined;
    }>;
    private vendorOrdersForReports;
    earningReport(req: AuthedRequest): Promise<{
        total: number;
        today: number;
        this_week: number;
        this_month: number;
    }>;
    orderReport(req: AuthedRequest): Promise<{
        delivered: number;
        canceled: number;
        returned: number;
        total_orders: number;
        total_amount: number;
        data: {
            day: string;
            count: number;
        }[];
    }>;
    foodReport(req: AuthedRequest): Promise<{
        data: {
            food_id: number;
            total_sold_quantity: number;
            total_amount: number;
        }[];
        total_data: {
            food_id: number;
            total_sold_quantity: number;
            total_amount: number;
        }[];
    }>;
    campaignReport(): {
        data: never[];
        total_amount: number;
        total_orders: number;
    };
    taxReport(req: AuthedRequest, limitStr?: string, offsetStr?: string): Promise<{
        total_size: number;
        limit: number;
        offset: number;
        taxSummary: {
            tax_name: string;
            tax_label: string;
            total_tax: number;
        }[];
        totalOrders: number;
        totalOrderAmount: number;
        totalTax: number;
        orders: {
            id: number;
            order_amount: number;
            total_tax_amount: number;
            order_status: {} | null;
            payment_status: {} | null;
            created_at: {} | null;
            orderTaxes: never[];
        }[];
    }>;
    disbursementReport(): {
        data: never[];
        total: number;
    };
    expenseReport(req: AuthedRequest): Promise<{
        data: {
            order_id: number;
            order_amount: number;
            commission_amount: number;
            created_at: {} | null;
        }[];
        total: number;
    }>;
    transactionReport(req: AuthedRequest): Promise<{
        data: {
            order_id: number;
            order_amount: number;
            payment_method: {} | null;
            payment_status: {} | null;
            order_status: {} | null;
            created_at: {} | null;
        }[];
        total: number;
    }>;
    generateStatement(): {
        message: string;
    };
    searchedFood(): {
        products: never[];
    };
    vendorNotifications(req: AuthedRequest): Promise<{
        id: number;
        title: string | null;
        description: string | null;
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
    basicCampaigns(): never[];
    campaignJoin(): {
        message: string;
    };
    campaignLeave(): {
        message: string;
    };
    private shapeAd;
    private parseAdTranslations;
    private createAdvertisement;
    ads(req: AuthedRequest, offsetQ?: string, limitQ?: string, adsType?: string): Promise<{
        total_size: number;
        limit: number;
        offset: number;
        all: number;
        running: number;
        pending: number;
        denied: number;
        approved: number;
        expired: number;
        paused: number;
        adds: {
            id: number;
            restaurant_id: number;
            add_type: {};
            title: {} | null;
            description: {} | null;
            start_date: {} | null;
            end_date: {} | null;
            pause_note: {} | null;
            cancellation_note: {} | null;
            cover_image: {} | null;
            profile_image: {} | null;
            video_attachment: {} | null;
            priority: number;
            is_rating_active: number;
            is_review_active: number;
            is_paid: number;
            is_updated: number;
            created_by_id: number;
            created_by_type: {};
            status: {};
            active: number;
            created_at: {} | null;
            updated_at: {} | null;
            cover_image_full_url: string | null;
            profile_image_full_url: string | null;
            video_attachment_full_url: string | null;
            translations: any[];
            storage: never[];
        }[];
    }>;
    adDetails(idStr: string): Promise<{
        id: number;
        restaurant_id: number;
        add_type: {};
        title: {} | null;
        description: {} | null;
        start_date: {} | null;
        end_date: {} | null;
        pause_note: {} | null;
        cancellation_note: {} | null;
        cover_image: {} | null;
        profile_image: {} | null;
        video_attachment: {} | null;
        priority: number;
        is_rating_active: number;
        is_review_active: number;
        is_paid: number;
        is_updated: number;
        created_by_id: number;
        created_by_type: {};
        status: {};
        active: number;
        created_at: {} | null;
        updated_at: {} | null;
        cover_image_full_url: string | null;
        profile_image_full_url: string | null;
        video_attachment_full_url: string | null;
        translations: any[];
        storage: never[];
    } | null>;
    adStore(req: AuthedRequest, body?: Record<string, unknown>, files?: {
        cover_image?: Express.Multer.File[];
        profile_image?: Express.Multer.File[];
        video_attachment?: Express.Multer.File[];
    }): Promise<{
        message: string;
        errors?: undefined;
        id?: undefined;
    } | {
        errors: {
            code: string;
            message: string;
        }[];
        message?: undefined;
        id?: undefined;
    } | {
        message: string;
        id: number;
        errors?: undefined;
    }>;
    adCopy(req: AuthedRequest, body?: Record<string, unknown>, files?: {
        cover_image?: Express.Multer.File[];
        profile_image?: Express.Multer.File[];
        video_attachment?: Express.Multer.File[];
    }): Promise<{
        message: string;
        errors?: undefined;
        id?: undefined;
    } | {
        errors: {
            code: string;
            message: string;
        }[];
        message?: undefined;
        id?: undefined;
    } | {
        message: string;
        id: number;
        errors?: undefined;
    }>;
    adUpdate(idStr: string, body?: Record<string, unknown>, files?: {
        cover_image?: Express.Multer.File[];
        profile_image?: Express.Multer.File[];
        video_attachment?: Express.Multer.File[];
    }): Promise<{
        message: string;
    }>;
    adStatus(body?: Record<string, unknown>): Promise<{
        message: string;
    }>;
    adDelete(idStr: string): Promise<{
        message: string;
    }>;
    businessPlan(req: AuthedRequest): Promise<{
        commission: number;
        subscription: number;
        commission_rate: string | number;
        restaurant_id: number | null;
        restaurant_name: string | null;
    }>;
    packageView(): Promise<{
        packages: Record<string, unknown>[];
    }>;
    subscriptionTransactionsList(): {
        transactions: never[];
        total_size: number;
        limit: number;
        offset: number;
    };
    subscriptionTransaction(): {
        message: string;
    };
    subscriptionPayment(): {
        redirect_url: null;
    };
    cancelSubscription(): {
        message: string;
    };
    schedule(req: AuthedRequest): Promise<{
        id: number;
        restaurant_id: number;
        mysql_id: number;
        mysql_restaurant_id?: number | null;
        legacy?: Record<string, unknown>;
    }[] | {
        id: number;
        restaurant_id: number;
        created_at: Date | null;
        updated_at: Date | null;
        opening_time: Date | null;
        day: number;
        closing_time: Date | null;
    }[]>;
    scheduleStore(): {
        message: string;
    };
    posCustomers(): {
        users: never[];
        total_size: number;
    };
    posOrders(): {
        orders: never[];
        total_size: number;
    };
    posPlaceOrder(): {
        message: string;
    };
    characteristicSuggestions(): never[];
}
