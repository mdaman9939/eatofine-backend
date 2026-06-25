export interface AdditionalChargeRow {
    charge_head?: string | null;
    charge_type?: string | null;
    amount?: number | null;
    gst_applicable?: boolean | number | null;
    gst_rate?: number | null;
    status?: boolean | number | null;
    order_types?: string[] | null;
}
export declare const ORDER_TYPES: readonly ["take_away", "dine_in", "delivery"];
export type OrderTypeName = (typeof ORDER_TYPES)[number];
export declare function sanitizeOrderTypes(input: unknown): OrderTypeName[];
export declare function chargeAppliesToOrderType(row: AdditionalChargeRow, orderType?: string | null): boolean;
export declare function computeFlatAdditionalCharge(rows: AdditionalChargeRow[], orderType?: string | null): {
    amount: number;
    name: string;
};
export declare function computeAdditionalChargeForSubtotal(rows: AdditionalChargeRow[], subtotal: number, orderType?: string | null): number;
