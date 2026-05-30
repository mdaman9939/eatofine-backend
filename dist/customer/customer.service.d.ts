import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';
export interface CartIdentity {
    id: bigint;
    guest: boolean;
}
export declare class CustomerService {
    private readonly prisma;
    private readonly mongo;
    constructor(prisma: PrismaService, mongo: MongoDataService);
    private useMongo;
    private storageBase;
    info(userId: bigint): Promise<{
        id: number;
        f_name: string | null;
        l_name: string | null;
        phone: string | null;
        email: string | null;
        image: string | null;
        image_full_url: string | null;
        is_phone_verified: number;
        is_email_verified: number;
        email_verified_at: string | Date | null;
        auth_token: string | null;
        created_at: string | Date | null;
        updated_at: string | Date | null;
        status: number;
        order_count: number;
        login_medium: string | null;
        wallet_balance: number;
        loyalty_point: number;
        ref_code: string | null;
        current_language_key: string | null;
        userinfo: null;
        member_since_days: number;
        is_valid_for_discount: boolean;
        discount_amount: number;
        discount_amount_type: string;
        validity: string;
    } | {
        id: bigint;
        f_name: string | null;
        l_name: string | null;
        phone: string | null;
        email: string | null;
        image: string | null;
        image_full_url: string | null;
        is_phone_verified: number;
        is_email_verified: number;
        email_verified_at: Date | null;
        auth_token: string | null;
        created_at: Date | null;
        updated_at: Date | null;
        status: number;
        order_count: number;
        login_medium: string | null;
        wallet_balance: number;
        loyalty_point: number;
        ref_code: string | null;
        current_language_key: string | null;
        userinfo: null;
        member_since_days: number;
        is_valid_for_discount: boolean;
        discount_amount: number;
        discount_amount_type: string;
        validity: string;
    }>;
    listAddresses(userId: bigint): Promise<{
        total_size: number;
        limit: number;
        offset: number;
        addresses: {
            id: number;
            address_type: string | null;
            contact_person_number: string | null;
            contact_person_name: string | null;
            address: string | null;
            latitude: string | null;
            longitude: string | null;
            user_id: number | null;
            zone_id: number | null;
            floor: string | null;
            road: string | null;
            house: string | null;
            is_default: number;
        }[];
    } | {
        total_size: number;
        limit: number;
        offset: number;
        addresses: {
            id: bigint;
            address_type: string;
            contact_person_number: string;
            contact_person_name: string | null;
            address: string | null;
            latitude: string | null;
            longitude: string | null;
            user_id: bigint | null;
            zone_id: bigint | null;
            floor: string | null;
            road: string | null;
            house: string | null;
            is_default: number;
        }[];
    }>;
    addAddress(userId: bigint, body: {
        address_type?: string;
        contact_person_number?: string;
        contact_person_name?: string;
        address?: string;
        latitude?: string;
        longitude?: string;
        zone_id?: number;
        floor?: string;
        road?: string;
        house?: string;
    }): Promise<{
        message: string;
        address_id: number;
    } | {
        message: string;
        address_id: bigint;
    }>;
    getCart(identity: CartIdentity): Promise<{
        id: number;
        user_id: number;
        item_id: number;
        is_guest: boolean;
        item_type: string;
        price: number;
        quantity: number;
        variations: unknown[];
        variation_options: unknown[];
        add_on_ids: unknown[];
        add_on_qtys: unknown[];
        created_at: string | null;
        updated_at: string | null;
        item: {
            id: number;
            name: string | null;
            description: string | null;
            image: string | null;
            image_full_url: string | null;
            restaurant_id: number;
            price: number;
            veg: number;
        } | null;
    }[]>;
    private serializeMongoCartRow;
    private serializeCartRow;
    private safeParse;
    addToCart(identity: CartIdentity, body: {
        item_id?: number;
        model?: string;
        quantity?: number;
        price?: number;
        variations?: unknown[];
        variation_options?: unknown[];
        add_on_ids?: number[];
        add_on_qtys?: number[];
    }): Promise<{
        id: number;
        user_id: number;
        item_id: number;
        is_guest: boolean;
        item_type: string;
        price: number;
        quantity: number;
        variations: unknown[];
        variation_options: unknown[];
        add_on_ids: unknown[];
        add_on_qtys: unknown[];
        created_at: string | null;
        updated_at: string | null;
        item: {
            id: number;
            name: string | null;
            description: string | null;
            image: string | null;
            image_full_url: string | null;
            restaurant_id: number;
            price: number;
            veg: number;
        } | null;
    }[] | {
        errors: {
            code: string;
            message: string;
        }[];
    }>;
    updateCart(identity: CartIdentity, cartId: number, quantity: number): Promise<{
        id: number;
        user_id: number;
        item_id: number;
        is_guest: boolean;
        item_type: string;
        price: number;
        quantity: number;
        variations: unknown[];
        variation_options: unknown[];
        add_on_ids: unknown[];
        add_on_qtys: unknown[];
        created_at: string | null;
        updated_at: string | null;
        item: {
            id: number;
            name: string | null;
            description: string | null;
            image: string | null;
            image_full_url: string | null;
            restaurant_id: number;
            price: number;
            veg: number;
        } | null;
    }[]>;
    removeCartItem(identity: CartIdentity, cartId: number): Promise<{
        id: number;
        user_id: number;
        item_id: number;
        is_guest: boolean;
        item_type: string;
        price: number;
        quantity: number;
        variations: unknown[];
        variation_options: unknown[];
        add_on_ids: unknown[];
        add_on_qtys: unknown[];
        created_at: string | null;
        updated_at: string | null;
        item: {
            id: number;
            name: string | null;
            description: string | null;
            image: string | null;
            image_full_url: string | null;
            restaurant_id: number;
            price: number;
            veg: number;
        } | null;
    }[]>;
    clearCart(identity: CartIdentity): Promise<{
        id: number;
        user_id: number;
        item_id: number;
        is_guest: boolean;
        item_type: string;
        price: number;
        quantity: number;
        variations: unknown[];
        variation_options: unknown[];
        add_on_ids: unknown[];
        add_on_qtys: unknown[];
        created_at: string | null;
        updated_at: string | null;
        item: {
            id: number;
            name: string | null;
            description: string | null;
            image: string | null;
            image_full_url: string | null;
            restaurant_id: number;
            price: number;
            veg: number;
        } | null;
    }[]>;
}
