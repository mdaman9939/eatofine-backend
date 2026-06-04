import { RefundService } from './refund.service';
import type { ScenarioKey } from './refund-policy';
export declare class RefundController {
    private readonly svc;
    constructor(svc: RefundService);
    catalogue(): {
        scenarios: Pick<import("./refund-policy").ScenarioDefinition, "key" | "label" | "cancelled_by">[];
    };
    ledger(limit?: string, offset?: string, actorType?: 'restaurant' | 'deliveryman'): Promise<{
        total: number;
        limit: number;
        offset: number;
        items: Record<string, unknown>[];
    }>;
    applicable(orderId: number): Promise<{
        order_id: number;
        stage: import("./refund-policy").OrderStage;
        scenarios: Pick<import("./refund-policy").ScenarioDefinition, "key" | "label" | "cancelled_by">[];
    }>;
    preview(orderId: number, scenario: ScenarioKey): Promise<{
        order_id: number;
        scenario: {
            key: ScenarioKey;
            label: string;
            cancelled_by: import("./refund-policy").CancelledBy;
        };
        stage: import("./refund-policy").OrderStage;
        money: import("./refund-policy").OrderMoney;
        effects: import("./refund-policy").RefundEffects;
    }>;
    apply(orderId: number, body: {
        scenario: ScenarioKey;
        remarks: string;
    }): Promise<{
        ok: boolean;
        decision_id: number;
        artefacts: {
            refund_id?: number;
            credit_note_id?: number;
            wallet_ledger_ids: number[];
        };
        effects: import("./refund-policy").RefundEffects;
        scenario: {
            key: ScenarioKey;
            label: string;
            cancelled_by: import("./refund-policy").CancelledBy;
        };
    }>;
    history(orderId: number): Promise<{
        order_id: number;
        decisions: Record<string, unknown>[];
    }>;
}
