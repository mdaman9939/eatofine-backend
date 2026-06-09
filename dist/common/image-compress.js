"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.compressImage = compressImage;
const sharp_1 = __importDefault(require("sharp"));
const MAX_DIM = 1200;
const TARGET_BYTES = 300 * 1024;
const QUALITY_STEPS = [82, 72, 62, 52, 42];
async function compressImage(input) {
    if (!input || input.length === 0)
        return null;
    try {
        const base = (0, sharp_1.default)(input, { failOn: 'none', animated: false })
            .rotate()
            .resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true });
        let best = null;
        for (const quality of QUALITY_STEPS) {
            const buffer = await base.clone().webp({ quality, effort: 4 }).toBuffer();
            best = buffer;
            if (buffer.length <= TARGET_BYTES)
                break;
        }
        if (!best)
            return null;
        if (best.length >= input.length)
            return null;
        return { buffer: best, ext: '.webp', contentType: 'image/webp' };
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=image-compress.js.map