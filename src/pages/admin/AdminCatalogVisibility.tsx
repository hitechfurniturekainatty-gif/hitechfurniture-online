import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { toTitleCase } from "@/lib/textCase";
import { refreshPublicCatalogVisibility } from "@/hooks/usePublicCatalogVisibility";
import {
  VISIBILITY_SECTION_KEY, DEFAULT_PUBLIC_MESSAGE, emptyVisibilityConfig, parseVisibilityConfig, pruneExpired,
  entryActive, entryScheduled, isAllHidden, activeCounts, type CatalogVisibilityConfig, type HideEntry,
} from "@/lib/publicCatalogVisibility";
import { ChevronDown, ChevronRight, EyeOff, Eye, Loader2, Search, ShieldCheck, Clock, ExternalLink } from "lucide-react";

const db = supabase as any;

type Cat = { id: string; name: string };
type Sub = { id: string; name: string; main_category_id: string };
type Item = { id: string; name: string; code: string; main_category_id: string | null; sub_category_id: string | null; image: string | null; bundle: boolean; publicEligible: boolean };

type Dur = "manual" | "1d" | "7d" | "30d" | "custom";
const DUR_LABEL: Record<Dur, string> = {
  manual: "Until I switch it back on",
  "1d": "For 1 day",
  "7d": "For 7 days",
  "30d": "For 30 days",
  custom: "Custom from / to time",
};

