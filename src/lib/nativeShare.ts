// Native share helpers for mobile + desktop fallbacks.
//
// Used by the "Direct WhatsApp Share" job-work flow so admins can pick ANY
// contact / WhatsApp Group from their phone (not just saved workers) without
// us needing CONTACTS permission.
//
// Strategy:
//   1. If `navigator.canShare({ files })` works (modern Chrome on Android,
//      Safari iOS 16+) we trigger the OS share sheet with the actual file
//      attached — user then picks WhatsApp / WhatsApp group / Telegram / etc.
//   2. Otherwise we download the file(s) and open WhatsApp with a prefilled
//      caption so the admin can attach the file manually (same fallback we
//      already use for the saved-worker path).

import { downloadBlob } from "@/lib/downloadBlob";
import { openWhatsAppApp } from "@/lib/whatsapp";

const supportsFileShare = (files: File[]) => {
  try {
    return (
      typeof navigator !== "undefined" &&
      typeof (navigator as any).canShare === "function" &&
      typeof (navigator as any).share === "function" &&
      (navigator as any).canShare({ files })
    );
  } catch {
    return false;
  }
};

const blobToFile = (blob: Blob, name: string): File => {
  const type = blob.type || (name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
  return new File([blob], name, { type });
};

/**
 * Open the OS native share sheet with one or more files attached.
 * Falls back to downloading the file(s) + opening WhatsApp with the message
 * pre-filled when the platform can't share files directly.
 *
 * Returns "shared" if the native sheet handled it, "fallback" otherwise.
 */
export const shareFilesNative = async (
  blobs: Blob[],
  baseName: string,
  message: string,
  ext: "pdf" | "jpg" = "jpg",
): Promise<"shared" | "fallback"> => {
  if (!blobs.length) return "fallback";

  const isMulti = blobs.length > 1;
  const files = blobs.map((b, i) =>
    blobToFile(
      b,
      isMulti ? `${baseName}_Page${i + 1}.${ext}` : `${baseName}.${ext}`,
    ),
  );

  if (supportsFileShare(files)) {
    try {
      await (navigator as any).share({
        files,
        title: baseName,
        text: message,
      });
      return "shared";
    } catch (err: any) {
      // User cancelled — treat as handled, don't fall back.
      if (err?.name === "AbortError") return "shared";
      // fall through to fallback
    }
  }

  // Fallback: download files, then open WhatsApp with prefilled text.
  files.forEach((f, idx) => {
    setTimeout(() => downloadBlob(f, f.name), idx * 250);
  });
  setTimeout(() => openWhatsAppApp("", message), 400 + files.length * 250);
  return "fallback";
};
