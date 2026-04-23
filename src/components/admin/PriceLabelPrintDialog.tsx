import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { BRAND_NAME, formatINR } from "@/lib/brand";
import { Printer, Loader2 } from "lucide-react";

export type LabelProduct = {
  id: string;
  product_name: string;
  product_code: string;
  mrp: number;
  offer_price: number | null;
  material: string | null;
  dimensions: string | null;
  available_colors: string[] | null;
};

type Density = 4 | 8 | 12 | 16;
type Layout = "standard" | "detailed";

const GRID_BY_DENSITY: Record<Density, { cols: number; rows: number }> = {
  4: { cols: 2, rows: 2 },
  8: { cols: 2, rows: 4 },
  12: { cols: 3, rows: 4 },
  16: { cols: 4, rows: 4 },
};

export const PriceLabelPrintDialog = ({
  open,
  onOpenChange,
  products,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  products: LabelProduct[];
}) => {
  const [density, setDensity] = useState<Density>(8);
  const [layout, setLayout] = useState<Layout>("standard");
  const [showQr, setShowQr] = useState(true);
  const [copies, setCopies] = useState("1");
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Generate QR data URLs once products / showQr changes
  useEffect(() => {
    if (!open || !showQr) return;
    let cancelled = false;
    setGenerating(true);
    Promise.all(
      products.map(async (p) => {
        const dataUrl = await QRCode.toDataURL(p.product_code, {
          margin: 0,
          width: 160,
          errorCorrectionLevel: "M",
        });
        return [p.id, dataUrl] as const;
      })
    ).then((entries) => {
      if (cancelled) return;
      const map: Record<string, string> = {};
      entries.forEach(([id, url]) => { map[id] = url; });
      setQrMap(map);
      setGenerating(false);
    });
    return () => { cancelled = true; };
  }, [open, showQr, products]);

  const expanded = useMemo(() => {
    const c = Math.max(1, Math.min(20, parseInt(copies, 10) || 1));
    const out: LabelProduct[] = [];
    products.forEach((p) => {
      for (let i = 0; i < c; i++) out.push(p);
    });
    return out;
  }, [products, copies]);

  const grid = GRID_BY_DENSITY[density];

  const print = () => {
    if (!printRef.current) return;
    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) return;
    const styles = `
      @page { size: A4; margin: 8mm; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1a1a1a; }
      .sheet { display: grid; grid-template-columns: repeat(${grid.cols}, 1fr); gap: 4mm; }
      .label { border: 1px dashed #bbb; border-radius: 6px; padding: 4mm; display: flex; flex-direction: column; gap: 2mm; page-break-inside: avoid; min-height: ${280 / grid.rows}mm; }
      .label .brand { font-size: 9px; letter-spacing: 1px; color: #0A6E3D; font-weight: 700; text-transform: uppercase; }
      .label .name { font-size: ${density >= 12 ? 12 : 14}px; font-weight: 700; line-height: 1.2; }
      .label .code { font-size: 10px; color: #666; font-family: ui-monospace, monospace; }
      .label .meta { font-size: 9px; color: #555; line-height: 1.35; }
      .label .price-row { display: flex; align-items: baseline; gap: 4px; margin-top: auto; }
      .label .mrp-strike { font-size: 10px; color: #888; text-decoration: line-through; }
      .label .price { font-size: ${density >= 12 ? 16 : 20}px; font-weight: 800; color: #0A6E3D; }
      .label .qr-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 4mm; margin-top: 2mm; }
      .label .qr { width: ${density >= 12 ? 16 : 22}mm; height: ${density >= 12 ? 16 : 22}mm; }
      .label .offer-tag { display: inline-block; background: #C49A2A; color: white; padding: 1px 5px; border-radius: 3px; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    `;
    w.document.write(`<!doctype html><html><head><title>Price labels</title><style>${styles}</style></head><body>`);
    w.document.write(printRef.current.innerHTML);
    w.document.write(`</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-full flex-col gap-0 rounded-none p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-4xl sm:rounded-lg">
        <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6 sm:py-4">
          <DialogTitle className="font-display text-xl">Print price labels · {products.length} products</DialogTitle>
          <p className="text-xs text-muted-foreground">A4 sheet · {expanded.length} labels total</p>
        </DialogHeader>

        <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
          {/* Settings */}
          <div className="shrink-0 space-y-4 border-b bg-muted/20 p-4 sm:p-6 lg:w-72 lg:border-b-0 lg:border-r">
            <div className="space-y-1.5">
              <Label>Labels per A4</Label>
              <Select value={String(density)} onValueChange={(v) => setDensity(parseInt(v, 10) as Density)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">4 (large)</SelectItem>
                  <SelectItem value="8">8 (medium)</SelectItem>
                  <SelectItem value="12">12 (small)</SelectItem>
                  <SelectItem value="16">16 (mini)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Layout</Label>
              <Select value={layout} onValueChange={(v) => setLayout(v as Layout)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard (name + price)</SelectItem>
                  <SelectItem value="detailed">Detailed (+ material, size, colors)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Copies per product</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={copies}
                onChange={(e) => setCopies(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label className="m-0">Show QR code</Label>
              <Switch checked={showQr} onCheckedChange={setShowQr} />
            </div>
            <p className="text-xs text-muted-foreground">QR encodes the product code for quick scanning at the counter.</p>
          </div>

          {/* Preview */}
          <div className="flex-1 overflow-auto bg-secondary/30 p-4 sm:p-6">
            {generating && showQr ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div ref={printRef}>
                <div
                  className="sheet mx-auto bg-white p-3 shadow-sm"
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
                    gap: "4mm",
                    width: "194mm",
                  }}
                >
                  {expanded.map((p, idx) => {
                    const onOffer = p.offer_price && p.offer_price < p.mrp;
                    return (
                      <div
                        key={`${p.id}-${idx}`}
                        className="label"
                        style={{
                          border: "1px dashed #bbb",
                          borderRadius: 6,
                          padding: "4mm",
                          display: "flex",
                          flexDirection: "column",
                          gap: "2mm",
                          minHeight: `${280 / grid.rows}mm`,
                          color: "#1a1a1a",
                          background: "white",
                          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div className="brand" style={{ fontSize: 9, letterSpacing: 1, color: "#0A6E3D", fontWeight: 700, textTransform: "uppercase" }}>
                            {BRAND_NAME}
                          </div>
                          {onOffer && <span className="offer-tag" style={{ background: "#C49A2A", color: "white", padding: "1px 5px", borderRadius: 3, fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Offer</span>}
                        </div>
                        <div className="name" style={{ fontSize: density >= 12 ? 12 : 14, fontWeight: 700, lineHeight: 1.2 }}>
                          {p.product_name}
                        </div>
                        <div className="code" style={{ fontSize: 10, color: "#666", fontFamily: "ui-monospace, monospace" }}>
                          {p.product_code}
                        </div>
                        {layout === "detailed" && (
                          <div className="meta" style={{ fontSize: 9, color: "#555", lineHeight: 1.35 }}>
                            {p.material && <div>Material: {p.material}</div>}
                            {p.dimensions && <div>Size: {p.dimensions}</div>}
                            {p.available_colors && p.available_colors.length > 0 && (
                              <div>Colors: {p.available_colors.join(", ")}</div>
                            )}
                          </div>
                        )}
                        <div className="qr-row" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "4mm", marginTop: "auto" }}>
                          <div className="price-row" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            {onOffer && (
                              <span className="mrp-strike" style={{ fontSize: 10, color: "#888", textDecoration: "line-through" }}>
                                MRP {formatINR(p.mrp)}
                              </span>
                            )}
                            <span className="price" style={{ fontSize: density >= 12 ? 16 : 20, fontWeight: 800, color: "#0A6E3D" }}>
                              {formatINR(onOffer ? p.offer_price! : p.mrp)}
                            </span>
                          </div>
                          {showQr && qrMap[p.id] && (
                            <img
                              src={qrMap[p.id]}
                              alt={p.product_code}
                              className="qr"
                              style={{ width: density >= 12 ? "16mm" : "22mm", height: density >= 12 ? "16mm" : "22mm" }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t bg-background px-4 py-3 sm:flex-row sm:px-6 sm:py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">Close</Button>
          <Button onClick={print} className="w-full sm:w-auto">
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};