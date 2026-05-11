-- Allow measurement staff to view + edit (while drafted) a quotation that is linked
-- to a measurement_task assigned to them, even when the quotation was created
-- by office staff/admin (created_by != measurement staff).

DROP POLICY IF EXISTS quotations_select ON public.quotations;
CREATE POLICY quotations_select ON public.quotations
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    (
      has_role(auth.uid(), 'staff'::app_role)
      OR (
        has_role(auth.uid(), 'measurement_staff'::app_role)
        AND (
          created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.measurement_tasks mt
            WHERE mt.draft_quotation_id = quotations.id
              AND (mt.assigned_to = auth.uid() OR mt.assigned_to IS NULL)
          )
        )
      )
    )
    AND deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS quotations_update ON public.quotations;
CREATE POLICY quotations_update ON public.quotations
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'staff'::app_role)
  OR (
    has_role(auth.uid(), 'measurement_staff'::app_role)
    AND status = ANY (ARRAY['draft'::text, 'drafted'::text])
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.measurement_tasks mt
        WHERE mt.draft_quotation_id = quotations.id
          AND (mt.assigned_to = auth.uid() OR mt.assigned_to IS NULL)
      )
    )
  )
);

-- Also extend items policies so they can view/edit line items on those quotations.
DROP POLICY IF EXISTS items_select ON public.quotation_items;
CREATE POLICY items_select ON public.quotation_items
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.quotations q
  WHERE q.id = quotation_items.quotation_id
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
      OR (
        has_role(auth.uid(), 'measurement_staff'::app_role)
        AND (
          q.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.measurement_tasks mt
            WHERE mt.draft_quotation_id = q.id
              AND (mt.assigned_to = auth.uid() OR mt.assigned_to IS NULL)
          )
        )
      )
    )
));

DROP POLICY IF EXISTS items_insert ON public.quotation_items;
CREATE POLICY items_insert ON public.quotation_items
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.quotations q
  WHERE q.id = quotation_items.quotation_id
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
      OR (
        has_role(auth.uid(), 'measurement_staff'::app_role)
        AND q.status = ANY (ARRAY['draft'::text, 'drafted'::text])
        AND (
          q.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.measurement_tasks mt
            WHERE mt.draft_quotation_id = q.id
              AND (mt.assigned_to = auth.uid() OR mt.assigned_to IS NULL)
          )
        )
      )
    )
));

DROP POLICY IF EXISTS items_update ON public.quotation_items;
CREATE POLICY items_update ON public.quotation_items
FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.quotations q
  WHERE q.id = quotation_items.quotation_id
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
      OR (
        has_role(auth.uid(), 'measurement_staff'::app_role)
        AND q.status = ANY (ARRAY['draft'::text, 'drafted'::text])
        AND (
          q.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.measurement_tasks mt
            WHERE mt.draft_quotation_id = q.id
              AND (mt.assigned_to = auth.uid() OR mt.assigned_to IS NULL)
          )
        )
      )
    )
));

DROP POLICY IF EXISTS items_delete ON public.quotation_items;
CREATE POLICY items_delete ON public.quotation_items
FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.quotations q
  WHERE q.id = quotation_items.quotation_id
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
      OR (
        has_role(auth.uid(), 'measurement_staff'::app_role)
        AND q.status = ANY (ARRAY['draft'::text, 'drafted'::text])
        AND (
          q.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.measurement_tasks mt
            WHERE mt.draft_quotation_id = q.id
              AND (mt.assigned_to = auth.uid() OR mt.assigned_to IS NULL)
          )
        )
      )
    )
));