import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';
import { BusinessSettingsService } from '../business-settings/business-settings.service';
type SettingType = 'int' | 'float' | 'string' | 'bool' | 'json';
export interface InvoiceRow {
    id: number;
    invoice_number: string;
    vendor_id: number;
    restaurant_id: number | null;
    plan_type: string;
    period_start: Date;
    period_end: Date;
    gross_sales: number;
    order_count: number;
    commission_base: number;
    ppo_base: number;
    subscription_fee: number;
    taxable_amount: number;
    cgst: number;
    sgst: number;
    igst: number;
    total_amount: number;
    tds_amount: number;
    net_payable: number;
    status: string;
    notes: string | null;
    issued_at: Date | null;
    paid_at: Date | null;
    created_at: Date | null;
    vendor_name: string | null;
    restaurant_name: string | null;
}
export interface CreditNoteRow {
    id: number;
    credit_note_number: string;
    order_id: number;
    customer_id: number;
    restaurant_id: number | null;
    reason: string | null;
    refund_amount: number;
    tax_reversed: number;
    delivery_reversed: number;
    total_credit: number;
    status: string;
    notes: string | null;
    issued_by: number | null;
    created_at: Date | null;
    customer_name: string | null;
    restaurant_name: string | null;
}
export interface VendorPromoRow {
    id: number;
    vendor_id: number;
    restaurant_id: number;
    vendor_name: string | null;
    restaurant_name: string | null;
    title: string;
    description: string | null;
    promo_type: string;
    discount_type: string | null;
    discount_value: number | null;
    min_order_value: number | null;
    max_discount: number | null;
    start_date: Date | null;
    end_date: Date | null;
    image_path: string | null;
    target_audience: string;
    status: string;
    admin_remarks: string | null;
    reviewed_by: number | null;
    reviewed_at: Date | null;
    total_uses: number;
    created_at: Date | null;
}
export declare class CompletionService {
    private readonly prisma;
    private readonly mongo;
    private readonly bs;
    constructor(prisma: PrismaService, mongo: MongoDataService, bs: BusinessSettingsService);
    private invoiceRates;
    private useMongo;
    private vendorNameMongo;
    private restaurantNameMongo;
    private userNameMongo;
    private subjectNameMongo;
    listInvoices(filters?: {
        vendorId?: number;
        status?: string;
        limit?: number;
    }): Promise<InvoiceRow[]>;
    getInvoiceById(id: number): Promise<{
        id: number;
        invoice_number: string;
        plan_type: string;
        period_start: Date;
        period_end: Date;
        gross_sales: number;
        order_count: number;
        subscription_fee: number;
        commission_base: number;
        ppo_base: number;
        taxable_amount: number;
        cgst: number;
        sgst: number;
        igst: number;
        total_amount: number;
        tds_amount: number;
        net_payable: number;
        status: string;
        notes: string | null;
        issued_at: Date | null;
        paid_at: Date | null;
        created_at: Date | null;
        restaurant: {
            id: number;
            name: string | null;
            registered_name: string | null;
            address: string | null;
            phone: string | null;
            email: string | null;
            gstin: string | null;
            cin: string | null;
            fssai: string | null;
            state_code: string | null;
        } | null;
        vendor: {
            id: number;
            name: string;
            email: string | null;
            phone: string | null;
        } | null;
    } | {
        id: number;
        invoice_number: string;
        plan_type: string;
        period_start: unknown;
        period_end: unknown;
        gross_sales: number;
        order_count: number;
        subscription_fee: number;
        commission_base: number;
        ppo_base: number;
        taxable_amount: number;
        cgst: number;
        sgst: number;
        igst: number;
        total_amount: number;
        tds_amount: number;
        net_payable: number;
        status: string;
        notes: string;
        issued_at: Date | null;
        paid_at: Date | null;
        created_at: Date | null;
        restaurant: {
            id: number;
            name: {} | null;
            registered_name: null;
            address: {} | null;
            phone: {} | null;
            email: {} | null;
            gstin: null;
            cin: null;
            fssai: null;
            state_code: null;
        } | null;
        vendor: null;
    } | null>;
    getInvoiceStats(): Promise<{
        draft: number;
        issued: number;
        paid: number;
        cancelled: number;
        total_count: number;
        total_value: number;
        paid_value: number;
        outstanding_value: number;
    }>;
    generateMonthlyInvoices(periodStart?: string, periodEnd?: string): Promise<{
        ok: boolean;
        period: {
            start: string;
            end: string;
        };
        created: number;
    }>;
    markInvoicePaid(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    cancelInvoice(id: number, notes?: string): Promise<{
        ok: boolean;
        id: number;
    }>;
    listCreditNotes(filters?: {
        status?: string;
        limit?: number;
    }): Promise<CreditNoteRow[]>;
    createCreditNote(body: {
        order_id: number;
        refund_amount: number;
        tax_reversed?: number;
        delivery_reversed?: number;
        reason?: string;
        notes?: string;
        issued_by?: number;
    }): Promise<{
        ok: boolean;
        credit_note_number: string;
        total_credit: number;
    }>;
    getCreditNoteStats(): Promise<{
        issued: number;
        adjusted: number;
        cancelled: number;
        total_count: number;
        total_value: number;
    }>;
    listSettings(category?: string): Promise<{
        id: number;
        setting_key: string;
        setting_value: string;
        value_type: SettingType;
        category: string;
        label: string;
        description: string | null;
        min_value: number | null;
        max_value: number | null;
        updated_at: Date | null;
    }[]>;
    updateSetting(key: string, value: string, updatedBy?: number): Promise<{
        ok: boolean;
        key: string;
        value: string;
    }>;
    listFraudFlags(filters?: {
        status?: string;
        subjectType?: string;
        limit?: number;
    }): Promise<{
        auto_triggered: boolean;
        id: number;
        subject_type: "customer" | "vendor" | "delivery_man";
        subject_id: number;
        subject_name: string | null;
        flag_type: string;
        severity: string;
        description: string | null;
        status: string;
        flagged_by: number | null;
        resolved_by: number | null;
        resolved_at: Date | null;
        resolution_notes: string | null;
        created_at: Date | null;
    }[]>;
    createFraudFlag(body: {
        subject_type: 'customer' | 'vendor' | 'delivery_man';
        subject_id: number;
        flag_type: string;
        severity?: 'low' | 'medium' | 'high' | 'critical';
        description?: string;
        flagged_by?: number;
    }): Promise<{
        ok: boolean;
    }>;
    resolveFraudFlag(id: number, status: 'investigating' | 'resolved' | 'dismissed', notes: string, resolvedBy: number): Promise<{
        ok: boolean;
        id: number;
        status: "investigating" | "resolved" | "dismissed";
    }>;
    getFraudStats(): Promise<{
        total: number;
        byStatus: {
            open: number;
            investigating: number;
            resolved: number;
            dismissed: number;
        };
        bySeverity: {
            low: number;
            medium: number;
            high: number;
            critical: number;
        };
    }>;
    listVendorPromos(filters?: {
        status?: string;
        vendorId?: number;
        limit?: number;
    }): Promise<VendorPromoRow[]>;
    approvePromo(id: number, reviewerId: number, remarks?: string): Promise<{
        ok: boolean;
        id: number;
    }>;
    rejectPromo(id: number, reviewerId: number, remarks: string): Promise<{
        ok: boolean;
        id: number;
    }>;
    pausePromo(id: number, paused: boolean): Promise<{
        ok: boolean;
        id: number;
    }>;
    getPromoStats(): Promise<Record<string, number>>;
}
export {};
