ALTER TABLE public.product_bundles
  ADD COLUMN IF NOT EXISTS show_item_prices_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_item_prices_staff  boolean NOT NULL DEFAULT true;