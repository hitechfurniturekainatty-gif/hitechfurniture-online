import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Download, FileText, Image as ImageIcon, Link2, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type DownloadShareMenuProps = {
  onPdf: () => unknown | Promise<unknown>;
  onJpg: () => unknown | Promise<unknown>;
  onShareLink?: () => unknown | Promise<unknown>;
  busy?: boolean;
  label?: string;
  triggerVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
  triggerClassName?: string;
  pdfTooltip?: string;
  jpgTooltip?: string;
  linkTooltip?: string;
  iconOnly?: boolean;
  disabled?: boolean;
};

export function DownloadShareMenu({
  onPdf,
  onJpg,
  onShareLink,
  busy = false,
  label = "Share / Export",
  triggerVariant = "outline",
  triggerSize,
  triggerClassName,
  pdfTooltip = "Professional PDF document",
  jpgTooltip = "High-quality image pages",
  linkTooltip = "Live mobile preview link",
  iconOnly = false,
  disabled = false,
}: DownloadShareMenuProps) {
  const [open, setOpen] = useState(false);

  const handlePick = async (fn: () => unknown | Promise<unknown>) => {
    setOpen(false);
    await fn();
  };

  const optionClass = "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={triggerVariant}
          size={triggerSize}
          className={cn("justify-center", triggerClassName)}
          disabled={disabled || busy}
          aria-label={label}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {!iconOnly && <span className="ml-1.5">{label}</span>}
          {!iconOnly && !busy && <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" />}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-[min(92vw,320px)] p-2 shadow-xl">
        <div className="px-2 pb-2 pt-1">
          <p className="text-sm font-semibold">Choose format</p>
          <p className="text-xs text-muted-foreground">Download, share on WhatsApp, or open a live preview.</p>
        </div>

        <button type="button" className={optionClass} onClick={() => handlePick(onPdf)} disabled={busy}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <FileText className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">PDF Document</span>
            <span className="block text-xs text-muted-foreground">{pdfTooltip}</span>
          </span>
        </button>

        <button type="button" className={optionClass} onClick={() => handlePick(onJpg)} disabled={busy}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <ImageIcon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Image Pages (JPG)</span>
            <span className="block text-xs text-muted-foreground">{jpgTooltip}</span>
          </span>
        </button>

        {onShareLink && (
          <button type="button" className={optionClass} onClick={() => handlePick(onShareLink)} disabled={busy}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Link2 className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Live Preview Link</span>
              <span className="block text-xs text-muted-foreground">{linkTooltip}</span>
            </span>
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
