import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Download, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Unified Download/Share control.
 *
 * Renders a single "Download / Share" button. Tapping it reveals two small,
 * distinct icons:
 *   • PDF (red)   — full multi-page professional PDF, ideal for customers.
 *   • JPG (teal)  — page-by-page high-clarity images, ideal for workers /
 *                   WhatsApp.
 *
 * The component is purely presentational — the parent decides what each format
 * should produce (e.g. customer copy vs. worker-safe copy that omits prices).
 */
export type DownloadShareMenuProps = {
  /** Called when the user picks the PDF action. */
  onPdf: () => void | Promise<void>;
  /** Called when the user picks the JPG action. */
  onJpg: () => void | Promise<void>;
  /** Disables both actions while a generation is in progress. */
  busy?: boolean;
  /** Optional override for the trigger label. */
  label?: string;
  /** Visual variant of the trigger button. */
  triggerVariant?: ButtonProps["variant"];
  /** Size of the trigger button. */
  triggerSize?: ButtonProps["size"];
  /** Extra classes for the trigger button. */
  triggerClassName?: string;
  /** Override tooltip text on the PDF icon. */
  pdfTooltip?: string;
  /** Override tooltip text on the JPG icon. */
  jpgTooltip?: string;
  /** Hide trigger label so only the icon shows (useful in dense bars). */
  iconOnly?: boolean;
  /** Disable the entire trigger. */
  disabled?: boolean;
};

export function DownloadShareMenu({
  onPdf,
  onJpg,
  busy = false,
  label = "Download / Share",
  triggerVariant = "outline",
  triggerSize,
  triggerClassName,
  pdfTooltip = "PDF — full document for customer",
  jpgTooltip = "JPG — high-res images for WhatsApp / worker",
  iconOnly = false,
  disabled = false,
}: DownloadShareMenuProps) {
  const [open, setOpen] = useState(false);

  const handlePick = async (fn: () => void | Promise<void>) => {
    setOpen(false);
    await fn();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={triggerVariant}
          size={triggerSize}
          className={cn(triggerClassName)}
          disabled={disabled || busy}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {!iconOnly && <span className="ml-1.5">{label}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-auto rounded-full border-border/70 bg-popover p-1.5 shadow-lg"
      >
        <TooltipProvider delayDuration={150}>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10"
                  onClick={() => handlePick(onPdf)}
                  disabled={busy}
                  aria-label="Download as PDF"
                >
                  <FileText className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{pdfTooltip}</TooltipContent>
            </Tooltip>

            <span className="h-6 w-px bg-border" aria-hidden />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full text-teal-600 hover:bg-teal-50 hover:text-teal-700 dark:text-teal-400 dark:hover:bg-teal-500/10"
                  onClick={() => handlePick(onJpg)}
                  disabled={busy}
                  aria-label="Download as JPG"
                >
                  <ImageIcon className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{jpgTooltip}</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </PopoverContent>
    </Popover>
  );
}