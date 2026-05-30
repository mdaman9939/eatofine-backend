import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';
export declare class AdminService {
    private readonly prisma;
    private readonly mongo;
    constructor(prisma: PrismaService, mongo: MongoDataService);
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
    listOrders(limit?: number, offset?: number, status?: string, q?: string): Promise<{
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
    getOrder(id: number): Promise<{
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
    getRestaurant(id: number): Promise<{
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
    updateRestaurant(id: number, body: {
        name?: string;
        email?: string;
        phone?: string;
        address?: string;
        comission?: number;
        minimum_order?: number;
        status?: boolean;
        active?: boolean;
    }): Promise<{
        ok: boolean;
        id: number;
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
            phone: string | null;
            f_name: string | null;
            l_name: string | null;
            email: string | null;
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
            phone: string;
            f_name: string;
            l_name: string | null;
            email: string;
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
            phone: string;
            f_name: string | null;
            l_name: string | null;
            email: string | null;
            image: string | null;
            application_status: import("@prisma/client").$Enums.delivery_men_application_status;
        }[];
    }>;
    updateDeliveryManStatus(id: number, status: boolean): Promise<{
        ok: boolean;
        id: number;
        status: boolean;
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
    createCategory(body: {
        name: string;
        parent_id?: number;
        position?: number;
        priority?: number;
        image?: string | null;
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
    updateBannerStatus(id: number, status: boolean): Promise<{
        ok: boolean;
        id: number;
        status: boolean;
    }>;
    deleteBanner(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    listZones(): Promise<{
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
    updateZoneStatus(id: number, status: boolean): Promise<{
        ok: boolean;
        id: number;
        status: boolean;
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
    salesSummary(days?: number): Promise<{
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
    restaurantEarnings(limit?: number): Promise<{
        top_earners: {
            restaurant_id: number;
            name: string | null;
            orders: number;
            revenue: number;
            admin_commission: number;
            restaurant_take: number;
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
        updateAddOnStatus(id: number, status: boolean): Promise<unknown>;
        deleteAddOn(id: number): Promise<unknown>;
        listAddonCategories(opts: ListOpts): Promise<unknown>;
        createAddonCategory(body: {
            name: string;
        }): Promise<unknown>;
        updateAddonCategoryStatus(id: number, status: boolean): Promise<unknown>;
        deleteAddonCategory(id: number): Promise<unknown>;
        listAttributes(): Promise<unknown>;
        createAttribute(body: {
            name: string;
        }): Promise<unknown>;
        deleteAttribute(id: number): Promise<unknown>;
        listCampaigns(opts: ListOpts): Promise<unknown>;
        createCampaign(body: {
            title: string;
            description?: string;
            start_date?: string;
            end_date?: string;
        }): Promise<unknown>;
        updateCampaignStatus(id: number, status: boolean): Promise<unknown>;
        deleteCampaign(id: number): Promise<unknown>;
        listAdvertisements(opts: ListOpts): Promise<unknown>;
        updateAdvertisementStatus(id: number, status: 'approved' | 'denied' | 'pending' | 'paused' | 'expired' | 'running'): Promise<unknown>;
        listCashBacks(): Promise<unknown>;
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
        listDisbursements(opts: ListOpts): Promise<unknown>;
        listWithdrawRequests(opts: ListOpts & {
            type?: string;
            approved?: boolean;
        }): Promise<unknown>;
        approveWithdrawRequest(id: number, approve: boolean): Promise<unknown>;
        listWithdrawalMethods(): Promise<unknown>;
        listOfflinePaymentMethods(): Promise<unknown>;
        updateOfflinePaymentMethodStatus(id: number, status: number): Promise<unknown>;
        listProvideDMEarnings(opts: ListOpts): Promise<unknown>;
        listContactMessages(opts: ListOpts): Promise<unknown>;
        replyContactMessage(id: number, reply: string): Promise<unknown>;
        listNotifications(opts: ListOpts): Promise<unknown>;
        createNotification(body: {
            title: string;
            description?: string;
            tergat?: string;
            zone_id?: number | null;
        }): Promise<unknown>;
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
        listAdminRoles(): Promise<unknown>;
        createAdminRole(body: {
            name: string;
            modules?: string;
        }): Promise<unknown>;
        deleteAdminRole(id: number): Promise<unknown>;
        listSubscriptionPackages(): Promise<unknown>;
        createSubscriptionPackage(body: {
            package_name: string;
            price: number;
            validity: number;
            max_order?: string;
            max_product?: string;
        }): Promise<unknown>;
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
            starting_coverage_area: number;
            maximum_coverage_area: number;
            extra_charges: number;
        }): Promise<unknown>;
        updateVehicleStatus(id: number, status: boolean): Promise<unknown>;
        deleteVehicle(id: number): Promise<unknown>;
        listOrderCancelReasons(): Promise<unknown>;
        createOrderCancelReason(body: {
            reason: string;
            user_type: string;
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
        adminEarningReport(days: number): Promise<unknown>;
        customerReport(limit: number): Promise<unknown>;
        deliverymanEarningReport(limit: number): Promise<unknown>;
    }
}
export interface ListOpts {
    limit?: number;
    offset?: number;
    q?: string;
}
