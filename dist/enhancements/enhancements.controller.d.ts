import { EnhancementsService } from './enhancements.service';
import { DmChargesService } from './dm-charges.service';
import { UserDeliveryChargesService } from './user-delivery-charges.service';
export declare class EnhancementsController {
    private readonly svc;
    private readonly dm;
    private readonly user;
    constructor(svc: EnhancementsService, dm: DmChargesService, user: UserDeliveryChargesService);
    slabs(vid?: string): Promise<{
        id: number;
        vendor_id: number | null;
        min_order_value: number;
        max_order_value: number;
        fixed_charge: number;
        extra_charge: number;
        gst_rate: number;
        gst_on_extra: boolean;
        effective_from: Date | null;
        status: boolean;
        created_at: Date | null;
    }[]>;
    createSlab(body: Parameters<EnhancementsService['createSlab']>[0]): Promise<{
        ok: boolean;
    }>;
    toggleSlab(id: number, body: {
        status: boolean;
    }): Promise<{
        ok: boolean;
        id: number;
        status: boolean;
    }>;
    deleteSlab(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    taxes(): Promise<{
        id: number;
        charge_head: string;
        gst_rate: number;
        cgst: number;
        sgst: number;
        igst: number;
        hsn_sac: string | null;
        status: boolean;
        configurable: boolean;
    }[]>;
    createTax(body: Parameters<EnhancementsService['createTax']>[0]): Promise<{
        ok: boolean;
    }>;
    updateTax(id: number, body: Parameters<EnhancementsService['updateTaxRate']>[1]): Promise<{
        ok: boolean;
        id: number;
    }>;
    deleteTax(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    calculate(body: Parameters<EnhancementsService['calculateOrderCharges']>[0]): Promise<{
        order_value: number;
        matched_slab: {
            id: number;
            min_order_value: number;
            max_order_value: number;
            fixed_charge: number;
            extra_charge: number;
            gst_rate: number;
            gst_on_extra: boolean;
            vendor_id: number | null;
        };
        breakdown: {
            fixed_charge: number;
            extra_charge: number;
            base_charge: number;
            gst_base: number;
            gst_rate: number;
            gst_amount: number;
            cgst: number;
            sgst: number;
            igst: number;
            total_deduction: number;
        };
        vendor_payout: number;
        tax_mode: string;
    }>;
    listAdditionalCharges(): Promise<{
        id: number;
        charge_head: string;
        charge_type: "fixed" | "percentage";
        amount: number;
        gst_applicable: boolean;
        gst_rate: number;
        hsn_sac: string | null;
        description: string | null;
        status: boolean;
    }[]>;
    createAdditionalCharge(body: Parameters<EnhancementsService['createAdditionalCharge']>[0]): Promise<{
        ok: boolean;
    }>;
    updateAdditionalCharge(id: number, body: Parameters<EnhancementsService['updateAdditionalCharge']>[1]): Promise<{
        ok: boolean;
        id: number;
    }>;
    deleteAdditionalCharge(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    invoices(l?: string, o?: string): Promise<{
        total: number;
        invoices: {
            invoice_no: string;
            order_id: number;
            issued_on: Date | null;
            customer: {
                id: bigint;
                f_name: string | null;
                l_name: string | null;
                email: string | null;
            } | null;
            restaurant: {
                id: bigint;
                name: string | null;
            } | null;
            subtotal: number;
            tax: number;
            delivery_charge: number;
            total: number;
            cgst: number;
            sgst: number;
            igst: number;
            payment_method: string | null;
            status: string;
        }[];
    }>;
    invoice(id: number): Promise<{
        invoice_no: string;
        issued_on: Date | null;
        bill_from: {
            name: string;
            address: string;
            gstin: string;
            state: string;
            state_code: string;
        };
        bill_to: {
            name: string;
            email: string | null;
            phone: string | null;
            address: string | null;
        };
        items: {
            id: number;
            name: string;
            hsn: string;
            qty: number;
            unit_price: number;
            subtotal: number;
            tax: number;
        }[];
        summary: {
            subtotal: number;
            delivery_charge: number;
            tax_total: number;
            cgst: number;
            sgst: number;
            igst: number;
            grand_total: number;
        };
        payment_method: string | null;
        payment_status: string;
    }>;
    tds(vid?: string, rate?: string, threshold?: string): Promise<{
        tds_rate: number;
        threshold: number;
        rows: {
            restaurant_id: number;
            restaurant: string | null;
            vendor_id: number | null;
            orders: number;
            gross_payout: number;
            admin_commission_pct: number;
            admin_cut: number;
            net_vendor_payout: number;
            tds_applies: boolean;
            tds_amount: number;
            final_disbursement: number;
        }[];
    }>;
    tdsSettings(): Promise<{
        id: number;
        default_rate: number;
        threshold: number;
        section_code: string;
        financial_year_start: Date;
        status: boolean;
        updated_by: string | null;
        updated_at: Date | null;
    }>;
    updateTdsSettings(body: Parameters<EnhancementsService['updateTdsSettings']>[0]): Promise<{
        ok: boolean;
    }>;
    dmSlabs(): Promise<{
        id: number;
        min_km: number;
        max_km: number;
        base_charge: number;
        extra_per_km: number;
        status: boolean;
        effective_from: Date | null;
    }[]>;
    dmCreateSlab(body: Parameters<DmChargesService['createSlab']>[0]): Promise<{
        ok: boolean;
    }>;
    dmUpdateSlab(id: number, body: Parameters<DmChargesService['updateSlab']>[1]): Promise<{
        ok: boolean;
        id: number;
    }>;
    dmDeleteSlab(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    dmSurcharges(): Promise<{
        id: number;
        surcharge_type: "weekend" | "festival" | "late_night";
        label: string;
        config_json: any;
        surcharge_type_value: "fixed" | "percentage";
        amount: number;
        status: boolean;
        effective_from: Date | null;
    }[]>;
    dmCreateSurcharge(body: Parameters<DmChargesService['createSurcharge']>[0]): Promise<{
        ok: boolean;
    }>;
    dmUpdateSurcharge(id: number, body: Parameters<DmChargesService['updateSurcharge']>[1]): Promise<{
        ok: boolean;
        id: number;
    }>;
    dmDeleteSurcharge(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    dmCalculate(body: Parameters<DmChargesService['calculate']>[0]): Promise<{
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
        surcharges: import("./dm-charges.service").DmApplicableSurcharge[];
        total: number;
        notes: string;
    }>;
    userSlabs(): Promise<{
        id: number;
        min_km: number;
        max_km: number;
        base_charge: number;
        extra_per_km: number;
        gst_rate: number;
        status: boolean;
    }[]>;
    userCreateSlab(body: Parameters<UserDeliveryChargesService['createSlab']>[0]): Promise<{
        ok: boolean;
    }>;
    userUpdateSlab(id: number, body: Parameters<UserDeliveryChargesService['updateSlab']>[1]): Promise<{
        ok: boolean;
        id: number;
    }>;
    userDeleteSlab(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    userSurcharges(): Promise<{
        id: number;
        surcharge_type: "weekend" | "festival" | "late_night" | "surge";
        label: string;
        config_json: any;
        surcharge_type_value: "fixed" | "percentage" | "multiplier";
        amount: number;
        gst_rate: number;
        status: boolean;
    }[]>;
    userCreateSurcharge(body: Parameters<UserDeliveryChargesService['createSurcharge']>[0]): Promise<{
        ok: boolean;
    }>;
    userUpdateSurcharge(id: number, body: Parameters<UserDeliveryChargesService['updateSurcharge']>[1]): Promise<{
        ok: boolean;
        id: number;
    }>;
    userDeleteSurcharge(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    userFreeDelivery(): Promise<{
        id: number;
        min_order_value: number;
        status: boolean;
    }>;
    userUpdateFreeDelivery(body: Parameters<UserDeliveryChargesService['updateFreeDelivery']>[0]): Promise<{
        ok: boolean;
    }>;
    userSurgeGrid(): Promise<{
        day_of_week: number;
        hour_of_day: number;
        multiplier: number;
        status: boolean;
    }[]>;
    userUpdateSurgeCell(body: Parameters<UserDeliveryChargesService['updateSurgeCell']>[0]): Promise<{
        ok: boolean;
    }>;
    userCalculate(body: Parameters<UserDeliveryChargesService['calculate']>[0]): Promise<{
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
        surcharges: import("./user-delivery-charges.service").UserApplicableSurcharge[];
        gst_amount: number;
        subtotal: number;
        total: number;
        free_delivery: boolean;
        notes?: undefined;
    }>;
}
