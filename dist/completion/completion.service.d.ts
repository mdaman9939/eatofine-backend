import { PrismaService } from '../prisma/prisma.service';
type SettingType = 'int' | 'float' | 'string' | 'bool' | 'json';
export declare class CompletionService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    listInvoices(filters?: {
        vendorId?: number;
        status?: string;
        limit?: number;
    }): Promise<{
        id: number;
        vendor_id: number;
        restaurant_id: number | null;
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
        invoice_number: string;
        plan_type: string;
        period_start: Date;
        period_end: Date;
        status: string;
        notes: string | null;
        issued_at: Date | null;
        paid_at: Date | null;
        created_at: Date | null;
        vendor_name: string | null;
        restaurant_name: string | null;
    }[]>;
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
    }): Promise<{
        id: number;
        order_id: number;
        customer_id: number;
        restaurant_id: number | null;
        refund_amount: number;
        tax_reversed: number;
        delivery_reversed: number;
        total_credit: number;
        issued_by: number | null;
        credit_note_number: string;
        reason: string | null;
        status: string;
        notes: string | null;
        created_at: Date | null;
        customer_name: string | null;
        restaurant_name: string | null;
    }[]>;
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
        min_value: number | null;
        max_value: number | null;
        setting_key: string;
        setting_value: string;
        value_type: SettingType;
        category: string;
        label: string;
        description: string | null;
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
        id: number;
        subject_id: number;
        auto_triggered: boolean;
        flagged_by: number | null;
        resolved_by: number | null;
        subject_type: "customer" | "vendor" | "delivery_man";
        subject_name: string | null;
        flag_type: string;
        severity: string;
        description: string | null;
        status: string;
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
    }): Promise<{
        id: number;
        vendor_id: number;
        restaurant_id: number;
        discount_value: number | null;
        min_order_value: number | null;
        max_discount: number | null;
        total_uses: number;
        reviewed_by: number | null;
        vendor_name: string | null;
        restaurant_name: string | null;
        title: string;
        description: string | null;
        promo_type: string;
        discount_type: string | null;
        start_date: Date | null;
        end_date: Date | null;
        image_path: string | null;
        target_audience: string;
        status: string;
        admin_remarks: string | null;
        reviewed_at: Date | null;
        created_at: Date | null;
    }[]>;
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
