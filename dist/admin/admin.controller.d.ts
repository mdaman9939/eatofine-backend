import type { AuthedRequest } from '../auth/auth.guard';
interface MulterFile {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
}
import { AdminService } from './admin.service';
import { MongoDataService } from '../mongo/mongo-data.service';
export declare class AdminController {
    private readonly admin;
    private readonly mongo;
    constructor(admin: AdminService, mongo: MongoDataService);
    me(req: AuthedRequest): Promise<{
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
    updateMe(req: AuthedRequest, body: Parameters<AdminService['updateMe']>[1]): Promise<{
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
    changeMyPassword(req: AuthedRequest, body: Parameters<AdminService['changeMyPassword']>[1]): Promise<{
        ok: boolean;
    }>;
    stats(): Promise<{
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
    orders(limit?: string, offset?: string, status?: string, q?: string, orderType?: string): Promise<{
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
    orderDetail(id: number): Promise<{
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
    }>;
    placePosOrder(body: Parameters<AdminService['createPosOrder']>[0]): Promise<{
        ok: boolean;
        id: number;
        order_amount: number;
    }>;
    updateOrderStatus(id: number, body: {
        status: string;
        reason?: string;
    }): Promise<{
        ok: boolean;
        id: number;
        status: string;
    }>;
    restaurants(limit?: string, offset?: string, q?: string): Promise<{
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
    createRestaurant(body: Parameters<AdminService['createRestaurant']>[0]): Promise<{
        ok: boolean;
        id: number;
        name: string;
        vendor_id: number | null;
    }>;
    restaurantsPending(): Promise<{
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
    bulkImportRestaurants(body: {
        rows?: Array<Record<string, unknown>>;
    }): Promise<{
        ok: boolean;
        inserted: number;
        failed: number;
        total: number;
    }>;
    approveRestaurant(id: number): Promise<{
        ok: boolean;
        id: number;
        decision: "approved" | "rejected";
    }>;
    rejectRestaurant(id: number, body: {
        reason?: string;
    }): Promise<{
        ok: boolean;
        id: number;
        decision: "approved" | "rejected";
    }>;
    restaurantDetail(id: number): Promise<{
        restaurant: {
            id: number;
            zone_id: number | null;
            vendor_id: number;
            comission: number | null;
            minimum_order: number;
            tax: number;
            minimum_shipping_charge: number;
            mysql_id: number;
            name: string | null;
            email: string | null;
            phone: string | null;
            status?: boolean;
            active?: boolean;
            address: string | null;
            logo: string | null;
            latitude?: number;
            longitude?: number;
            mysql_zone_id?: number;
            mysql_vendor_id?: number;
            delivery?: boolean;
            take_away?: boolean;
            restaurant_model?: string;
            order_count?: number;
            created_at?: Date;
        };
        vendor: {
            id: number;
            f_name: string | null;
            l_name: string | null;
            email: string | null;
            phone: string | null;
        } | null;
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
    restaurantTabs(id: number, limit?: string): Promise<{
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
    updateRestaurant(id: number, body: Parameters<AdminService['updateRestaurant']>[1]): Promise<{
        ok: boolean;
        id: number;
    }>;
    users(limit?: string, offset?: string, q?: string): Promise<{
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
    userDetail(id: number): Promise<{
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
    updateUserStatus(id: number, body: {
        status: boolean;
    }): Promise<{
        ok: boolean;
        id: number;
        status: boolean;
    }>;
    vendors(limit?: string, offset?: string, q?: string): Promise<{
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
    updateVendorStatus(id: number, body: {
        status: boolean;
    }): Promise<{
        ok: boolean;
        id: number;
        status: boolean;
    }>;
    deliveryMen(limit?: string, offset?: string, q?: string): Promise<{
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
    createDeliveryMan(body: Parameters<AdminService['createDeliveryMan']>[0]): Promise<{
        ok: boolean;
        id: number;
        name: string;
    }>;
    deliveryMenPending(): Promise<{
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
    deliveryManDetail(id: number): Promise<{
        delivery_man: {
            id: number;
            zone_id: {} | null;
            vehicle_id: {} | null;
            shift_id: {} | null;
            dob: {} | null;
        };
    }>;
    approveDeliveryMan(id: number): Promise<{
        ok: boolean;
        id: number;
        decision: "approved" | "rejected";
    }>;
    rejectDeliveryMan(id: number, body: {
        reason?: string;
    }): Promise<{
        ok: boolean;
        id: number;
        decision: "approved" | "rejected";
    }>;
    updateDMStatus(id: number, body: {
        status: boolean;
    }): Promise<{
        ok: boolean;
        id: number;
        status: boolean;
    }>;
    updateDeliveryMan(id: number, body: Parameters<AdminService['updateDeliveryMan']>[1]): Promise<{
        ok: boolean;
        id: number;
    }>;
    updateDMApproval(id: number, body: {
        approval: 'approved' | 'denied';
    }): Promise<{
        ok: boolean;
        id: number;
        application_status: "approved" | "denied";
    }>;
    deleteDeliveryMan(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    food(limit?: string, offset?: string, q?: string, restaurantId?: string): Promise<{
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
    createFood(body: Parameters<AdminService['createFood']>[0]): Promise<{
        ok: boolean;
        id: number;
        name: string;
    }>;
    bulkImportFood(body: {
        rows?: Array<Record<string, unknown>>;
    }): Promise<{
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
    foodDetail(id: number): Promise<{
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
    updateFood(id: number, body: Parameters<AdminService['updateFood']>[1]): Promise<{
        ok: boolean;
        id: number;
    }>;
    updateFoodStatus(id: number, body: {
        status: boolean;
    }): Promise<{
        ok: boolean;
        id: number;
        status: boolean;
    }>;
    updateFoodRecommended(id: number, body: {
        recommended: boolean;
    }): Promise<{
        ok: boolean;
        id: number;
        recommended: boolean;
    }>;
    deleteFood(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    categories(parentId?: string): Promise<{
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
    bulkImportCategories(body: {
        rows?: Array<Record<string, unknown>>;
    }): Promise<{
        ok: boolean;
        created: number;
        failed: number;
        errors: string[];
    }>;
    createCategory(body: Parameters<AdminService['createCategory']>[0]): Promise<{
        ok: boolean;
        id: number;
    }>;
    updateCategory(id: number, body: Parameters<AdminService['updateCategory']>[1]): Promise<{
        ok: boolean;
        id: number;
    }>;
    deleteCategory(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    cuisines(): Promise<{
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
    }): Promise<{
        ok: boolean;
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
    coupons(): Promise<{
        coupons: {
            id: number;
            title: string | null;
            code: string | null;
            start_date: Date | null;
            expire_date: Date | null;
            min_purchase: number;
            max_discount: number;
            discount: number;
            discount_type: string;
            coupon_type: string;
            limit: number | null;
            status: boolean;
            created_at: Date | null;
            updated_at: Date | null;
            data: string | null;
            total_uses: number;
            created_by: string | null;
            customer_id: string | null;
            slug: string | null;
            restaurant_id: number | null;
        }[];
    }>;
    createCoupon(body: Parameters<AdminService['createCoupon']>[0]): Promise<{
        ok: boolean;
        id: number;
    }>;
    updateCouponStatus(id: number, body: {
        status: boolean;
    }): Promise<{
        ok: boolean;
        id: number;
        status: boolean;
    }>;
    updateCoupon(id: number, body: Parameters<AdminService['updateCoupon']>[1]): Promise<{
        ok: boolean;
        id: number;
    }>;
    deleteCoupon(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    banners(): Promise<{
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
    createBanner(body: Parameters<AdminService['createBanner']>[0]): Promise<{
        ok: boolean;
        id: number;
    }>;
    updateBannerStatus(id: number, body: {
        status: boolean;
    }): Promise<{
        ok: boolean;
        id: number;
        status: boolean;
    }>;
    updateBanner(id: number, body: Parameters<AdminService['updateBanner']>[1]): Promise<{
        ok: boolean;
        id: number;
    }>;
    deleteBanner(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    zones(zoneFor?: string): Promise<{
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
    createZone(body: Parameters<AdminService['createZone']>[0]): Promise<{
        ok: boolean;
        id: number;
        name: string;
    }>;
    updateZoneStatus(id: number, body: {
        status: boolean;
    }): Promise<{
        ok: boolean;
        id: number;
        status: boolean;
    }>;
    zoneDetail(id: number): Promise<{
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
    updateZone(id: number, body: Parameters<AdminService['updateZone']>[1]): Promise<{
        ok: boolean;
        id: number;
    }>;
    deleteZone(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    newsletterList(limit?: string): Promise<{
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
    customerWalletFundHistory(limit?: string): Promise<{
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
    getPage(slug: string): Promise<{
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
    updatePage(slug: string, body: {
        content?: string;
        title?: string;
    }): Promise<{
        ok: boolean;
        slug: string;
    }>;
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
    togglePromotionalBanner(id: number, body: {
        status: boolean;
    }): Promise<{
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
    }): Promise<{
        ok: boolean;
        id: number;
    }>;
    toggleDmBonus(id: number, body: {
        status: boolean;
    }): Promise<{
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
            period: string;
            deliveries: number;
            claim_amount: number;
            status: string;
            reason: string | null;
            created_at: Date | null;
        }[];
    }>;
    approveDmIncentive(id: number): Promise<{
        ok: boolean;
        id: number;
        status: "approved" | "rejected";
    }>;
    rejectDmIncentive(id: number, body: {
        reason?: string;
    }): Promise<{
        ok: boolean;
        id: number;
        status: "approved" | "rejected";
    }>;
    subscriptionOrders(): Promise<{
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
    activityLog(limit?: string): Promise<{
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
    assignDispatch(orderId: number, body: {
        delivery_man_id: number;
    }): Promise<{
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
    cleanDatabase(body: {
        collections?: string[];
        confirm?: string;
    }): Promise<{
        ok: boolean;
        cleared: Record<string, number>;
    }>;
    businessSettings(prefix?: string): Promise<{
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
    salesSummary(days?: string, from?: string, to?: string, zoneId?: string, restaurantId?: string): Promise<{
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
    expenseDetails(from?: string, to?: string, zoneId?: string, restaurantId?: string): Promise<{
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
    transactionDetails(days?: string, from?: string, to?: string, zoneId?: string, restaurantId?: string): Promise<{
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
    restaurantEarnings(limit?: string, from?: string, to?: string, zoneId?: string, restaurantId?: string): Promise<{
        top_earners: {
            restaurant_id: number;
            name: string | null;
            orders: number;
            revenue: number;
            admin_commission: number;
            restaurant_take: number;
        }[];
    }>;
    adminEarningReport(days?: string, from?: string, to?: string, zoneId?: string, restaurantId?: string): Promise<unknown>;
    customerReport(limit?: string, from?: string, to?: string, zoneId?: string, restaurantId?: string): Promise<unknown>;
    topFoods(limit?: string, from?: string, to?: string, zoneId?: string, restaurantId?: string): Promise<{
        top_foods: {
            food_id: number | null;
            name: string | null;
            restaurant_id: number | null;
            units_sold: number;
            revenue: number;
        }[];
    }>;
    deliverymanEarningReport(limit?: string, from?: string, to?: string, zoneId?: string, restaurantId?: string): Promise<unknown>;
    addOns(limit?: string, offset?: string, q?: string, restaurantId?: string): Promise<unknown>;
    createAddOn(body: Parameters<AdminService['createAddOn']>[0]): Promise<unknown>;
    updateAddOnStatus(id: number, body: {
        status: boolean;
    }): Promise<unknown>;
    updateAddOn(id: number, body: Parameters<AdminService['updateAddOn']>[1]): Promise<unknown>;
    deleteAddOn(id: number): Promise<unknown>;
    addonCategories(limit?: string, offset?: string, q?: string): Promise<unknown>;
    createAddonCategory(body: {
        name: string;
    }): Promise<unknown>;
    updateAddonCategoryStatus(id: number, body: {
        status: boolean;
    }): Promise<unknown>;
    updateAddonCategory(id: number, body: {
        name?: string;
    }): Promise<unknown>;
    deleteAddonCategory(id: number): Promise<unknown>;
    attributes(): Promise<unknown>;
    createAttribute(body: {
        name: string;
    }): Promise<unknown>;
    updateAttribute(id: number, body: {
        name?: string;
    }): Promise<unknown>;
    deleteAttribute(id: number): Promise<unknown>;
    campaigns(limit?: string, offset?: string, q?: string, type?: string): Promise<unknown>;
    createCampaign(body: Parameters<AdminService['createCampaign']>[0]): Promise<unknown>;
    updateCampaignStatus(id: number, body: {
        status: boolean;
    }): Promise<unknown>;
    updateCampaign(id: number, body: Parameters<AdminService['updateCampaign']>[1]): Promise<unknown>;
    deleteCampaign(id: number): Promise<unknown>;
    advertisements(limit?: string, offset?: string): Promise<unknown>;
    createAdvertisement(body: Parameters<AdminService['createAdvertisement']>[0]): Promise<unknown>;
    deleteAdvertisement(id: number): Promise<unknown>;
    updateAdvertisementStatus(id: number, body: {
        status: 'approved' | 'denied' | 'pending' | 'paused' | 'expired' | 'running';
    }): Promise<unknown>;
    cashBacks(): Promise<unknown>;
    createCashBack(body: Parameters<AdminService['createCashBack']>[0]): Promise<unknown>;
    updateCashBackStatus(id: number, body: {
        status: boolean;
    }): Promise<unknown>;
    deleteCashBack(id: number): Promise<unknown>;
    walletBonuses(): Promise<unknown>;
    createWalletBonus(body: Parameters<AdminService['createWalletBonus']>[0]): Promise<unknown>;
    updateWalletBonusStatus(id: number, body: {
        status: boolean;
    }): Promise<unknown>;
    deleteWalletBonus(id: number): Promise<unknown>;
    accountTransactions(limit?: string, offset?: string): Promise<unknown>;
    walletTransactions(limit?: string, offset?: string): Promise<unknown>;
    loyaltyTransactions(limit?: string, offset?: string): Promise<unknown>;
    cashbackHistories(limit?: string, offset?: string): Promise<unknown>;
    disbursements(limit?: string, offset?: string, type?: string): Promise<unknown>;
    updateDisbursementStatus(id: number, body: {
        status: string;
    }): Promise<unknown>;
    withdrawRequests(limit?: string, offset?: string, type?: string, approved?: string): Promise<unknown>;
    approveWithdrawRequest(id: number, body: {
        approved: boolean;
    }): Promise<unknown>;
    withdrawalMethods(): Promise<unknown>;
    offlinePaymentMethods(): Promise<unknown>;
    createOfflinePaymentMethod(body: Parameters<AdminService['createOfflinePaymentMethod']>[0]): Promise<unknown>;
    updateOfflinePaymentMethod(id: number, body: Parameters<AdminService['updateOfflinePaymentMethod']>[1]): Promise<unknown>;
    updateOfflinePaymentMethodStatus(id: number, body: {
        status: number;
    }): Promise<unknown>;
    deleteOfflinePaymentMethod(id: number): Promise<unknown>;
    provideDmEarnings(limit?: string, offset?: string): Promise<unknown>;
    contactMessages(limit?: string, offset?: string): Promise<unknown>;
    replyContactMessage(id: number, body: {
        reply: string;
    }): Promise<unknown>;
    notifications(limit?: string, offset?: string): Promise<unknown>;
    createNotification(body: Parameters<AdminService['createNotification']>[0]): Promise<unknown>;
    updateNotification(id: number, body: Parameters<AdminService['updateNotification']>[1]): Promise<unknown>;
    deleteNotification(id: number): Promise<unknown>;
    reviews(limit?: string, offset?: string): Promise<unknown>;
    replyReview(id: number, body: {
        reply: string;
    }): Promise<unknown>;
    dmReviews(limit?: string, offset?: string): Promise<unknown>;
    faqs(): Promise<unknown>;
    createFAQ(body: Parameters<AdminService['createFAQ']>[0]): Promise<unknown>;
    updateFAQ(id: number, body: {
        question?: string;
        answer?: string;
        status?: boolean;
    }): Promise<unknown>;
    deleteFAQ(id: number): Promise<unknown>;
    pageSeo(): Promise<unknown>;
    upsertPageSeo(body: Parameters<AdminService['upsertPageSeo']>[0]): Promise<unknown>;
    socialMedia(): Promise<unknown>;
    createSocialMedia(body: {
        name: string;
        link: string;
    }): Promise<unknown>;
    updateSocialMediaStatus(id: number, body: {
        status: boolean;
    }): Promise<unknown>;
    deleteSocialMedia(id: number): Promise<unknown>;
    employees(limit?: string, offset?: string, q?: string): Promise<unknown>;
    createEmployee(body: Parameters<AdminService['createEmployee']>[0]): Promise<unknown>;
    employeeDetail(id: number): Promise<unknown>;
    updateEmployee(id: number, body: Parameters<AdminService['updateEmployee']>[1]): Promise<unknown>;
    deleteEmployee(id: number): Promise<unknown>;
    adminRoles(): Promise<unknown>;
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
    subscriptionPackages(): Promise<unknown>;
    createSubscriptionPackage(body: Parameters<AdminService['createSubscriptionPackage']>[0]): Promise<unknown>;
    updateSubscriptionPackageStatus(id: number, body: {
        status: boolean;
    }): Promise<unknown>;
    deleteSubscriptionPackage(id: number): Promise<unknown>;
    shifts(): Promise<unknown>;
    createShift(body: Parameters<AdminService['createShift']>[0]): Promise<unknown>;
    updateShiftStatus(id: number, body: {
        status: boolean;
    }): Promise<unknown>;
    deleteShift(id: number): Promise<unknown>;
    vehicles(): Promise<unknown>;
    createVehicle(body: Parameters<AdminService['createVehicle']>[0]): Promise<unknown>;
    updateVehicleStatus(id: number, body: {
        status: boolean;
    }): Promise<unknown>;
    deleteVehicle(id: number): Promise<unknown>;
    orderCancelReasons(): Promise<unknown>;
    createOrderCancelReason(body: {
        reason: string;
        user_type: string;
    }): Promise<unknown>;
    updateOrderCancelReasonStatus(id: number, body: {
        status: boolean;
    }): Promise<unknown>;
    deleteOrderCancelReason(id: number): Promise<unknown>;
    refundReasons(): Promise<unknown>;
    createRefundReason(body: {
        reason: string;
    }): Promise<unknown>;
    deleteRefundReason(id: number): Promise<unknown>;
    refunds(limit?: string, offset?: string): Promise<unknown>;
    updateRefundStatus(id: number, body: {
        status: string;
        admin_note?: string;
    }): Promise<unknown>;
    currencies(): Promise<unknown>;
    tags(): Promise<unknown>;
    translations(limit?: string, offset?: string): Promise<unknown>;
    uploadImage(file: MulterFile | undefined, dir?: string, body?: Record<string, unknown>): Promise<{
        ok: boolean;
        filename: string;
        path: string;
        url: string;
    }>;
}
export {};
