
-- 1. Auto-advance quotation to Logistics stage when its items are dispatched.
CREATE OR REPLACE FUNCTION public.quotation_items_dispatch_advance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _label TEXT;
BEGIN
  IF NEW.dispatched_at IS NOT NULL AND OLD.dispatched_at IS NULL THEN
    SELECT party_name || ' — ' || COALESCE(party_place,'')
      INTO _label FROM public.quotations WHERE id = NEW.quotation_id;
    PERFORM public.set_quotation_stage(
      NEW.quotation_id, 6::SMALLINT, 'delivery'::app_role,
      'Dispatched from warehouse', _label
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotation_items_dispatch_advance ON public.quotation_items;
CREATE TRIGGER trg_quotation_items_dispatch_advance
AFTER UPDATE OF dispatched_at ON public.quotation_items
FOR EACH ROW EXECUTE FUNCTION public.quotation_items_dispatch_advance();

-- 2. Restrict warehouse role to Warehouse-stage quotations only.
DROP POLICY IF EXISTS quotations_select_warehouse ON public.quotations;
CREATE POLICY quotations_select_warehouse ON public.quotations
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'warehouse'::app_role)
  AND deleted_at IS NULL
  AND pipeline_stage = 5
);

DROP POLICY IF EXISTS items_select_warehouse ON public.quotation_items;
CREATE POLICY items_select_warehouse ON public.quotation_items
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'warehouse'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.quotations q
    WHERE q.id = quotation_items.quotation_id
      AND q.deleted_at IS NULL
      AND q.pipeline_stage = 5
  )
);

-- 3. Allow delivery role to see Logistics-stage quotations + items (no trip required).
DROP POLICY IF EXISTS quotations_select_delivery_stage ON public.quotations;
CREATE POLICY quotations_select_delivery_stage ON public.quotations
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'delivery'::app_role)
  AND deleted_at IS NULL
  AND pipeline_stage = 6
);

DROP POLICY IF EXISTS items_select_delivery_stage ON public.quotation_items;
CREATE POLICY items_select_delivery_stage ON public.quotation_items
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'delivery'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.quotations q
    WHERE q.id = quotation_items.quotation_id
      AND q.deleted_at IS NULL
      AND q.pipeline_stage = 6
  )
);
