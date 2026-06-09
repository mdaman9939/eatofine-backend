export interface CompressedImage {
    buffer: Buffer;
    ext: string;
    contentType: string;
}
export declare function compressImage(input: Buffer): Promise<CompressedImage | null>;
