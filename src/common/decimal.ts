/**
 * Robust numeric coercion for values that may arrive as a plain number, a
 * string, a BSON Decimal128 (`{ $numberDecimal }`), or a serialized decimal.js
 * object (`{ s, e, d }`). Migrated MySQL DECIMAL columns land in Mongo as the
 * latter, and plain `Number(...)` on them returns NaN (which silently shows as
 * ₹0 in the UI). Use this anywhere a money/rate field is read from Mongo.
 */
export function toNum(x: unknown, fallback = 0): number {
  if (x == null) return fallback;
  if (typeof x === 'number') return Number.isFinite(x) ? x : fallback;
  if (typeof x === 'string') {
    const n = parseFloat(x);
    return Number.isFinite(n) ? n : fallback;
  }
  if (typeof x === 'object') {
    const o = x as { $numberDecimal?: unknown; s?: unknown; e?: unknown; d?: unknown; toString?: () => string };
    // BSON Decimal128
    if (o.$numberDecimal != null) {
      const n = parseFloat(String(o.$numberDecimal));
      return Number.isFinite(n) ? n : fallback;
    }
    // decimal.js internal representation { s: sign, e: exponent, d: digits[] }
    if (Array.isArray(o.d) && typeof o.e === 'number' && typeof o.s === 'number') {
      let digits = String(o.d[0] ?? '0');
      for (let i = 1; i < o.d.length; i++) digits += String(o.d[i]).padStart(7, '0');
      const intLen = o.e + 1;
      let s: string;
      if (intLen <= 0) s = '0.' + '0'.repeat(-intLen) + digits;
      else if (intLen >= digits.length) s = digits + '0'.repeat(intLen - digits.length);
      else s = digits.slice(0, intLen) + '.' + digits.slice(intLen);
      const n = o.s * (parseFloat(s) || 0);
      return Number.isFinite(n) ? n : fallback;
    }
    // Last resort: some driver decimals stringify cleanly.
    if (typeof o.toString === 'function') {
      const n = parseFloat(o.toString());
      if (Number.isFinite(n)) return n;
    }
  }
  return fallback;
}