async function allPages<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await q(i, i + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

function entryText(e: HideEntry | null | undefined) {
  if (!e) return "";
  const now = Date.now();
  if (entryScheduled(e, now)) return `Hides ${fmt(e.from)}${e.until ? ` → ${fmt(e.until)}` : ""}`;
  return e.until ? `Hidden until ${fmt(e.until)}` : "Hidden until switched on";
}

export default function AdminCatalogVisibility() {
  const [cfg, setCfg] = useState<CatalogVisibilityConfig>(emptyVisibilityConfig());
  const [legacyShow, setLegacyShow] = useState<boolean | null>(null);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [cats, setCats] = useState<Cat[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dur, setDur] = useState<Dur>("manual");
  const [customFrom, setCustomFrom] = useState("");
  const [customUntil, setCustomUntil] = useState("");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [qCat, setQCat] = useState("__all__");
  const [qSub, setQSub] = useState("__all__");
  const [, tick] = useState(0);

  useEffect(() => { const t = window.setInterval(() => tick(x => x + 1), 30_000); return () => window.clearInterval(t); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sec, hs, mc, sc, ps, bs] = await Promise.all([
        db.from("homepage_sections").select("body").eq("section_key", VISIBILITY_SECTION_KEY).maybeSingle(),
        db.from("homepage_settings").select("id, show_public_catalog").limit(1).maybeSingle(),
        allPages<Cat>((a, b) => db.from("main_categories").select("id,name").is("deleted_at", null).order("display_order").order("id").range(a, b)),
        allPages<Sub>((a, b) => db.from("sub_categories").select("id,name,main_category_id").is("deleted_at", null).order("display_order").order("id").range(a, b)),
        allPages<any>((a, b) => db.from("products").select("id,product_name,product_code,main_category_id,sub_category_id,primary_image_url,is_published,review_status").is("deleted_at", null).order("product_name").order("id").range(a, b)),
        allPages<any>((a, b) => db.from("product_bundles").select("id,name,bundle_code,main_category_id,sub_category_id,main_image_url,is_published").is("deleted_at", null).order("name").order("id").range(a, b)),
      ]);
      const parsed = parseVisibilityConfig(sec.data?.body ?? null);
      setCfg(parsed);
      setMessage(parsed.message || "");
      setLegacyShow(hs.data?.show_public_catalog ?? null);
      setSettingsId(hs.data?.id ?? null);
      setCats(mc);
      setSubs(sc);
      setItems([
        ...ps.map((p: any) => ({ id: p.id, name: p.product_name, code: p.product_code, main_category_id: p.main_category_id, sub_category_id: p.sub_category_id, image: p.primary_image_url, bundle: false, publicEligible: p.is_published && p.review_status === "approved" })),
        ...bs.map((b: any) => ({ id: b.id, name: b.name, code: b.bundle_code, main_category_id: b.main_category_id, sub_category_id: b.sub_category_id, image: b.main_image_url, bundle: true, publicEligible: !!b.is_published })),
      ]);
    } catch (e: any) {
      toast({ title: "Could not load", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  /** Read the latest saved rules, apply a change, save. Avoids overwriting another admin's edit. */
  const save = async (mutate: (c: CatalogVisibilityConfig) => CatalogVisibilityConfig, okText: string) => {
    setSaving(true);
    try {
      const { data: cur, error: readErr } = await db.from("homepage_sections").select("id, body").eq("section_key", VISIBILITY_SECTION_KEY).maybeSingle();
      if (readErr) throw readErr;
      const next = pruneExpired(mutate(parseVisibilityConfig(cur?.body ?? null)));
      const body = JSON.stringify(next);
      const res = cur?.id
        ? await db.from("homepage_sections").update({ body }).eq("id", cur.id)
        : await db.from("homepage_sections").insert({
            section_key: VISIBILITY_SECTION_KEY, body, is_visible: false, display_order: 9999,
            title: "Public catalog visibility (system — do not edit)",
          });
      if (res.error) throw res.error;
      setCfg(next);
      await refreshPublicCatalogVisibility();
      toast({ title: okText });
      return true;
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message, variant: "destructive" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  /** The hide window chosen at the top of the page. */
  const makeEntry = (label?: string): HideEntry | null => {
    const now = Date.now();
    if (dur === "custom") {
      const from = customFrom ? new Date(customFrom) : null;
      const until = customUntil ? new Date(customUntil) : null;
      if (until && until.getTime() <= Math.max(now, from?.getTime() ?? 0)) {
        toast({ title: "Check the time", description: "'Show again at' must be later than now and the start time.", variant: "destructive" });
        return null;
      }
      return { from: from && from.getTime() > now ? from.toISOString() : null, until: until ? until.toISOString() : null, label };
    }
    const days = dur === "1d" ? 1 : dur === "7d" ? 7 : dur === "30d" ? 30 : 0;
    return { from: null, until: days ? new Date(now + days * 864e5).toISOString() : null, label };
  };

  const now = Date.now();
  const allHidden = isAllHidden(cfg, legacyShow, now);
  const counts = activeCounts(cfg, now);

  const setAll = async (show: boolean) => {
    if (show) {
      const ok = await save(c => ({ ...c, all: null }), "Public catalog is ON");
      // The older Home Page master switch also hides everything — switch it back on too.
      // (Only the flag; products are not bulk-published here.)
      if (ok && legacyShow === false && settingsId) {
        const { error } = await db.from("homepage_settings").update({ show_public_catalog: true }).eq("id", settingsId);
        if (!error) { setLegacyShow(true); await refreshPublicCatalogVisibility(); }
      }
    } else {
      const e = makeEntry();
      if (!e) return;
      await save(c => ({ ...c, all: e, message: message.trim() }), entryScheduled(e) ? "Public catalog OFF is scheduled" : "Public catalog is OFF for the public");
    }
  };

  type MapKey = "main" | "sub" | "products" | "bundles";
  const toggle = async (key: MapKey, id: string, show: boolean, label: string) => {
    if (show) {
      await save(c => { const m = { ...c[key] }; delete m[id]; return { ...c, [key]: m }; }, `${label}: visible to public`);
    } else {
      const e = makeEntry(label);
      if (!e) return;
      await save(c => ({ ...c, [key]: { ...c[key], [id]: e } }), `${label}: hidden from public`);
    }
  };

  const hideMany = async (list: Item[]) => {
    if (!list.length) return;
    const e = makeEntry();
    if (!e) return;
    await save(c => {
      const products = { ...c.products }, bundles = { ...c.bundles };
      for (const it of list) (it.bundle ? bundles : products)[it.id] = { ...e, label: `${it.name} (${it.code})` };
      return { ...c, products, bundles };
    }, `${list.length} item(s) hidden from public`);
  };

  const showEverything = async () => {
    if (!window.confirm("Show everything on the public catalog again? This clears all hide rules (categories, sub-categories and items).")) return;
    await save(c => ({ ...emptyVisibilityConfig(), message: c.message }), "All hide rules cleared");
    if (legacyShow === false && settingsId) {
      await db.from("homepage_settings").update({ show_public_catalog: true }).eq("id", settingsId);
      setLegacyShow(true);
      await refreshPublicCatalogVisibility();
    }
  };

  const countBy = useMemo(() => {
    const main = new Map<string, number>(), sub = new Map<string, number>();
    for (const it of items) {
      if (!it.publicEligible) continue;
      if (it.main_category_id) main.set(it.main_category_id, (main.get(it.main_category_id) ?? 0) + 1);
      if (it.sub_category_id) sub.set(it.sub_category_id, (sub.get(it.sub_category_id) ?? 0) + 1);
    }
    return { main, sub };
  }, [items]);

  const itemHiddenEntry = (it: Item) => (it.bundle ? cfg.bundles : cfg.products)[it.id];

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s && qCat === "__all__") return [];
    return items.filter(it =>
      (qCat === "__all__" || it.main_category_id === qCat) &&
      (qSub === "__all__" || it.sub_category_id === qSub) &&
      (!s || it.name.toLowerCase().includes(s) || it.code.toLowerCase().includes(s)));
  }, [items, q, qCat, qSub]);

  const hiddenItems = useMemo(() => {
    const byId = new Map(items.map(i => [(i.bundle ? "b:" : "p:") + i.id, i]));
    const rows: { key: MapKey; id: string; entry: HideEntry; item?: Item }[] = [];
    for (const [id, entry] of Object.entries(cfg.products)) rows.push({ key: "products", id, entry, item: byId.get("p:" + id) });
    for (const [id, entry] of Object.entries(cfg.bundles)) rows.push({ key: "bundles", id, entry, item: byId.get("b:" + id) });
    return rows;
  }, [cfg, items]);

  const catName = (id: string | null) => toTitleCase(cats.find(c => c.id === id)?.name ?? "");
  const subName = (id: string | null) => toTitleCase(subs.find(c => c.id === id)?.name ?? "");

  if (loading) return <AdminShell><div className="flex h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div></AdminShell>;

  return (
    <AdminShell>
      <div className="mx-auto max-w-4xl space-y-5 p-3 sm:p-5">
        <div>
          <h1 className="font-display text-2xl text-foreground sm:text-3xl">Public Catalog Visibility</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            പബ്ലിക് കാറ്റലോഗിൽ എന്ത് കാണിക്കണം എന്ന് ഇവിടെ തീരുമാനിക്കാം. Products are never deleted or unpublished — they only stop showing to the public.
            Staff Catalog and logged-in staff always see everything.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Badge variant={allHidden ? "destructive" : "secondary"}>{allHidden ? "Public catalog OFF" : "Public catalog ON"}</Badge>
            {counts.main > 0 && <Badge variant="outline">{counts.main} categor{counts.main === 1 ? "y" : "ies"} hidden</Badge>}
            {counts.sub > 0 && <Badge variant="outline">{counts.sub} sub-categor{counts.sub === 1 ? "y" : "ies"} hidden</Badge>}
            {counts.items > 0 && <Badge variant="outline">{counts.items} item{counts.items === 1 ? "" : "s"} hidden</Badge>}
            {counts.scheduled > 0 && <Badge variant="outline"><Clock className="mr-1 h-3 w-3" />{counts.scheduled} scheduled</Badge>}
            <Link to="/catalog" target="_blank" className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline">Open public catalog <ExternalLink className="h-3 w-3" /></Link>
          </div>
        </div>

        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-amber-900">When hiding, hide for (ഹൈഡ് ചെയ്യുന്ന സമയം)</Label>
              <Select value={dur} onValueChange={v => setDur(v as Dur)}>
                <SelectTrigger className="h-10 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(DUR_LABEL) as Dur[]).map(d => <SelectItem key={d} value={d}>{DUR_LABEL[d]}</SelectItem>)}</SelectContent>
              </Select>
              {dur === "custom" && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div><Label className="text-xs">Hide from (empty = now)</Label><Input type="datetime-local" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="bg-white" /></div>
                  <div><Label className="text-xs">Show again at (empty = until switched on)</Label><Input type="datetime-local" value={customUntil} onChange={e => setCustomUntil(e.target.value)} className="bg-white" /></div>
                </div>
              )}
            </div>
            <p className="text-xs text-amber-900/80 sm:max-w-[16rem]">Applies to every switch you turn off below. Items come back automatically when the time ends.</p>
          </CardContent>
        </Card>

        {/* 1. Whole catalog */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">1. Whole public catalog (എല്ലാം)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
              <div className="min-w-0">
                <p className="font-semibold">{allHidden ? "OFF — public sees a message instead of products" : "ON — public can browse the catalog"}</p>
                <p className="text-xs text-muted-foreground">
                  {cfg.all ? entryText(cfg.all) : legacyShow === false ? "Turned off from Home Page settings" : entryScheduled(cfg.all) ? entryText(cfg.all) : "Visible"}
                </p>
              </div>
              <Switch checked={!allHidden && !entryScheduled(cfg.all)} disabled={saving} onCheckedChange={v => void setAll(v)} aria-label="Public catalog on or off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pcv-msg" className="text-xs">Message shown to the public while OFF</Label>
              <Textarea id="pcv-msg" value={message} onChange={e => setMessage(e.target.value)} placeholder={DEFAULT_PUBLIC_MESSAGE} rows={2} />
              <Button size="sm" variant="outline" disabled={saving || message.trim() === (cfg.message || "")} onClick={() => void save(c => ({ ...c, message: message.trim() }), "Message saved")}>Save message</Button>
            </div>
          </CardContent>
        </Card>

        {/* 2 + 3. Categories and sub-categories */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">2. Main category & 3. Sub-category (കാറ്റഗറി / സബ് കാറ്റഗറി)</CardTitle>
            <p className="text-xs text-muted-foreground">Switch OFF to hide. Tap a category to see its sub-categories.</p>
          </CardHeader>
          <CardContent className="divide-y rounded-xl border p-0">
            {cats.map(c => {
              const e = cfg.main[c.id];
              const hidden = entryActive(e) ;
              const sched = entryScheduled(e);
              const children = subs.filter(s => s.main_category_id === c.id);
              const isOpen = open.has(c.id);
              const subHiddenCount = children.filter(s => entryActive(cfg.sub[s.id])).length;
              return (
                <div key={c.id}>
                  <div className="flex items-center gap-2 p-3">
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpen(p => { const n = new Set(p); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })} disabled={!children.length}>
                      {children.length ? (isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />) : <span className="w-4" />}
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{toTitleCase(c.name)} <span className="text-xs font-normal text-muted-foreground">· {countBy.main.get(c.id) ?? 0} items</span></span>
                        {(hidden || sched) && <span className="block text-xs text-destructive">{entryText(e)}</span>}
                        {!hidden && subHiddenCount > 0 && <span className="block text-xs text-amber-700">{subHiddenCount} sub-categor{subHiddenCount === 1 ? "y" : "ies"} hidden</span>}
                      </span>
                    </button>
                    <Switch checked={!hidden && !sched} disabled={saving} onCheckedChange={v => void toggle("main", c.id, v, toTitleCase(c.name))} aria-label={`Show ${c.name}`} />
                  </div>
                  {isOpen && (
                    <div className="space-y-1 bg-muted/30 px-3 pb-3 pl-9">
                      {children.map(s => {
                        const se = cfg.sub[s.id];
                        const sh = entryActive(se), ss = entryScheduled(se);
                        return (
                          <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-background px-3 py-2">
                            <span className="min-w-0">
                              <span className="block truncate text-sm">{toTitleCase(s.name)} <span className="text-xs text-muted-foreground">· {countBy.sub.get(s.id) ?? 0}</span></span>
                              {(sh || ss) && <span className="block text-xs text-destructive">{entryText(se)}</span>}
                              {hidden && !sh && <span className="block text-xs text-muted-foreground">Hidden because the main category is off</span>}
                            </span>
                            <Switch checked={!sh && !ss} disabled={saving} onCheckedChange={v => void toggle("sub", s.id, v, toTitleCase(s.name))} aria-label={`Show ${s.name}`} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* 4. Items */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">4. Individual items (ഐറ്റം)</CardTitle>
            <p className="text-xs text-muted-foreground">Search by name or code, or pick a category, then hide one item or all results.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="relative sm:col-span-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={e => setQ(e.target.value)} placeholder="Name or code…" className="pl-9" /></div>
              <Select value={qCat} onValueChange={v => { setQCat(v); setQSub("__all__"); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="__all__">All categories</SelectItem>{cats.map(c => <SelectItem key={c.id} value={c.id}>{toTitleCase(c.name)}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={qSub} onValueChange={setQSub} disabled={qCat === "__all__"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="__all__">All sub-categories</SelectItem>{subs.filter(s => s.main_category_id === qCat).map(s => <SelectItem key={s.id} value={s.id}>{toTitleCase(s.name)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {results.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">{results.length} result{results.length === 1 ? "" : "s"}</span>
                <Button size="sm" variant="outline" disabled={saving} onClick={() => { const list = results.filter(r => !entryActive(itemHiddenEntry(r))); if (list.length && window.confirm(`Hide ${list.length} item(s) from the public catalog?`)) void hideMany(list); }}>
                  <EyeOff className="mr-1.5 h-4 w-4" />Hide all {results.length} results
                </Button>
              </div>
            )}
            <div className="max-h-[420px] divide-y overflow-y-auto rounded-xl border">
              {results.slice(0, 200).map(it => {
                const e = itemHiddenEntry(it);
                const h = entryActive(e) || entryScheduled(e);
                return (
                  <div key={(it.bundle ? "b" : "p") + it.id} className="flex items-center gap-3 p-2">
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md bg-muted">{it.image && <img src={it.image} alt="" className="h-full w-full object-cover" loading="lazy" />}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{it.name}{it.bundle && <Badge variant="outline" className="ml-1.5 text-[10px]">Set</Badge>}</p>
                      <p className="truncate text-xs text-muted-foreground">{it.code} · {[catName(it.main_category_id), subName(it.sub_category_id)].filter(Boolean).join(" › ")}{!it.publicEligible && " · not published"}</p>
                      {h && <p className="text-xs text-destructive">{entryText(e)}</p>}
                    </div>
                    <Button size="sm" variant={h ? "outline" : "secondary"} disabled={saving} onClick={() => void toggle(it.bundle ? "bundles" : "products", it.id, h, `${it.name} (${it.code})`)}>
                      {h ? <><Eye className="mr-1 h-4 w-4" />Show</> : <><EyeOff className="mr-1 h-4 w-4" />Hide</>}
                    </Button>
                  </div>
                );
              })}
              {!results.length && <p className="p-4 text-center text-sm text-muted-foreground">Type a name / code or choose a category to find items.</p>}
              {results.length > 200 && <p className="p-2 text-center text-xs text-muted-foreground">Showing first 200 — narrow the search, or use "Hide all results".</p>}
            </div>

            {hiddenItems.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm font-semibold">Hidden items ({hiddenItems.length})</p>
                <div className="max-h-72 divide-y overflow-y-auto rounded-xl border">
                  {hiddenItems.map(r => (
                    <div key={r.key + r.id} className="flex items-center justify-between gap-2 p-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm">{r.item ? `${r.item.name} (${r.item.code})` : r.entry.label || "Deleted item"}</p>
                        <p className="text-xs text-destructive">{entryText(r.entry)}</p>
                      </div>
                      <Button size="sm" variant="outline" disabled={saving} onClick={() => void toggle(r.key, r.id, true, r.item?.name ?? r.entry.label ?? "Item")}><Eye className="mr-1 h-4 w-4" />Show</Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" />Hidden items are removed from the public catalog, home page, product pages, PDF download and the sitemap (from the next deploy).</span>
          <Button size="sm" variant="outline" disabled={saving} onClick={() => void showEverything()}>Show everything again</Button>
        </div>
      </div>
    </AdminShell>
  );
}
