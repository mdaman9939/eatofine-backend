export type ScenarioKey = 'USER_BEFORE_ACCEPT' | 'USER_AFTER_ACCEPT_NO_DM' | 'USER_AFTER_ACCEPT_WITH_DM' | 'ADMIN_USER_UNREACHABLE' | 'ADMIN_WRONG_ITEM_RESTAURANT' | 'ADMIN_MISSING_PACKET_DM' | 'ADMIN_RESTAURANT_FAULT_AFTER_DELIVERY' | 'ADMIN_RESTAURANT_FAULT_BEFORE_DELIVERY' | 'ADMIN_DM_FAULT_AFTER_DELIVERY' | 'ADMIN_DM_FAULT_BEFORE_DELIVERY' | 'RESTAURANT_REJECT_BEFORE_ACCEPT' | 'RESTAURANT_REJECT_AFTER_ACCEPT_NO_DM' | 'RESTAURANT_REJECT_AFTER_ACCEPT_WITH_DM';
export type CancelledBy = 'user' | 'admin' | 'restaurant';
export type PenaltyTarget = 'restaurant' | 'deliveryman' | null;
export type WalletDirection = 'credit' | 'debit' | 'none';
export interface OrderMoney {
    item_total: number;
    tax: number;
    delivery_charge: number;
    packaging_amount: number;
    additional_charge: number;
    situational_charge: number;
    admin_commission: number;
    admin_commission_gst: number;
    grand_total: number;
}
export interface OrderStage {
    status: string;
    has_delivery_man: boolean;
    is_delivered: boolean;
    cancelled_by: CancelledBy | null;
}
export interface ScenarioDefinition {
    key: ScenarioKey;
    cancelled_by: CancelledBy;
    label: string;
    allowsStage: (s: OrderStage) => boolean;
    decide: (money: OrderMoney) => RefundEffects;
}
export interface RefundEffects {
    refund_amount: number;
    refund_to_user: boolean;
    generate_invoice: boolean;
    generate_credit_note: boolean;
    penalty: {
        target: PenaltyTarget;
        amount: number;
        components: string[];
    };
    restaurant_wallet: {
        direction: WalletDirection;
        amount: number;
        note: string;
    };
    deliveryman_wallet: {
        direction: WalletDirection;
        amount: number;
        note: string;
    };
    final_order_status: 'canceled' | 'refunded';
    summary: string;
}
export declare const SCENARIOS: Record<ScenarioKey, ScenarioDefinition>;
export declare function listScenarios(): Array<Pick<ScenarioDefinition, 'key' | 'cancelled_by' | 'label'>>;
export declare function scenarioForRestaurantReject(preStatus: string, hasDeliveryMan: boolean): ScenarioKey;
export declare function scenarioForUserCancel(preStatus: string, hasDeliveryMan: boolean): ScenarioKey;
export declare function getScenario(key: ScenarioKey): ScenarioDefinition | null;
export declare function applicableScenarios(stage: OrderStage): Array<Pick<ScenarioDefinition, 'key' | 'cancelled_by' | 'label'>>;
