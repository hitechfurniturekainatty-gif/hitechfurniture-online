/**
 * Rasterise a PDF blob into JPG image(s).
 *
 * Why: the app's documents (Quotations / POs / Job Work / Product brochure)
 * are authored as multi-page A4 PDFs via @react-pdf/renderer. The user wants
 * to share/download them as a single JPG image (best UX on WhatsApp).
 *
 * Two output modes:
 *  - `pdfBlobToJpgBlob(pdf)` → single tall JPG (all pages stitched). Good
 *    for one-page brochures.
 *  - `pdfBlobToJpgPages(pdf)` → one JPG per PDF page (preferred for
 *    multi-page quotations & job-work orders so workers can swipe page-by-
 *    page on WhatsApp without zooming). Each page is rasterised at 3× DPI
 *    for crystal-clear zoom on product textures and measurements, then
 *    quality-scaled down until it fits the WhatsApp size budget.
 */

const MAX_BYTES = 1024 * 1024; // 1 MB target ceiling per image (WhatsApp-friendly)

// Resolution attempts in pixel-width per A4 page (A4 = 595pt wide @ 72dpi).
// First entry ≈ 3× scale (1785px ≈ 215 DPI) for crystal-clear zoom on
// textures / measurements. We progressively step down only if the resulting
// JPEG cannot fit the size budget at any quality level.
const WIDTH_ATTEMPTS_STITCHED = [1240, 1080, 920, 800, 680, 560];
const WIDTH_ATTEMPTS_PER_PAGE = [1785, 1487, 1240, 1080, 920, 800];
const QUALITY_ATTEMPTS = [0.92, 0.88, 0.82, 0.75, 0.68];

export type PdfToJpgOptions = {
  /** Override target file size (bytes). Default 1 MB. */
  maxBytes?: number;
  /** Background fill behind transparent PDF areas. Default white. */
  background?: string;
  /** Vertical gap (px) between stitched pages. Default 0. */
  gap?: number;
};

/**
 * Convert a PDF Blob into a single tall JPG Blob, suitable for WhatsApp share.
 * Use this for single-page documents (e.g. product brochures). For multi-page
 * quotations / job-work orders prefer `pdfBlobToJpgPages` so each page stays
 * at full zoom-quality independently.
 */
export async function pdfBlobToJpgBlob(
  pdfBlob: Blob,
  options: PdfToJpgOptions = {},
): Promise<Blob> {
  const maxBytes = options.maxBytes ?? MAX_BYTES;
  const background = options.background ?? "#ffffff";
  const gap = options.gap ?? 0;

  const pages = await loadPdfPages(pdfBlob);

  let lastBlob: Blob | null = null;

  for (const targetWidth of WIDTH_ATTEMPTS_STITCHED) {
    // Render every page onto its own canvas at this resolution.
    const pageCanvases: HTMLCanvasElement[] = [];
    for (const { page, baseW } of pages) {
      const scale = targetWidth / baseW;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D context unavailable");
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      pageCanvases.push(canvas);
    }

    // Stitch vertically.
    const stitchedW = Math.max(...pageCanvases.map((c) => c.width));
    const stitchedH =
      pageCanvases.reduce((s, c) => s + c.height, 0) +
      gap * Math.max(0, pageCanvases.length - 1);
    const stitched = document.createElement("canvas");
    stitched.width = stitchedW;
    stitched.height = stitchedH;
    const sctx = stitched.getContext("2d");
    if (!sctx) throw new Error("Canvas 2D context unavailable");
    sctx.fillStyle = background;
    sctx.fillRect(0, 0, stitchedW, stitchedH);

    let y = 0;
    for (const c of pageCanvases) {
      const x = Math.round((stitchedW - c.width) / 2);
      sctx.drawImage(c, x, y);
      y += c.height + gap;
    }

    // Try progressively lower JPEG qualities at this resolution until
    // we hit the size budget.
    for (const q of QUALITY_ATTEMPTS) {
      const blob = await canvasToJpegBlob(stitched, q);
      lastBlob = blob;
      if (blob.size <= maxBytes) {
        return blob;
      }
    }
    // Couldn't fit at this resolution — try a smaller one.
  }

  // Fallback: return whatever we last produced (smallest attempt).
  if (!lastBlob) throw new Error("Failed to rasterise PDF");
  return lastBlob;
}

/**
 * Convert a PDF Blob into one JPG Blob per PDF page, suitable for sequential
 * WhatsApp sharing. Each page is rasterised at 3× scale (~215 DPI) for
 * crisp zoom, then quality-scaled to fit `maxBytes` (default 1 MB).
 *
 * The PDF is authored with `wrap={false}` on every item row, so each
 * resulting JPG already contains atomic items (a single furniture item is
 * never split across two images).
 */
export async function pdfBlobToJpgPages(
  pdfBlob: Blob,
  options: PdfToJpgOptions = {},
): Promise<Blob[]> {
  const maxBytes = options.maxBytes ?? MAX_BYTES;
  const background = options.background ?? "#ffffff";

  const pages = await loadPdfPages(pdfBlob);
  const out: Blob[] = [];

  for (const { page, baseW } of pages) {
    let lastBlob: Blob | null = null;
    let placed = false;

    for (const targetWidth of WIDTH_ATTEMPTS_PER_PAGE) {
      const scale = targetWidth / baseW;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D context unavailable");
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;

      for (const q of QUALITY_ATTEMPTS) {
        const blob = await canvasToJpegBlob(canvas, q);
        lastBlob = blob;
        if (blob.size <= maxBytes) {
          out.push(blob);
          placed = true;
          break;
        }
      }
      if (placed) break;
    }

    if (!placed) {
      if (!lastBlob) throw new Error("Failed to rasterise PDF page");
      out.push(lastBlob);
    }
  }

  return out;
}

/**
 * Shared pdf.js loader: lazy-loads the (heavy) library, configures the worker
 * once, then returns the parsed pages with their unit-scale dimensions.
 */
async function loadPdfPages(pdfBlob: Blob) {
  // Lazy-load pdf.js (heavy) only when actually rasterising.
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Use Vite's `new Worker(new URL(..., import.meta.url), { type: "module" })`
  // pattern so the worker gets bundled with the right MIME type — `?url` is
  // unreliable on some hosts that serve .mjs as application/octet-stream.
  if (!pdfjs.GlobalWorkerOptions.workerPort) {
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(
      new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url),
      { type: "module" },
    );
  }
  const buf = await pdfBlob.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const pageCount: number = pdf.numPages;

  const pages: { page: any; baseW: number; baseH: number }[] = [];
  for (let p = 1; p <= pageCount; p++) {
    const page = await pdf.getPage(p);
    const v1 = page.getViewport({ scale: 1 });
    pages.push({ page, baseW: v1.width, baseH: v1.height });
  }
  return pages;
}

function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      quality,
    );
  });
}

/** Helper: trigger a browser download for a Blob. */
export function downloadJpgBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".jpg") ? filename : `${filename}.jpg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}