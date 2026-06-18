export declare const ORDER_STATUS: {
    readonly PENDING: "pending";
    readonly CONFIRMED: "confirmed";
    readonly PROCESSING: "processing";
    readonly READY_FOR_PICKUP: "ready_for_pickup";
    readonly PICKED_UP: "picked_up";
    readonly OUT_FOR_DELIVERY: "out_for_delivery";
    readonly SERVED: "served";
    readonly COMPLETED: "completed";
    readonly CANCELED: "canceled";
    readonly AUTO_CANCELLED: "auto_cancelled";
};
export type OrderStatusValue = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];
export declare const CANCEL_REASONS: readonly ["restaurant_not_responded", "item_unavailable", "restaurant_unavailable", "restaurant_closed", "customer_cancelled", "restaurant_cancelled", "admin_cancelled", "delivery_partner_unavailable", "payment_failed"];
export type CancelReason = (typeof CANCEL_REASONS)[number];
export declare const REFUND_STATUS: {
    readonly NOT_REQUIRED: "not_required";
    readonly PENDING: "pending";
    readonly PROCESSED: "processed";
    readonly FAILED: "failed";
};
export type RefundStatusValue = (typeof REFUND_STATUS)[keyof typeof REFUND_STATUS];
export type OrderType = 'delivery' | 'take_away' | 'dine_in';
export declare const FLOW: Record<OrderType, string[]>;
export declare const LEGACY_ALIAS: Record<string, string>;
export declare const TERMINAL_STATUSES: Set<string>;
export declare const CANCELLABLE_BY: {
    customer: Set<string>;
    restaurant: Set<string>;
    admin: Set<string>;
};
interface ActorLabels {
    customer: string;
    restaurant: string;
    delivery: string | null;
}
export declare const STATUS_LABELS: Record<string, ActorLabels>;
export declare const CANCEL_MESSAGE_CUSTOMER: Record<CancelReason, string>;
export declare const CANCEL_MESSAGE_RESTAURANT: Record<CancelReason, string>;
export declare const NOTIFY_DELIVERY_ON_CANCEL: Set<"restaurant_not_responded" | "item_unavailable" | "restaurant_unavailable" | "restaurant_closed" | "customer_cancelled" | "restaurant_cancelled" | "admin_cancelled" | "delivery_partner_unavailable" | "payment_failed">;
export declare function normaliseStatus(status: string): string;
export {};
