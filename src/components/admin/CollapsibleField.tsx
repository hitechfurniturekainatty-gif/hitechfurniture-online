import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Plus, ChevronUp } from "lucide-react";

/**
 * Wraps a heavy input (image picker, photo gallery, etc.) so it stays
 * collapsed behind a small "+ <label>" pill during quotation creation.
 *
 * - If `hasValue` is true (the field already has data), the children are
 *   rendered immediately so users see existing photos/sketches.
 * - Otherwise the user must tap the pill to expand the editor.
 *
 * This keeps the quotation editor compact when many items are added.
 */
type Props = {
  label: string;
  hasValue: boolean;
  children: ReactNode;
};

export const CollapsibleField = ({ label, hasValue, children }: Props) => {
  const [open, setOpen] = useState(false);
  const expanded = hasValue || open;
  return (
    <div className="space-y-1.5">
      {expanded ? (
        <>
          {children}
          {!hasValue && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px] text-muted-foreground"
              onClick={() => setOpen(false)}
            >
              <ChevronUp className="mr-1 h-3 w-3" />Hide
            </Button>
          )}
        </>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-2.5 text-xs"
          onClick={() => setOpen(true)}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          {label}
        </Button>
      )}
    </div>
  );
};

export default CollapsibleField;
