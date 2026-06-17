"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeFlatAdditionalCharge = computeFlatAdditionalCharge;
const decimal_1 = require("./decimal");
const isOn = (v) => v === true || v === 1 || v === '1';
function computeFlatAdditionalCharge(rows) {
    const active = (Array.isArray(rows) ? rows : []).filter((r) => isOn(r.status) && (r.charge_type ?? 'fixed') === 'fixed');
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
//# sourceMappingURL=additional-charge.js.map