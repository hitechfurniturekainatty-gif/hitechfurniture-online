import imageCompression from "browser-image-compression";

/**
 * Compress an image file on the client before upload.
 * Targets ~500KB max with up to 1920px on the longest side.
 * Falls back to the original file if compression fails.
 */
export async function compressImage(file: File): Promise<File> {
  // Skip non-images and tiny files (already small)
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= 300 * 1024) return file;

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 0.5, // ~500KB
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      initialQuality: 0.8,
      fileType: file.type === "image/png" ? "image/jpeg" : file.type,
    });
    // imageCompression returns a Blob in some envs; ensure it's a File
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
