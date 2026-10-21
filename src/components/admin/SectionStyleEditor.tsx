import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Palette, RotateCcw } from "lucide-react";
import type { BlockStyle } from "@/lib/homeLayout";

const COLORS: [keyof BlockStyle, string, string][] = [
  ["bg", "Background", "#ffffff"],
  ["text", "Text", "#2a2622"],
  ["brand", "Buttons / brand", "#5e2b05"],
  ["brandText", "Button text", "#ffffff"],
  ["highlight", "Highlight", "#f39b02"],
  ["card", "Cards / boxes", "#ffffff"],
  ["borderColor", "Border colour", "#e1d6ca"],
];

/** Colours, border and alignment for ONE home page section. */
export function SectionStyleEditor({ value, onChange }: { value?: BlockStyle; onChange: (s: BlockStyle | undefined) => void }) {
  const s = value ?? {};
  const set = (patch: Partial<BlockStyle>) => {
    const next = { ...s, ...patch };
    Object.keys(next).forEach((k) => (next as Record<string, unknown>)[k] === undefined && delete (next as Record<string, unknown>)[k]);
    onChange(Object.keys(next).length ? next : undefined);
  };
  const opt = (k: keyof BlockStyle, items: [string | undefined, string][]) => (
    <div className="flex flex-wrap gap-1.5">
      {items.map(([v, l]) => (
        <Button key={l} type="button" size="sm" className="h-7 px-2 text-xs" variant={s[k] === v ? "default" : "outline"} onClick={() => set({ [k]: v } as Partial<BlockStyle>)}>{l}</Button>
      ))}
    </div>
  );

  return (
    <div className="space-y-3 rounded-lg border bg-background p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold"><Palette className="h-4 w-4" />Section style</span>
        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onChange(undefined)}><RotateCcw className="mr-1 h-3 w-3" />Original style</Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {COLORS.map(([k, label, def]) => {
          const cur = s[k] as string | undefined;
          return (
            <div key={k} className="flex items-center gap-2 rounded-md border p-1.5">
              <input type="color" value={cur ?? def} onChange={(e) => set({ [k]: e.target.value })} className="h-8 w-9 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-medium">{label}</div>
                {cur ? <button type="button" className="text-[10px] text-muted-foreground underline" onClick={() => set({ [k]: undefined })}>clear</button>
                  : <span className="text-[10px] text-muted-foreground">original</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Border thickness: {s.borderWidth ?? 0}px</Label>
          <input type="range" min={0} max={8} step={1} value={s.borderWidth ?? 0} onChange={(e) => set({ borderWidth: Number(e.target.value) || undefined })} className="w-full" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Border style</Label>
          {opt("borderStyle", [[undefined, "Solid"], ["dashed", "Dashed"], ["dotted", "Dotted"], ["double", "Double"]])}
        </div>
        <div>
          <Label className="text-xs">Corner roundness: {s.radius ?? "original"}{typeof s.radius === "number" ? " rem" : ""}</Label>
          <input type="range" min={0} max={2} step={0.125} value={s.radius ?? 0.75} onChange={(e) => set({ radius: Number(e.target.value) })} className="w-full" />
        </div>
        <div>
          <Label className="text-xs">Top/bottom space: {s.padY ?? "original"}{typeof s.padY === "number" ? "px" : ""}</Label>
          <input type="range" min={0} max={120} step={4} value={s.padY ?? 0} onChange={(e) => set({ padY: Number(e.target.value) })} className="w-full" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Text alignment</Label>
          {opt("align", [[undefined, "Original"], ["left", "Left"], ["center", "Center"], ["right", "Right"]])}
        </div>
        <label className="flex items-center gap-2 text-xs">
          <Switch checked={!!s.boxed} onCheckedChange={(v) => set({ boxed: v || undefined })} />
          Show as rounded box (card)
        </label>
      </div>
    </div>
  );
}
