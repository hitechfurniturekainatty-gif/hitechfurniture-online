import type { FocusEvent } from "react";

/**
 * onFocusCapture handler that scrolls the focused input/textarea/combobox
 * into the center of its scroll container so it stays visible above the
 * mobile on-screen keyboard.
 */
export const scrollFocusedIntoView = (e: FocusEvent<HTMLElement>) => {
  const t = e.target as HTMLElement;
  if (!t || !t.matches?.("input, textarea, [role=combobox]")) return;
  setTimeout(() => {
    try {
      t.scrollIntoView({ block: "center", behavior: "smooth" });
    } catch {
      // ignore
    }
  }, 300);
};
