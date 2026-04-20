import { useEffect, useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Pencil, Download, MessageCircle, Loader2, FileText, HardHat } from "lucide-react";

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

  // Create / revoke object URL whenever the blob changes.
  useEffect(() => {
    if (!blob) {
      if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
      lastUrl.current = null;
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(blob);
    if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
    lastUrl.current = next;
    setUrl(next);
    return () => {
      // cleanup on unmount only — for blob changes we revoke above
    };
  }, [blob]);

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
        <div className="flex-1 overflow-hidden bg-muted">
          {url ? (
            <iframe
              key={url}
              src={url}
              title={filename}
              className="h-full w-full border-0"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
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