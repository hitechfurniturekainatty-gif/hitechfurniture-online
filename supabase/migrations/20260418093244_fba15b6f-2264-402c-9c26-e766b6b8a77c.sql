ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS catalog_text TEXT,
  ADD COLUMN IF NOT EXISTS catalog_image_url TEXT;