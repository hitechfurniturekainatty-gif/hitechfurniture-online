import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ArrowDown, ArrowUp, Download, ExternalLink, ImagePlus, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { loadSocialBody } from "@/hooks/useSocialLinks";
import { SocialBadge } from "@/components/SocialLinks";
import { FancyQr, svgToPng } from "@/components/FancyQr";
import { SingleImagePicker } from "@/components/admin/SingleImagePicker";
import {
  CONNECT_PAGE_URL, SOCIAL_SECTION_KEY, SOCIAL_TYPES, buildSocialLinks, newSocialItem, parseSocialConfig,
  resolveItemUrl, typeInfo, type SocialItem, type SocialType,
} from "@/lib/socialLinks";

const db = supabase as any;

type SettingsLike = {
  id?: string; instagram_url?: string | null; facebook_url?: string | null; whatsapp_number?: string | null;
  google_maps_url?: string | null; whatsapp_default_message?: string | null;
};

/**
 * Admin → Home Page → Social: the list of social / review links shown on the
 * home page "Scan & connect" section and the /connect page, plus the QR code.
 */
export function SocialLinksAdminCard({ settings, onSettingsSynced }: {
  settings: SettingsLike | null;
  /** Keeps the parent form in step when Instagram / Facebook are mirrored into homepage_settings (used by the footer). */
  onSettingsSynced?: (patch: { instagram_url: string | null; facebook_url: string | null }) => void;
}) {
  const [items, setItems] = useState<SocialItem[]>([]);
  const [showOnHome, setShowOnHome] = useState(true);
  const [savedJson, setSavedJson] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addType, setAddType] = useState<SocialType>("threads");
  const [iconFor, setIconFor] = useState<string | null>(null);
  const [qrTarget, setQrTarget] = useState("connect");
  const [downloading, setDownloading] = useState(false);
  const qrRef = useRef<SVGSVGElement>(null);
  const settingsReady = !!settings;

  useEffect(() => {
    if (!settingsReady) return;
    void loadSocialBody(true).then(body => {
      const cfg = parseSocialConfig(body, settings);
      setItems(cfg.items);
      setShowOnHome(cfg.show_on_home);
      setSavedJson(JSON.stringify({ items: cfg.items, show_on_home: cfg.show_on_home }));
      setLoading(false);
    });
    // Load once the settings row is known; later edits to the parent form don't reset this list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsReady]);

  const dirty = JSON.stringify({ items, show_on_home: showOnHome }) !== savedJson;
  const links = useMemo(() => buildSocialLinks({ v: 2, items, show_on_home: showOnHome }, settings?.whatsapp_default_message || undefined), [items, showOnHome, settings?.whatsapp_default_message]);
  const targets = useMemo(() => [
    { id: "connect", label: "All links page (recommended)", url: CONNECT_PAGE_URL },
    ...links.map(l => ({ id: l.id, label: `${l.label} only`, url: l.url })),
  ], [links]);
  const target = targets.find(t => t.id === qrTarget) ?? targets[0];

  const patch = (id: string, p: Partial<SocialItem>) => setItems(list => list.map(it => (it.id === id ? { ...it, ...p } : it)));
  const move = (i: number, d: -1 | 1) => setItems(list => {
    const j = i + d;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const remove = (it: SocialItem) => {
    if (!window.confirm(`Remove ${it.label || typeInfo(it.type).label}? (Tip: switch it off instead to just hide it.)`)) return;
    setItems(list => list.filter(x => x.id !== it.id));
  };
  const add = () => {
    const it = newSocialItem(addType);
    setItems(list => [...list, it]);
    if (addType === "custom") setIconFor(it.id);
  };

  const save = async () => {
    const bad = items.find(it => it.visible && !resolveItemUrl(it));
    if (bad) {
      toast({ title: `Check the ${bad.label || typeInfo(bad.type).label} link`, description: "Paste a full link (https://…), or switch it off.", variant: "destructive" });
      return;
    }
    if (items.some(it => it.type === "custom" && !it.label.trim())) {
      toast({ title: "Give the new link a name", description: "e.g. Threads, Pinterest…", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const clean = items.map(it => ({ ...it, label: it.label.trim() || typeInfo(it.type).label, url: it.url.trim() }));
      const body = JSON.stringify({ v: 2, items: clean, show_on_home: showOnHome });
      const { data: cur, error: readErr } = await db.from("homepage_sections").select("id").eq("section_key", SOCIAL_SECTION_KEY).maybeSingle();
      if (readErr) throw readErr;
      const res = cur?.id
        ? await db.from("homepage_sections").update({ body }).eq("id", cur.id)
        : await db.from("homepage_sections").insert({ section_key: SOCIAL_SECTION_KEY, body, is_visible: false, display_order: 9998, title: "Social links (system — do not edit)" });
      if (res.error) throw res.error;

      // Mirror Instagram / Facebook into the settings row — the footer reads them from there.
      const firstUrl = (t: SocialType) => { const it = clean.find(x => x.type === t && x.visible); return it ? resolveItemUrl(it) || null : null; };
      const mirror = { instagram_url: firstUrl("instagram"), facebook_url: firstUrl("facebook") };
      if (settings?.id && (mirror.instagram_url !== (settings.instagram_url || null) || mirror.facebook_url !== (settings.facebook_url || null))) {
        const { error } = await db.from("homepage_settings").update(mirror).eq("id", settings.id);
        if (!error) onSettingsSynced?.(mirror);
      }

      await loadSocialBody(true);
      setItems(clean);
      setSavedJson(JSON.stringify({ items: clean, show_on_home: showOnHome }));
      toast({ title: "Social links saved", description: "Home page, links page and QR now use this list." });
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : (e as { message?: string })?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const download = async () => {
    if (!qrRef.current) return;
    setDownloading(true);
    try {
      const png = await svgToPng(qrRef.current, 1400);
      const a = document.createElement("a");
      a.href = png;
      a.download = `hitech-qr-${target.id === "connect" ? "connect" : (links.find(l => l.id === target.id)?.key ?? "link")}.png`;
      a.click();
    } catch (e) {
      toast({ title: "Download failed", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <Card><CardContent className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></CardContent></Card>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Social links, Google review &amp; QR code</CardTitle>
        <p className="text-xs text-muted-foreground">Shown on the home page ("Follow us &amp; rate us") and on the QR links page. Add, hide (switch), reorder (arrows) or remove. For a new app like Threads, add it and upload its logo.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          {items.map((it, i) => {
            const info = typeInfo(it.type);
            const ok = !!resolveItemUrl(it);
            return (
              <div key={it.id} className={`rounded-xl border p-3 ${it.visible ? "bg-card" : "bg-muted/40 opacity-75"}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => setIconFor(iconFor === it.id ? null : it.id)} title="Change icon picture" className="relative">
                    <SocialBadge k={it.type} iconUrl={it.icon_url} size="md" />
                    <span className="absolute -bottom-1 -right-1 rounded-full bg-background p-0.5 shadow ring-1 ring-border"><ImagePlus className="h-3 w-3" /></span>
                  </button>
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[150px_1fr]">
                    <Select value={it.type} onValueChange={v => patch(it.id, { type: v as SocialType, label: it.label === info.label ? typeInfo(v as SocialType).label : it.label })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{SOCIAL_TYPES.map(t => <SelectItem key={t.type} value={t.type}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input className="h-9" value={it.label} onChange={e => patch(it.id, { label: e.target.value })} placeholder="Name shown (e.g. Threads)" aria-label="Name shown" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch checked={it.visible} onCheckedChange={v => patch(it.id, { visible: v })} aria-label={`Show ${it.label}`} />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down"><ArrowDown className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(it)} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Input className="h-9" value={it.url} onChange={e => patch(it.id, { url: e.target.value })} placeholder={info.placeholder} aria-label={`${it.label} link`} />
                  {ok && <a href={resolveItemUrl(it)} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs font-semibold text-primary underline-offset-2 hover:underline">Test</a>}
                </div>
                {iconFor === it.id && (
                  <div className="mt-3 rounded-lg border border-dashed p-3">
                    <Label className="mb-2 block text-xs">Icon picture (square logo, optional — replaces the built-in icon)</Label>
                    <div className="flex items-center gap-3">
                      <div className="w-32"><SingleImagePicker compact value={it.icon_url ?? null} onChange={url => patch(it.id, { icon_url: url })} bucket="homepage-media" folder="social-icons" /></div>
                      {it.icon_url && <Button size="sm" variant="outline" onClick={() => patch(it.id, { icon_url: null })}>Use built-in icon</Button>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="w-48">
            <Label className="text-xs">Add a platform</Label>
            <Select value={addType} onValueChange={v => setAddType(v as SocialType)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{SOCIAL_TYPES.map(t => <SelectItem key={t.type} value={t.type}>{t.type === "custom" ? "Other (upload icon)" : t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="outline" onClick={add}><Plus className="mr-1 h-4 w-4" />Add link</Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
          <div>
            <p className="text-sm font-semibold">Show on the home page</p>
            <p className="text-xs text-muted-foreground">"Follow us &amp; rate us" section with icons and QR, below the Google review section.</p>
          </div>
          <Switch checked={showOnHome} onCheckedChange={setShowOnHome} aria-label="Show social section on home page" />
        </div>

        <div className="flex justify-end">
          <Button onClick={() => void save()} disabled={saving || !dirty}>{saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}Save social links</Button>
        </div>

        <div className="grid gap-4 rounded-xl border bg-muted/30 p-4 sm:grid-cols-[200px_1fr]">
          <div className="mx-auto rounded-[1.75rem] bg-gradient-to-br from-[#5E2D05] via-[#8a4a10] to-[#F4A227] p-[3px]">
            <div className="rounded-[calc(1.75rem-3px)] bg-white p-3"><FancyQr ref={qrRef} value={target.url} size={170} title={`QR for ${target.label}`} /></div>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">QR code opens</Label>
              <Select value={target.id} onValueChange={setQrTarget}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>{targets.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
              <p className="mt-1 break-all text-[11px] text-muted-foreground">{target.url}</p>
            </div>
            <p className="text-xs text-muted-foreground">Print for the counter, bills, delivery stickers or visiting cards. The "All links page" QR never needs reprinting — edit the list above and the same QR shows the new links.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void download()} disabled={downloading}>{downloading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}Download QR (PNG)</Button>
              <Button size="sm" variant="outline" asChild><a href="/connect" target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1 h-4 w-4" />Open links page</a></Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
