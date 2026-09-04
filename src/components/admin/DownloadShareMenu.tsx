import { useEffect, useRef, useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Check,
  ChevronDown,
  Download,
  FileText,
  HardHat,
  Image as ImageIcon,
  Link2,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Share2,
  StickyNote,
} from "lucide-react";
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

type LegacyAction = "Assign Job" | "Direct Share" | "Share via WhatsApp" | "Notes" | "Done";

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
  const [moreOpen, setMoreOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // The quotation preview historically rendered every action as a separate
  // sticky-bar button. Keep those battle-tested handlers intact, but collapse
  // their visual controls into this professional 3-button layout:
  // Edit · Share / Export · More.
  // Other DownloadShareMenu usages (catalog, worker dialog, etc.) are untouched.
  const isQuotationPreviewMenu = pdfTooltip.includes("full quotation for customer");

  useEffect(() => {
    if (!isQuotationPreviewMenu) return;
    const parent = rootRef.current?.parentElement;
    if (!parent) return;

    const hidden: HTMLElement[] = [];
    const labels: LegacyAction[] = ["Assign Job", "Direct Share", "Share via WhatsApp", "Notes", "Done"];

    for (const child of Array.from(parent.children)) {
      if (child === rootRef.current) continue;
      const el = child as HTMLElement;
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      if (labels.some((label) => text.includes(label))) {
        el.dataset.quotationCompactHidden = "true";
        el.style.display = "none";
        hidden.push(el);
      }
    }

    return () => {
      hidden.forEach((el) => {
        if (el.dataset.quotationCompactHidden === "true") {
          el.style.display = "";
          delete el.dataset.quotationCompactHidden;
        }
      });
    };
  }, [isQuotationPreviewMenu]);

  const findLegacyButton = (label: LegacyAction): HTMLButtonElement | null => {
    const parent = rootRef.current?.parentElement;
    if (!parent) return null;
    return (
      Array.from(parent.querySelectorAll("button")).find((button) => {
        if (rootRef.current?.contains(button)) return false;
        const text = (button.textContent ?? "").replace(/\s+/g, " ").trim();
        return text.includes(label);
      }) ?? null
    );
  };

  const invokeLegacy = (label: LegacyAction) => {
    setOpen(false);
    setMoreOpen(false);
    const button = findLegacyButton(label);
    if (!button || button.disabled) return;
    button.click();
  };

  const handlePick = async (fn: () => unknown | Promise<unknown>) => {
    setOpen(false);
    await fn();
  };

  const optionClass =
    "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

  const iconBox = "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted";

  return (
    <div ref={rootRef} className={isQuotationPreviewMenu ? "contents" : undefined}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={isQuotationPreviewMenu ? "default" : triggerVariant}
            size={triggerSize}
            className={cn("justify-center", triggerClassName)}
            disabled={disabled || busy}
            aria-label={label}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
            {!iconOnly && <span className="ml-1.5">{label}</span>}
            {!iconOnly && !busy && <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" />}
          </Button>
        </PopoverTrigger>

        <PopoverContent align="end" sideOffset={8} className="w-[min(92vw,340px)] p-2 shadow-xl">
          <div className="px-2 pb-2 pt-1">
            <p className="text-sm font-semibold">Share or export quotation</p>
            <p className="text-xs text-muted-foreground">Choose the best format for the customer or WhatsApp.</p>
          </div>

          {isQuotationPreviewMenu && (
            <button
              type="button"
              className={optionClass}
              onClick={() => invokeLegacy("Share via WhatsApp")}
              disabled={busy || !findLegacyButton("Share via WhatsApp") || !!findLegacyButton("Share via WhatsApp")?.disabled}
            >
              <span className={iconBox}><MessageCircle className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">WhatsApp Customer</span>
                <span className="block text-xs text-muted-foreground">Generate image pages and send to the saved customer number.</span>
              </span>
            </button>
          )}

          <button type="button" className={optionClass} onClick={() => handlePick(onPdf)} disabled={busy}>
            <span className={iconBox}><FileText className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">PDF Document</span>
              <span className="block text-xs text-muted-foreground">{pdfTooltip}</span>
            </span>
          </button>

          <button type="button" className={optionClass} onClick={() => handlePick(onJpg)} disabled={busy}>
            <span className={iconBox}><ImageIcon className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Image Pages (JPG)</span>
              <span className="block text-xs text-muted-foreground">{jpgTooltip}</span>
            </span>
          </button>

          {onShareLink && (
            <button type="button" className={optionClass} onClick={() => handlePick(onShareLink)} disabled={busy}>
              <span className={iconBox}><Link2 className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">Live Preview Link</span>
                <span className="block text-xs text-muted-foreground">{linkTooltip}</span>
              </span>
            </button>
          )}
        </PopoverContent>
      </Popover>

      {isQuotationPreviewMenu && (
        <Popover open={moreOpen} onOpenChange={setMoreOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size={triggerSize}
              className={cn("h-11 flex-1 justify-center sm:flex-initial", triggerClassName)}
              disabled={busy}
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="ml-1.5">More</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={8} className="w-[min(92vw,320px)] p-2 shadow-xl">
            <div className="px-2 pb-2 pt-1">
              <p className="text-sm font-semibold">More actions</p>
              <p className="text-xs text-muted-foreground">Job work, internal notes, and closing actions.</p>
            </div>

            <button type="button" className={optionClass} onClick={() => invokeLegacy("Assign Job")} disabled={!findLegacyButton("Assign Job") || !!findLegacyButton("Assign Job")?.disabled}>
              <span className={iconBox}><HardHat className="h-5 w-5" /></span>
              <span><span className="block text-sm font-medium">Assign Job</span><span className="block text-xs text-muted-foreground">Select items and assign them to a saved worker.</span></span>
            </button>

            <button type="button" className={optionClass} onClick={() => invokeLegacy("Direct Share")} disabled={!findLegacyButton("Direct Share") || !!findLegacyButton("Direct Share")?.disabled}>
              <span className={iconBox}><Share2 className="h-5 w-5" /></span>
              <span><span className="block text-sm font-medium">Direct Worker Share</span><span className="block text-xs text-muted-foreground">Send worker-safe files to any contact or WhatsApp group.</span></span>
            </button>

            <button type="button" className={optionClass} onClick={() => invokeLegacy("Notes")} disabled={!findLegacyButton("Notes") || !!findLegacyButton("Notes")?.disabled}>
              <span className={iconBox}><StickyNote className="h-5 w-5" /></span>
              <span><span className="block text-sm font-medium">Internal Notes</span><span className="block text-xs text-muted-foreground">Open staff-only photos, PDFs, and handwritten references.</span></span>
            </button>

            <div className="my-1 border-t border-border" />

            <button type="button" className={optionClass} onClick={() => invokeLegacy("Done")} disabled={!findLegacyButton("Done") || !!findLegacyButton("Done")?.disabled}>
              <span className={iconBox}><Check className="h-5 w-5" /></span>
              <span><span className="block text-sm font-medium">Done</span><span className="block text-xs text-muted-foreground">Close preview and return to quotations.</span></span>
            </button>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
