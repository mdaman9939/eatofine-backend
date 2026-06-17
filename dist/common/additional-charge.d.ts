export interface AdditionalChargeRow {
    charge_head?: string | null;
    charge_type?: string | null;
    amount?: number | null;
    gst_applicable?: boolean | number | null;
    gst_rate?: number | null;
    status?: boolean | number | null;
}
export declare function computeFlatAdditionalCharge(rows: AdditionalChargeRow[]): {
    amount: number;
    name: string;
};
