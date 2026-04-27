-- =====================================================================
-- Home Page CMS schema
-- =====================================================================

-- 1. Single-row settings table (brand-level info)
CREATE TABLE public.homepage_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  brand_tagline text NOT NULL DEFAULT 'Crafted interiors for considered living.',
  contact_phone text,
  contact_phone_secondary text,
  contact_email text,
  address_lines text[] NOT NULL DEFAULT '{}'::text[],
  google_maps_url text,
  google_maps_embed_url text,
  whatsapp_number text NOT NULL DEFAULT '919526610404',
  whatsapp_default_message text NOT NULL DEFAULT 'Hello Hitech Furniture, I''d like to know more about your collection.',
  instagram_url text,
  facebook_url text,
  managing_partner text,
  footer_about text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.homepage_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read homepage settings"
  ON public.homepage_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins manage homepage settings"
  ON public.homepage_settings FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_homepage_settings_updated_at
  BEFORE UPDATE ON public.homepage_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Hero slider
CREATE TABLE public.homepage_hero_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  headline text,
  subheadline text,
  cta_label text,
  cta_link text,
  display_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.homepage_hero_slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read hero slides"
  ON public.homepage_hero_slides FOR SELECT
  USING (true);

CREATE POLICY "Admins manage hero slides"
  ON public.homepage_hero_slides FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_homepage_hero_slides_updated_at
  BEFORE UPDATE ON public.homepage_hero_slides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_hero_slides_order ON public.homepage_hero_slides(display_order);

-- 3. Editable sections (about, made-to-order, find-us, etc.)
CREATE TABLE public.homepage_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text NOT NULL UNIQUE,
  eyebrow text,
  title text,
  body text,
  cta_label text,
  cta_link text,
  image_url text,
  style_preset text NOT NULL DEFAULT 'default',
  text_align text NOT NULL DEFAULT 'left',
  display_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.homepage_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read homepage sections"
  ON public.homepage_sections FOR SELECT
  USING (true);

CREATE POLICY "Admins manage homepage sections"
  ON public.homepage_sections FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_homepage_sections_updated_at
  BEFORE UPDATE ON public.homepage_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_homepage_sections_order ON public.homepage_sections(display_order);

-- 4. Storage bucket for homepage media
INSERT INTO storage.buckets (id, name, public)
VALUES ('homepage-media', 'homepage-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read homepage media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'homepage-media');

CREATE POLICY "Admins upload homepage media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'homepage-media' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update homepage media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'homepage-media' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete homepage media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'homepage-media' AND has_role(auth.uid(), 'admin'::app_role));

-- 5. Seed defaults so the site keeps showing the existing content
INSERT INTO public.homepage_settings (
  brand_tagline, contact_phone, contact_phone_secondary, contact_email,
  address_lines, google_maps_url, google_maps_embed_url,
  whatsapp_number, instagram_url, facebook_url,
  managing_partner, footer_about
) VALUES (
  'Crafted interiors for considered living.',
  '+91 95266 10404',
  '+91 95621 34796',
  'hitechfurniturekainatty@gmail.com',
  ARRAY['Edappetty Shopping Centre', 'Near Amrid, Edappetty', 'Kalpetta, Wayanad - 673122'],
  'https://maps.app.goo.gl/hy5mbzYsFP2c3vx27?g_st=iw',
  'https://www.google.com/maps?q=Edappetty+Shopping+Centre+Kalpetta+Wayanad&output=embed',
  '919526610404',
  NULL,
  NULL,
  'Abdul Raheem',
  'A live catalog of furniture & interior pieces — refined craftsmanship for homes and workspaces.'
);

INSERT INTO public.homepage_sections (section_key, eyebrow, title, body, cta_label, cta_link, style_preset, text_align, display_order, is_visible) VALUES
  ('hero_intro', 'Live Catalog · Updated Daily', 'Furniture, crafted for the way you live.',
   'Browse our complete collection of sofas, beds, wardrobes and bespoke interiors — with live pricing and instant WhatsApp inquiry.',
   'Explore catalog', '/catalog', 'elegant', 'left', 10, true),
  ('made_to_order', 'Made to order', 'Have something specific in mind?',
   'Send us a photo or sketch on WhatsApp and our team will craft it to your dimensions.',
   'Start a conversation', 'https://wa.me/919526610404', 'bold', 'center', 50, true),
  ('about_us', 'About', 'Refined craftsmanship for every home.',
   'For over a decade, Hitech Furniture has built bespoke interiors and modular furniture for families across Wayanad. Every piece is made to last — designed in-house and finished by hand.',
   NULL, NULL, 'default', 'left', 60, true);