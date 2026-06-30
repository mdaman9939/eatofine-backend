import type { MongoDataService } from '../mongo/mongo-data.service';
export type CreditNoteDoc = {
    mysql_id: number;
    credit_note_number: string;
    credit_note_number_obr: string;
    credit_note_number_etu: string;
    order_id: number;
    refund_id?: number | null;
    customer_id: number;
    restaurant_id: number | null;
    reference_invoice_no_obr?: string | null;
    reference_invoice_no_etu?: string | null;
    reference_invoice_date?: Date | null;
    arn?: string | null;
    reason?: string | null;
    refund_amount: number;
    tax_reversed: number;
    delivery_reversed: number;
    total_credit: number;
    status: string;
    notes?: string | null;
    issued_by?: number | null;
    created_at?: Date | null;
    updated_at?: Date | null;
};
export declare function ensureOrderInvoice(mongo: MongoDataService, orderId: number): Promise<{
    obr: string;
    etu: string;
} | null>;
export declare function issueCreditNote(mongo: MongoDataService, input: {
    orderId: number;
    refundId?: number | null;
    amount: number;
    reason?: string | null;
    notes?: string | null;
    issuedBy?: number | null;
}): Promise<{
    record: CreditNoteDoc | null;
    alreadyExisted: boolean;
}>;
