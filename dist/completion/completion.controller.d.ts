import { type AuthedRequest } from '../auth/auth.guard';
import { CompletionService } from './completion.service';
export declare class CompletionController {
    private readonly svc;
    constructor(svc: CompletionService);
    listInvoices(vendorId?: string, status?: string, limit?: string): Promise<import("./completion.service").InvoiceRow[]>;
    invoiceStats(): Promise<{
        draft: number;
        issued: number;
        paid: number;
        cancelled: number;
        total_count: number;
        total_value: number;
        paid_value: number;
        outstanding_value: number;
    }>;
    invoiceDetail(id: number): Promise<{
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
    generateInvoices(body: {
        period_start?: string;
        period_end?: string;
    }): Promise<{
        ok: boolean;
        period: {
            start: string;
            end: string;
        };
        created: number;
    }>;
    markPaid(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    cancelInvoice(id: number, body: {
        notes?: string;
    }): Promise<{
        ok: boolean;
        id: number;
    }>;
    listCreditNotes(status?: string, limit?: string): Promise<import("./completion.service").CreditNoteRow[]>;
    cnStats(): Promise<{
        issued: number;
        adjusted: number;
        cancelled: number;
        total_count: number;
        total_value: number;
    }>;
    createCreditNote(req: AuthedRequest, body: Parameters<CompletionService['createCreditNote']>[0]): Promise<{
        ok: boolean;
        credit_note_number: string;
        total_credit: number;
    }>;
    listSettings(category?: string): Promise<{
        id: number;
        setting_key: string;
        setting_value: string;
        value_type: "string" | "bool" | "int" | "float" | "json";
        category: string;
        label: string;
        description: string | null;
        min_value: number | null;
        max_value: number | null;
        updated_at: Date | null;
    }[]>;
    updateSetting(req: AuthedRequest, key: string, body: {
        value: string;
    }): Promise<{
        ok: boolean;
        key: string;
        value: string;
    }>;
    listFlags(status?: string, subjectType?: string, limit?: string): Promise<{
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
    flagStats(): Promise<{
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
    createFlag(req: AuthedRequest, body: Parameters<CompletionService['createFraudFlag']>[0]): Promise<{
        ok: boolean;
    }>;
    resolveFlag(req: AuthedRequest, id: number, body: {
        status: 'investigating' | 'resolved' | 'dismissed';
        notes: string;
    }): Promise<{
        ok: boolean;
        id: number;
        status: "investigating" | "resolved" | "dismissed";
    }>;
    listPromos(status?: string, vendorId?: string, limit?: string): Promise<import("./completion.service").VendorPromoRow[]>;
    promoStats(): Promise<Record<string, number>>;
    approvePromo(req: AuthedRequest, id: number, body: {
        remarks?: string;
    }): Promise<{
        ok: boolean;
        id: number;
    }>;
    rejectPromo(req: AuthedRequest, id: number, body: {
        remarks: string;
    }): Promise<{
        ok: boolean;
        id: number;
    }>;
    pausePromo(id: number, body: {
        paused: boolean;
    }): Promise<{
        ok: boolean;
        id: number;
    }>;
}
