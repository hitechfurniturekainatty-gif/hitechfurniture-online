import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useState } from "react";

// Root-cause reproduction for the "autosave interrupts typing" bug in the
// quotation editor's item list.
//
// Mechanism: a freshly-added item row starts life with a temporary
// client-side id (`tmp-...`). When the debounced autosave successfully
// inserts that row, AdminQuotationEditor swaps the row's `id` from the tmp
// id to the real database uuid it gets back — everything else about the
// row (its description/qty/etc.) is preserved.
//
// The item list previously rendered each row with `key={it.id}`. Because
// React treats a changed `key` as "this is a different list item," the
// id swap made React unmount the row's DOM subtree (including the
// currently-focused <input>) and mount a brand new one in its place — even
// though, semantically, it's still the same row. That teardown/rebuild is
// what dropped focus/cursor position and could swallow the keystroke that
// was in flight at that exact moment.
//
// The fix decouples the React key from the mutable `id` via a `_clientKey`
// that's generated once and never changes. This harness isolates just that
// mechanism (not the real component's Supabase/auth dependencies) to prove
// the bug and the fix side by side.
type Item = { id: string; _clientKey: string; description: string };

function ItemsList({ useStableKey }: { useStableKey: boolean }) {
  const [items, setItems] = useState<Item[]>([
    { id: "tmp-1", _clientKey: "tmp-1", description: "" },
  ]);

  const updateDescription = (id: string, value: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, description: value } : it)));
  };

  // Mirrors saveAll() in AdminQuotationEditor: once the row is inserted,
  // its tmp id is swapped for the real DB id it comes back with.
  const simulateAutosaveIdSwap = () => {
    setItems((prev) => prev.map((it) => (it.id === "tmp-1" ? { ...it, id: "real-uuid-1" } : it)));
  };

  return (
    <div>
      {items.map((it) => (
        <input
          key={useStableKey ? it._clientKey : it.id}
          aria-label="item-description"
          value={it.description}
          onChange={(e) => updateDescription(it.id, e.target.value)}
        />
      ))}
      <button onClick={simulateAutosaveIdSwap}>simulate autosave</button>
    </div>
  );
}

describe("quotation item list — React key stability across autosave's id swap", () => {
  it("BUG (key={it.id}): autosave's id swap remounts the row's input and drops focus mid-typing", () => {
    render(<ItemsList useStableKey={false} />);
    const input = screen.getByLabelText("item-description") as HTMLInputElement;
    input.focus();
    fireEvent.change(input, { target: { value: "Sof" } });
    expect(document.activeElement).toBe(input);

    // Autosave resolves mid-typing and assigns the row its real DB id.
    act(() => {
      screen.getByText("simulate autosave").click();
    });

    const inputAfter = screen.getByLabelText("item-description") as HTMLInputElement;
    expect(inputAfter).not.toBe(input); // proves React tore down and rebuilt the node
    expect(document.activeElement).not.toBe(inputAfter); // focus/cursor was lost
  });

  it("FIX (key={it._clientKey}): the same id swap leaves the input untouched — focus and value survive", () => {
    render(<ItemsList useStableKey={true} />);
    const input = screen.getByLabelText("item-description") as HTMLInputElement;
    input.focus();
    fireEvent.change(input, { target: { value: "Sof" } });
    expect(document.activeElement).toBe(input);

    act(() => {
      screen.getByText("simulate autosave").click();
    });

    const inputAfter = screen.getByLabelText("item-description") as HTMLInputElement;
    expect(inputAfter).toBe(input); // same DOM node — no remount
    expect(document.activeElement).toBe(input); // focus preserved
    expect(inputAfter.value).toBe("Sof"); // in-progress text intact
  });
});
