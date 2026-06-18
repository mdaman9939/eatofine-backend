/**
 * Order lifecycle — single source of truth for statuses, cancel reasons, refund
 * states, per-order-type flows, and per-actor visibility (labels). Mirrors the
 * Zomato/Swiggy/Uber-Eats model. Backend-only; the apps keep their UI and map
 * these statuses to their own copy.
 */

export const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  READY_FOR_PICKUP: 'ready_for_pickup',
  PICKED_UP: 'picked_up',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  SERVED: 'served',
  COMPLETED: 'completed',
  CANCELED: 'canceled',
  AUTO_CANCELLED: 'auto_cancelled',
} as const;
export type OrderStatusValue = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const CANCEL_REASONS = [
  'restaurant_not_responded',
  'item_unavailable',
  'restaurant_unavailable',
  'restaurant_closed',
  'customer_cancelled',
  'restaurant_cancelled',
  'admin_cancelled',
  'delivery_partner_unavailable',
  'payment_failed',
] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number];

export const REFUND_STATUS = {
  NOT_REQUIRED: 'not_required',
  PENDING: 'pending',
  PROCESSED: 'processed',
  FAILED: 'failed',
} as const;
export type RefundStatusValue = (typeof REFUND_STATUS)[keyof typeof REFUND_STATUS];

export type OrderType = 'delivery' | 'take_away' | 'dine_in';

/** Forward status path per order type (terminal = completed). */
export const FLOW: Record<OrderType, string[]> = {
  delivery: ['pending', 'confirmed', 'processing', 'ready_for_pickup', 'picked_up', 'out_for_delivery', 'completed'],
  take_away: ['pending', 'confirmed', 'processing', 'ready_for_pickup', 'completed'],
  dine_in: ['pending', 'confirmed', 'processing', 'served', 'completed'],
};

/**
 * The existing apps send legacy statuses. We normalise them to the new flow so
 * nothing changes for the apps (no UI change) while the backend speaks the new
 * vocabulary. `delivered` is treated as the terminal `completed`.
 */
export const LEGACY_ALIAS: Record<string, string> = {
  accepted: 'confirmed',
  handover: 'ready_for_pickup',
  delivered: 'completed',
};

export const TERMINAL_STATUSES = new Set(['completed', 'delivered', 'canceled', 'auto_cancelled', 'refunded']);

/** Statuses from which each actor may cancel (per the spec's cases). */
export const CANCELLABLE_BY = {
  customer: new Set(['pending', 'confirmed']),
  restaurant: new Set(['pending', 'confirmed']),
  admin: new Set(['pending', 'confirmed', 'processing', 'ready_for_pickup', 'accepted', 'handover', 'picked_up', 'out_for_delivery', 'served']),
};

/**
 * Per-actor display label for a status. Backend exposes this so any surface can
 * show the right message without hard-coding. (Apps already have their own; this
 * is the authoritative reference + used in notifications.)
 */
interface ActorLabels { customer: string; restaurant: string; delivery: string | null }
export const STATUS_LABELS: Record<string, ActorLabels> = {
  pending: { customer: 'Waiting for restaurant confirmation', restaurant: 'Accept / Reject order', delivery: null },
  confirmed: { customer: 'Order accepted', restaurant: 'Accepted', delivery: null },
  processing: { customer: 'Preparing your order', restaurant: 'Preparing food', delivery: null },
  ready_for_pickup: { customer: 'Food is ready', restaurant: 'Waiting for delivery partner', delivery: 'Pick up order' },
  picked_up: { customer: 'Rider picked up your order', restaurant: 'Handed over to rider', delivery: 'Order collected' },
  out_for_delivery: { customer: 'Order arriving', restaurant: 'Out for delivery', delivery: 'Delivering order' },
  served: { customer: 'Served', restaurant: 'Served', delivery: null },
  completed: { customer: 'Delivered successfully', restaurant: 'Completed', delivery: 'Delivery completed' },
  canceled: { customer: 'Order cancelled', restaurant: 'Cancelled', delivery: 'Order cancelled' },
  auto_cancelled: { customer: 'Order cancelled because the restaurant did not respond', restaurant: 'Order expired', delivery: null },
};

/** Customer-facing message for each cancel reason. */
export const CANCEL_MESSAGE_CUSTOMER: Record<CancelReason, string> = {
  restaurant_not_responded: 'Order cancelled because the restaurant did not respond.',
  item_unavailable: 'Order cancelled because items are unavailable.',
  restaurant_unavailable: 'Order cancelled because the restaurant is unavailable.',
  restaurant_closed: 'Order cancelled because the restaurant is closed.',
  customer_cancelled: 'You cancelled the order.',
  restaurant_cancelled: 'Order cancelled by restaurant.',
  admin_cancelled: 'Order cancelled by admin.',
  delivery_partner_unavailable: 'No delivery partner available.',
  payment_failed: 'Order cancelled because the payment failed.',
};

export const CANCEL_MESSAGE_RESTAURANT: Record<CancelReason, string> = {
  restaurant_not_responded: 'Order expired.',
  item_unavailable: 'Rejected due to unavailable items.',
  restaurant_unavailable: 'Cancelled — restaurant unavailable.',
  restaurant_closed: 'Cancelled — restaurant closed.',
  customer_cancelled: 'Cancelled by customer.',
  restaurant_cancelled: 'Cancelled successfully.',
  admin_cancelled: 'Cancelled by admin.',
  delivery_partner_unavailable: 'Unable to assign delivery partner.',
  payment_failed: 'Cancelled — payment failed.',
};

/** Cancel reasons that should also reach the delivery partner ("Order cancelled"). */
export const NOTIFY_DELIVERY_ON_CANCEL = new Set<CancelReason>([
  'customer_cancelled',
  'restaurant_cancelled',
  'admin_cancelled',
  'delivery_partner_unavailable',
]);

/** Normalise any incoming status to the canonical lifecycle status. */
export function normaliseStatus(status: string): string {
  return LEGACY_ALIAS[status] ?? status;
}
