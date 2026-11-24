import * as React from "react";

import { cn } from "@/lib/utils";

// Phone-friendly defaults for every input in the app:
//  * the keyboard shows a "Next →" key; pressing it moves to the next field in the same
//    form / dialog / page, so staff fill a quotation or lead without hunting for boxes;
//  * on a touch screen the focused field scrolls to the middle of the screen so the
//    keyboard never covers it.
// Search boxes, dates, files and inputs with their own Enter handling keep normal behaviour.

const NO_ADVANCE_TYPES = new Set(["search", "date", "datetime-local", "time", "month", "file", "checkbox", "radio", "hidden", "range", "color"]);
const looksLikeSearch = (p: React.ComponentProps<"input">) =>
  /search|തിര/i.test(`${p.placeholder ?? ""} ${p["aria-label"] ?? ""} ${p.name ?? ""}`);

const FIELD_SELECTOR = "input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]):not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled]):not([readonly])";

/** Focus the next visible field after `el` inside its form / dialog / page. Returns true if one was found. */
export function focusNextField(el: HTMLElement): boolean {
  const scope = (el.closest("form, [role=dialog], main") as HTMLElement | null) ?? document.body;
  const fields = Array.from(scope.querySelectorAll<HTMLElement>(FIELD_SELECTOR))
    .filter((f) => f.offsetParent !== null || f.getClientRects().length > 0);
  const next = fields[fields.indexOf(el) + 1];
  if (!next) return false;
  next.focus();
  return true;
}

const isTouch = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, enterKeyHint, inputMode, onKeyDown, onFocus, ...props }, ref) => {
    const canAdvance = !NO_ADVANCE_TYPES.has(type ?? "text") && !looksLikeSearch(props);
    const hint = enterKeyHint ?? (canAdvance ? "next" : undefined);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      onKeyDown?.(e);
      if (e.defaultPrevented || e.key !== "Enter" || e.nativeEvent.isComposing || hint !== "next" || !canAdvance) return;
      // Only take over Enter when the field is not inside a form that should submit on Enter.
      const form = e.currentTarget.form;
      if (form && form.querySelector("[type=submit]")) return;
      if (focusNextField(e.currentTarget)) e.preventDefault();
      else e.currentTarget.blur(); // last field: close the keyboard
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      onFocus?.(e);
      if (!isTouch() || NO_ADVANCE_TYPES.has(type ?? "text")) return;
      const el = e.currentTarget;
      // Wait for the keyboard to open, then bring the field to the middle of the screen.
      window.setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
    };

    return (
      <input
        type={type}
        enterKeyHint={hint}
        // Number fields get the phone's number pad (with a decimal point) unless a page says otherwise.
        inputMode={inputMode ?? (type === "number" ? "decimal" : type === "tel" ? "tel" : undefined)}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
