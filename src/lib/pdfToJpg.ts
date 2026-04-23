/**
 * Rasterise a PDF blob into a single tall JPG blob.
 *
 * Why: the app's documents (Quotations / POs / Job Work / Product brochure)
 * are authored as multi-page A4 PDFs via @react-pdf/renderer. The user wants
 * to share/download them as a single JPG image (best UX on WhatsApp).
 *
 * Strategy: render every PDF page with pdf.js, stitch the pages vertically
 * onto one canvas, then export JPEG. We start at a high resolution and
 * progressively downscale + lower quality until the output is under ~1MB,
 * so quality stays as crisp as possible while remaining WhatsApp-friendly.
 */

const MAX_BYTES = 1024 * 1024; // 1 MB target ceiling

// Resolution attempts, in pixel-width per A4 page (A4 = 595pt wide @ 72dpi).
// We try high → low so the typical 1–2 page quotation stays at print quality
// and only big multi-page docs degrade to keep within 1 MB.
const WIDTH_ATTEMPTS = [1240, 1080, 920, 800, 680, 560];
const QUALITY_ATTEMPTS = [0.88, 0.82, 0.75, 0.68];

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
 */
export async function pdfBlobToJpgBlob(
  pdfBlob: Blob,
  options: PdfToJpgOptions = {},
): Promise<Blob> {
  const maxBytes = options.maxBytes ?? MAX_BYTES;
  const background = options.background ?? "#ffffff";
  const gap = options.gap ?? 0;

  // Lazy-load pdf.js (heavy) only when actually rasterising.
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Use Vite's `new Worker(new URL(..., import.meta.url), { type: "module" })`
  // pattern. Vite bundles the worker and serves it with the correct MIME type,
  // which avoids the "Setting up fake worker failed" / "module script must be
  // served with a JavaScript MIME type" errors we hit when using `?url` on
  // some hosts (which serve .mjs as application/octet-stream).
  if (!pdfjs.GlobalWorkerOptions.workerPort) {
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(
      new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url),
      { type: "module" },
    );
  }

  const buf = await pdfBlob.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const pageCount: number = pdf.numPages;

  // Cache the rendered pages at unit scale (scale=1) once, then just
  // re-render at the chosen resolution per attempt below.
  const pages = [];
  for (let p = 1; p <= pageCount; p++) {
    const page = await pdf.getPage(p);
    const v1 = page.getViewport({ scale: 1 });
    pages.push({ page, baseW: v1.width, baseH: v1.height });
  }

  let lastBlob: Blob | null = null;

  for (const targetWidth of WIDTH_ATTEMPTS) {
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