ALTER TABLE public.homepage_settings
  ADD COLUMN IF NOT EXISTS show_hero_window boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_hero_text boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_google_review boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS hero_brand_text text,
  ADD COLUMN IF NOT EXISTS hero_headline_line1 text,
  ADD COLUMN IF NOT EXISTS hero_headline_line2 text,
  ADD COLUMN IF NOT EXISTS hero_scroll_hint text,
  ADD COLUMN IF NOT EXISTS hero_caption_eyebrow text,
  ADD COLUMN IF NOT EXISTS hero_caption_title text;