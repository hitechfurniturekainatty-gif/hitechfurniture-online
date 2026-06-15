-- Product price history with effective-dated snapshots.
-- Each row represents a price period; active row has effective_to = NULL.

CREATE TABLE public.product_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  cost_price numeric,
  selling_price numeric,
  mrp numeric,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX product_price_history_product_idx
  ON public.product_price_history(product_id, effective_from DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_price_history TO authenticated;
GRANT ALL ON public.product_price_history TO service_role;

ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/staff manage price history"
  ON public.product_price_history FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'staff'::app_role));

-- Seed one active row per existing product so history is contiguous.
INSERT INTO public.product_price_history (product_id, cost_price, selling_price, mrp, effective_from, note)
SELECT id, cost_price, offer_price, mrp, COALESCE(created_at, now()), 'Initial seed'
FROM public.products
WHERE deleted_at IS NULL;

-- RPC: apply a price change with an effective date.
-- Closes the active row, inserts a new active row, updates the live product columns.
CREATE OR REPLACE FUNCTION public.apply_product_price_change(
  _product_id uuid,
  _cost_price numeric,
  _selling_price numeric,
  _mrp numeric,
  _effective_from timestamptz DEFAULT now(),
  _note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_id uuid;
  _is_priv boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  _is_priv := public.has_role(auth.uid(), 'admin'::app_role)
           OR public.has_role(auth.uid(), 'staff'::app_role);

  IF NOT _is_priv THEN
    RAISE EXCEPTION 'Only admin or office staff can change prices';
  END IF;

  -- Close any currently-active row for this product at the new effective date.
  UPDATE public.product_price_history
     SET effective_to = _effective_from
   WHERE product_id = _product_id
     AND effective_to IS NULL;

  -- Insert the new active row.
  INSERT INTO public.product_price_history
    (product_id, cost_price, selling_price, mrp, effective_from, effective_to, note, created_by)
  VALUES
    (_product_id, _cost_price, _selling_price, _mrp, _effective_from, NULL, _note, auth.uid())
  RETURNING id INTO _new_id;

  -- Update live product columns so catalog/website reads the latest values.
  UPDATE public.products
     SET cost_price = COALESCE(_cost_price, cost_price),
         offer_price = _selling_price,
         mrp = COALESCE(_mrp, mrp),
         updated_at = now()
   WHERE id = _product_id;

  RETURN _new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_product_price_change(uuid, numeric, numeric, numeric, timestamptz, text) TO authenticated;