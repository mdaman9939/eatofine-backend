import sharp from 'sharp';

export interface CompressedImage {
  buffer: Buffer;
  ext: string; // includes leading dot, e.g. '.webp'
  contentType: string;
}

// Longest-side cap and target file size. Photos are resized to fit inside a
// MAX_DIM box (never enlarged) and re-encoded as WebP, stepping the quality
// down until the result is under TARGET_BYTES — so every stored image lands
// around 150–300 KB with good visual quality and fast mobile loads.
const MAX_DIM = 1200;
const TARGET_BYTES = 300 * 1024;
const QUALITY_STEPS = [82, 72, 62, 52, 42];

/**
 * Resize + compress an uploaded image to a small WebP. Returns null when the
 * input isn't a processable raster image (e.g. an SVG) or sharp fails — the
 * caller should then fall back to storing the original bytes unchanged.
 */
export async function compressImage(input: Buffer): Promise<CompressedImage | null> {
  if (!input || input.length === 0) return null;
  try {
    const base = sharp(input, { failOn: 'none', animated: false })
      .rotate() // honour EXIF orientation so phone photos aren't sideways
      .resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true });

    let best: Buffer | null = null;
    for (const quality of QUALITY_STEPS) {
      const buffer = await base.clone().webp({ quality, effort: 4 }).toBuffer();
      best = buffer;
      if (buffer.length <= TARGET_BYTES) break;
    }
    if (!best) return null;
    // Never return something bigger than the original — keep whichever is smaller.
    if (best.length >= input.length) return null;
    return { buffer: best, ext: '.webp', contentType: 'image/webp' };
  } catch {
    return null;
  }
}
