import { MongoDataService } from '../mongo/mongo-data.service';
import { OrderMoney, OrderStage, RefundEffects, ScenarioKey } from './refund-policy';
export interface AppliedDecision {
    order_id: number;
    scenario: ScenarioKey;
    remarks: string;
    effects: RefundEffects;
    applied_at: Date;
    artefacts: {
        refund_id?: number;
        credit_note_id?: number;
        wallet_ledger_ids: number[];
    };
}
export declare class RefundService {
    private readonly mongo;
    constructor(mongo: MongoDataService);
    catalogue(): {
        scenarios: Pick<import("./refund-policy").ScenarioDefinition, "key" | "label" | "cancelled_by">[];
    };
    preview(orderId: number, scenarioKey: ScenarioKey): Promise<{
        order_id: number;
        scenario: {
            key: ScenarioKey;
            label: string;
            cancelled_by: import("./refund-policy").CancelledBy;
        };
        stage: OrderStage;
        money: OrderMoney;
        effects: RefundEffects;
    }>;
    applicable(orderId: number): Promise<{
        order_id: number;
        stage: OrderStage;
        scenarios: Pick<import("./refund-policy").ScenarioDefinition, "key" | "label" | "cancelled_by">[];
    }>;
    apply(orderId: number, scenarioKey: ScenarioKey, remarks: string): Promise<{
        ok: boolean;
        decision_id: number;
        artefacts: {
            refund_id?: number;
            credit_note_id?: number;
            wallet_ledger_ids: number[];
        };
        effects: RefundEffects;
        scenario: {
            key: ScenarioKey;
            label: string;
            cancelled_by: import("./refund-policy").CancelledBy;
        };
    }>;
    historyFor(orderId: number): Promise<{
        order_id: number;
        decisions: Record<string, unknown>[];
    }>;
    ledger(limit?: number, offset?: number, actorType?: 'restaurant' | 'deliveryman'): Promise<{
        total: number;
        limit: number;
        offset: number;
        items: Record<string, unknown>[];
    }>;
    private stageOf;
    private moneyOf;
    private userIdFor;
    private writeLedger;
}
