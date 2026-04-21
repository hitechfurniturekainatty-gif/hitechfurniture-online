import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type Suggestion<T = unknown> = {
  /** Primary text shown bold in the dropdown row. */
  label: string;
  /** Optional secondary line (e.g. product code, category). */
  sub?: string;
  /** Optional thumbnail URL shown on the left. */
  image?: string | null;
  /** Anything you want to receive in `onPick`. */
  data?: T;
};

type Props<T> = {
  value: string;
  onChange: (next: string) => void;
  /** Called when a suggestion is clicked. */
  onPick?: (s: Suggestion<T>) => void;
  /** Called when the text changes — return matching suggestions. */
  fetchSuggestions: (query: string) => Promise<Suggestion<T>[]> | Suggestion<T>[];
  placeholder?: string;
  className?: string;
  /** Auto-uppercase as the user types. */
  uppercase?: boolean;
  /** Use a textarea-like multiline input height. */
  inputClassName?: string;
  /** Minimum chars before fetching (default 1). */
  minChars?: number;
  /** Max suggestions to show (default 8). */
  limit?: number;
  autoFocus?: boolean;
  onBlur?: () => void;
  id?: string;
};

/**
 * Lightweight typeahead input. Renders a regular text input with a
 * floating suggestions list anchored below (or above, near viewport
 * bottom). Mobile friendly: full-width dropdown, generous tap targets,
 * pointerdown handler so clicks fire before blur hides the list.
 */
export function AutoSuggestInput<T = unknown>({
  value,
  onChange,
  onPick,
  fetchSuggestions,
  placeholder,
  className,
  uppercase,
  inputClassName,
  minChars = 1,
  limit = 8,
  autoFocus,
  onBlur,
  id,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Suggestion<T>[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [placement, setPlacement] = useState<"below" | "above">("below");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const reqIdRef = useRef(0);

  // Recompute suggestions on value change
  useEffect(() => {
    let cancelled = false;
    const q = value?.trim() ?? "";
    if (q.length < minChars) {
      setItems([]);
      return;
    }
    const myReq = ++reqIdRef.current;
    Promise.resolve(fetchSuggestions(q)).then((res) => {
      if (cancelled || myReq !== reqIdRef.current) return;
      setItems(res.slice(0, limit));
      setActiveIdx(-1);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, minChars, limit]);

  // Decide whether to flip dropdown above the input near viewport bottom
  useEffect(() => {
    if (!open) return;
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    setPlacement(spaceBelow < 240 && r.top > 240 ? "above" : "below");
  }, [open, items.length]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pick = (s: Suggestion<T>) => {
    onChange(s.label);
    onPick?.(s);
    setOpen(false);
  };

  const handleChange = (raw: string) => {
    const next = uppercase ? raw.toUpperCase() : raw;
    onChange(next);
    setOpen(true);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      pick(items[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <Input
        id={id}
        ref={inputRef}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        className={cn(uppercase && "uppercase tracking-wide", inputClassName)}
      />
      {open && items.length > 0 && (
        <ul
          role="listbox"
          className={cn(
            "absolute left-0 right-0 z-50 max-h-72 overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-lg",
            placement === "above" ? "bottom-full mb-1" : "top-full mt-1",
          )}
        >
          {items.map((s, i) => (
            <li
              key={`${s.label}-${i}`}
              role="option"
              aria-selected={i === activeIdx}
              onMouseEnter={() => setActiveIdx(i)}
              onPointerDown={(e) => {
                e.preventDefault(); // keep input focus, fire before blur
                pick(s);
              }}
              className={cn(
                "flex cursor-pointer items-center gap-3 border-b border-border/50 px-3 py-2.5 text-sm last:border-b-0",
                i === activeIdx ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
              )}
            >
              {s.image ? (
                <img
                  src={s.image}
                  alt=""
                  loading="lazy"
                  className="h-9 w-9 shrink-0 rounded bg-muted object-contain"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{s.label}</p>
                {s.sub ? <p className="truncate text-xs text-muted-foreground">{s.sub}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}