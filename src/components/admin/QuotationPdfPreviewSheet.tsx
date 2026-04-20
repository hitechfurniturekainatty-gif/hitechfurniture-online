import { useEffect, useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Pencil, Download, MessageCircle, Loader2, FileText, HardHat } from "lucide-react";
// Use the legacy build for broader browser/iframe-less compatibility.
// We dynamically import inside the effect to keep the initial bundle small.

// Synchronous mobile detection — combines UA sniff (catches Android/iOS even
// on large screens) with the viewport breakpoint. Running this during render
// avoids the one-frame flash where the iframe branch would otherwise mount
// and trigger Chrome's PDF download prompt before the effect-based hook
// flips `isMobile` to true.
function detectMobile(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const uaMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const narrow = window.innerWidth < 768;
  return uaMobile || narrow;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** PDF blob to preview. When null + open=true the sheet shows a loader. */
  blob: Blob | null;
  filename: string;
  /** Click handler for the "Edit" button — typically just closes the sheet. */
  onEdit: () => void;
  /** Optional handlers to expose Download / WhatsApp directly from the preview. */
  onDownload?: () => void;
  onWhatsApp?: () => void;
  /** Optional handler to open the Assign Job Work dialog directly from preview. */
  onAssign?: () => void;
};

/**
 * Mobile-first PDF preview sheet shown right after saving a quotation.
 * - Embeds the actual generated PDF in an <iframe> (pixel-perfect with the
 *   downloaded file).
 * - Provides an "Edit" button that closes the sheet and returns to the editor.
 * - On mobile: takes the full screen (bottom sheet).
 * - On desktop: opens as a right-side sheet so the editor stays visible.
 */
export function QuotationPdfPreviewSheet({
  open,
  onOpenChange,
  blob,
  filename,
  onEdit,
  onDownload,
  onWhatsApp,
  onAssign,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const lastUrl = useRef<string | null>(null);
  // Initialise synchronously so the first render already knows whether to
  // use the raster preview (important — mobile Chrome will start a PDF
  // download the moment an <iframe src=blob:…pdf> mounts).
  const [isMobile] = useState<boolean>(() => detectMobile());
  // Rendered page image data URLs (mobile fallback — many mobile browsers
  // refuse to render PDFs inside an <iframe> and instead trigger a download).
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Create / revoke object URL whenever the blob changes.
  // IMPORTANT: Only do this on desktop. On mobile we must never feed the PDF
  // to an iframe (Chrome Android / some iOS browsers trigger a "Saved / Open"
  // download prompt instead of rendering inline), so we rasterise with
  // pdf.js in the effect below.
  useEffect(() => {
    if (isMobile || !blob) {
      if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
      lastUrl.current = null;
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(blob);
    if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
    lastUrl.current = next;
    setUrl(next);
  }, [blob, isMobile]);

  // On mobile, rasterize the PDF to images so the preview is actually visible
  // inline (iframes with PDF src often trigger a download on mobile Chrome).
  useEffect(() => {
    let cancelled = false;
    if (!isMobile || !blob) {
      setPageImages([]);
      setRenderError(null);
      return;
    }
    setRendering(true);
    setRenderError(null);
    setPageImages([]);
    (async () => {
      try {
        const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
        // Worker: use the bundled worker via Vite ?url import.
        const workerUrl = (
          await import("pdfjs-dist/legacy/build/pdf.worker.mjs?url")
        ).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        const buf = await blob.arrayBuffer();
        if (cancelled) return;
        const pdf = await pdfjs.getDocument({ data: buf }).promise;
        const images: string[] = [];
        const targetWidth = Math.min(window.innerWidth * window.devicePixelRatio, 1400);
        for (let p = 1; p <= pdf.numPages; p++) {
          if (cancelled) return;
          const page = await pdf.getPage(p);
          const viewport1 = page.getViewport({ scale: 1 });
          const scale = targetWidth / viewport1.width;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport }).promise;
          images.push(canvas.toDataURL("image/jpeg", 0.85));
          if (!cancelled) setPageImages([...images]);
        }
      } catch (e: any) {
        if (!cancelled) setRenderError(e?.message || "Failed to render PDF preview");
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [blob, isMobile]);

  // Final cleanup
  useEffect(() => {
    return () => {
      if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
      lastUrl.current = null;
    };
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-[100dvh] w-screen max-w-full flex-col gap-0 p-0 sm:max-w-2xl"
      >
        <SheetHeader className="shrink-0 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <SheetTitle className="flex items-center gap-2 text-left">
            <FileText className="h-4 w-4 text-primary" />
            Quotation Preview
          </SheetTitle>
        </SheetHeader>

        {/* PDF body */}
        <div className="flex-1 overflow-auto bg-muted">
          {!blob ? (
            <div className="flex h-full w-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : isMobile ? (
            // Mobile: render rasterized pages inline so the preview is
            // actually visible (avoids browser forcing a PDF download).
            <div className="flex flex-col items-center gap-3 p-3">
              {pageImages.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={`${filename} page ${i + 1}`}
                  className="w-full max-w-full rounded-sm bg-background shadow-sm"
                  loading="lazy"
                />
              ))}
              {rendering && (
                <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Rendering preview…
                </div>
              )}
              {!rendering && pageImages.length === 0 && renderError && (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Couldn't render inline preview. Tap PDF to download.
                </div>
              )}
            </div>
          ) : url ? (
            <iframe
              key={url}
              src={url}
              title={filename}
              className="h-full w-full border-0"
            />
          ) : null}
        </div>

        {/* Sticky action bar */}
        <div className="shrink-0 border-t border-border bg-background px-3 py-2 sm:px-6 sm:py-3">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={onEdit}
              className="h-11 flex-1 sm:flex-initial"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
            {onDownload && (
              <Button
                variant="outline"
                onClick={onDownload}
                className="h-11 flex-1 sm:flex-initial"
              >
                <Download className="mr-2 h-4 w-4" />
                PDF
              </Button>
            )}
            {onWhatsApp && (
              <Button
                variant="outline"
                onClick={onWhatsApp}
                className="h-11 flex-1 sm:flex-initial"
              >
                <MessageCircle className="mr-2 h-4 w-4 text-primary" />
                WhatsApp
              </Button>
            )}
            {onAssign && (
              <Button
                variant="secondary"
                onClick={onAssign}
                className="h-11 flex-1 sm:flex-initial"
              >
                <HardHat className="mr-2 h-4 w-4" />
                Assign
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}