/**
 * Compress an image file on the device before upload.
 *
 * Runs on the main thread with the browser's own decoder and <canvas> — no
 * web worker and no script from a CDN. (The old browser-image-compression
 * worker loaded its code from a CDN; on shop phones it often timed out and
 * the original 1.5–2.5 MB PNG/JPEG was uploaded, which made quotation pages
 * slow on mobile and desktop.)
 *  - Already small JPEG/WebP (<= 300 KB) is uploaded as it is.
 *  - Longest side capped at 1600 px — sharp on phones, desktops and PDFs.
 *  - WebP at quality 0.8 (JPEG 0.82 where the browser cannot write WebP).
 *    Typical result: 150–350 KB instead of 1.5–2.5 MB.
 *  - Transparent areas (PNG screenshots) are painted white.
 *  - SVG / GIF pass through untouched.
 * Falls back to the original file if the browser cannot decode it (e.g. HEIC
 * on some Android phones) or if the result would be larger.
 */
export const UPLOAD_MAX_SIDE = 1600;

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/svg+xml" || file.type === "image/gif") return file;
  const alreadyLight = file.type === "image/jpeg" || file.type === "image/webp";
  if (alreadyLight && file.size <= 300 * 1024) return file;

  try {
    const bitmap = await loadBitmap(file);
    if (!bitmap) return file;
    const w = bitmap.width;
    const h = bitmap.height;
    if (!w || !h) return file;
    const scale = Math.min(1, UPLOAD_MAX_SIDE / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    if (typeof (bitmap as ImageBitmap).close === "function") (bitmap as ImageBitmap).close();

    const encode = (type: string, quality: number) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
    let blob = await encode("image/webp", 0.8);
    // Browsers that cannot write WebP silently return PNG — use JPEG then.
    if (!blob || blob.type !== "image/webp") blob = await encode("image/jpeg", 0.82);
    if (!blob || blob.size >= file.size) return file;

    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    const baseName = file.name.replace(/\.[a-z0-9]+$/i, "") || "photo";
    return new File([blob], `${baseName}.${ext}`, { type: blob.type, lastModified: Date.now() });
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
