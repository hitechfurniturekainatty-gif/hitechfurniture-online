ALTER TABLE public.product_bundles
  ADD COLUMN IF NOT EXISTS location_id uuid;

CREATE INDEX IF NOT EXISTS idx_product_bundles_location ON public.product_bundles(location_id);