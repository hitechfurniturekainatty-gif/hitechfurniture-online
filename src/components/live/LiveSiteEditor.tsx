import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { ArrowDown, ArrowLeft, ArrowUp, Loader2, RotateCcw, Save, Undo2, X } from "lucide-react";
import { SectionStyleEditor } from "@/components/admin/SectionStyleEditor";
import { SingleImagePicker } from "@/components/admin/SingleImagePicker";
import ThemeEditor from "@/components/admin/ThemeEditor";
import { saveHomeLayout } from "@/hooks/useHomeLayout";
import { BLOCKS, HERO_FIELDS, blockDef, emptyHomeLayout, type BlockId, type BlockStyle, type FieldDef, type HomeLayout } from "@/lib/homeLayout";

type Props = {
  draft: HomeLayout;
  saved: HomeLayout;
  setDraft: (fn: (l: HomeLayout) => HomeLayout) => void;
  target: string | null;
  setTarget: (t: string | null) => void;
  onSaved: (l: HomeLayout) => void;
  onExit: () => void;
};

const nameOf = (id: string) => (id === "hero" ? "Big photo section (top)" : blockDef(id as BlockId)?.name ?? id);

/** Website-builder style panel: shown on the live home page for admins in edit mode. */
export default function LiveSiteEditor({ draft, saved, setDraft, target, setTarget, onSaved, onExit }: Props) {
  const [tab, setTab] = useState<"page" | "theme">("page");
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  useEffect(() => {
    supabase.from("homepage_settings").select("id").limit(1).maybeSingle().then(({ data }) => setSettingsId((data as { id?: string } | null)?.id ?? ""));
  }, []);
  useEffect(() => { if (target) setTab("page"); }, [target]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const setText = (block: string, f: FieldDef, value: string) => setDraft(l => {
    const text = { ...l.text }; const k = `${block}.${f.key}`;
    if (value === f.def) delete text[k]; else text[k] = value;
    return { ...l, text };
  });
  const setImage = (block: string, key: string, url: string | null) => setDraft(l => {
    const images = { ...l.images }; const k = `${block}.${key}`;
    if (url) images[k] = url; else delete images[k];
    return { ...l, images };
  });
  const setStyle = (block: string, st: BlockStyle | undefined) => setDraft(l => {
    const styles = { ...(l.styles ?? {}) };
    if (st) styles[block] = st; else delete styles[block];
    return { ...l, styles };
  });
  const move = (id: BlockId, d: -1 | 1) => setDraft(l => {
    const i = l.order.indexOf(id), j = i + d;
    if (i < 0 || j < 0 || j >= l.order.length) return l;
    const order = [...l.order]; [order[i], order[j]] = [order[j], order[i]];
    return { ...l, order };
  });
  const setVisible = (id: BlockId, v: boolean) => setDraft(l => ({ ...l, hidden: v ? l.hidden.filter(x => x !== id) : [...l.hidden, id] }));
  const resetSection = (block: string) => {
    if (!window.confirm("ഈ section പഴയ (original) എഴുത്ത്, ഫോട്ടോ, കളർ ആക്കണോ?")) return;
    const keep = ([k]: [string, unknown]) => !k.startsWith(`${block}.`);
    setDraft(l => {
      const styles = { ...(l.styles ?? {}) }; delete styles[block];
      return { ...l, text: Object.fromEntries(Object.entries(l.text).filter(keep)), images: Object.fromEntries(Object.entries(l.images).filter(keep)), styles };
    });
  };
  const resetAll = () => {
    if (!window.confirm("Home page മുഴുവൻ original design-ലേക്ക് തിരിച്ചു കൊണ്ടുവരണോ? (Save അമർത്തിയാലേ live ആകൂ)")) return;
    setDraft(() => emptyHomeLayout());
  };

  const save = async () => {
    setSaving(true);
    try { await saveHomeLayout(draft); onSaved(draft); toast({ title: "Saved — live on website now" }); }
    catch (e) { toast({ title: "Save failed", description: e instanceof Error ? e.message : (e as { message?: string })?.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const fields = target === "hero" ? HERO_FIELDS : target ? blockDef(target as BlockId)?.fields ?? [] : [];
  const images = target && target !== "hero" ? blockDef(target as BlockId)?.images ?? [] : [];
  const tgtId = target as BlockId;

  return (
    <aside className="fixed inset-x-0 bottom-0 z-[60] flex max-h-[60vh] flex-col border-t bg-white text-[#292522] shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[400px] sm:border-l sm:border-t-0" style={{ colorScheme: "light" }}>
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <b className="text-sm">✏ Edit website</b>
        <div className="ml-2 flex rounded-md border text-xs">
          <button className={`px-3 py-1 ${tab === "page" ? "bg-[#292522] text-white" : ""}`} onClick={() => setTab("page")}>Sections</button>
          <button className={`px-3 py-1 ${tab === "theme" ? "bg-[#292522] text-white" : ""}`} onClick={() => setTab("theme")}>Theme</button>
        </div>
        <button className="ml-auto rounded p-1 hover:bg-black/5" aria-label="Close editor" onClick={() => { if (!dirty || window.confirm("Save ചെയ്യാത്ത മാറ്റങ്ങൾ പോകും. Close ചെയ്യണോ?")) onExit(); }}><X className="h-5 w-5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 text-sm">
        {tab === "theme" && <ThemeEditor settingsId={settingsId} />}

        {tab === "page" && !target && (
          <div className="space-y-2">
            <p className="text-xs text-[#655b52]">പേജിലെ ഏത് ഭാഗത്തും <b>Edit</b> അമർത്തുക, അല്ലെങ്കിൽ താഴെ നിന്ന് തിരഞ്ഞെടുക്കുക. മാറ്റങ്ങൾ ഉടനെ കാണാം; <b>Save</b> അമർത്തിയാലേ customers-ന് കാണൂ.</p>
            <button className="w-full rounded-lg border p-2 text-left font-medium hover:bg-black/5" onClick={() => setTarget("hero")}>{nameOf("hero")}</button>
            {draft.order.map((id, i) => {
              const visible = !draft.hidden.includes(id);
              return (
                <div key={id} className={`flex items-center gap-1 rounded-lg border p-1 ${visible ? "" : "opacity-60"}`}>
                  <button className="min-w-0 flex-1 truncate p-1 text-left font-medium" onClick={() => setTarget(id)}>{BLOCKS.find(b => b.id === id)?.name}</button>
                  <Switch checked={visible} onCheckedChange={v => setVisible(id, v)} aria-label="Show section" />
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === 0} onClick={() => move(id, -1)} aria-label="Move up"><ArrowUp className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === draft.order.length - 1} onClick={() => move(id, 1)} aria-label="Move down"><ArrowDown className="h-4 w-4" /></Button>
                </div>
              );
            })}
            <Button variant="outline" size="sm" className="w-full" onClick={resetAll}><RotateCcw className="mr-1 h-4 w-4" />Whole page → original design</Button>
          </div>
        )}

        {tab === "page" && target && (
          <div className="space-y-3">
            <button className="flex items-center gap-1 text-xs text-[#655b52]" onClick={() => setTarget(null)}><ArrowLeft className="h-3.5 w-3.5" />All sections</button>
            <h3 className="font-semibold">{nameOf(target)}</h3>
            {target !== "hero" && (
              <div className="flex items-center gap-2">
                <Switch checked={!draft.hidden.includes(tgtId)} onCheckedChange={v => setVisible(tgtId, v)} /><span className="text-xs">Show on website</span>
                <Button size="sm" variant="outline" className="ml-auto h-7" onClick={() => move(tgtId, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="outline" className="h-7" onClick={() => move(tgtId, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
              </div>
            )}
            {blockDef(tgtId)?.hint && <p className="text-xs text-[#655b52]">{blockDef(tgtId)!.hint}</p>}
            {target === "hero" && <p className="text-xs text-[#655b52]">Hero photos: Admin → Home Page → Hero Slider.</p>}
            {!!images.length && (
              <div className="grid grid-cols-2 gap-2">
                {images.map(im => (
                  <div key={im.key}>
                    <Label className="mb-1 block text-xs">{im.label}</Label>
                    <SingleImagePicker compact value={draft.images[`${target}.${im.key}`] ?? null} onChange={url => setImage(target, im.key, url)} bucket="homepage-media" folder="home-layout" />
                  </div>
                ))}
              </div>
            )}
            {fields.map(fd => {
              const v = draft.text[`${target}.${fd.key}`] ?? fd.def;
              return (
                <div key={fd.key}>
                  <Label className="text-xs">{fd.label}</Label>
                  {fd.multiline
                    ? <Textarea rows={3} value={v} placeholder={fd.def} onChange={e => setText(target, fd, e.target.value)} />
                    : <Input value={v} placeholder={fd.def} onChange={e => setText(target, fd, e.target.value)} />}
                </div>
              );
            })}
            <SectionStyleEditor value={draft.styles?.[target]} onChange={st => setStyle(target, st)} />
            <Button size="sm" variant="outline" className="w-full" onClick={() => resetSection(target)}><RotateCcw className="mr-1 h-4 w-4" />This section → original</Button>
          </div>
        )}
      </div>

      {tab === "page" && (
        <div className="flex items-center gap-2 border-t px-3 py-2">
          <span className="mr-auto text-xs text-[#655b52]">{dirty ? "● Unsaved changes" : "All saved"}</span>
          <Button size="sm" variant="outline" disabled={!dirty || saving} onClick={() => setDraft(() => saved)}><Undo2 className="mr-1 h-4 w-4" />Undo</Button>
          <Button size="sm" disabled={!dirty || saving} onClick={save}>{saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}Save</Button>
        </div>
      )}
    </aside>
  );
}
