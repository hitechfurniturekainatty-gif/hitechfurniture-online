import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

export type SearchableOption = {
  value: string;
  label: string;
  /** Optional secondary text shown below the label. */
  sub?: string;
};

type Props = {
  value: string;
  onChange: (next: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  /** Disables the trigger. */
  disabled?: boolean;
  /** Empty-state text when no option matches the search. */
  emptyText?: string;
  className?: string;
  /** Optional id forwarded to the trigger button (for label htmlFor). */
  id?: string;
};

/**
 * A drop-in replacement for `<Select>` that supports type-to-filter.
 * Built on Popover + a lightweight filtered list so it works inside
 * scrollable dialogs and stays within the viewport on small screens.
 */
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Choose…",
  disabled,
  emptyText = "No matches",
  className,
  id,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (open) {
      setQuery("");
      // Focus the search box once the popover renders.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter(
        (o) => o.label.toLowerCase().includes(q) || (o.sub ?? "").toLowerCase().includes(q),
      )
    : options;

  return (
    <Popover open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[--radix-popover-trigger-width] max-w-[95vw] p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center border-b px-2">
          <Search className="mr-2 h-4 w-4 opacity-50" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search…"
            className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <ul role="listbox" className="max-h-[min(60vh,18rem)] overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyText}</li>
          ) : (
            filtered.map((o) => {
              const active = o.value === value;
              return (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={active}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent",
                    active && "bg-accent/60",
                  )}
                >
                  <Check className={cn("mt-0.5 h-4 w-4 shrink-0", active ? "opacity-100" : "opacity-0")} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{o.label}</p>
                    {o.sub ? (
                      <p className="truncate text-xs text-muted-foreground">{o.sub}</p>
                    ) : null}
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}