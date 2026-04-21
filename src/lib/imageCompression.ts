import imageCompression from "browser-image-compression";

/**
 * Compress an image file on the client before upload.
 *
 * Tuned to preserve furniture detail/texture while keeping files tiny enough
 * for sub-1s loads on 4G:
 *  - Fast path: anything already <= 300KB is uploaded as-is (no decode).
 *  - Cap the longest side at 1920px — 4K-ready, sharp on every device.
 *  - Target ~500KB ceiling at quality 0.85 (visually lossless for furniture).
 *  - Convert to WebP for ~30% smaller files than JPEG at equal quality.
 *    SVG / GIF are passed through untouched (vector / animated).
 *  - Always runs in a Web Worker so the UI stays smooth.
 * Falls back to the original file if compression fails or the result is
 * somehow larger than the source.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  // SVGs and GIFs are not re-encoded — they're vector / animated and already small.
  if (file.type === "image/svg+xml" || file.type === "image/gif") return file;
  // Fast path — already-optimised images skip the decode entirely.
  if (file.size <= 300 * 1024) return file;

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 0.5, // ~500KB ceiling — keeps catalog snappy on 4G
      maxWidthOrHeight: 1920, // 4K-ready longest side, crisp on any screen
      useWebWorker: true,
      initialQuality: 0.85, // visually lossless for furniture textures
      fileType: "image/webp", // ~30% smaller than JPEG at the same quality
    });
    const blob = compressed as Blob;
    // Never ship a "compressed" file that ended up bigger than the original.
    if (blob.size >= file.size) return file;
    const webpName = file.name.replace(/\.(png|jpe?g|gif|bmp|tiff?)$/i, ".webp");
    if (blob instanceof File) {
      // Ensure the filename ends in .webp so the storage path matches the type.
      return new File([blob], webpName, { type: "image/webp", lastModified: Date.now() });
    }
    return new File([blob], webpName, {
      type: blob.type || "image/webp",
      lastModified: Date.now(),
    });
  } catch (err) {
    console.warn("[imageCompression] failed, using original", err);
    return file;
  }
}
