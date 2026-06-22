import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';
import { SettlementService } from '../settlement/settlement.service';
import { OrderLifecycleService } from '../lifecycle/order-lifecycle.service';
export interface FoodWriteBody {
    name?: string;
    description?: string;
    price?: number;
    restaurant_id?: number;
    category_id?: number;
    sub_category_id?: number | null;
    discount?: number;
    discount_type?: string;
    tax?: number;
    tax_type?: string;
    veg?: boolean | string | number;
    is_halal?: boolean;
    recommended?: boolean;
    stock_type?: string;
    item_stock?: number;
    maximum_cart_quantity?: number | null;
    available_time_starts?: string;
    available_time_ends?: string;
    addon_ids?: number[] | string;
    variations?: unknown[];
    image?: string;
    meta_title?: string | null;
    meta_description?: string | null;
    meta_image?: string | null;
    translations?: Array<{
        locale?: string;
        key?: string;
        value?: string;
    }>;
    description_translations?: Array<{
        locale?: string;
        key?: string;
        value?: string;
    }>;
}
export declare class AdminService {
    private readonly prisma;
    private readonly mongo;
    private readonly settlement;
    private readonly lifecycle;
    constructor(prisma: PrismaService, mongo: MongoDataService, settlement: SettlementService, lifecycle: OrderLifecycleService);
    private useMongo;
    getMe(adminId: bigint): Promise<{
        id: number;
        f_name: string | null;
        l_name: string | null;
        email: string;
        phone: string | null;
        image: string | null;
        role_id: number | null;
        zone_id: number | null;
        created_at: Date | null;
        updated_at: Date | null;
    }>;
    updateMe(adminId: bigint, body: {
        f_name?: string;
        l_name?: string;
        email?: string;
        phone?: string;
        image?: string;
    }): Promise<{
        id: number;
        f_name: string | null;
        l_name: string | null;
        email: string;
        phone: string | null;
        image: string | null;
        role_id: number | null;
        zone_id: number | null;
        created_at: Date | null;
        updated_at: Date | null;
    }>;
    changeMyPassword(adminId: bigint, body: {
        current_password: string;
        new_password: string;
    }): Promise<{
        ok: boolean;
    }>;
    dashboardStats(): Promise<{
        orders: {
            total: number;
            pending: number;
            delivered: number;
            canceled: number;
            refunded: number;
            payment_failed: number;
            processing: number;
            picked_up: number;
            scheduled: number;
        };
        restaurants: {
            total: number;
            active: number;
        };
        users: {
            total: number;
        };
        delivery_men: {
            total: number;
        };
        vendors: {
            total: number;
        };
        food: {
            total: number;
        };
        revenue: {
            total: number;
        };
    }>;
    listOrders(limit?: number, offset?: number, status?: string, q?: string, orderType?: string): Promise<{
        total: number;
        limit: number;
        offset: number;
        orders: {
            id: number;
            user: {
                mysql_id?: number | undefined;
                f_name?: string | null | undefined;
                l_name?: string | null | undefined;
                email?: string | null | undefined;
                phone?: string | null | undefined;
                id: number;
            } | null;
            restaurant: {
                id: number;
                name: string | null | undefined;
            } | null;
            order_amount: number;
            payment_status: string | undefined;
            order_status: string | undefined;
            payment_method: string | undefined;
            order_type: string | undefined;
            delivery_charge: number;
            total_tax_amount: number;
            created_at: Date | undefined;
        }[];
    } | {
        total: number;
        limit: number;
        offset: number;
        orders: {
            id: number;
            user: {
                id: bigint;
                email: string | null;
                f_name: string | null;
                l_name: string | null;
                phone: string | null;
            } | null;
            restaurant: {
                id: bigint;
                name: string;
            } | null;
            order_amount: number;
            payment_status: string;
            order_status: string;
            payment_method: string | null;
            order_type: string;
            delivery_charge: number;
            total_tax_amount: number;
            created_at: Date | null;
        }[];
    }>;
    getOrder(id: number): Promise<{
        earnings: {
            customer_payment: number;
            food_amount: number;
            commission_pct: number;
            eatofine_commission: number;
            eatofine_platform_fee: number;
            admin_discount: number;
            restaurant_discount: number;
            eatofine_earning: number;
            restaurant_earning: number;
            deliveryman_earning: number;
            tax_amount: number;
        };
        order: {
            id: number;
            order_amount: number;
            coupon_discount_amount: number;
            total_tax_amount: number;
            delivery_charge: number;
            restaurant_discount_amount: number;
            payment_status: string | undefined;
            order_status: string | undefined;
            payment_method: string | undefined;
            order_type: string | undefined;
            table_number: string | null;
            coupon_code: string | null;
            order_note: string | null;
            delivery_address: string | null;
            cancellation_reason: string | null;
            cancel_reason: string | null;
            refund_status: string;
            canceled_by: string | null;
            timeline: {
                pending: Date | null;
                accepted: Date | null;
                confirmed: Date | null;
                processing: Date | null;
                handover: Date | null;
                picked_up: Date | null;
                delivered: Date | null;
                canceled: Date | null;
                failed: Date | null;
            };
            created_at: Date | null;
        };
        user: {
            id: number;
            f_name: string | null;
            l_name: string | null;
            email: string | null;
            phone: string | null;
        } | null;
        restaurant: {
            id: number;
            name: string | null;
            phone: string | null;
            email: string | null;
            address: string | null;
            logo: string | null;
        } | null;
        delivery_man: {
            id: number;
            f_name: string | null;
            l_name: string | null;
            phone: string | null;
        } | null;
        items: {
            id: number;
            food_id: number | null;
            price: number;
            quantity: number;
            tax_amount: number;
            total_add_on_price: number;
            variant: string | null;
            food_details: unknown;
        }[];
    } | {
        order: {
            id: number;
            order_amount: number;
            coupon_discount_amount: number;
            total_tax_amount: number;
            delivery_charge: number;
            restaurant_discount_amount: number;
            payment_status: string;
            order_status: string;
            payment_method: string | null;
            order_type: string;
            coupon_code: string | null;
            order_note: string | null;
            delivery_address: string | null;
            cancellation_reason: string | null;
            canceled_by: string | null;
            timeline: {
                pending: Date | null;
                accepted: Date | null;
                confirmed: Date | null;
                processing: Date | null;
                handover: Date | null;
                picked_up: Date | null;
                delivered: Date | null;
                canceled: Date | null;
                failed: Date | null;
            };
            created_at: Date | null;
            table_number?: undefined;
            cancel_reason?: undefined;
            refund_status?: undefined;
        };
        user: {
            id: number;
            f_name: string | null;
            l_name: string | null;
            email: string | null;
            phone: string | null;
        } | null;
        restaurant: {
            id: number;
            name: string;
            phone: string;
            email: string | null;
            address: string | null;
            logo: string | null;
        } | null;
        delivery_man: {
            id: number;
            f_name: string | null;
            l_name: string | null;
            phone: string;
        } | null;
        items: {
            id: number;
            food_id: number | null;
            price: number;
            quantity: number;
            tax_amount: number;
            total_add_on_price: number;
            variant: string | null;
            food_details: unknown;
        }[];
        earnings?: undefined;
    }>;
    updateOrderStatus(id: number, status: string, reason?: string): Promise<{
        ok: boolean;
        id: number;
        status: string;
    }>;
    listRestaurants(limit?: number, offset?: number, q?: string): Promise<{
        total: number;
        limit: number;
        offset: number;
        restaurants: {
            id: number;
            name: string | null;
            email: string | null;
            phone: string | null;
            status: boolean | undefined;
            active: boolean | undefined;
            address: string | null;
            logo: string | null;
            latitude: number | undefined;
            longitude: number | undefined;
            zone_id: number | null;
            vendor_id: number;
            comission: number | null;
            minimum_order: number;
            restaurant_model: string | undefined;
            order_count: number;
            created_at: Date | undefined;
        }[];
    } | {
        total: number;
        limit: number;
        offset: number;
        restaurants: {
            id: number;
            zone_id: number | null;
            vendor_id: number;
            comission: number | null;
            minimum_order: number;
            created_at: Date | null;
            name: string;
            status: boolean;
            email: string | null;
            phone: string;
            order_count: number;
            logo: string | null;
            latitude: string | null;
            longitude: string | null;
            address: string | null;
            delivery: boolean;
            take_away: boolean;
            active: boolean;
            restaurant_model: string | null;
        }[];
    }>;
    getRestaurant(id: number): Promise<{
        restaurant: {
            id: number;
            zone_id: number;
            vendor_id: number;
            comission: number;
            minimum_order: number;
            tax: number;
            minimum_shipping_charge: number;
            restaurant_model: string;
            delivery_time: string;
            latitude: {};
            longitude: {};
            logo_full_url: string | null;
            cover_photo_full_url: string | null;
            license_document_full_url: string | null;
            additional_documents_full_urls: (string | null)[];
            mysql_id: number;
            name: string | null;
            email: string | null;
            phone: string | null;
            status?: boolean;
            active?: boolean;
            address: string | null;
            logo: string | null;
            mysql_zone_id?: number;
            mysql_vendor_id?: number;
            delivery?: boolean;
            take_away?: boolean;
            order_count?: number;
            created_at?: Date;
        };
        vendor: {
            id: number;
            f_name: string | null;
            l_name: string | null;
            email: string | null;
            phone: string | null;
        };
        stats: {
            food_count: number;
            order_count: number;
            revenue: number;
        };
    } | {
        restaurant: {
            id: number;
            zone_id: number | null;
            vendor_id: number;
            comission: number | null;
            minimum_order: number;
            tax: number;
            minimum_shipping_charge: number;
            created_at: Date | null;
            updated_at: Date | null;
            name: string;
            status: boolean;
            email: string | null;
            phone: string;
            order_count: number;
            logo: string | null;
            latitude: string | null;
            longitude: string | null;
            address: string | null;
            footer_text: string | null;
            schedule_order: boolean;
            opening_time: Date | null;
            closeing_time: Date | null;
            free_delivery: boolean;
            rating: string | null;
            cover_photo: string | null;
            delivery: boolean;
            take_away: boolean;
            food_section: boolean;
            reviews_section: boolean;
            active: boolean;
            off_day: string;
            gst: string | null;
            self_delivery_system: boolean;
            pos_system: boolean;
            delivery_time: string | null;
            veg: boolean;
            non_veg: boolean;
            total_order: number;
            per_km_shipping_charge: number | null;
            restaurant_model: string | null;
            maximum_shipping_charge: number | null;
            slug: string | null;
            order_subscription_active: boolean | null;
            cutlery: boolean;
            meta_title: string | null;
            meta_description: string | null;
            meta_image: string | null;
            meta_data: string | null;
            announcement: boolean;
            announcement_message: string | null;
            qr_code: string | null;
            free_delivery_distance: string | null;
            additional_data: string | null;
            additional_documents: string | null;
            package_id: bigint | null;
            tin: string | null;
            tin_expire_date: Date | null;
            tin_certificate_image: string | null;
        };
        vendor: {
            id: number;
            f_name: string;
            l_name: string | null;
            email: string;
            phone: string;
        } | null;
        stats: {
            food_count: number;
            order_count: number;
            revenue: number;
        };
    }>;
    updateRestaurant(id: number, body: {
        name?: string;
        email?: string;
        phone?: string;
        address?: string;
        comission?: number;
        minimum_order?: number;
        status?: boolean;
        active?: boolean;
        latitude?: string | number;
        longitude?: string | number;
        password?: string;
        zone_id?: number;
        cuisine_ids?: number[] | string;
        tax?: number;
        minimum_delivery_time?: number;
        maximum_delivery_time?: number;
        delivery_time_type?: string;
        logo?: string;
        cover_photo?: string;
        veg?: boolean;
        non_veg?: boolean;
        delivery?: boolean;
        take_away?: boolean;
        restaurant_model?: string;
        identity_number?: string;
        state?: string;
        license_document?: string;
        business_name?: string;
        gstin?: string;
        fssai?: string;
        cin?: string;
    }): Promise<{
        ok: boolean;
        id: number;
    }>;
    getRestaurantTabs(id: number, limit?: number): Promise<{
        foods: never[];
        orders: never[];
        reviews: never[];
        transactions: never[];
        wallet: {
            total_earning: number;
            commission_paid: number;
            delivered_count: number;
            total_orders: number;
            avg_rating: number;
            rating_count: number;
        };
    } | {
        foods: {
            id: number;
            name: {} | null;
            price: number;
            image: {} | null;
            status: {};
            veg: {} | null;
        }[];
        orders: {
            id: number;
            order_amount: number;
            order_status: {} | null;
            payment_status: {} | null;
            order_type: {} | null;
            created_at: {} | null;
        }[];
        reviews: {
            id: number;
            rating: number;
            comment: {} | null;
            reply: {} | null;
            food_id: number | null;
            customer: string | null;
        }[];
        transactions: {
            id: number;
            order_amount: number;
            commission: number;
            restaurant_earning: number;
            order_status: {} | null;
            created_at: {} | null;
        }[];
        wallet: {
            total_earning: number;
            commission_paid: number;
            restaurant_earning: number;
            delivered_count: number;
            total_orders: number;
            avg_rating: number;
            rating_count: number;
        };
    }>;
    listUsers(limit?: number, offset?: number, q?: string): Promise<{
        total: number;
        limit: number;
        offset: number;
        users: {
            id: number;
            f_name: string | null;
            l_name: string | null;
            email: string | null;
            phone: string | null;
            status: boolean | undefined;
            created_at: Date | undefined;
        }[];
    } | {
        total: number;
        limit: number;
        offset: number;
        users: {
            id: number;
            created_at: Date | null;
            status: boolean;
            email: string | null;
            f_name: string | null;
            l_name: string | null;
            phone: string | null;
        }[];
    }>;
    private buildMongoSearchFilter;
    getUser(id: number): Promise<{
        user: {
            id: number;
            f_name: string | null;
            l_name: string | null;
            email: string | null;
            phone: string | null;
            status: boolean | undefined;
            is_phone_verified: boolean | undefined;
            is_email_verified: boolean | undefined;
            login_medium: string | null | undefined;
            created_at: Date | undefined;
        };
        stats: {
            order_count: number;
            total_spend: number;
            wallet_balance: number;
            avg_order_value: number;
            breakdown: {
                delivered: number;
                ongoing: number;
                canceled: number;
                refunded: number;
            };
        };
        addresses: {
            id: number;
            address_type: {} | null;
            address: {} | null;
            contact_person_name: {} | null;
            contact_person_number: {} | null;
        }[];
        recent_orders: {
            id: number;
            order_amount: number;
            order_status: {} | null;
            payment_status: {} | null;
            created_at: {} | null;
        }[];
    } | {
        user: {
            id: number;
            f_name: string | null;
            l_name: string | null;
            email: string | null;
            phone: string | null;
            status: boolean;
            is_phone_verified: boolean;
            is_email_verified: boolean;
            login_medium: string | null;
            created_at: Date | null;
        };
        stats: {
            order_count: number;
            total_spend: number;
            wallet_balance?: undefined;
            avg_order_value?: undefined;
            breakdown?: undefined;
        };
        addresses?: undefined;
        recent_orders?: undefined;
    }>;
    updateUserStatus(id: number, status: boolean): Promise<{
        ok: boolean;
        id: number;
        status: boolean;
    }>;
    listVendors(limit?: number, offset?: number, q?: string): Promise<{
        total: number;
        limit: number;
        offset: number;
        vendors: {
            id: number;
            f_name: string | null;
            l_name: string | null;
            email: string | null;
            phone: string | null;
            status: boolean | undefined;
            image: string | null;
            created_at: Date | undefined;
        }[];
    } | {
        total: number;
        limit: number;
        offset: number;
        vendors: {
            id: number;
            created_at: Date | null;
            status: boolean | null;
            email: string;
            f_name: string;
            l_name: string | null;
            phone: string;
            image: string | null;
        }[];
    }>;
    updateVendorStatus(id: number, status: boolean): Promise<{
        ok: boolean;
        id: number;
        status: boolean;
    }>;
    listDeliveryMen(limit?: number, offset?: number, q?: string): Promise<{
        total: number;
        limit: number;
        offset: number;
        delivery_men: {
            id: number;
            f_name: string | null;
            l_name: string | null;
            email: string | null;
            phone: string | null;
            status: boolean | undefined;
            application_status: string | null;
            image: string | null;
            zone_id: number | null;
            created_at: Date | undefined;
        }[];
    } | {
        total: number;
        limit: number;
        offset: number;
        delivery_men: {
            id: number;
            zone_id: number | null;
            created_at: Date | null;
            status: boolean;
            email: string | null;
            f_name: string | null;
            l_name: string | null;
            phone: string;
            image: string | null;
            application_status: import("@prisma/client").$Enums.delivery_men_application_status;
        }[];
    }>;
    getDeliveryMan(id: number): Promise<{
        delivery_man: {
            id: number;
            zone_id: {} | null;
            vehicle_id: {} | null;
            shift_id: {} | null;
            dob: {} | null;
            image_full_url: string | null;
            license_image_full_url: string | null;
            identity_image_full_urls: (string | null)[];
        };
    }>;
    updateDeliveryMan(id: number, body: {
        f_name?: string;
        l_name?: string;
        email?: string;
        phone?: string;
        password?: string;
        zone_id?: number;
        vehicle_id?: number;
        dm_type?: string;
        shift_id?: number | null;
        age?: number;
        dob?: string;
        identity_type?: string;
        identity_number?: string;
        image?: string;
        license_image?: string;
        status?: boolean;
    }): Promise<{
        ok: boolean;
        id: number;
    }>;
    updateDeliveryManStatus(id: number, status: boolean): Promise<{
        ok: boolean;
        id: number;
        status: boolean;
    }>;
    deleteDeliveryMan(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    approveDeliveryMan(id: number, approval: 'approved' | 'denied'): Promise<{
        ok: boolean;
        id: number;
        application_status: "approved" | "denied";
    }>;
    listFood(limit?: number, offset?: number, q?: string, restaurantId?: number): Promise<{
        total: number;
        limit: number;
        offset: number;
        food: {
            id: number;
            name: string | null;
            image: string | null;
            price: number;
            discount: number;
            discount_type: string | undefined;
            veg: boolean;
            status: boolean;
            restaurant_id: number;
            category_id: number;
            avg_rating: number;
            order_count: number;
            recommended: boolean;
            item_stock: number;
            stock_type: string | undefined;
            restaurant: {
                id: number | undefined;
                name: string | null;
            };
        }[];
    } | {
        total: number;
        limit: number;
        offset: number;
        food: {
            id: number;
            restaurant_id: number;
            restaurant: {
                id: bigint;
                name: string;
            } | null;
            category_id: number | null;
            price: number;
            discount: number;
            name: string | null;
            status: boolean;
            image: string | null;
            order_count: number;
            veg: boolean;
            discount_type: string;
            recommended: boolean;
            avg_rating: number;
            item_stock: number;
            stock_type: string;
        }[];
    }>;
    getFood(id: number): Promise<{
        food: {
            id: number;
            restaurant_id: number;
            category_id: number | null;
            sub_category_id: number | null;
            price: number;
            tax: number;
            discount: number;
            variations: any[];
            add_ons: any[];
            addon_ids: any[];
            translations: any[];
            image_full_url: string | null;
            request_status: string;
            rejection_reason: string | null;
        };
        restaurant: {
            id: number;
            name: string | null;
        } | null;
    } | {
        food: {
            id: number;
            restaurant_id: number;
            category_id: number | null;
            price: number;
            tax: number;
            discount: number;
            variations: unknown;
            add_ons: unknown;
            attributes: unknown;
            choice_options: unknown;
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
            tax_type: string;
            available_time_starts: Date | null;
            available_time_ends: Date | null;
            rating_count: number;
            maximum_cart_quantity: number | null;
            is_halal: boolean;
            sell_count: number;
        };
        restaurant: {
            id: number;
            name: string;
        } | null;
    }>;
    listPendingFood(): Promise<{
        total: number;
        items: {
            id: number;
            name: string;
            price: number;
            veg: boolean;
            image_full_url: string | null;
            restaurant_id: number | null;
            restaurant_name: string;
            submitted_at: Date | null;
            status: string;
        }[];
    }>;
    updateFoodApproval(id: number, decision: 'approved' | 'denied', reason?: string): Promise<{
        ok: boolean;
        id: number;
        decision: "approved" | "denied";
    }>;
    updateFoodStatus(id: number, status: boolean): Promise<{
        ok: boolean;
        id: number;
        status: boolean;
    }>;
    updateFoodRecommended(id: number, recommended: boolean): Promise<{
        ok: boolean;
        id: number;
        recommended: boolean;
    }>;
    deleteFood(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    listCategories(parentId?: number): Promise<{
        categories: {
            id: number;
            name: string;
            image: string | null;
            parent_id: number;
            position: number;
            status: boolean;
            priority: number;
            slug: string | null;
            meta_title: string | null;
            meta_description: string | null;
            meta_image: string | null;
            meta_data: string | null;
            created_at: Date | null;
            updated_at: Date | null;
        }[];
    }>;
    bulkExportCategories(): Promise<{
        total: number;
        rows: {
            id: number;
            name: string;
            parent_id: number;
            position: number;
            priority: number;
            status: number;
        }[];
    }>;
    bulkImportCategories(rows: Array<Record<string, unknown>>): Promise<{
        ok: boolean;
        created: number;
        failed: number;
        errors: string[];
    }>;
    createCategory(body: {
        name: string;
        parent_id?: number;
        position?: number;
        priority?: number;
        image?: string | null;
        translations?: Array<{
            locale?: string;
            key?: string;
            value?: string;
        }>;
    }): Promise<{
        ok: boolean;
        id: number;
    }>;
    updateCategory(id: number, body: {
        name?: string;
        status?: boolean;
        priority?: number;
        position?: number;
        parent_id?: number;
        translations?: Array<{
            locale?: string;
            key?: string;
            value?: string;
        }>;
    }): Promise<{
        ok: boolean;
        id: number;
    }>;
    deleteCategory(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    listCuisines(): Promise<{
        cuisines: {
            id: number;
            name: string;
            image: string | null;
            status: boolean;
            slug: string | null;
            meta_title: string | null;
            meta_description: string | null;
            meta_image: string | null;
            meta_data: string | null;
            created_at: Date | null;
            updated_at: Date | null;
        }[];
    }>;
    createCuisine(body: {
        name: string;
        image?: string | null;
    }): Promise<{
        ok: boolean;
        id: number;
    }>;
    updateRecord(collection: string, id: number, body: Record<string, unknown>, allowed: string[]): Promise<{
        ok: true;
        id: number;
    }>;
    updateCuisine(id: number, body: {
        name?: string;
        status?: boolean;
    }): Promise<{
        ok: boolean;
        id: number;
    }>;
    deleteCuisine(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    listCoupons(): Promise<{
        coupons: {
            id: number;
            restaurant_id: number | null;
            min_purchase: number;
            max_discount: number;
            discount: number;
            total_uses: number;
            limit: number | null;
            created_at: Date | null;
            updated_at: Date | null;
            status: boolean;
            data: string | null;
            slug: string | null;
            discount_type: string;
            title: string | null;
            code: string | null;
            coupon_type: string;
            start_date: Date | null;
            expire_date: Date | null;
            customer_id: string | null;
            created_by: string | null;
        }[];
    }>;
    createCoupon(body: {
        title: string;
        code: string;
        discount: number;
        discount_type?: string;
        min_purchase?: number;
        max_discount?: number;
        start_date?: string;
        expire_date?: string;
        limit?: number;
        coupon_type?: string;
        discount_owner?: string;
        admin_discount_amount?: number;
        restaurant_discount_amount?: number;
        restaurant_id?: number | null;
        zone_id?: number | null;
        customer_id?: number | string | null;
    }): Promise<{
        ok: boolean;
        id: number;
    }>;
    updateCoupon(id: number, body: {
        title?: string;
        discount?: number;
        discount_type?: string;
        min_purchase?: number;
        max_discount?: number;
        start_date?: string;
        expire_date?: string;
        limit?: number;
        coupon_type?: string;
        restaurant_id?: number | null;
        zone_id?: number | null;
        status?: boolean;
    }): Promise<{
        ok: boolean;
        id: number;
    }>;
    updateCouponStatus(id: number, status: boolean): Promise<{
        ok: boolean;
        id: number;
        status: boolean;
    }>;
    deleteCoupon(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    listBanners(): Promise<{
        banners: {
            id: number;
            title: string;
            type: string;
            image: string | null;
            status: boolean;
            data: string;
            zone_id: number;
            created_at: Date | null;
            updated_at: Date | null;
        }[];
    }>;
    createBanner(body: {
        title: string;
        type: string;
        zone_id: number;
        data?: string;
        image?: string | null;
    }): Promise<{
        ok: boolean;
        id: number;
    }>;
    updateBanner(id: number, body: {
        title?: string;
        type?: string;
        zone_id?: number;
        data?: string;
        image?: string | null;
        status?: boolean;
    }): Promise<{
        ok: boolean;
        id: number;
    }>;
    updateBannerStatus(id: number, status: boolean): Promise<{
        ok: boolean;
        id: number;
        status: boolean;
    }>;
    deleteBanner(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    listZones(zoneFor?: string): Promise<{
        zones: {
            id: number;
            restaurant_count: number;
            created_at: Date | null;
            name: string;
            status: boolean;
            minimum_shipping_charge: number | null;
            per_km_shipping_charge: number | null;
            maximum_shipping_charge: number | null;
            is_default: boolean;
            max_cod_order_amount: number | null;
            minimum_delivery_time: number | null;
            display_name: string | null;
        }[];
    }>;
    updateZoneStatus(id: number, status: boolean): Promise<{
        ok: boolean;
        id: number;
        status: boolean;
    }>;
    createZone(body: {
        name?: string;
        display_name?: string;
        minimum_shipping_charge?: number;
        per_km_shipping_charge?: number;
        maximum_shipping_charge?: number;
        minimum_delivery_time?: number;
        max_cod_order_amount?: number;
        is_default?: boolean;
        coordinates?: Array<{
            lat: number;
            lng: number;
        }>;
        zone_for?: string;
    }): Promise<{
        ok: boolean;
        id: number;
        name: string;
    }>;
    getZone(id: number): Promise<{
        zone: {
            id: number;
            name: string;
            display_name: string;
            coordinates: any[];
            status: boolean;
            is_default: boolean;
            zone_for: string;
            minimum_shipping_charge: number;
            per_km_shipping_charge: number;
            maximum_shipping_charge: number;
            minimum_delivery_time: number;
            max_cod_order_amount: number;
        };
    }>;
    updateZone(id: number, body: {
        name?: string;
        display_name?: string;
        minimum_shipping_charge?: number;
        per_km_shipping_charge?: number;
        maximum_shipping_charge?: number;
        minimum_delivery_time?: number;
        max_cod_order_amount?: number;
        is_default?: boolean;
        coordinates?: Array<{
            lat: number;
            lng: number;
        }>;
        zone_for?: string;
    }): Promise<{
        ok: boolean;
        id: number;
    }>;
    createRestaurant(body: {
        name?: string;
        email?: string;
        phone?: string;
        restaurant_phone?: string;
        address?: string;
        minimum_order?: number;
        zone_id?: number;
        vendor_id?: number;
        delivery?: boolean;
        take_away?: boolean;
        f_name?: string;
        l_name?: string;
        password?: string;
        latitude?: string | number;
        longitude?: string | number;
        minimum_delivery_time?: number;
        maximum_delivery_time?: number;
        delivery_time_type?: string;
        tax?: number;
        comission?: number;
        logo?: string;
        cover_photo?: string;
        cuisine_ids?: number[] | string;
        restaurant_model?: string;
        veg?: boolean;
        non_veg?: boolean;
        documents?: string[];
        translations?: Array<{
            locale?: string;
            key?: string;
            value?: string;
        }>;
        address_translations?: Array<{
            locale?: string;
            key?: string;
            value?: string;
        }>;
        identity_number?: string;
        state?: string;
        license_document?: string;
        [key: string]: unknown;
    }): Promise<{
        ok: boolean;
        id: number;
        name: string;
        vendor_id: number | null;
    }>;
    createDeliveryMan(body: {
        f_name?: string;
        l_name?: string;
        email?: string;
        phone?: string;
        password?: string;
        zone_id?: number;
        vehicle_id?: number;
        image?: string;
        dm_type?: string;
        shift_id?: number | null;
        age?: number;
        dob?: string;
        identity_type?: string;
        identity_number?: string;
        identity_image?: string[] | string;
        license_image?: string;
    }): Promise<{
        ok: boolean;
        id: number;
        name: string;
    }>;
    createFood(body: FoodWriteBody): Promise<{
        ok: boolean;
        id: number;
        name: string;
    }>;
    updateFood(id: number, body: FoodWriteBody): Promise<{
        ok: boolean;
        id: number;
    }>;
    private normaliseIdArray;
    createPosOrder(body: {
        restaurant_id?: number;
        items?: Array<{
            food_id?: number;
            name?: string;
            price?: number;
            quantity?: number;
            add_ons?: Array<{
                id?: number;
                name?: string;
                price?: number;
            }>;
        }>;
        customer_name?: string;
        customer_phone?: string;
        address?: string;
        order_type?: string;
        table_number?: string | number;
        payment_method?: string;
        discount?: number;
        tax_percent?: number;
        delivery_charge?: number;
        additional_charge?: number;
        extra_packaging_amount?: number;
        order_note?: string;
    }, createdBy?: {
        kind: string;
        id: number;
    }): Promise<{
        ok: boolean;
        id: number;
        order_amount: number;
    }>;
    bulkImportRestaurants(rows: Array<Record<string, unknown>>): Promise<{
        ok: boolean;
        inserted: number;
        failed: number;
        total: number;
    }>;
    bulkExportRestaurants(): Promise<{
        total: number;
        rows: {
            id: number;
            name: string;
            email: string;
            phone: string;
            address: string;
            minimum_order: number;
            zone_id: string | number;
            status: string;
        }[];
    }>;
    bulkImportFood(rows: Array<Record<string, unknown>>): Promise<{
        ok: boolean;
        inserted: number;
        failed: number;
        total: number;
    }>;
    bulkExportFood(): Promise<{
        total: number;
        rows: {
            id: number;
            name: string;
            description: string;
            price: number;
            tax: number;
            discount: number;
            restaurant_id: string | number;
            category_id: string | number;
            status: string;
        }[];
    }>;
    listNewsletterSubscribers(limit: number): Promise<{
        total: number;
        items: {
            id: number;
            email: string;
            source: string;
            status: string;
            created_at: Date | null;
        }[];
    }>;
    deleteNewsletterSubscriber(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    listPendingRestaurants(): Promise<{
        total: number;
        items: {
            id: number;
            name: string;
            email: string | null;
            phone: string | null;
            address: string | null;
            vendor_id: number | null;
            submitted_at: Date | null;
            status: string;
        }[];
    }>;
    updateRestaurantApproval(id: number, decision: 'approved' | 'rejected', reason?: string): Promise<{
        ok: boolean;
        id: number;
        decision: "approved" | "rejected";
    }>;
    listPendingDeliveryMen(): Promise<{
        total: number;
        items: {
            id: number;
            name: string;
            email: string | null;
            phone: string | null;
            zone_id: number | null;
            vehicle_id: number | null;
            submitted_at: Date | null;
            status: string;
        }[];
    }>;
    listDeniedDeliveryMen(): Promise<{
        total: number;
        items: {
            id: number;
            name: string;
            email: string | null;
            phone: string | null;
            zone_id: number | null;
            vehicle_id: number | null;
            job_type: string | null;
            reason: string | null;
            denied_at: Date | null;
            status: string;
        }[];
    }>;
    updateDeliveryManApproval(id: number, decision: 'approved' | 'rejected', reason?: string): Promise<{
        ok: boolean;
        id: number;
        decision: "approved" | "rejected";
    }>;
    addCustomerWalletFund(body: {
        user_id?: number;
        amount?: number;
        reason?: string;
    }): Promise<{
        ok: boolean;
        transaction_id: number;
        user_id: number;
        customer_name: string;
        amount: number;
        new_balance: number;
    }>;
    listCustomerWalletFundHistory(limit: number): Promise<{
        total: number;
        items: {
            id: number;
            user_id: number | null;
            customer_name: string;
            amount: number;
            reason: string;
            created_at: Date | null;
        }[];
    }>;
    getPublicPage(slug: string): Promise<{
        slug: string;
        title: null;
        content: string;
        updated_at: null;
    } | {
        slug: string;
        title: string;
        content: string;
        updated_at: Date | null;
    }>;
    upsertPublicPage(slug: string, body: {
        content?: string;
        title?: string;
    }): Promise<{
        ok: boolean;
        slug: string;
    }>;
    private defaultPageTitle;
    listPromotionalBanners(): Promise<{
        total: number;
        items: {
            id: number;
            title: string;
            subtitle: string | null;
            image: string | null;
            type: string;
            target: string | null;
            cta_text: string;
            status: boolean;
            zone_id: number | null;
            created_at: Date | null;
        }[];
    }>;
    createPromotionalBanner(body: {
        title?: string;
        subtitle?: string;
        image?: string;
        type?: string;
        target?: string;
        cta_text?: string;
        zone_id?: number;
    }): Promise<{
        ok: boolean;
        id: number;
    }>;
    togglePromotionalBanner(id: number, status: boolean): Promise<{
        ok: boolean;
        id: number;
        status: boolean;
    }>;
    deletePromotionalBanner(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    listEmailTemplates(): Promise<{
        total: number;
        items: {
            id: number;
            event: string;
            audience: string;
            subject: string;
            body: string;
            status: boolean;
            updated_at: Date | null;
        }[];
    }>;
    createEmailTemplate(body: {
        event?: string;
        audience?: string;
        subject?: string;
        body?: string;
    }): Promise<{
        ok: boolean;
        id: number;
    }>;
    updateEmailTemplate(id: number, body: {
        subject?: string;
        body?: string;
        status?: boolean;
    }): Promise<{
        ok: boolean;
        id: number;
    }>;
    deleteEmailTemplate(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    listDmBonuses(): Promise<{
        total: number;
        items: {
            id: number;
            name: string;
            type: string;
            amount: number;
            trigger: string;
            threshold: number;
            period: string;
            status: boolean;
            claims_30d: number;
            created_at: Date | null;
        }[];
    }>;
    createDmBonus(body: {
        name?: string;
        type?: string;
        amount?: number;
        trigger?: string;
        threshold?: number;
        period?: string;
    }): Promise<{
        ok: boolean;
        id: number;
    }>;
    toggleDmBonus(id: number, status: boolean): Promise<{
        ok: boolean;
        id: number;
        status: boolean;
    }>;
    deleteDmBonus(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    listDmIncentives(status?: string): Promise<{
        total: number;
        items: {
            id: number;
            dm_id: number | null;
            dm_name: string;
            zone_id: number | null;
            zone_name: string;
            total_earning: number;
            period: string;
            deliveries: number;
            claim_amount: number;
            status: string;
            reason: string | null;
            created_at: Date | null;
        }[];
    }>;
    updateDmIncentiveStatus(id: number, status: 'approved' | 'rejected', reason?: string): Promise<{
        ok: boolean;
        id: number;
        status: string;
    }>;
    createDmIncentive(body: {
        dm_id?: number;
        period?: string;
        deliveries?: number;
        claim_amount?: number;
    }): Promise<{
        ok: boolean;
        id: number;
    }>;
    updateDmIncentive(id: number, body: {
        period?: string;
        deliveries?: number;
        claim_amount?: number;
    }): Promise<{
        ok: boolean;
        id: number;
    }>;
    deleteDmIncentive(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    deleteDmReview(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    listSubscriptionOrders(): Promise<{
        total: number;
        items: {
            id: number;
            customer: string;
            restaurant: string;
            plan: string;
            frequency: string;
            status: string;
            start_date: Date | null;
        }[];
    }>;
    updateSubscriptionStatus(id: number, status: string): Promise<{
        ok: boolean;
        id: number;
        status: string;
    }>;
    listActivityLog(limit: number): Promise<{
        total: number;
        items: {
            id: number;
            admin_email: string;
            action: string;
            target: string;
            ip: string | null;
            created_at: Date | null;
        }[];
    }>;
    listDispatchOrders(type?: string): Promise<{
        items: never[];
        total: number;
        type?: undefined;
    } | {
        total: number;
        type: string;
        items: {
            id: number;
            customer: string;
            restaurant: string;
            order_amount: number;
            address: string;
            wait_minutes: number;
            assigned_to: number | null;
        }[];
    }>;
    assignOrderToDeliveryMan(orderId: number, deliveryManId: number): Promise<{
        ok: boolean;
        order_id: number;
        delivery_man_id: number;
    }>;
    listGalleryFiles(folder?: string): Promise<{
        total: number;
        folders: {
            name: string;
            count: number;
        }[];
        files: {
            name: string;
            folder: string;
            size_bytes: number;
            url: string;
            modified: Date | null;
        }[];
    }>;
    cleanDatabaseCollections(body: {
        collections?: string[];
        confirm?: string;
    }): Promise<{
        ok: boolean;
        cleared: Record<string, number>;
    }>;
    logActivity(adminEmail: string, action: string, target: string, ip: string, meta?: Record<string, unknown>): Promise<void>;
    deleteZone(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    listBusinessSettings(prefix?: string): Promise<{
        settings: {
            id: number;
            key: string;
            value: string | null;
        }[];
    }>;
    upsertBusinessSettings(body: {
        settings: Array<{
            key: string;
            value: string | null;
        }>;
    }): Promise<{
        ok: boolean;
        updated: number;
    }>;
    salesSummary(days?: number, opts?: {
        from?: string;
        to?: string;
        zoneId?: number;
        restaurantId?: number;
    }): Promise<{
        days: number;
        total_revenue: number;
        total_orders: number;
        series: {
            day: string;
            revenue: number;
            orders: number;
            tax: number;
            delivery: number;
        }[];
    }>;
    transactionDetails(opts?: ReportFilterOpts & {
        days?: number;
    }): Promise<{
        total: number;
        rows: {
            order_id: number;
            restaurant: string | null;
            customer_name: string | null;
            total_item_amount: number;
            item_discount: number;
            coupon_discount: number;
            referral_discount: number;
            discounted_amount: number;
            vat_tax: number;
            delivery_charge: number;
            order_amount: number;
            admin_discount: number;
            restaurant_discount: number;
            admin_commission: number;
            service_charge: number;
            extra_packaging_amount: number;
            commission_on_delivery_charge: number;
            admin_net_income: number;
            restaurant_net_income: number;
            amount_received_by: string;
            payment_method: string;
            payment_status: string;
        }[];
    }>;
    expenseDetails(opts?: ReportFilterOpts): Promise<{
        total: number;
        rows: never[];
        total_amount?: undefined;
    } | {
        total: number;
        total_amount: number;
        rows: {
            order_id: number;
            date_time: unknown;
            expense_type: string;
            customer_name: string | null;
            amount: number;
        }[];
    }>;
    foodReport(opts?: ReportFilterOpts & {
        categoryId?: number;
    }): Promise<{
        total: number;
        rows: {
            food_id: number;
            name: string | null;
            image_full_url: string | null;
            restaurant_id: number;
            restaurant: string | null;
            category_id: number;
            order_count: number;
            price: number;
            total_amount_sold: number;
            total_discount: number;
            average_sale_value: number;
            avg_rating: number;
            rating_count: number;
        }[];
        yearly: {
            year: number;
            total: number;
        }[];
    }>;
    orderReport(opts?: ReportFilterOpts & {
        days?: number;
        campaign?: boolean;
    }): Promise<{
        total: number;
        rows: {
            order_id: number;
            restaurant: string | null;
            customer_name: string | null;
            total_item_amount: number;
            item_discount: number;
            coupon_discount: number;
            referral_discount: number;
            discounted_amount: number;
            tax: number;
            delivery_charge: number;
            service_charge: number;
            order_amount: number;
            amount_received_by: string;
            payment_method: string;
            payment_status: string;
            order_status: string;
            created_at: {} | null;
        }[];
        status_counts: Record<string, number>;
    }>;
    restaurantReport(opts?: ReportFilterOpts): Promise<{
        total: number;
        rows: {
            restaurant_id: number;
            zone_id: number;
            name: string | null;
            image_full_url: string | null;
            total_food: number;
            total_order: number;
            total_order_amount: number;
            total_discount: number;
            total_admin_commission: number;
            total_vat: number;
            avg_rating: number;
            rating_count: number;
        }[];
        yearly: {
            year: number;
            total: number;
        }[];
    }>;
    subscriptionReport(): Promise<{
        total: number;
        rows: {
            transaction_id: string;
            transaction_date: {} | null;
            restaurant_name: string | null;
            package_name: string;
            duration: string;
            pricing: number;
            payment_status: string;
            payment_method: string;
        }[];
    }>;
    customerOverviewReport(_opts?: ReportFilterOpts): Promise<{
        total: number;
        rows: {
            customer_id: number;
            name: string | null;
            email: string | null;
            phone: string | null;
            image_full_url: string | null;
            joining_date: {} | null;
            total_order: number;
            total_spent: number;
            aov: number;
            last_purchase: {} | null;
            most_used_payment_method: string | null;
        }[];
        stats: {
            total_customers: number;
            new_customers: number;
            active: number;
            inactive: number;
            returning: number;
        };
    }>;
    customerWalletReport(): Promise<{
        total: number;
        rows: {
            transaction_id: string;
            customer: string | null;
            credit: number;
            debit: number;
            balance: number;
            transaction_type: string;
            reference: string;
            created_at: {} | null;
        }[];
        totals: {
            credit: number;
            debit: number;
            balance: number;
        };
    }>;
    adminEarningDetailed(_opts?: ReportFilterOpts): Promise<{
        summary: {
            total_earnings: number;
            total_expenses: number;
            net_profit: number;
        };
        earnings_breakdown: {
            label: string;
            amount: number;
            pct: number;
        }[];
        expenses_breakdown: {
            label: string;
            amount: number;
            pct: number;
        }[];
        transactions: {
            earnings: Record<string, unknown>[];
            subscription: {
                txn_id: string;
                date: {} | null;
                source: string | null;
                source_type: string;
                earning_source: string;
                amount: number;
            }[];
            expenses: Record<string, unknown>[];
        };
    }>;
    restaurantEarningDetailed(opts?: ReportFilterOpts): Promise<{
        transactions: {
            earnings: Record<string, unknown>[];
            expenses: Record<string, unknown>[];
            subscription: {
                txn_id: string;
                date: {} | null;
                restaurant: string | null;
                transaction_type: string;
                amount: number;
            }[];
        };
    }>;
    restaurantEarnings(limit?: number, opts?: ReportFilterOpts): Promise<{
        top_earners: {
            restaurant_id: number;
            name: string | null;
            orders: number;
            revenue: number;
            admin_commission: number;
            restaurant_take: number;
        }[];
    }>;
    topFoods(limit?: number, opts?: ReportFilterOpts): Promise<{
        top_foods: {
            food_id: number | null;
            name: string | null;
            restaurant_id: number | null;
            units_sold: number;
            revenue: number;
        }[];
    }>;
}
declare module './admin.service' {
    interface AdminService {
        listAddOns(opts: ListOpts & {
            restaurantId?: number;
        }): Promise<unknown>;
        createAddOn(body: {
            name: string;
            price: number;
            restaurant_id: number;
            addon_category_id?: number;
        }): Promise<unknown>;
        updateAddOn(id: number, body: {
            name?: string;
            price?: number;
            addon_category_id?: number;
            stock_type?: string;
            addon_stock?: number;
        }): Promise<unknown>;
        updateAddOnStatus(id: number, status: boolean): Promise<unknown>;
        deleteAddOn(id: number): Promise<unknown>;
        listAddonCategories(opts: ListOpts): Promise<unknown>;
        createAddonCategory(body: {
            name: string;
        }): Promise<unknown>;
        updateAddonCategory(id: number, body: {
            name?: string;
        }): Promise<unknown>;
        updateAddonCategoryStatus(id: number, status: boolean): Promise<unknown>;
        deleteAddonCategory(id: number): Promise<unknown>;
        listAttributes(): Promise<unknown>;
        createAttribute(body: {
            name: string;
        }): Promise<unknown>;
        updateAttribute(id: number, body: {
            name?: string;
        }): Promise<unknown>;
        deleteAttribute(id: number): Promise<unknown>;
        listCampaigns(opts: ListOpts & {
            type?: string;
        }): Promise<unknown>;
        createCampaign(body: {
            title: string;
            description?: string;
            start_date?: string;
            end_date?: string;
            start_time?: string;
            end_time?: string;
            image?: string | null;
            zone_id?: number | null;
            campaign_type?: string;
            food_id?: number | null;
            restaurant_id?: number | null;
            price?: number | null;
            discount?: number | null;
            discount_type?: string;
        }): Promise<unknown>;
        updateCampaign(id: number, body: {
            title?: string;
            description?: string;
            start_date?: string;
            end_date?: string;
            start_time?: string;
            end_time?: string;
            image?: string | null;
            zone_id?: number | null;
            status?: boolean;
        }): Promise<unknown>;
        updateCampaignStatus(id: number, status: boolean): Promise<unknown>;
        deleteCampaign(id: number): Promise<unknown>;
        listAdvertisements(opts: ListOpts): Promise<unknown>;
        createAdvertisement(body: {
            title?: string;
            description?: string;
            add_type?: string;
            restaurant_id?: number | null;
            priority?: number;
            start_date?: string;
            end_date?: string;
            image?: string | null;
            cover_image?: string | null;
            is_paid?: boolean | string;
            amount?: number | string;
        }): Promise<unknown>;
        updateAdvertisementStatus(id: number, status: 'approved' | 'denied' | 'pending' | 'paused' | 'expired' | 'running'): Promise<unknown>;
        deleteAdvertisement(id: number): Promise<unknown>;
        listCashBacks(): Promise<unknown>;
        createCashBack(body: {
            title?: string;
            customer_id?: number | string | null;
            cashback_type?: string;
            cashback_amount?: number;
            min_purchase?: number;
            max_discount?: number;
            start_date?: string;
            end_date?: string;
            limit?: number;
        }): Promise<unknown>;
        updateCashBackStatus(id: number, status: boolean): Promise<unknown>;
        deleteCashBack(id: number): Promise<unknown>;
        listWalletBonuses(): Promise<unknown>;
        createWalletBonus(body: {
            title: string;
            bonus_type: string;
            bonus_amount: number;
            minimum_add_amount?: number;
            maximum_bonus_amount?: number;
            start_date?: string;
            end_date?: string;
        }): Promise<unknown>;
        updateWalletBonusStatus(id: number, status: boolean): Promise<unknown>;
        deleteWalletBonus(id: number): Promise<unknown>;
        listAccountTransactions(opts: ListOpts): Promise<unknown>;
        listWalletTransactions(opts: ListOpts): Promise<unknown>;
        listLoyaltyPointTransactions(opts: ListOpts): Promise<unknown>;
        listCashbackHistories(opts: ListOpts): Promise<unknown>;
        listDisbursements(opts: ListOpts & {
            type?: string;
        }): Promise<unknown>;
        updateDisbursementStatus(id: number, status: string): Promise<unknown>;
        generateDmDisbursements(): Promise<unknown>;
        listWithdrawRequests(opts: ListOpts & {
            type?: string;
            approved?: boolean;
        }): Promise<unknown>;
        approveWithdrawRequest(id: number, approve: boolean): Promise<unknown>;
        listDmPayouts(): Promise<unknown>;
        recordDmCashDeposit(id: number, amount: number): Promise<unknown>;
        listWithdrawalMethods(): Promise<unknown>;
        listOfflinePaymentMethods(): Promise<unknown>;
        createOfflinePaymentMethod(body: {
            method_name?: string;
            method_fields?: string;
            method_informations?: string;
        }): Promise<unknown>;
        updateOfflinePaymentMethod(id: number, body: {
            method_name?: string;
            method_fields?: string;
            method_informations?: string;
            status?: number;
        }): Promise<unknown>;
        updateOfflinePaymentMethodStatus(id: number, status: number): Promise<unknown>;
        deleteOfflinePaymentMethod(id: number): Promise<unknown>;
        listProvideDMEarnings(opts: ListOpts): Promise<unknown>;
        listContactMessages(opts: ListOpts): Promise<unknown>;
        replyContactMessage(id: number, reply: string): Promise<unknown>;
        listNotifications(opts: ListOpts): Promise<unknown>;
        createNotification(body: {
            title: string;
            description?: string;
            tergat?: string;
            zone_id?: number | null;
            image?: string | null;
        }): Promise<unknown>;
        updateNotification(id: number, body: {
            title?: string;
            description?: string;
            tergat?: string;
            zone_id?: number | null;
            image?: string | null;
        }): Promise<unknown>;
        updateNotificationStatus(id: number, status: boolean): Promise<unknown>;
        deleteNotification(id: number): Promise<unknown>;
        listReviews(opts: ListOpts): Promise<unknown>;
        replyReview(id: number, reply: string): Promise<unknown>;
        listDMReviews(opts: ListOpts): Promise<unknown>;
        listFAQs(): Promise<unknown>;
        createFAQ(body: {
            question: string;
            answer: string;
            page_type?: string;
            user_type?: string;
        }): Promise<unknown>;
        updateFAQ(id: number, body: {
            question?: string;
            answer?: string;
            status?: boolean;
        }): Promise<unknown>;
        deleteFAQ(id: number): Promise<unknown>;
        listPageSeo(): Promise<unknown>;
        upsertPageSeo(body: {
            page_name: string;
            title: string;
            description: string;
            status?: boolean;
        }): Promise<unknown>;
        listSocialMedia(): Promise<unknown>;
        createSocialMedia(body: {
            name: string;
            link: string;
        }): Promise<unknown>;
        updateSocialMediaStatus(id: number, status: boolean): Promise<unknown>;
        deleteSocialMedia(id: number): Promise<unknown>;
        listEmployees(opts: ListOpts): Promise<unknown>;
        getEmployee(id: number): Promise<unknown>;
        createEmployee(body: {
            f_name?: string;
            l_name?: string;
            email?: string;
            phone?: string;
            password?: string;
            role_id?: number;
            zone_id?: number | null;
            image?: string;
        }): Promise<unknown>;
        updateEmployee(id: number, body: {
            f_name?: string;
            l_name?: string;
            email?: string;
            phone?: string;
            password?: string;
            role_id?: number;
            zone_id?: number | null;
            image?: string;
        }): Promise<unknown>;
        deleteEmployee(id: number): Promise<unknown>;
        listAdminRoles(): Promise<unknown>;
        createAdminRole(body: {
            name: string;
            modules?: string;
        }): Promise<unknown>;
        updateAdminRole(id: number, body: {
            name?: string;
            modules?: string;
            status?: boolean;
        }): Promise<unknown>;
        deleteAdminRole(id: number): Promise<unknown>;
        listSubscriptionPackages(): Promise<unknown>;
        createSubscriptionPackage(body: {
            package_name: string;
            price: number;
            validity: number;
            max_order?: string;
            max_product?: string;
            pos?: boolean;
            mobile_app?: boolean;
            chat?: boolean;
            review?: boolean;
            self_delivery?: boolean;
            default?: boolean;
        }): Promise<unknown>;
        getSubscriptionPackage(id: number): Promise<unknown>;
        updateSubscriptionPackage(id: number, body: Record<string, unknown>): Promise<unknown>;
        updateSubscriptionPackageStatus(id: number, status: boolean): Promise<unknown>;
        deleteSubscriptionPackage(id: number): Promise<unknown>;
        listShifts(): Promise<unknown>;
        createShift(body: {
            name: string;
            start_time?: string;
            end_time?: string;
            is_full_day?: boolean;
        }): Promise<unknown>;
        updateShiftStatus(id: number, status: boolean): Promise<unknown>;
        deleteShift(id: number): Promise<unknown>;
        listVehicles(): Promise<unknown>;
        createVehicle(body: {
            type: string;
            starting_coverage_area?: number;
            maximum_coverage_area?: number;
            extra_charges?: number;
        }): Promise<unknown>;
        updateVehicleStatus(id: number, status: boolean): Promise<unknown>;
        deleteVehicle(id: number): Promise<unknown>;
        listOrderCancelReasons(): Promise<unknown>;
        createOrderCancelReason(body: {
            reason: string;
            user_type: string;
            scenario_key?: string;
        }): Promise<unknown>;
        updateOrderCancelReasonStatus(id: number, status: boolean): Promise<unknown>;
        deleteOrderCancelReason(id: number): Promise<unknown>;
        listRefundReasons(): Promise<unknown>;
        createRefundReason(body: {
            reason: string;
        }): Promise<unknown>;
        deleteRefundReason(id: number): Promise<unknown>;
        listRefunds(opts: ListOpts): Promise<unknown>;
        updateRefundStatus(id: number, status: string, admin_note?: string): Promise<unknown>;
        listCurrencies(): Promise<unknown>;
        listTags(): Promise<unknown>;
        listTranslations(opts: ListOpts): Promise<unknown>;
        adminEarningReport(days: number, opts?: ReportFilterOpts): Promise<unknown>;
        customerReport(limit: number, opts?: ReportFilterOpts): Promise<unknown>;
        deliverymanEarningReport(limit: number, opts?: ReportFilterOpts): Promise<unknown>;
    }
}
export interface ListOpts {
    limit?: number;
    offset?: number;
    q?: string;
}
export interface ReportFilterOpts {
    from?: string;
    to?: string;
    zoneId?: number;
    restaurantId?: number;
}
