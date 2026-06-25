"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ORDER_TYPES = void 0;
exports.sanitizeOrderTypes = sanitizeOrderTypes;
exports.chargeAppliesToOrderType = chargeAppliesToOrderType;
exports.computeFlatAdditionalCharge = computeFlatAdditionalCharge;
exports.computeAdditionalChargeForSubtotal = computeAdditionalChargeForSubtotal;
const decimal_1 = require("./decimal");
exports.ORDER_TYPES = ['take_away', 'dine_in', 'delivery'];
const isOn = (v) => v === true || v === 1 || v === '1';
function sanitizeOrderTypes(input) {
    const arr = Array.isArray(input)
        ? input
        : typeof input === 'string' ? input.split(',') : [];
    const valid = arr
        .map((x) => String(x).trim())
        .filter((x) => exports.ORDER_TYPES.includes(x));
    return Array.from(new Set(valid));
}
function chargeAppliesToOrderType(row, orderType) {
    if (!orderType)
        return true;
    const types = Array.isArray(row.order_types) ? row.order_types : null;
    if (types === null)
        return true;
    return types.includes(orderType);
}
function computeFlatAdditionalCharge(rows, orderType) {
    const active = (Array.isArray(rows) ? rows : []).filter((r) => isOn(r.status) && (r.charge_type ?? 'fixed') === 'fixed' && chargeAppliesToOrderType(r, orderType));
    let total = 0;
    for (const r of active) {
        const base = (0, decimal_1.toNum)(r.amount);
        const gst = isOn(r.gst_applicable) ? base * ((0, decimal_1.toNum)(r.gst_rate) / 100) : 0;
        total += base + gst;
    }
    const name = active.length === 0 ? 'Additional Charge'
        : active.length === 1 ? (active[0].charge_head ?? 'Additional Charge')
            : 'Additional Charges';
    return { amount: Math.round(total * 100) / 100, name };
}
function computeAdditionalChargeForSubtotal(rows, subtotal, orderType) {
    let total = 0;
    for (const r of Array.isArray(rows) ? rows : []) {
        if (!isOn(r.status) || !chargeAppliesToOrderType(r, orderType))
            continue;
        const base = (r.charge_type ?? 'fixed') === 'percentage'
            ? Math.max(0, (0, decimal_1.toNum)(subtotal)) * ((0, decimal_1.toNum)(r.amount) / 100)
            : (0, decimal_1.toNum)(r.amount);
        const gst = isOn(r.gst_applicable) ? base * ((0, decimal_1.toNum)(r.gst_rate) / 100) : 0;
        total += base + gst;
    }
    return Math.round(total * 100) / 100;
}
//# sourceMappingURL=additional-charge.js.map