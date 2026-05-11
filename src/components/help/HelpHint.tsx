import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FIELD_HELP } from "@/lib/help/content";

type Props = {
  /** Lookup key in FIELD_HELP, e.g. "quotation.party_phone". */
  id?: string;
  /** Override the looked-up title. */
  title?: string;
  /** Override the looked-up example. */
  example?: string;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
};

/**
 * Tiny "?" icon shown next to a form field. On hover/tap reveals a short
 * explanation and an optional example. Reads copy from the central
 * `FIELD_HELP` map so editing a tooltip never requires touching components.
 */
export const HelpHint = ({ id, title, example, side = "top", className }: Props) => {
  const entry = id ? FIELD_HELP[id] : undefined;
  const t = title ?? entry?.title;
  const ex = example ?? entry?.example;
  if (!t && !ex) return null;
  // Allow users to globally hide tips.
  if (typeof window !== "undefined" && window.localStorage?.getItem("help.tipsEnabled") === "false") return null;
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Help"
          className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary ${className ?? ""}`}
          onClick={(e) => e.preventDefault()}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs space-y-1 text-xs leading-relaxed">
        {t && <p>{t}</p>}
        {ex && <p className="text-muted-foreground"><span className="font-semibold">Example:</span> {ex}</p>}
      </TooltipContent>
    </Tooltip>
  );
};

export default HelpHint;