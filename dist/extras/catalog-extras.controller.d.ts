import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';
export declare class CatalogExtrasController {
    private readonly prisma;
    private readonly mongo;
    constructor(prisma: PrismaService, mongo: MongoDataService);
    private useMongo;
    private num;
    couponList(): Promise<{
        id: number;
        restaurant_id: number | null;
        min_purchase: number;
        max_discount: number;
        discount: number;
        total_uses: number;
    }[]>;
    couponApply(code?: string, amountStr?: string): Promise<{
        code: string;
        message: string;
        title?: undefined;
        coupon_code?: undefined;
        discount?: undefined;
        min_purchase?: undefined;
        max_discount?: undefined;
    } | {
        code: string;
        title: unknown;
        coupon_code: unknown;
        discount: number;
        min_purchase: number;
        max_discount: number;
        message?: undefined;
    }>;
    restaurantCoupons(idStr?: string): Promise<{
        id: number;
        restaurant_id: number | null;
        min_purchase: number;
        max_discount: number;
        discount: number;
        total_uses: number;
    }[]>;
    cuisineAlias(): Promise<{
        id: number;
        name: unknown;
        image: unknown;
        image_full_url: string | null;
        slug: unknown;
    }[]>;
    cuisineRestaurants(idStr?: string): Promise<{
        restaurants: never[];
        total_size: number;
    }>;
    addonCategoryList(): Promise<{
        id: number;
        name: unknown;
        status: unknown;
        slug: unknown;
    }[]>;
    basicCampaigns(): Promise<{
        id: number;
        title: unknown;
        description: unknown;
        image: unknown;
        start_date: unknown;
        end_date: unknown;
    }[]>;
    basicCampaignDetails(idStr?: string): Promise<{
        campaign: {
            id: number;
        } | null;
        restaurants: never[];
    } | {
        campaign: {
            id: number;
            created_at: Date | null;
            updated_at: Date | null;
            status: boolean;
            image: string | null;
            slug: string | null;
            description: string | null;
            title: string | null;
            start_date: Date | null;
            end_date: Date | null;
            admin_id: bigint | null;
            start_time: Date | null;
            end_time: Date | null;
        } | null;
        restaurants: never[];
    }>;
    itemCampaigns(): {
        campaigns: never[];
        total_size: number;
    };
    cashbackList(): Promise<{
        id: number;
    }[]>;
    getCashback(): {
        cashback_amount: number;
        message: string;
    };
    offlinePaymentMethods(): Promise<{
        id: number;
        method_name: unknown;
        method_fields: unknown;
        method_informations: unknown;
    }[]>;
    search(name?: string, limitStr?: string): Promise<{
        products: {
            products: never[];
            total_size?: undefined;
            limit?: undefined;
            offset?: undefined;
        };
        restaurants: {
            restaurants: never[];
            total_size?: undefined;
            limit?: undefined;
            offset?: undefined;
        };
    } | {
        products: {
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
            }[];
        };
        restaurants: {
            total_size: number;
            limit: number;
            offset: number;
            restaurants: {
                id: number;
                zone_id: number | null;
                vendor_id: number;
                tax: number;
                minimum_order: number;
                minimum_shipping_charge: number;
                comission: number | null;
            }[];
        };
    }>;
    setMenu(): {
        menus: never[];
        total_size: number;
    };
    productsSearch(name?: string, offsetStr?: string, limitStr?: string, minPriceStr?: string, maxPriceStr?: string): Promise<{
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
        }[];
    }>;
    restaurantsSearch(name?: string, offsetStr?: string, limitStr?: string): Promise<{
        total_size: number;
        limit: number;
        offset: number;
        restaurants: {
            id: number;
            zone_id: number | null;
            vendor_id: number;
            tax: number;
            minimum_order: number;
            minimum_shipping_charge: number;
            comission: number | null;
        }[];
    }>;
    productReviewsByPath(idStr: string): Promise<{
        rating_count: number;
        avg_rating: number;
        rating: number[];
        reviews: unknown[];
    }>;
    productReviews(idStr?: string): Promise<{
        id: number;
        food_id: number;
        user_id: number;
        comment: unknown;
        rating: unknown;
        attachment: unknown;
        created_at: unknown;
        reply: unknown;
        reply_at: unknown;
    }[]>;
    submitProductReview(body?: Record<string, unknown>): Promise<{
        message: string;
        errors?: undefined;
    } | {
        errors: {
            code: string;
            message: string;
        }[];
        message?: undefined;
    }>;
    private recomputeRating;
    recommendedMostReviewed(): Promise<{
        products: {
            id: number;
            price: number;
            tax: number;
            discount: number;
            restaurant_id: number;
            category_id: number | null;
        }[];
    }>;
    restaurantReviews(idStr?: string): Promise<{
        id: number;
        food_id: number;
        user_id: number;
        comment: unknown;
        rating: unknown;
        created_at: unknown;
    }[]>;
    dineInRestaurants(): {
        restaurants: never[];
        total_size: number;
    };
    recentlyViewed(): never[];
    advertisementList(): Promise<{
        id: number;
        restaurant_id: number;
        restaurant_status: number;
        restaurant_name: string | null;
        restaurant_logo_full_url: string | null;
        created_by_id: number;
        cover_image_full_url: string | null;
        profile_image_full_url: string | null;
        video_attachment_full_url: string | null;
    }[] | {
        id: number;
        restaurant_id: number;
        created_by_id: number;
        created_at: Date | null;
        updated_at: Date | null;
        status: import("@prisma/client").$Enums.advertisements_status;
        description: string | null;
        priority: number | null;
        title: string | null;
        start_date: Date;
        end_date: Date;
        add_type: import("@prisma/client").$Enums.advertisements_add_type;
        pause_note: string | null;
        cancellation_note: string | null;
        cover_image: string | null;
        profile_image: string | null;
        video_attachment: string | null;
        is_rating_active: boolean;
        is_review_active: boolean;
        is_paid: boolean;
        is_updated: boolean;
        created_by_type: string;
    }[]>;
    allergies(): Promise<{
        id: number;
    }[]>;
    nutritions(): Promise<{
        id: number;
    }[]>;
    vehicles(): Promise<{
        id: number;
    }[]>;
    vehicleExtraCharge(): {
        extra_charges: number;
    };
    mostTips(): number[];
    dmShifts(): Promise<{
        id: number;
    }[]>;
    taxList(): never[];
    newsletter(): {
        message: string;
    };
}
