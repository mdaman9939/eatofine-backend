"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toNum = toNum;
function toNum(x, fallback = 0) {
    if (x == null)
        return fallback;
    if (typeof x === 'number')
        return Number.isFinite(x) ? x : fallback;
    if (typeof x === 'string') {
        const n = parseFloat(x);
        return Number.isFinite(n) ? n : fallback;
    }
    if (typeof x === 'object') {
        const o = x;
        if (o.$numberDecimal != null) {
            const n = parseFloat(String(o.$numberDecimal));
            return Number.isFinite(n) ? n : fallback;
        }
        if (Array.isArray(o.d) && typeof o.e === 'number' && typeof o.s === 'number') {
            let digits = String(o.d[0] ?? '0');
            for (let i = 1; i < o.d.length; i++)
                digits += String(o.d[i]).padStart(7, '0');
            const intLen = o.e + 1;
            let s;
            if (intLen <= 0)
                s = '0.' + '0'.repeat(-intLen) + digits;
            else if (intLen >= digits.length)
                s = digits + '0'.repeat(intLen - digits.length);
            else
                s = digits.slice(0, intLen) + '.' + digits.slice(intLen);
            const n = o.s * (parseFloat(s) || 0);
            return Number.isFinite(n) ? n : fallback;
        }
        if (typeof o.toString === 'function') {
            const n = parseFloat(o.toString());
            if (Number.isFinite(n))
                return n;
        }
    }
    return fallback;
}
//# sourceMappingURL=decimal.js.map