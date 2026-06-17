"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeFlatAdditionalCharge = computeFlatAdditionalCharge;
const isOn = (v) => v === true || v === 1 || v === '1';
function computeFlatAdditionalCharge(rows) {
    const active = (Array.isArray(rows) ? rows : []).filter((r) => isOn(r.status) && (r.charge_type ?? 'fixed') === 'fixed');
    let total = 0;
    for (const r of active) {
        const base = Number(r.amount ?? 0) || 0;
        const gst = isOn(r.gst_applicable) ? base * (Number(r.gst_rate ?? 0) / 100) : 0;
        total += base + gst;
    }
    const name = active.length === 0 ? 'Additional Charge'
        : active.length === 1 ? (active[0].charge_head ?? 'Additional Charge')
            : 'Additional Charges';
    return { amount: Math.round(total * 100) / 100, name };
}
//# sourceMappingURL=additional-charge.js.map