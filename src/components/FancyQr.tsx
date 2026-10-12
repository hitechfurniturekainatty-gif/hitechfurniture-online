import { forwardRef, useEffect, useState } from "react";

type Matrix = { size: number; get: (r: number, c: number) => boolean };

/**
 * Branded QR code as SVG: round dots, rounded "eyes", warm brown→amber
 * gradient and a small centre badge. Uses error-correction level H so the
 * badge never stops it from scanning. Pure SVG (no external images), so it
 * can be exported to PNG for printing.
 */
export const FancyQr = forwardRef<SVGSVGElement, {
  value: string; size?: number; className?: string; dark?: string; accent?: string; badge?: string; title?: string;
}>(function FancyQr({ value, size = 220, className, dark = "#5E2D05", accent = "#9C5B10", badge = "H", title = "QR code" }, ref) {
  const [m, setM] = useState<Matrix | null>(null);

  useEffect(() => {
    let alive = true;
    void import("qrcode").then((QR) => {
      const q = QR.create(value, { errorCorrectionLevel: "H" });
      const n = q.modules.size;
      const data = q.modules.data;
      if (alive) setM({ size: n, get: (r, c) => !!data[r * n + c] });
    }).catch(() => { if (alive) setM(null); });
    return () => { alive = false; };
  }, [value]);

  if (!m) return <div className={className} style={{ width: size, height: size }} aria-label={title} role="img" />;

  const n = m.size;
  const pad = 2;
  const vb = n + pad * 2;
  const inEye = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  const hole = Math.ceil(n * 0.22) | 1; // odd number of modules, centred
  const h0 = Math.floor((n - hole) / 2);
  const inHole = (r: number, c: number) => r >= h0 && r < h0 + hole && c >= h0 && c < h0 + hole;

  const dots: JSX.Element[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!m.get(r, c) || inEye(r, c) || inHole(r, c)) continue;
      dots.push(<circle key={`${r}-${c}`} cx={c + pad + 0.5} cy={r + pad + 0.5} r={0.43} />);
    }
  }
  const eye = (r: number, c: number, k: string) => (
    <g key={k} transform={`translate(${c + pad} ${r + pad})`}>
      <rect x={0.5} y={0.5} width={6} height={6} rx={1.9} fill="none" stroke="url(#qr-g)" strokeWidth={1} />
      <rect x={2} y={2} width={3} height={3} rx={0.9} fill={dark} />
    </g>
  );
  const cx = vb / 2;
  const br = (hole - 1) / 2;

  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${vb} ${vb}`} width={size} height={size} className={className} role="img" aria-label={title} shapeRendering="geometricPrecision">
      <title>{title}</title>
      <defs>
        <linearGradient id="qr-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={dark} />
          <stop offset="1" stopColor={accent} />
        </linearGradient>
      </defs>
      <rect width={vb} height={vb} rx={vb * 0.12} fill="#ffffff" />
      <g fill="url(#qr-g)">{dots}</g>
      {eye(0, 0, "tl")}{eye(0, n - 7, "tr")}{eye(n - 7, 0, "bl")}
      <circle cx={cx} cy={cx} r={br} fill="#ffffff" />
      <circle cx={cx} cy={cx} r={br - 0.6} fill="url(#qr-g)" />
      <text x={cx} y={cx} textAnchor="middle" dominantBaseline="central" fontFamily="Georgia, 'Times New Roman', serif" fontWeight={700} fontSize={br * 1.25} fill="#ffffff">{badge}</text>
    </svg>
  );
});

/** Render an SVG element to a PNG data URL (for printing). */
export async function svgToPng(svg: SVGSVGElement, px = 1200): Promise<string> {
  const xml = new XMLSerializer().serializeToString(svg);
  const src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  const img = new Image();
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("QR render failed")); img.src = src; });
  const canvas = document.createElement("canvas");
  canvas.width = px; canvas.height = px;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, px, px);
  ctx.drawImage(img, 0, 0, px, px);
  return canvas.toDataURL("image/png");
}
