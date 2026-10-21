import { useEffect, useState } from "react";

/** Turns what people paste from Google into a #rrggbb hex: "#0E5C66", "0e5c66", "#abc", "rgb(14,92,102)", "teal". */
export function parseColor(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  let m = /^#?([0-9a-f]{6})$/i.exec(s);
  if (m) return `#${m[1].toLowerCase()}`;
  m = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s);
  if (m) return `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toLowerCase();
  m = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/i.exec(s);
  if (m) {
    const n = [m[1], m[2], m[3]].map(Number);
    if (n.some((x) => x > 255)) return null;
    return `#${n.map((x) => x.toString(16).padStart(2, "0")).join("")}`;
  }
  // colour names (red, navy, teal…) via the browser
  if (/^[a-z]+$/i.test(s) && typeof CSS !== "undefined" && CSS.supports("color", s)) {
    const c = document.createElement("canvas").getContext("2d");
    if (c) { c.fillStyle = "#000001"; c.fillStyle = s; if (c.fillStyle !== "#000001") return String(c.fillStyle).toLowerCase(); }
  }
  return null;
}

/** Colour picker + type/paste-a-code box. Applies as soon as the code is valid. */
export function ColorCodeInput({ value, onChange, size = "md" }: { value: string; onChange: (hex: string) => void; size?: "sm" | "md" }) {
  const [text, setText] = useState(value);
  const [bad, setBad] = useState(false);
  useEffect(() => { setText(value); setBad(false); }, [value]);

  const commit = (v: string) => {
    setText(v);
    const hex = parseColor(v);
    setBad(!!v.trim() && !hex);
    if (hex && hex !== value.toLowerCase()) onChange(hex);
  };

  return (
    <div className="flex items-center gap-1.5">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
        className={`${size === "sm" ? "h-8 w-9" : "h-10 w-12"} shrink-0 cursor-pointer rounded border-0 bg-transparent p-0`} aria-label="Pick colour" />
      <input
        value={text}
        onChange={(e) => commit(e.target.value)}
        onBlur={() => { setText(value); setBad(false); }}
        onFocus={(e) => e.target.select()}
        placeholder="#0E5C66"
        spellCheck={false}
        className={`${size === "sm" ? "h-7 w-[76px] text-[11px]" : "h-9 w-24 text-xs"} rounded-md border bg-background px-2 font-mono uppercase outline-none focus:ring-2 focus:ring-ring ${bad ? "border-destructive" : ""}`}
        aria-label="Colour code"
        title="Colour code paste ചെയ്യുക: #0E5C66, 0e5c66, rgb(14,92,102), teal"
      />
    </div>
  );
}
