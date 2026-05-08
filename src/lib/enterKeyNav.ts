import type { KeyboardEvent } from "react";

/**
 * onKeyDown handler for form wrappers that makes the keyboard "Enter" (return)
 * key act like "next field" on mobile — and trigger the final Submit action
 * when the focus is on the last eligible field.
 *
 * Behavior:
 *  - If the event target is a <textarea>, Enter keeps its default behavior
 *    (newline) so multi-line fields still work normally.
 *  - Otherwise the next visible/enabled focusable control inside the wrapper
 *    is focused. If there is no next control, the `onSubmit` callback runs
 *    (e.g. the "Save" / "Create" button).
 *
 * Attach it to a <form> or a <div> that wraps the fields you want to
 * sequentially tab through:
 *
 *   <form onKeyDown={(e) => handleEnterAsNext(e, submit)}>...</form>
 */
export const handleEnterAsNext = (
  e: KeyboardEvent<HTMLElement>,
  onSubmit?: () => void,
) => {
  if (e.defaultPrevented || e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;

  const target = e.target as HTMLElement | null;
  if (!target) return;

  // Let textareas keep their normal newline behavior.
  const tag = target.tagName;
  if (tag === "TEXTAREA") return;
  // Don't hijack Enter on native buttons / links — they have their own action.
  if (tag === "BUTTON" || tag === "A") return;
  // Keep Enter usable for controls that open/choose options (date pickers,
  // file pickers, checkboxes, radios, etc.). Only text-like fields use
  // Enter-as-next; all normal typing keys, including Space, pass through.
  if (tag === "INPUT") {
    const type = (target as HTMLInputElement).type;
    const textLikeTypes = new Set([
      "",
      "text",
      "search",
      "tel",
      "url",
      "email",
      "number",
      "password",
    ]);
    if (!textLikeTypes.has(type)) return;
  }

  // Only handle Enter coming from form controls.
  if (tag !== "INPUT" && target.getAttribute("role") !== "combobox") return;

  const container = e.currentTarget as HTMLElement;
  const focusables = Array.from(
    container.querySelectorAll<HTMLElement>(
      'input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [role=combobox]:not([disabled])',
    ),
  ).filter((el) => !el.hasAttribute("data-enter-skip") && el.offsetParent !== null);

  const idx = focusables.indexOf(target as HTMLElement);
  e.preventDefault();

  if (idx >= 0 && idx < focusables.length - 1) {
    focusables[idx + 1].focus({ preventScroll: true });
    return;
  }

  // Last field — trigger submit.
  onSubmit?.();
};