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

/**
 * Catalog-grade product image compression.
 *
 * Enforces the standardised gallery format:
 *  - 1080×1080 square (1:1) — every angle lines up perfectly in the carousel.
 *  - WebP at quality 0.82 (target sweet spot of 100–300 KB per image).
 *  - "Cover" mode (cover-crops the centre of non-square photos) so straight /
 *    side / top angles all render edge-to-edge without letterboxing.
 *  - SVG/GIF pass through untouched.
 *  - Falls back to the generic compressor on any failure.
 */
export async function compressProductImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/svg+xml" || file.type === "image/gif") return file;

  const TARGET = 1080;
  try {
    const square = await renderSquareWebP(file, TARGET, 0.82);
    if (!square) return await compressImage(file);
    // If a small source somehow inflated, prefer the original.
    if (square.size >= file.size && file.size <= 300 * 1024) return file;
    return square;
  } catch (err) {
    console.warn("[compressProductImage] failed, falling back", err);
    return await compressImage(file);
  }
}

/**
 * Decode a file, cover-crop it to a centred square, scale to `size`×`size`,
 * and encode as WebP. Returns null if the browser cannot decode the file.
 */
async function renderSquareWebP(
  file: File,
  size: number,
  quality: number,
): Promise<File | null> {
  const bitmap = await loadBitmap(file);
  if (!bitmap) return null;

  const srcW = bitmap.width;
  const srcH = bitmap.height;
  const side = Math.min(srcW, srcH);
  const sx = Math.round((srcW - side) / 2);
  const sy = Math.round((srcH - side) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // White backdrop in case of transparency — keeps catalog grid uniform.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  if (typeof (bitmap as ImageBitmap).close === "function") {
    (bitmap as ImageBitmap).close();
  }

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality),
  );
  if (!blob) return null;

  const baseName = file.name.replace(/\.(png|jpe?g|gif|bmp|tiff?|webp)$/i, "");
  return new File([blob], `${baseName || "image"}.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement | null> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to HTMLImageElement decode
    }
  }
  return await new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
