"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOTIFY_DELIVERY_ON_CANCEL = exports.CANCEL_MESSAGE_RESTAURANT = exports.CANCEL_MESSAGE_CUSTOMER = exports.STATUS_LABELS = exports.CANCELLABLE_BY = exports.TERMINAL_STATUSES = exports.LEGACY_ALIAS = exports.FLOW = exports.REFUND_STATUS = exports.CANCEL_REASONS = exports.ORDER_STATUS = void 0;
exports.normaliseStatus = normaliseStatus;
exports.ORDER_STATUS = {
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
};
exports.CANCEL_REASONS = [
    'restaurant_not_responded',
    'item_unavailable',
    'restaurant_unavailable',
    'restaurant_closed',
    'customer_cancelled',
    'restaurant_cancelled',
    'admin_cancelled',
    'delivery_partner_unavailable',
    'payment_failed',
];
exports.REFUND_STATUS = {
    NOT_REQUIRED: 'not_required',
    PENDING: 'pending',
    PROCESSED: 'processed',
    FAILED: 'failed',
};
exports.FLOW = {
    delivery: ['pending', 'confirmed', 'processing', 'ready_for_pickup', 'picked_up', 'out_for_delivery', 'completed'],
    take_away: ['pending', 'confirmed', 'processing', 'ready_for_pickup', 'completed'],
    dine_in: ['pending', 'confirmed', 'processing', 'served', 'completed'],
};
exports.LEGACY_ALIAS = {
    accepted: 'confirmed',
    handover: 'ready_for_pickup',
    delivered: 'completed',
};
exports.TERMINAL_STATUSES = new Set(['completed', 'delivered', 'canceled', 'auto_cancelled', 'refunded']);
exports.CANCELLABLE_BY = {
    customer: new Set(['pending', 'confirmed']),
    restaurant: new Set(['pending', 'confirmed']),
    admin: new Set(['pending', 'confirmed', 'processing', 'ready_for_pickup', 'accepted', 'handover', 'picked_up', 'out_for_delivery', 'served']),
};
exports.STATUS_LABELS = {
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
exports.CANCEL_MESSAGE_CUSTOMER = {
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
exports.CANCEL_MESSAGE_RESTAURANT = {
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
exports.NOTIFY_DELIVERY_ON_CANCEL = new Set([
    'customer_cancelled',
    'restaurant_cancelled',
    'admin_cancelled',
    'delivery_partner_unavailable',
]);
function normaliseStatus(status) {
    return exports.LEGACY_ALIAS[status] ?? status;
}
//# sourceMappingURL=order-lifecycle.constants.js.map