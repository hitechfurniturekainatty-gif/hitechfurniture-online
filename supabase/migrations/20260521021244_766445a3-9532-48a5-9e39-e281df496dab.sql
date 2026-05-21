
-- Delivery: read quotations for any stop on an assigned trip
CREATE POLICY "Quotations read by assigned driver"
  ON public.quotations FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND has_role(auth.uid(), 'delivery'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.trip_quotations tq
      JOIN public.trips t ON t.id = tq.trip_id
      WHERE tq.quotation_id = quotations.id
        AND t.assigned_driver_id = auth.uid()
        AND t.deleted_at IS NULL
    )
  );

-- Delivery: read line items for those same quotations
CREATE POLICY "Items read by assigned driver"
  ON public.quotation_items FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'delivery'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.trip_quotations tq
      JOIN public.trips t ON t.id = tq.trip_id
      WHERE tq.quotation_id = quotation_items.quotation_id
        AND t.assigned_driver_id = auth.uid()
        AND t.deleted_at IS NULL
    )
  );
