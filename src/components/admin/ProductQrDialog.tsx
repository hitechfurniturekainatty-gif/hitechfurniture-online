import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, Download } from "lucide-react";

export type QrTarget = {
  productId: string;
  productName: string;
  productCode: string;
  variantId?: string;
  variantName?: string;
};

/**
 * Encodes product (and optional variant) identity into a scannable QR code.
 * The payload is a stable URL-style string so any future scanner page can
 * route directly to /admin/products/<id>?variant=<vid>.
 */
export const ProductQrDialog = ({
  open,
  onOpenChange,
  target,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  target: QrTarget | null;
}) => {
  const [dataUrl, setDataUrl] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !target) return;
    setBusy(true);
    const payload = target.variantId
      ? `hitech://product/${target.productId}?variant=${target.variantId}`
      : `hitech://product/${target.productId}`;
    QRCode.toDataURL(payload, { margin: 1, width: 512, errorCorrectionLevel: "M" })
      .then((url) => setDataUrl(url))
      .finally(() => setBusy(false));
  }, [open, target]);

  const handlePrint = () => {
    const node = printRef.current;
    if (!node) return;
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return;
    w.document.write(`<html><head><title>QR · ${target?.productCode ?? ""}</title>
      <style>body{font-family:system-ui;padding:24px;text-align:center}
      img{width:280px;height:280px}
      h2{margin:8px 0 4px;font-size:16px}
      p{margin:2px 0;font-size:12px;color:#555}
      </style></head><body>${node.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); w.close(); }, 250);
  };

  const handleDownload = () => {
    if (!dataUrl || !target) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qr-${target.productCode}${target.variantId ? "-" + target.variantId.slice(0, 6) : ""}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Product QR</DialogTitle>
        </DialogHeader>
        <div ref={printRef} className="flex flex-col items-center gap-2 py-2">
          {busy || !dataUrl ? (
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          ) : (
            <img src={dataUrl} alt="Product QR" className="h-64 w-64" />
          )}
          {target && (
            <>
              <h2 className="text-base font-semibold">{target.productName}</h2>
              <p className="text-xs text-muted-foreground">Code · {target.productCode}</p>
              {target.variantName && (
                <p className="text-xs text-muted-foreground">Variant · {target.variantName}</p>
              )}
            </>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleDownload} disabled={!dataUrl}>
            <Download className="mr-1 h-4 w-4" /> PNG
          </Button>
          <Button onClick={handlePrint} disabled={!dataUrl}>
            <Printer className="mr-1 h-4 w-4" /> Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};