ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS sketch_url text,
  ADD COLUMN IF NOT EXISTS site_photos text;