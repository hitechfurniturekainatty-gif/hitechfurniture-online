-- A trip stop records the item rows actually received, never the whole quotation.
ALTER TABLE public.trip_quotations ADD COLUMN IF NOT EXISTS delivered_item_ids uuid[];
CREATE SCHEMA IF NOT EXISTS private;
CREATE OR REPLACE FUNCTION private.record_trip_item_delivery()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE t public.trips%ROWTYPE; q public.quotations%ROWTYPE; n integer;
BEGIN
  IF NEW.trip_id IS DISTINCT FROM OLD.trip_id OR NEW.quotation_id IS DISTINCT FROM OLD.quotation_id THEN
    RAISE EXCEPTION 'A delivery stop cannot be moved to another trip or quotation';
  END IF;
  IF OLD.delivered_at IS NOT NULL THEN
    IF NEW.delivered_at IS NULL OR NEW.delivered_item_ids IS DISTINCT FROM OLD.delivered_item_ids THEN
      RAISE EXCEPTION 'Completed delivery records cannot be overwritten';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.delivered_at IS NULL THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to record delivery'; END IF;
  SELECT * INTO t FROM public.trips WHERE id=NEW.trip_id FOR UPDATE;
  IF t.deleted_at IS NOT NULL OR t.status='cancelled' OR NOT coalesce((
    public.has_role(auth.uid(),'admin'::public.app_role) OR
    public.has_role(auth.uid(),'staff'::public.app_role) OR
    (public.has_role(auth.uid(),'delivery'::public.app_role) AND t.assigned_driver_id=auth.uid())
  ),false) THEN RAISE EXCEPTION 'Not authorized for this delivery trip'; END IF;
  SELECT * INTO q FROM public.quotations WHERE id=NEW.quotation_id FOR UPDATE;
  IF q.deleted_at IS NOT NULL OR q.status='rejected' OR coalesce(q.document_type,'quotation')='po' THEN
    RAISE EXCEPTION 'Quotation is not deliverable';
  END IF;
  IF NOT (coalesce(q.status,'') IN ('finalized','delivered','completed') OR coalesce(q.commercial_status,'') IN ('confirmed','payment_pending','closed','delivered')) THEN
    RAISE EXCEPTION 'Confirm the order before recording delivery';
  END IF;
  n := cardinality(NEW.delivered_item_ids);
  IF coalesce(n,0)=0 THEN RAISE EXCEPTION 'Select the received items; refresh the delivery page if no selection is shown'; END IF;
  IF (SELECT count(DISTINCT x) FROM unnest(NEW.delivered_item_ids) x)<>n THEN
    RAISE EXCEPTION 'Duplicate or empty item selection';
  END IF;
  PERFORM id FROM public.quotation_items WHERE quotation_id=q.id ORDER BY id FOR UPDATE;
  IF (SELECT count(*) FROM public.quotation_items i WHERE i.quotation_id=q.id AND i.id=ANY(NEW.delivered_item_ids)
      AND i.delivered_at IS NULL)=n THEN
    IF EXISTS (SELECT 1 FROM public.quotation_items i WHERE i.id=ANY(NEW.delivered_item_ids)
      AND (coalesce(i.cancelled_qty,0)>0 OR (coalesce(i.ordered_qty,0)>0 AND i.ordered_qty<i.quantity))) THEN
      RAISE EXCEPTION 'This row has partially ordered or cancelled quantities; split it before recording full-row delivery';
    END IF;
    IF (SELECT count(*) FROM public.warehouse_order_items w WHERE w.id=ANY(NEW.delivered_item_ids)
        AND w.order_confirmed AND w.warehouse_ready)<>n THEN
      RAISE EXCEPTION 'Selected items must be confirmed and warehouse ready';
    END IF;
  ELSE
    RAISE EXCEPTION 'Selection includes unavailable, already delivered or unrelated items';
  END IF;
  NEW.delivered_at := now();
  UPDATE public.quotation_items SET delivered_at=NEW.delivered_at
    WHERE quotation_id=q.id AND id=ANY(NEW.delivered_item_ids) AND delivered_at IS NULL;
  -- Existing item-completion triggers close the quotation only after its last item.
  IF NOT EXISTS (SELECT 1 FROM public.quotation_items WHERE quotation_id=q.id AND delivered_at IS NULL) THEN
    UPDATE public.quotations SET status='delivered',pipeline_stage=6,updated_at=now() WHERE id=q.id;
  END IF;
  UPDATE public.trips SET status=CASE WHEN EXISTS (
    SELECT 1 FROM public.trip_quotations WHERE trip_id=NEW.trip_id AND id<>NEW.id AND delivered_at IS NULL
  ) THEN 'in_transit' ELSE 'delivered' END WHERE id=NEW.trip_id;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.record_trip_item_delivery() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_trip_quotations_mark_delivered ON public.trip_quotations;
CREATE TRIGGER trg_trip_quotations_mark_delivered BEFORE UPDATE ON public.trip_quotations
FOR EACH ROW EXECUTE FUNCTION private.record_trip_item_delivery();
-- Retire the blanket writer; it must not remain executable as an API function.
REVOKE ALL ON FUNCTION public.trip_quotations_mark_delivered() FROM PUBLIC, anon, authenticated;

-- Completion remains in Logistics (6); 7 violates both existing stage constraints.
DO $migration$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.quotations_delivery_review_notify()'::regprocedure) INTO definition;
  IF position('7::smallint' in definition)>0 THEN
    EXECUTE replace(definition,'7::smallint','6::smallint');
  END IF;
END $migration$;
