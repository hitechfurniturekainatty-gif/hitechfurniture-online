ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS show_price_to_delivery boolean NOT NULL DEFAULT false;