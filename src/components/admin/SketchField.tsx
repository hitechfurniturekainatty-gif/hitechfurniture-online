import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, X } from "lucide-react";
import { SketchPad } from "./SketchPad";

/**
 * Compact editor field that previews a saved sketch and opens the full-screen
 * SketchPad on tap. If no sketch exists yet, shows a "Draw sketch" CTA.
 * Emits the new public PNG URL via `onChange` (or null when removed).
 */
type Props = {
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
};

export const SketchField = ({ value, onChange, label }: Props) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1.5">
      {label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}
      {value ? (
        <div className="group relative aspect-[4/3] w-full overflow-hidden rounded-md border border-border bg-white">
          <img
            src={value}
            alt="Measurement sketch"
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-1 top-1 rounded-full bg-foreground/80 p-1 text-background opacity-90 hover:bg-foreground"
            aria-label="Remove sketch"
          >
            <X className="h-3 w-3" />
          </button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="absolute bottom-1 right-1 h-7 px-2 text-xs"
            onClick={() => setOpen(true)}
          >
            <Pencil className="mr-1 h-3 w-3" />Edit
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-20 w-full border-dashed text-xs"
          onClick={() => setOpen(true)}
        >
          <Pencil className="mr-1.5 h-4 w-4" />
          Draw measurement sketch
        </Button>
      )}
      <SketchPad
        open={open}
        onOpenChange={setOpen}
        initialUrl={value}
        onSave={(url) => onChange(url)}
      />
    </div>
  );
};

export default SketchField;