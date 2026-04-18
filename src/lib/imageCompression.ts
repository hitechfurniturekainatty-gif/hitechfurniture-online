import imageCompression from "browser-image-compression";

/**
 * Compress an image file on the client before upload.
 * Optimised for SPEED on quotation/measurement photos taken from phones:
 *  - Skip anything already <= 500KB (fast path, no decode).
 *  - Cap longest side at 1280px (more than enough for PDF/preview).
 *  - Target ~300KB at quality 0.72.
 *  - Always run inside a Web Worker so the UI stays buttery smooth.
 * Falls back to the original file if compression fails.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  // Fast path — phone-shrunk or already-optimised images skip the decode entirely.
  if (file.size <= 500 * 1024) return file;

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 0.3, // ~300KB target
      maxWidthOrHeight: 1280, // plenty for previews + A4 PDF rendering
      useWebWorker: true,
      initialQuality: 0.72,
      fileType: file.type === "image/png" ? "image/jpeg" : file.type,
    });
    const blob = compressed as Blob;
    if (blob instanceof File) return blob;
    return new File([blob], file.name.replace(/\.png$/i, ".jpg"), {
      type: blob.type || "image/jpeg",
      lastModified: Date.now(),
    });
  } catch (err) {
    console.warn("[imageCompression] failed, using original", err);
    return file;
  }
}
