ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS fulfillment_route TEXT NOT NULL DEFAULT 'ready_stock';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quotation_items_fulfillment_route_check'
  ) THEN
    ALTER TABLE public.quotation_items
      ADD CONSTRAINT quotation_items_fulfillment_route_check
      CHECK (fulfillment_route IN ('ready_stock', 'custom'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_quotation_items_fulfillment_route
  ON public.quotation_items(fulfillment_route);