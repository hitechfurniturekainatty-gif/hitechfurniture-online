import { lazy, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Plus, X } from "lucide-react";

// Lazy-load the heavy Fabric.js sketch pad so mobile users don't pay the
// ~250kB cost on every quotation editor render.
const SketchPad = lazy(() => import("./SketchPad"));

/**
 * Compact editor field for a measurement sketch.
 * - When NO sketch exists: shows a small "+ Measurement sketch" pill so the
 *   editor row stays compact and doesn't dominate the quotation view.
 * - When a sketch exists: shows the saved PNG with Edit / Remove controls.
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
          size="sm"
          className="h-8 px-2.5 text-xs"
          onClick={() => setOpen(true)}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Measurement sketch
        </Button>
      )}
      {open && (
        <Suspense fallback={null}>
          <SketchPad
            open={open}
            onOpenChange={setOpen}
            initialUrl={value}
            onSave={(url) => onChange(url)}
          />
        </Suspense>
      )}
    </div>
  );
};

export default SketchField;