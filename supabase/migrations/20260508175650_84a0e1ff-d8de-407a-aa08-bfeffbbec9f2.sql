CREATE TABLE public.product_variant_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.product_locations(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0,
  floor_display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (variant_id, location_id)
);

CREATE INDEX idx_pvs_variant ON public.product_variant_stock(variant_id);
CREATE INDEX idx_pvs_location ON public.product_variant_stock(location_id);

ALTER TABLE public.product_variant_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read variant stock"
  ON public.product_variant_stock FOR SELECT
  USING (true);

CREATE POLICY "Staff insert variant stock"
  ON public.product_variant_stock FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff update variant stock"
  ON public.product_variant_stock FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff delete variant stock"
  ON public.product_variant_stock FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE TRIGGER trg_pvs_updated_at
  BEFORE UPDATE ON public.product_variant_stock
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill: seed one row per variant that already has a location_id, copying its existing stock.
INSERT INTO public.product_variant_stock (variant_id, location_id, quantity, floor_display_order)
SELECT id, location_id, COALESCE(stock_quantity, 0), COALESCE(floor_display_order, 0)
FROM public.product_variants
WHERE location_id IS NOT NULL
ON CONFLICT DO NOTHING;