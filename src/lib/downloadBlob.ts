// Tiny helper extracted out of @/lib/pdf so that callers needing only the
// download utility don't drag the entire @react-pdf/renderer bundle (~490 KB
// gzipped) into their route chunk.
//
// Robust across desktop, Android Chrome, iOS Safari and installed PWAs:
// the object URL is kept alive long enough for slow mobile downloads, and on
// browsers that ignore the `download` attribute (iOS / standalone PWA) we fall
// back to the native share sheet, then to opening the file in a new tab.
export function downloadBlob(blob: Blob, filename: string) {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
  const standalone =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true);

  if ((isIOS || standalone) && typeof navigator.share === "function") {
    try {
      const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: filename }).catch((e) => { if (e?.name !== "AbortError") anchorDownload(blob, filename, isIOS); });
        return;
      }
    } catch {
      /* fall through */
    }
  }
  anchorDownload(blob, filename, isIOS);
}

function anchorDownload(blob: Blob, filename: string, openFallback: boolean) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (openFallback && !("download" in HTMLAnchorElement.prototype)) window.open(url, "_blank");
  // Mobile browsers can take several seconds to start writing the file —
  // revoking after 1s produced empty/failed downloads.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
