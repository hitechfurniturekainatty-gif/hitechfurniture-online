import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SingleImagePicker } from "@/components/admin/SingleImagePicker";
import { MultiImagePicker } from "@/components/admin/MultiImagePicker";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown, Save, Eye, EyeOff } from "lucide-react";
import {
  fetchHomepageData,
  HeroSlide,
  HomepageSection,
  HomepageSettings,
  STYLE_PRESETS,
  SECTION_PRESETS,
} from "@/lib/homepage";

const DEFAULT_SETTINGS: Omit<HomepageSettings, "id"> = {
  brand_tagline: "",
  contact_phone: "",
  contact_phone_secondary: "",
  contact_email: "",
  address_lines: [],
  google_maps_url: "",
  google_maps_embed_url: "",
  whatsapp_number: "",
  whatsapp_default_message: "",
  instagram_url: "",
  facebook_url: "",
  managing_partner: "",
  footer_about: "",
};

const AdminHomePage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<(HomepageSettings & { isNew?: boolean }) | null>(null);
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [sections, setSections] = useState<HomepageSection[]>([]);

  const load = async () => {
    setLoading(true);
    const [settingsRes, slidesRes, sectionsRes] = await Promise.all([
      supabase.from("homepage_settings").select("*").limit(1).maybeSingle(),
      supabase.from("homepage_hero_slides").select("*").order("display_order", { ascending: true }),
      supabase.from("homepage_sections").select("*").order("display_order", { ascending: true }),
    ]);
    if (settingsRes.data) {
      setSettings(settingsRes.data as HomepageSettings);
    } else {
      setSettings({ id: "", ...DEFAULT_SETTINGS, isNew: true });
    }
    setSlides((slidesRes.data ?? []) as HeroSlide[]);
    setSections((sectionsRes.data ?? []) as HomepageSection[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // ---------- settings ----------
  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    const { id, isNew, ...rest } = settings;
    const payload = {
      ...rest,
      address_lines: rest.address_lines ?? [],
    };
    const { error } = isNew
      ? await supabase.from("homepage_settings").insert(payload)
      : await supabase.from("homepage_settings").update(payload).eq("id", id);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Home page settings saved" });
      load();
    }
  };

  // ---------- hero slides ----------
  const addSlide = async () => {
    const max = slides.reduce((m, s) => Math.max(m, s.display_order), 0);
    const { data, error } = await supabase
      .from("homepage_hero_slides")
      .insert({ image_url: "", display_order: max + 10, is_visible: true })
      .select()
      .single();
    if (error) return toast({ title: "Add failed", description: error.message, variant: "destructive" });
    setSlides((s) => [...s, data as HeroSlide]);
  };

  const updateSlideField = (id: string, patch: Partial<HeroSlide>) => {
    setSlides((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const persistSlide = async (slide: HeroSlide) => {
    const { error } = await supabase
      .from("homepage_hero_slides")
      .update({
        image_url: slide.image_url,
        headline: slide.headline,
        subheadline: slide.subheadline,
        cta_label: slide.cta_label,
        cta_link: slide.cta_link,
        display_order: slide.display_order,
        is_visible: slide.is_visible,
      })
      .eq("id", slide.id);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Slide saved" });
  };

  const deleteSlide = async (id: string) => {
    if (!confirm("Delete this slide?")) return;
    const { error } = await supabase.from("homepage_hero_slides").delete().eq("id", id);
    if (error) return toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    setSlides((s) => s.filter((x) => x.id !== id));
  };

  const moveSlide = async (id: string, dir: -1 | 1) => {
    const sorted = [...slides].sort((a, b) => a.display_order - b.display_order);
    const idx = sorted.findIndex((s) => s.id === id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    const a = sorted[idx];
    const aOrder = a.display_order;
    const bOrder = swap.display_order;
    await Promise.all([
      supabase.from("homepage_hero_slides").update({ display_order: bOrder }).eq("id", a.id),
      supabase.from("homepage_hero_slides").update({ display_order: aOrder }).eq("id", swap.id),
    ]);
    load();
  };

  // ---------- sections ----------
  const addSection = async () => {
    const key = prompt("Section key (e.g. about_us, find_us). Use lowercase + underscores.")?.trim().toLowerCase();
    if (!key) return;
    if (!/^[a-z0-9_]+$/.test(key)) {
      return toast({ title: "Invalid key", description: "Use lowercase letters, digits and underscores.", variant: "destructive" });
    }
    const max = sections.reduce((m, s) => Math.max(m, s.display_order), 0);
    const { data, error } = await supabase
      .from("homepage_sections")
      .insert({
        section_key: key,
        display_order: max + 10,
        is_visible: true,
        style_preset: "default",
        text_align: "left",
      })
      .select()
      .single();
    if (error) return toast({ title: "Add failed", description: error.message, variant: "destructive" });
    setSections((arr) => [...arr, data as HomepageSection]);
  };

  const updateSectionField = (id: string, patch: Partial<HomepageSection>) => {
    setSections((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const persistSection = async (section: HomepageSection) => {
    const { error } = await supabase
      .from("homepage_sections")
      .update({
        eyebrow: section.eyebrow,
        title: section.title,
        body: section.body,
        cta_label: section.cta_label,
        cta_link: section.cta_link,
        image_url: section.image_url,
        image_urls: section.image_urls,
        style_preset: section.style_preset,
        text_align: section.text_align,
        display_order: section.display_order,
        is_visible: section.is_visible,
      })
      .eq("id", section.id);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Section saved" });
  };

  const deleteSection = async (id: string) => {
    if (!confirm("Delete this section?")) return;
    const { error } = await supabase.from("homepage_sections").delete().eq("id", id);
    if (error) return toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    setSections((arr) => arr.filter((s) => s.id !== id));
  };

  const moveSection = async (id: string, dir: -1 | 1) => {
    const sorted = [...sections].sort((a, b) => a.display_order - b.display_order);
    const idx = sorted.findIndex((s) => s.id === id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    const a = sorted[idx];
    const aOrder = a.display_order;
    const bOrder = swap.display_order;
    await Promise.all([
      supabase.from("homepage_sections").update({ display_order: bOrder }).eq("id", a.id),
      supabase.from("homepage_sections").update({ display_order: aOrder }).eq("id", swap.id),
    ]);
    load();
  };

  if (loading || !settings) {
    return (
      <AdminShell>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      </AdminShell>
    );
  }

  const sortedSlides = [...slides].sort((a, b) => a.display_order - b.display_order);
  const sortedSections = [...sections].sort((a, b) => a.display_order - b.display_order);

  return (
    <AdminShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-foreground md:text-3xl">Home Page</h1>
          <p className="text-sm text-muted-foreground">
            Edit the live banner, sections, contact details and social links shown to visitors.
          </p>
        </div>
      </div>

      <Tabs defaultValue="hero">
        <TabsList className="mb-4 grid w-full grid-cols-4 max-w-3xl">
          <TabsTrigger value="hero">Hero Slider</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="contact">Contact &amp; Find Us</TabsTrigger>
          <TabsTrigger value="social">Social</TabsTrigger>
        </TabsList>

        {/* HERO */}
        <TabsContent value="hero" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">Hero banner slides</CardTitle>
              <Button size="sm" onClick={addSlide}><Plus className="mr-1 h-4 w-4" />Add slide</Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {sortedSlides.length === 0 && (
                <p className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                  No slides yet. Add your first banner — it will auto-advance every 5 seconds on the home page.
                </p>
              )}
              {sortedSlides.map((s, i) => (
                <div key={s.id} className="rounded-lg border border-border bg-card p-4 shadow-card-soft">
                  <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                    <div>
                      <Label className="mb-2 block text-xs">Image (recommended 1600×900)</Label>
                      <SingleImagePicker
                        value={s.image_url || null}
                        onChange={async (url) => {
                          const next = url || "";
                          updateSlideField(s.id, { image_url: next });
                          // Persist immediately so the uploaded banner can never
                          // be lost by forgetting to click "Save".
                          const { error } = await supabase
                            .from("homepage_hero_slides")
                            .update({ image_url: next })
                            .eq("id", s.id);
                          if (error) {
                            toast({ title: "Image save failed", description: error.message, variant: "destructive" });
                          } else if (next) {
                            toast({ title: "Banner image saved" });
                          }
                        }}
                        bucket="homepage-media"
                        folder="hero"
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <Label className="text-xs">Headline</Label>
                          <Input value={s.headline ?? ""} onChange={(e) => updateSlideField(s.id, { headline: e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs">Subheadline</Label>
                          <Input value={s.subheadline ?? ""} onChange={(e) => updateSlideField(s.id, { subheadline: e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs">CTA label (optional)</Label>
                          <Input value={s.cta_label ?? ""} onChange={(e) => updateSlideField(s.id, { cta_label: e.target.value })} placeholder="Explore catalog" />
                        </div>
                        <div>
                          <Label className="text-xs">CTA link</Label>
                          <Input value={s.cta_link ?? ""} onChange={(e) => updateSlideField(s.id, { cta_link: e.target.value })} placeholder="/catalog" />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Switch checked={s.is_visible} onCheckedChange={(v) => updateSlideField(s.id, { is_visible: v })} id={`vis-${s.id}`} />
                          <Label htmlFor={`vis-${s.id}`} className="text-xs flex items-center gap-1">
                            {s.is_visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                            {s.is_visible ? "Visible" : "Hidden"}
                          </Label>
                        </div>
                        <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => moveSlide(s.id, -1)}>
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" disabled={i === sortedSlides.length - 1} onClick={() => moveSlide(s.id, 1)}>
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <div className="ml-auto flex gap-2">
                          <Button size="sm" variant="destructive" onClick={() => deleteSlide(s.id)}>
                            <Trash2 className="mr-1 h-4 w-4" />Delete
                          </Button>
                          <Button size="sm" onClick={() => persistSlide(s)}>
                            <Save className="mr-1 h-4 w-4" />Save
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SECTIONS */}
        <TabsContent value="sections" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">Editable sections</CardTitle>
              <Button size="sm" onClick={addSection}><Plus className="mr-1 h-4 w-4" />Add section</Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Suggested keys: {SECTION_PRESETS.map((p) => p.key).join(", ")}. Reorder with the arrows; toggle visibility to hide a section without deleting it.
              </p>
              {sortedSections.map((s, i) => (
                <div key={s.id} className="rounded-lg border border-border bg-card p-4 shadow-card-soft">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
                      {s.section_key}
                    </span>
                    <div className="flex items-center gap-2">
                      <Switch checked={s.is_visible} onCheckedChange={(v) => updateSectionField(s.id, { is_visible: v })} id={`secvis-${s.id}`} />
                      <Label htmlFor={`secvis-${s.id}`} className="text-xs flex items-center gap-1">
                        {s.is_visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        {s.is_visible ? "Visible" : "Hidden"}
                      </Label>
                    </div>
                    <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => moveSection(s.id, -1)}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" disabled={i === sortedSections.length - 1} onClick={() => moveSection(s.id, 1)}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <div className="ml-auto flex gap-2">
                      <Button size="sm" variant="destructive" onClick={() => deleteSection(s.id)}>
                        <Trash2 className="mr-1 h-4 w-4" />Delete
                      </Button>
                      <Button size="sm" onClick={() => persistSection(s)}>
                        <Save className="mr-1 h-4 w-4" />Save
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                    <div>
                      <Label className="mb-2 block text-xs">Cover image (optional)</Label>
                      <SingleImagePicker
                        value={s.image_url || null}
                        onChange={async (url) => {
                          updateSectionField(s.id, { image_url: url });
                          const { error } = await supabase
                            .from("homepage_sections")
                            .update({ image_url: url })
                            .eq("id", s.id);
                          if (error) {
                            toast({ title: "Image save failed", description: error.message, variant: "destructive" });
                          } else if (url) {
                            toast({ title: "Section image saved" });
                          }
                        }}
                        bucket="homepage-media"
                        folder="sections"
                      />
                      <Label className="mb-2 mt-4 block text-xs">
                        Gallery (auto-rotates every 3s)
                      </Label>
                      <MultiImagePicker
                        value={s.image_urls}
                        onChange={async (joined) => {
                          updateSectionField(s.id, { image_urls: joined });
                          const { error } = await supabase
                            .from("homepage_sections")
                            .update({ image_urls: joined })
                            .eq("id", s.id);
                          if (error) {
                            toast({ title: "Gallery save failed", description: error.message, variant: "destructive" });
                          }
                        }}
                        bucket="homepage-media"
                        folder="sections"
                      />
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Add 2+ images to show a slideshow. With one image, the cover above is used.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <Label className="text-xs">Eyebrow (small label above title)</Label>
                          <Input value={s.eyebrow ?? ""} onChange={(e) => updateSectionField(s.id, { eyebrow: e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs">Title</Label>
                          <Input value={s.title ?? ""} onChange={(e) => updateSectionField(s.id, { title: e.target.value })} />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Body</Label>
                        <Textarea rows={3} value={s.body ?? ""} onChange={(e) => updateSectionField(s.id, { body: e.target.value })} />
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <Label className="text-xs">CTA label (optional)</Label>
                          <Input value={s.cta_label ?? ""} onChange={(e) => updateSectionField(s.id, { cta_label: e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs">CTA link</Label>
                          <Input value={s.cta_link ?? ""} onChange={(e) => updateSectionField(s.id, { cta_link: e.target.value })} placeholder="/catalog or https://..." />
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <Label className="text-xs">Style preset</Label>
                          <Select value={s.style_preset} onValueChange={(v) => updateSectionField(s.id, { style_preset: v as HomepageSection["style_preset"] })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {STYLE_PRESETS.map((p) => (
                                <SelectItem key={p.value} value={p.value}>
                                  <div>
                                    <div className="font-medium">{p.label}</div>
                                    <div className="text-xs text-muted-foreground">{p.description}</div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Text alignment</Label>
                          <Select value={s.text_align} onValueChange={(v) => updateSectionField(s.id, { text_align: v as HomepageSection["text_align"] })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="left">Left</SelectItem>
                              <SelectItem value="center">Center</SelectItem>
                              <SelectItem value="right">Right</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONTACT */}
        <TabsContent value="contact" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact &amp; Find Us</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">Brand tagline</Label>
                <Input value={settings.brand_tagline} onChange={(e) => setSettings({ ...settings, brand_tagline: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Footer about</Label>
                <Textarea rows={3} value={settings.footer_about ?? ""} onChange={(e) => setSettings({ ...settings, footer_about: e.target.value })} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-xs">Primary phone</Label>
                  <Input value={settings.contact_phone ?? ""} onChange={(e) => setSettings({ ...settings, contact_phone: e.target.value })} placeholder="+91 95266 10404" />
                </div>
                <div>
                  <Label className="text-xs">Secondary phone</Label>
                  <Input value={settings.contact_phone_secondary ?? ""} onChange={(e) => setSettings({ ...settings, contact_phone_secondary: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input value={settings.contact_email ?? ""} onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Managing partner</Label>
                  <Input value={settings.managing_partner ?? ""} onChange={(e) => setSettings({ ...settings, managing_partner: e.target.value })} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Address (one line per row)</Label>
                <Textarea
                  rows={4}
                  value={(settings.address_lines ?? []).join("\n")}
                  onChange={(e) =>
                    setSettings({ ...settings, address_lines: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean) })
                  }
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-xs">Google Maps URL (open in new tab)</Label>
                  <Input value={settings.google_maps_url ?? ""} onChange={(e) => setSettings({ ...settings, google_maps_url: e.target.value })} placeholder="https://maps.app.goo.gl/..." />
                </div>
                <div>
                  <Label className="text-xs">Embedded map URL</Label>
                  <Input value={settings.google_maps_embed_url ?? ""} onChange={(e) => setSettings({ ...settings, google_maps_embed_url: e.target.value })} placeholder="https://www.google.com/maps?...&output=embed" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={saveSettings} disabled={saving}>
                  {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}Save changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SOCIAL */}
        <TabsContent value="social" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Social &amp; messaging</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-xs">WhatsApp number (digits only, with country code)</Label>
                  <Input value={settings.whatsapp_number} onChange={(e) => setSettings({ ...settings, whatsapp_number: e.target.value.replace(/\D/g, "") })} placeholder="919526610404" />
                </div>
                <div>
                  <Label className="text-xs">WhatsApp default message</Label>
                  <Input value={settings.whatsapp_default_message} onChange={(e) => setSettings({ ...settings, whatsapp_default_message: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Instagram URL</Label>
                  <Input value={settings.instagram_url ?? ""} onChange={(e) => setSettings({ ...settings, instagram_url: e.target.value })} placeholder="https://instagram.com/..." />
                </div>
                <div>
                  <Label className="text-xs">Facebook URL</Label>
                  <Input value={settings.facebook_url ?? ""} onChange={(e) => setSettings({ ...settings, facebook_url: e.target.value })} placeholder="https://facebook.com/..." />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={saveSettings} disabled={saving}>
                  {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}Save changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
};

export default AdminHomePage;