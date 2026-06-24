/**
 * `order_details.food_details` is stored as an OBJECT snapshot (both the customer
 * and POS order flows). Legacy rows may still hold a JSON string. Parse either
 * form safely — never throws on an object (plain JSON.parse(object) would).
 */
export function parseFoodDetails(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const o: unknown = JSON.parse(raw);
      return o && typeof o === 'object' ? (o as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}
