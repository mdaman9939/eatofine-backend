import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';
import { BusinessSettingsService } from '../business-settings/business-settings.service';
export declare class EnhancementsService {
    private readonly prisma;
    private readonly mongo;
    private readonly bs;
    constructor(prisma: PrismaService, mongo: MongoDataService, bs: BusinessSettingsService);
    private useMongo;
    listSlabs(vendorId?: number): Promise<{
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
    createSlab(body: {
        min_order_value: number;
        max_order_value: number;
        fixed_charge: number;
        extra_charge?: number;
        gst_rate?: number;
        gst_on_extra?: boolean;
        vendor_id?: number | null;
    }): Promise<{
        ok: boolean;
    }>;
    deleteSlab(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    toggleSlabStatus(id: number, status: boolean): Promise<{
        ok: boolean;
        id: number;
        status: boolean;
    }>;
    listTaxes(): Promise<{
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
    updateTaxRate(id: number, body: {
        gst_rate?: number;
        cgst?: number;
        sgst?: number;
        igst?: number;
        hsn_sac?: string;
        status?: boolean;
    }): Promise<{
        ok: boolean;
        id: number;
    }>;
    createTax(body: {
        charge_head: string;
        gst_rate?: number;
        cgst?: number;
        sgst?: number;
        igst?: number;
        hsn_sac?: string;
        configurable?: boolean;
    }): Promise<{
        ok: boolean;
    }>;
    deleteTax(id: number): Promise<{
        ok: boolean;
        id: number;
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
    createAdditionalCharge(body: {
        charge_head: string;
        charge_type?: 'fixed' | 'percentage';
        amount: number;
        gst_applicable?: boolean;
        gst_rate?: number;
        hsn_sac?: string;
        description?: string;
    }): Promise<{
        ok: boolean;
    }>;
    updateAdditionalCharge(id: number, body: {
        charge_head?: string;
        charge_type?: 'fixed' | 'percentage';
        amount?: number;
        gst_applicable?: boolean;
        gst_rate?: number;
        hsn_sac?: string;
        description?: string;
        status?: boolean;
    }): Promise<{
        ok: boolean;
        id: number;
    }>;
    deleteAdditionalCharge(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    getTdsSettings(): Promise<{
        id: number;
        default_rate: number;
        threshold: number;
        section_code: string;
        financial_year_start: Date;
        status: boolean;
        updated_by: string | null;
        updated_at: Date | null;
    }>;
    updateTdsSettings(body: {
        default_rate?: number;
        threshold?: number;
        section_code?: string;
        financial_year_start?: string;
        status?: boolean;
        updated_by?: string;
    }): Promise<{
        ok: boolean;
    }>;
    calculateOrderCharges(input: {
        order_value: number;
        vendor_id?: number;
        same_state?: boolean;
    }): Promise<{
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
    listInvoices(limit?: number, offset?: number): Promise<{
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
    private flattenAddress;
    private fyCode;
    private assignInvoiceNumber;
    getInvoice(orderId: number): Promise<{
        invoice_no: string;
        eatofine_invoice_no: string;
        order_id: number;
        order_date: Date;
        restaurant: {
            name: string;
            address: string;
            gstin: string | null;
            fssai: string | null;
            cin: string | null;
        };
        customer: {
            name: string;
            email: string | null;
            phone: string | null;
            address: string | null;
            place_of_delivery: string | null;
        };
        restaurant_invoice: {
            hsn: string;
            service_type: string;
            items: {
                name: string;
                qty: number;
                unit_rate: number;
                amount: number;
            }[];
            sub_total: number;
            discount: number;
            net_value: number;
            gst_rate_half: number;
            cgst: number;
            igst: number;
            total: number;
        };
        eatofine_invoice: {
            hsn: string;
            supply_description: string;
            rows: {
                description: string;
                amount: number;
                cgst: number;
                sgst: number;
                net: number;
            }[];
            total: number;
        };
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
    } | {
        invoice_no: string;
        eatofine_invoice_no: string;
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
        order_id?: undefined;
        order_date?: undefined;
        restaurant?: undefined;
        customer?: undefined;
        restaurant_invoice?: undefined;
        eatofine_invoice?: undefined;
    }>;
    tdsReport(opts: {
        vendor_id?: number;
        rate?: number;
        threshold?: number;
    }): Promise<{
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
}
