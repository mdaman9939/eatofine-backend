import type { AuthedRequest } from '../auth/auth.guard';
interface MulterFile {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
}
import { AdminService } from './admin.service';
export declare class AdminController {
    private readonly admin;
    constructor(admin: AdminService);
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
    orders(limit?: string, offset?: string, status?: string, q?: string): Promise<{
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
                phone: string | null;
                f_name: string | null;
                l_name: string | null;
                email: string | null;
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
            logo: string | null;
            address: string | null;
            phone: string;
            take_away: boolean;
            email: string | null;
            order_count: number;
            latitude: string | null;
            longitude: string | null;
            delivery: boolean;
            active: boolean;
            restaurant_model: string | null;
        }[];
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
            logo: string | null;
            address: string | null;
            phone: string;
            schedule_order: boolean;
            footer_text: string | null;
            take_away: boolean;
            per_km_shipping_charge: number | null;
            maximum_shipping_charge: number | null;
            email: string | null;
            order_count: number;
            latitude: string | null;
            longitude: string | null;
            opening_time: Date | null;
            closeing_time: Date | null;
            free_delivery: boolean;
            rating: string | null;
            cover_photo: string | null;
            delivery: boolean;
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
            restaurant_model: string | null;
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
            phone: string | null;
            f_name: string | null;
            l_name: string | null;
            email: string | null;
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
        };
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
        };
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
            phone: string;
            f_name: string;
            l_name: string | null;
            email: string;
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
            phone: string;
            f_name: string | null;
            l_name: string | null;
            email: string | null;
            image: string | null;
            application_status: import("@prisma/client").$Enums.delivery_men_application_status;
        }[];
    }>;
    updateDMStatus(id: number, body: {
        status: boolean;
    }): Promise<{
        ok: boolean;
        id: number;
        status: boolean;
    }>;
    updateDMApproval(id: number, body: {
        approval: 'approved' | 'denied';
    }): Promise<{
        ok: boolean;
        id: number;
        application_status: "approved" | "denied";
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
    foodDetail(id: number): Promise<{
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
    createCategory(body: {
        name: string;
        parent_id?: number;
        position?: number;
        priority?: number;
    }): Promise<{
        ok: boolean;
        id: number;
    }>;
    updateCategory(id: number, body: {
        name?: string;
        status?: boolean;
        priority?: number;
    }): Promise<{
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
    deleteBanner(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    zones(): Promise<{
        zones: {
            id: number;
            name: string;
            display_name: string | null;
            status: boolean;
            is_default: boolean;
            minimum_shipping_charge: number | null;
            per_km_shipping_charge: number | null;
            maximum_shipping_charge: number | null;
            minimum_delivery_time: number | null;
            max_cod_order_amount: number | null;
            created_at: Date | null;
            restaurant_count: number;
        }[];
    }>;
    updateZoneStatus(id: number, body: {
        status: boolean;
    }): Promise<{
        ok: boolean;
        id: number;
        status: boolean;
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
    salesSummary(days?: string): Promise<{
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
    restaurantEarnings(limit?: string): Promise<{
        top_earners: {
            restaurant_id: number;
            name: string | null;
            orders: number;
            revenue: number;
            admin_commission: number;
            restaurant_take: number;
        }[];
    }>;
    adminEarningReport(days?: string): Promise<unknown>;
    customerReport(limit?: string): Promise<unknown>;
    deliverymanEarningReport(limit?: string): Promise<unknown>;
    addOns(limit?: string, offset?: string, q?: string, restaurantId?: string): Promise<unknown>;
    createAddOn(body: Parameters<AdminService['createAddOn']>[0]): Promise<unknown>;
    updateAddOnStatus(id: number, body: {
        status: boolean;
    }): Promise<unknown>;
    deleteAddOn(id: number): Promise<unknown>;
    addonCategories(limit?: string, offset?: string, q?: string): Promise<unknown>;
    createAddonCategory(body: {
        name: string;
    }): Promise<unknown>;
    updateAddonCategoryStatus(id: number, body: {
        status: boolean;
    }): Promise<unknown>;
    deleteAddonCategory(id: number): Promise<unknown>;
    attributes(): Promise<unknown>;
    createAttribute(body: {
        name: string;
    }): Promise<unknown>;
    deleteAttribute(id: number): Promise<unknown>;
    campaigns(limit?: string, offset?: string, q?: string): Promise<unknown>;
    createCampaign(body: Parameters<AdminService['createCampaign']>[0]): Promise<unknown>;
    updateCampaignStatus(id: number, body: {
        status: boolean;
    }): Promise<unknown>;
    deleteCampaign(id: number): Promise<unknown>;
    advertisements(limit?: string, offset?: string): Promise<unknown>;
    updateAdvertisementStatus(id: number, body: {
        status: 'approved' | 'denied' | 'pending' | 'paused' | 'expired' | 'running';
    }): Promise<unknown>;
    cashBacks(): Promise<unknown>;
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
    disbursements(limit?: string, offset?: string): Promise<unknown>;
    withdrawRequests(limit?: string, offset?: string, type?: string, approved?: string): Promise<unknown>;
    approveWithdrawRequest(id: number, body: {
        approved: boolean;
    }): Promise<unknown>;
    withdrawalMethods(): Promise<unknown>;
    offlinePaymentMethods(): Promise<unknown>;
    updateOfflinePaymentMethodStatus(id: number, body: {
        status: number;
    }): Promise<unknown>;
    provideDmEarnings(limit?: string, offset?: string): Promise<unknown>;
    contactMessages(limit?: string, offset?: string): Promise<unknown>;
    replyContactMessage(id: number, body: {
        reply: string;
    }): Promise<unknown>;
    notifications(limit?: string, offset?: string): Promise<unknown>;
    createNotification(body: Parameters<AdminService['createNotification']>[0]): Promise<unknown>;
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
    adminRoles(): Promise<unknown>;
    createAdminRole(body: {
        name: string;
        modules?: string;
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
    uploadImage(file: MulterFile | undefined, dir?: string): {
        ok: boolean;
        filename: string;
        path: string;
        url: string;
    };
}
export {};
