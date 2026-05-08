ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS location_id uuid,
  ADD COLUMN IF NOT EXISTS floor_display_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS product_variants_location_order_idx
  ON public.product_variants (location_id, floor_display_order);