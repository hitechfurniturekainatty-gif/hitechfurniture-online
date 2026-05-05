
DROP POLICY IF EXISTS items_insert ON public.quotation_items;
DROP POLICY IF EXISTS items_update ON public.quotation_items;
DROP POLICY IF EXISTS items_delete ON public.quotation_items;

CREATE POLICY items_insert ON public.quotation_items FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM quotations q
  WHERE q.id = quotation_items.quotation_id
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
      OR (has_role(auth.uid(), 'measurement_staff'::app_role)
          AND q.created_by = auth.uid()
          AND q.status IN ('draft','drafted'))
    )
));

CREATE POLICY items_update ON public.quotation_items FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM quotations q
  WHERE q.id = quotation_items.quotation_id
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
      OR (has_role(auth.uid(), 'measurement_staff'::app_role)
          AND q.created_by = auth.uid()
          AND q.status IN ('draft','drafted'))
    )
));

CREATE POLICY items_delete ON public.quotation_items FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM quotations q
  WHERE q.id = quotation_items.quotation_id
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
      OR (has_role(auth.uid(), 'measurement_staff'::app_role)
          AND q.created_by = auth.uid()
          AND q.status IN ('draft','drafted'))
    )
));

DROP POLICY IF EXISTS quotations_update ON public.quotations;
CREATE POLICY quotations_update ON public.quotations FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'staff'::app_role)
  OR (has_role(auth.uid(), 'measurement_staff'::app_role)
      AND created_by = auth.uid()
      AND status IN ('draft','drafted'))
);
