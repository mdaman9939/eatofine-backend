import type { AuthedRequest } from '../auth/auth.guard';
import { OrderService } from './order.service';
export declare class OrderController {
    private readonly orders;
    constructor(orders: OrderService);
    reasons(): Promise<{
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
    place(req: AuthedRequest, body: Parameters<OrderService['placeOrder']>[1]): Promise<{
        message: string;
        order_id: number;
        total_ammount: number;
    }>;
    list(req: AuthedRequest): Promise<{
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
            created_at: string | Date | null;
            details_count: number;
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
    track(orderId: number): Promise<{
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
        } | null;
        delivery_man: {
            id: number;
            f_name: string | null;
            l_name: string | null;
            phone: string | null;
            image: string | null;
        } | null;
        deliveryMan: {
            id: number;
            f_name: string | null;
            l_name: string | null;
            phone: string | null;
            image: string | null;
        } | null;
        delivery_address: {} | null;
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
    }>;
}
