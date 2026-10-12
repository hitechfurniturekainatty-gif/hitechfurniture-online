import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Download, ExternalLink, Loader2, Save } from "lucide-react";
import { loadSocialExtras } from "@/hooks/useSocialLinks";
import { SocialBadge } from "@/components/SocialLinks";
import {
  CONNECT_PAGE_URL, SOCIAL_SECTION_KEY, buildSocialLinks, defaultSocialExtras, normalizeUrl, type SocialExtras,
} from "@/lib/socialLinks";

const db = supabase as any;

type SettingsLike = { instagram_url?: string | null; facebook_url?: string | null; whatsapp_number?: string | null; google_maps_url?: string | null; whatsapp_default_message?: string | null };

/**
 * Admin → Home Page → Social: Google review / YouTube links, the home-page
 * icon strip switch, and a printable QR code for the /connect links page.
 */
export function SocialLinksAdminCard({ settings }: { settings: SettingsLike | null }) {
  const [extras, setExtras] = useState<SocialExtras>(defaultSocialExtras());
  const [saved, setSaved] = useState<SocialExtras>(defaultSocialExtras());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [qrTarget, setQrTarget] = useState("connect");
  const [qrData, setQrData] = useState("");

  useEffect(() => {
    void loadSocialExtras(true).then(x => { setExtras(x); setSaved(x); setLoading(false); });
  }, []);

  const links = useMemo(() => buildSocialLinks(settings, saved, settings?.whatsapp_default_message || undefined), [settings, saved]);
  const targets = useMemo(() => [
    { id: "connect", label: "All links page (recommended)", url: CONNECT_PAGE_URL },
    ...links.map(l => ({ id: l.key, label: `${l.label} only`, url: l.url })),
  ], [links]);
  const target = targets.find(t => t.id === qrTarget) ?? targets[0];

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(target.url, { width: 1024, margin: 2, errorCorrectionLevel: "M", color: { dark: "#3b1d06", light: "#ffffff" } })
      .then(d => { if (alive) setQrData(d); })
      .catch(() => { if (alive) setQrData(""); });
    return () => { alive = false; };
  }, [target.url]);

  const dirty = JSON.stringify(extras) !== JSON.stringify(saved);

  const save = async () => {
    const clean: SocialExtras = {
      google_review_url: extras.google_review_url.trim() ? normalizeUrl(extras.google_review_url) : "",
      youtube_url: extras.youtube_url.trim() ? normalizeUrl(extras.youtube_url) : "",
      show_on_home: extras.show_on_home,
    };
    if ((extras.google_review_url.trim() && !clean.google_review_url) || (extras.youtube_url.trim() && !clean.youtube_url)) {
      toast({ title: "Check the links", description: "Paste a full web link (https://…).", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body = JSON.stringify(clean);
      const { data: cur, error: readErr } = await db.from("homepage_sections").select("id").eq("section_key", SOCIAL_SECTION_KEY).maybeSingle();
      if (readErr) throw readErr;
      const res = cur?.id
        ? await db.from("homepage_sections").update({ body }).eq("id", cur.id)
        : await db.from("homepage_sections").insert({ section_key: SOCIAL_SECTION_KEY, body, is_visible: false, display_order: 9998, title: "Social links (system — do not edit)" });
      if (res.error) throw res.error;
      await loadSocialExtras(true);
      setExtras(clean); setSaved(clean);
      toast({ title: "Links saved", description: "The home page and the QR links page now use these." });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const download = () => {
    if (!qrData) return;
    const a = document.createElement("a");
    a.href = qrData;
    a.download = `hitech-qr-${target.id}.png`;
    a.click();
  };

  if (loading) return <Card><CardContent className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></CardContent></Card>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Links page, Google review &amp; QR code</CardTitle>
        <p className="text-xs text-muted-foreground">Instagram, Facebook and WhatsApp come from the fields above (save them first). Customers tap an icon and go straight to that page.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label className="text-xs">Google review link</Label>
            <Input value={extras.google_review_url} onChange={e => setExtras({ ...extras, google_review_url: e.target.value })} placeholder="https://g.page/r/…/review" />
          </div>
          <div>
            <Label className="text-xs">YouTube channel link (optional)</Label>
            <Input value={extras.youtube_url} onChange={e => setExtras({ ...extras, youtube_url: e.target.value })} placeholder="https://youtube.com/@…" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
          <div>
            <p className="text-sm font-semibold">Show social icons on the home page</p>
            <p className="text-xs text-muted-foreground">"Follow us &amp; share your experience" strip above the Google review section.</p>
          </div>
          <Switch checked={extras.show_on_home} onCheckedChange={v => setExtras({ ...extras, show_on_home: v })} aria-label="Show social icons on home page" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">{links.map(l => <a key={l.key} href={l.url} target="_blank" rel="noopener noreferrer" title={`Test: ${l.action}`}><SocialBadge k={l.key} size="lg" /></a>)}</div>
          <Button onClick={() => void save()} disabled={saving || !dirty}>{saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}Save links</Button>
        </div>

        <div className="grid gap-4 rounded-xl border bg-muted/30 p-4 sm:grid-cols-[180px_1fr]">
          <div className="mx-auto w-[180px] rounded-xl bg-white p-2 shadow-sm">
            {qrData ? <img src={qrData} alt={`QR code for ${target.label}`} className="h-auto w-full" /> : <div className="flex aspect-square items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>}
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">QR code opens</Label>
              <Select value={qrTarget} onValueChange={setQrTarget}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>{targets.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
              <p className="mt-1 break-all text-[11px] text-muted-foreground">{target.url}</p>
            </div>
            <p className="text-xs text-muted-foreground">Print this for the counter, bills, delivery stickers or visiting cards. The "All links page" QR never needs reprinting — change the links here and the same QR shows the new ones.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={download} disabled={!qrData}><Download className="mr-1 h-4 w-4" />Download QR (PNG)</Button>
              <Button size="sm" variant="outline" asChild><a href="/connect" target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1 h-4 w-4" />Open links page</a></Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
