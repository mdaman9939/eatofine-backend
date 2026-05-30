import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';
interface SurRow {
    id: number;
    surcharge_type: 'weekend' | 'festival' | 'late_night' | 'surge';
    label: string;
    config_json: unknown;
    surcharge_type_value: 'fixed' | 'percentage' | 'multiplier';
    amount: number;
    gst_rate: number;
    status: number;
}
export interface UserApplicableSurcharge {
    id: number;
    type: SurRow['surcharge_type'];
    label: string;
    amount: number;
    gst_amount: number;
}
export declare class UserDeliveryChargesService {
    private readonly prisma;
    private readonly mongo;
    constructor(prisma: PrismaService, mongo: MongoDataService);
    private useMongo;
    listSlabs(): Promise<{
        id: number;
        min_km: number;
        max_km: number;
        base_charge: number;
        extra_per_km: number;
        gst_rate: number;
        status: boolean;
    }[]>;
    createSlab(body: {
        min_km: number;
        max_km: number;
        base_charge: number;
        extra_per_km?: number;
        gst_rate?: number;
    }): Promise<{
        ok: boolean;
    }>;
    updateSlab(id: number, body: {
        min_km?: number;
        max_km?: number;
        base_charge?: number;
        extra_per_km?: number;
        gst_rate?: number;
        status?: boolean;
    }): Promise<{
        ok: boolean;
        id: number;
    }>;
    deleteSlab(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    listSurcharges(): Promise<{
        id: number;
        surcharge_type: "weekend" | "festival" | "late_night" | "surge";
        label: string;
        config_json: any;
        surcharge_type_value: "fixed" | "percentage" | "multiplier";
        amount: number;
        gst_rate: number;
        status: boolean;
    }[]>;
    createSurcharge(body: {
        surcharge_type: SurRow['surcharge_type'];
        label: string;
        config_json: unknown;
        surcharge_type_value?: SurRow['surcharge_type_value'];
        amount: number;
        gst_rate?: number;
    }): Promise<{
        ok: boolean;
    }>;
    updateSurcharge(id: number, body: {
        label?: string;
        config_json?: unknown;
        surcharge_type_value?: SurRow['surcharge_type_value'];
        amount?: number;
        gst_rate?: number;
        status?: boolean;
    }): Promise<{
        ok: boolean;
        id: number;
    }>;
    deleteSurcharge(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    getFreeDelivery(): Promise<{
        id: number;
        min_order_value: number;
        status: boolean;
    }>;
    updateFreeDelivery(body: {
        min_order_value?: number;
        status?: boolean;
    }): Promise<{
        ok: boolean;
    }>;
    getSurgeGrid(): Promise<{
        day_of_week: number;
        hour_of_day: number;
        multiplier: number;
        status: boolean;
    }[]>;
    updateSurgeCell(body: {
        day_of_week: number;
        hour_of_day: number;
        multiplier: number;
        status?: boolean;
    }): Promise<{
        ok: boolean;
    }>;
    calculate(input: {
        distance_km: number;
        order_value: number;
        when?: string;
    }): Promise<{
        distance_km: number;
        order_value: number;
        matched_slab: null;
        base_charge: number;
        extra_charge: number;
        surcharges: never[];
        surge_multiplier: number;
        gst_amount: number;
        total: number;
        free_delivery: boolean;
        notes: string;
        base_after_surge?: undefined;
        subtotal?: undefined;
    } | {
        distance_km: number;
        order_value: number;
        matched_slab: {
            id: number;
            min_km: number;
            max_km: number;
            base_charge: number;
            extra_per_km: number;
            gst_rate: number;
        };
        base_charge: number;
        extra_charge: number;
        base_after_surge: number;
        surge_multiplier: number;
        surcharges: UserApplicableSurcharge[];
        gst_amount: number;
        subtotal: number;
        total: number;
        free_delivery: boolean;
        notes?: undefined;
    }>;
}
export {};
