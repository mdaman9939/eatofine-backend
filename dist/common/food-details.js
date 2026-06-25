"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFoodDetails = parseFoodDetails;
function parseFoodDetails(raw) {
    if (raw && typeof raw === 'object')
        return raw;
    if (typeof raw === 'string') {
        try {
            const o = JSON.parse(raw);
            return o && typeof o === 'object' ? o : {};
        }
        catch {
            return {};
        }
    }
    return {};
}
//# sourceMappingURL=food-details.js.map