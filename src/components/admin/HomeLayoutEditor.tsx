import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, ExternalLink, Loader2, RotateCcw, Save } from "lucide-react";
import { SingleImagePicker } from "@/components/admin/SingleImagePicker";
import { loadHomeLayoutBody } from "@/hooks/useHomeLayout";
import {
  BLOCKS, HERO_FIELDS, HOME_LAYOUT_KEY, blockDef, emptyHomeLayout, parseHomeLayout,
  type BlockId, type FieldDef, type HomeLayout,
} from "@/lib/homeLayout";

const db = supabase as any;

/**
 * Admin → Home Page → Page Layout: show/hide and reorder every home page
 * section, and change its text and pictures. Empty or unchanged fields keep
 * the built-in text, so "Reset" always brings back the original.
 */
export function HomeLayoutEditor() {
  const [layout, setLayout] = useState<HomeLayout>(emptyHomeLayout());
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    void loadHomeLayoutBody(true).then(b => {
      const l = parseHomeLayout(b);
      setLayout(l); setSaved(JSON.stringify(l)); setLoading(false);
    });
  }, []);

  const dirty = useMemo(() => JSON.stringify(layout) !== saved, [layout, saved]);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const move = (i: number, d: -1 | 1) => setLayout(l => {
    const j = i + d;
    if (j < 0 || j >= l.order.length) return l;
    const order = [...l.order];
    [order[i], order[j]] = [order[j], order[i]];
    return { ...l, order };
  });
  const setVisible = (id: BlockId, v: boolean) => setLayout(l => ({ ...l, hidden: v ? l.hidden.filter(x => x !== id) : [...l.hidden, id] }));
  const setText = (block: string, f: FieldDef, value: string) => setLayout(l => {
    const text = { ...l.text };
    const k = `${block}.${f.key}`;
    // Keep "" while typing (the site shows the original for empty boxes); exact default = no override.
    if (value === f.def) delete text[k]; else text[k] = value;
    return { ...l, text };
  });
  const setImage = (block: string, key: string, url: string | null) => setLayout(l => {
    const images = { ...l.images };
    const k = `${block}.${key}`;
    if (url) images[k] = url; else delete images[k];
    return { ...l, images };
  });
  const resetBlock = (block: string) => {
    if (!window.confirm("Bring back the original text and pictures for this section?")) return;
    setLayout(l => ({
      ...l,
      text: Object.fromEntries(Object.entries(l.text).filter(([k]) => !k.startsWith(`${block}.`))),
      images: Object.fromEntries(Object.entries(l.images).filter(([k]) => !k.startsWith(`${block}.`))),
    }));
  };
  const changedCount = (block: string) =>
    Object.keys(layout.text).filter(k => k.startsWith(`${block}.`)).length + Object.keys(layout.images).filter(k => k.startsWith(`${block}.`)).length;

  const save = async () => {
    setSaving(true);
    try {
      const current = layoutRef.current;
      const clean: HomeLayout = { ...current, text: Object.fromEntries(Object.entries(layout.text).filter(([, v]) => v.trim())) };
      const body = JSON.stringify(clean);
      const { data: cur, error: readErr } = await db.from("homepage_sections").select("id").eq("section_key", HOME_LAYOUT_KEY).maybeSingle();
      if (readErr) throw readErr;
      const res = cur?.id
        ? await db.from("homepage_sections").update({ body }).eq("id", cur.id)
        : await db.from("homepage_sections").insert({ section_key: HOME_LAYOUT_KEY, body, is_visible: false, display_order: 9997, title: "Home page layout (system — do not edit)" });
      if (res.error) throw res.error;
      await loadHomeLayoutBody(true);
      setSaved(JSON.stringify(current) === JSON.stringify(clean) ? body : JSON.stringify(current));
      setSavedAt(new Date());
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : (e as { message?: string })?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Auto-save: every change goes live ~1s after the last edit (photos right away).
  useEffect(() => {
    if (loading || !dirty || saving) return;
    const t = window.setTimeout(() => void save(), 1000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, dirty, saving, loading]);

  const fieldsEditor = (block: string, fields: FieldDef[], images?: { key: string; label: string }[]) => (
    <div className="space-y-3 border-t bg-muted/20 p-3 sm:p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(fd => {
          const v = layout.text[`${block}.${fd.key}`] ?? fd.def;
          return (
            <div key={fd.key} className={fd.multiline ? "sm:col-span-2" : ""}>
              <Label className="text-xs">{fd.label}</Label>
              {fd.multiline
                ? <Textarea rows={3} value={v} placeholder={fd.def} onChange={e => setText(block, fd, e.target.value)} />
                : <Input value={v} placeholder={fd.def} onChange={e => setText(block, fd, e.target.value)} />}
            </div>
          );
        })}
      </div>
      {!!images?.length && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {images.map(im => (
            <div key={im.key}>
              <Label className="mb-1 block text-xs">{im.label}</Label>
              <SingleImagePicker compact value={layout.images[`${block}.${im.key}`] ?? null} onChange={url => setImage(block, im.key, url)} bucket="homepage-media" folder="home-layout" />
              {!layout.images[`${block}.${im.key}`] && <p className="mt-1 text-[10px] text-muted-foreground">Using the original photo</p>}
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => resetBlock(block)}><RotateCcw className="mr-1 h-3.5 w-3.5" />Reset this section</Button>
      </div>
    </div>
  );

  if (loading) return <Card><CardContent className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></CardContent></Card>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Home page sections</CardTitle>
          <p className="text-xs text-muted-foreground">
            ഓരോ ഭാഗവും ഓൺ/ഓഫ് ചെയ്യാം, ↑↓ കൊണ്ട് മേലോട്ടും താഴോട്ടും മാറ്റാം, പേരിൽ തൊട്ടാൽ എഴുത്തും ഫോട്ടോയും മാറ്റാം. <b>മാറ്റങ്ങൾ തനിയെ save ആകും, ഉടനെ വെബ്സൈറ്റിൽ വരും.</b> ഒഴിഞ്ഞ box ആണെങ്കിൽ പഴയ എഴുത്ത് തന്നെ കാണിക്കും.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="overflow-hidden rounded-xl border">
            <div className="flex items-center gap-2 p-3">
              <span className="w-6 text-center text-xs font-bold text-muted-foreground">1</span>
              <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpen(open === "hero" ? null : "hero")}>
                {open === "hero" ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="truncate text-sm font-semibold">Big photo section (top)</span>
                <Badge variant="outline" className="text-[10px]">Always first</Badge>
                {changedCount("hero") > 0 && <Badge className="text-[10px]">Edited</Badge>}
              </button>
              <span className="text-xs text-muted-foreground">Photos: Hero Slider / Main Images tabs</span>
            </div>
            {open === "hero" && fieldsEditor("hero", HERO_FIELDS)}
          </div>

          {layout.order.map((id, i) => {
            const def = blockDef(id);
            const visible = !layout.hidden.includes(id);
            const n = changedCount(id);
            return (
              <div key={id} className={`overflow-hidden rounded-xl border ${visible ? "bg-card" : "bg-muted/40"}`}>
                <div className="flex flex-wrap items-center gap-2 p-3">
                  <span className="w-6 text-center text-xs font-bold text-muted-foreground">{i + 2}</span>
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-default" disabled={!def.fields.length}
                    onClick={() => setOpen(open === id ? null : id)}>
                    {def.fields.length ? (open === id ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />) : <span className="w-4" />}
                    <span className={`truncate text-sm font-semibold ${visible ? "" : "text-muted-foreground line-through"}`}>{def.name}</span>
                    {n > 0 && <Badge className="text-[10px]">Edited</Badge>}
                    {!visible && <Badge variant="outline" className="text-[10px]">Hidden</Badge>}
                  </button>
                  {def.hint && <span className="hidden text-[11px] text-muted-foreground md:inline">{def.hint}</span>}
                  <div className="flex items-center gap-1">
                    <Switch checked={visible} onCheckedChange={v => setVisible(id, v)} aria-label={`Show ${def.name}`} />
                    <Button size="icon" variant="ghost" className="h-8 w-8" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" disabled={i === layout.order.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="h-4 w-4" /></Button>
                  </div>
                </div>
                {open === id && def.fields.length > 0 && fieldsEditor(id, def.fields, def.images)}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur">
        <span className={`text-xs font-medium ${saving || dirty ? "text-amber-600" : "text-emerald-600"}`}>{saving ? "Saving…" : dirty ? "Saving soon…" : savedAt ? `✓ Saved & live (${savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})` : "✓ All changes live"}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild><a href="/" target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1 h-4 w-4" />View home page</a></Button>
          <Button size="sm" onClick={() => void save()} disabled={!dirty || saving}>{saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}Save now</Button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">Sections: {BLOCKS.length + 1}. New sections with your own text and photos can be added in the "Sections" tab — they appear where "Your extra sections" sits in this list.</p>
    </div>
  );
}
