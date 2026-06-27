import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';
import { FcmService } from '../notifications/fcm.service';
import { UserDeliveryChargesService } from '../enhancements/user-delivery-charges.service';
import { ZoneService } from '../zone/zone.service';
export declare class OrderService {
    private readonly prisma;
    private readonly mongo;
    private readonly fcm;
    private readonly userCharges;
    private readonly zones;
    constructor(prisma: PrismaService, mongo: MongoDataService, fcm: FcmService, userCharges: UserDeliveryChargesService, zones: ZoneService);
    private chargesApplyOnNonDelivery;
    private foodGstOrderTypes;
    private pushNewOrderToRestaurant;
    private useMongo;
    placeOrder(userId: bigint, body: {
        cart?: Array<{
            item_id?: number;
            quantity?: number;
            price?: number;
            variations?: unknown[];
            add_on_ids?: number[];
            add_on_qtys?: number[];
        }>;
        order_amount?: number;
        payment_method?: string;
        order_type?: string;
        restaurant_id?: number;
        distance?: number;
        address?: string;
        latitude?: string;
        longitude?: string;
        contact_person_name?: string;
        contact_person_number?: string;
        address_type?: string;
        road?: string;
        house?: string;
        floor?: string;
        delivery_address_id?: number;
        coupon_code?: string;
        order_note?: string;
        schedule_at?: string;
        cutlery?: number | string | boolean;
    }): Promise<{
        message: string;
        order_id: number;
        total_ammount: number;
    }>;
    private buildDeliveryAddress;
    trackOrder(orderId: number): Promise<{
        id: number;
        order_status: string | undefined;
        payment_status: string | undefined;
        payment_method: string | undefined;
        order_amount: number;
        restaurant_id: number | null;
        delivery_man_id: number | null;
        restaurant: {
            id: number;
            name: string;
            phone: string | null;
            email: string | null;
            address: string | null;
            logo: string;
            logo_full_url: string | null;
            image_full_url: string | null;
            cover_photo: string | null;
            cover_photo_full_url: string | null;
            latitude: string | null;
            longitude: string | null;
        } | null;
        customer: {
            id: number;
            f_name: string | null;
            l_name: string | null;
            phone: string | null;
            email: string | null;
            image: string | null;
            image_full_url: string | null;
        } | null;
        delivery_man: {
            id: number;
            f_name: string | null;
            l_name: string | null;
            phone: string | null;
            image: string | null;
            image_full_url: string | null;
            avg_rating: number;
            rating_count: number;
            lat: string | null;
            lng: string | null;
            location: string | null;
        } | null;
        deliveryMan: {
            id: number;
            f_name: string | null;
            l_name: string | null;
            phone: string | null;
            image: string | null;
            image_full_url: string | null;
            avg_rating: number;
            rating_count: number;
            lat: string | null;
            lng: string | null;
            location: string | null;
        } | null;
        delivery_address: Record<string, unknown>;
        cutlery: boolean;
        order_note: string | null;
        pending: Date | null;
        accepted: Date | null;
        confirmed: Date | null;
        processing: Date | null;
        handover: Date | null;
        picked_up: Date | null;
        delivered: Date | null;
        otp: string | null;
    } | {
        id: bigint;
        order_status: string;
        payment_status: string;
        payment_method: string | null;
        order_amount: number;
        restaurant_id: bigint;
        delivery_man_id: bigint | null;
        pending: Date | null;
        accepted: Date | null;
        confirmed: Date | null;
        processing: Date | null;
        handover: Date | null;
        picked_up: Date | null;
        delivered: Date | null;
        otp: string | null;
        restaurant?: undefined;
        customer?: undefined;
        delivery_man?: undefined;
        deliveryMan?: undefined;
        delivery_address?: undefined;
        cutlery?: undefined;
        order_note?: undefined;
    }>;
    customerOrderList(userId: bigint): Promise<{
        total_size: number;
        limit: number;
        offset: number;
        orders: {
            id: number;
            order_status: string | undefined;
            payment_status: string | undefined;
            order_amount: number;
            payment_method: string | undefined;
            restaurant_id: number | null;
            restaurant: {
                id: number;
                name: string | null;
                logo: string | null;
                logo_full_url: string | null;
                zone_id: number | null;
            } | null;
            created_at: string | Date | null;
            details_count: number;
            cutlery: boolean;
        }[];
    } | {
        total_size: number;
        limit: number;
        offset: number;
        orders: {
            id: bigint;
            order_status: string;
            payment_status: string;
            order_amount: number;
            payment_method: string | null;
            restaurant_id: bigint;
            created_at: Date | null;
        }[];
    }>;
    cancellationReasons(): Promise<{
        reasons: {
            id: number | null;
            reason: string | null;
            user_type: string | null;
            status: boolean;
        }[];
    } | {
        reasons: never[] | {
            id: bigint;
            created_at: Date | null;
            updated_at: Date | null;
            status: boolean;
            is_default: boolean;
            reason: string;
            user_type: string;
        }[];
    }>;
}
