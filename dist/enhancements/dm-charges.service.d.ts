import { PrismaService } from '../prisma/prisma.service';
interface SurchargeRow {
    id: number;
    surcharge_type: 'weekend' | 'festival' | 'late_night';
    label: string;
    config_json: unknown;
    surcharge_type_value: 'fixed' | 'percentage';
    amount: number;
    status: number;
    effective_from: Date | null;
}
export interface DmApplicableSurcharge {
    id: number;
    type: SurchargeRow['surcharge_type'];
    label: string;
    amount: number;
}
export declare class DmChargesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    listSlabs(): Promise<{
        id: number;
        min_km: number;
        max_km: number;
        base_charge: number;
        extra_per_km: number;
        status: boolean;
        effective_from: Date | null;
    }[]>;
    createSlab(body: {
        min_km: number;
        max_km: number;
        base_charge: number;
        extra_per_km?: number;
        effective_from?: string;
    }): Promise<{
        ok: boolean;
    }>;
    updateSlab(id: number, body: {
        min_km?: number;
        max_km?: number;
        base_charge?: number;
        extra_per_km?: number;
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
        amount: number;
        status: boolean;
        config_json: any;
        surcharge_type: "weekend" | "festival" | "late_night";
        label: string;
        surcharge_type_value: "fixed" | "percentage";
        effective_from: Date | null;
    }[]>;
    createSurcharge(body: {
        surcharge_type: 'weekend' | 'festival' | 'late_night';
        label: string;
        config_json: unknown;
        surcharge_type_value?: 'fixed' | 'percentage';
        amount: number;
        effective_from?: string;
    }): Promise<{
        ok: boolean;
    }>;
    updateSurcharge(id: number, body: {
        label?: string;
        config_json?: unknown;
        surcharge_type_value?: 'fixed' | 'percentage';
        amount?: number;
        status?: boolean;
    }): Promise<{
        ok: boolean;
        id: number;
    }>;
    deleteSurcharge(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    calculate(input: {
        distance_km: number;
        when?: string;
    }): Promise<{
        distance_km: number;
        matched_slab: null;
        base_charge: number;
        extra_charge: number;
        surcharges: never[];
        total: number;
        notes: string;
    } | {
        distance_km: number;
        matched_slab: {
            id: number;
            min_km: number;
            max_km: number;
            base_charge: number;
            extra_per_km: number;
        };
        base_charge: number;
        extra_charge: number;
        surcharges: DmApplicableSurcharge[];
        total: number;
        notes: string;
    }>;
}
export {};
