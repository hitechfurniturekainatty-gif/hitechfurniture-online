-- Keep item-conversion lifecycle separate from sales/payment commercial_status.

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS item_conversion_status text NOT NULL DEFAULT 'open';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='quotations_item_conversion_status_check'
      AND conrelid='public.quotations'::regclass
  ) THEN
    ALTER TABLE public.quotations
      ADD CONSTRAINT quotations_item_conversion_status_check
      CHECK (item_conversion_status IN ('open','partial','converted','lost'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.refresh_quotation_commercial_state(_quotation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  _has_open boolean;
  _has_ordered boolean;
  _all_terminal boolean;
  _all_lost boolean;
  _item_state text;
BEGIN
  SELECT
    EXISTS(
      SELECT 1 FROM public.quotation_items
      WHERE quotation_id=_quotation_id
        AND COALESCE(ordered_qty,0)+COALESCE(cancelled_qty,0) < quantity
        AND conversion_status NOT IN ('lost','closed')
    ),
    EXISTS(
      SELECT 1 FROM public.quotation_items
      WHERE quotation_id=_quotation_id
        AND COALESCE(ordered_qty,0) > 0
    ),
    NOT EXISTS(
      SELECT 1 FROM public.quotation_items
      WHERE quotation_id=_quotation_id
        AND conversion_status NOT IN ('ordered','lost','closed')
    ),
    NOT EXISTS(
      SELECT 1 FROM public.quotation_items
      WHERE quotation_id=_quotation_id
        AND conversion_status <> 'lost'
    )
  INTO _has_open,_has_ordered,_all_terminal,_all_lost;

  _item_state := CASE
    WHEN _all_lost THEN 'lost'
    WHEN _has_ordered AND _all_terminal THEN 'converted'
    WHEN _has_ordered THEN 'partial'
    ELSE 'open'
  END;

  UPDATE public.quotations
  SET item_conversion_status=_item_state,
      commercial_status=CASE
        -- Never erase collection/closure state with a later item conversion.
        WHEN commercial_status IN ('payment_pending','closed') THEN commercial_status
        WHEN _all_lost THEN 'lost'
        WHEN _has_ordered AND _all_terminal THEN 'confirmed'
        WHEN commercial_status='partially_converted' THEN 'quote_preparation'
        ELSE commercial_status
      END,
      confirmed_at=CASE
        WHEN _has_ordered AND _all_terminal THEN COALESCE(confirmed_at,now())
        ELSE confirmed_at
      END,
      updated_at=now()
  WHERE id=_quotation_id
    AND status <> 'delivered';
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_quotation_commercial_state(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_quotation_commercial_state(uuid) TO service_role;

-- Backfill header conversion state from item state.
UPDATE public.quotations q
SET item_conversion_status = CASE
  WHEN NOT EXISTS (
    SELECT 1 FROM public.quotation_items qi
    WHERE qi.quotation_id=q.id AND qi.conversion_status <> 'lost'
  ) THEN 'lost'
  WHEN EXISTS (
    SELECT 1 FROM public.quotation_items qi
    WHERE qi.quotation_id=q.id AND COALESCE(qi.ordered_qty,0)>0
  ) AND NOT EXISTS (
    SELECT 1 FROM public.quotation_items qi
    WHERE qi.quotation_id=q.id AND qi.conversion_status NOT IN ('ordered','lost','closed')
  ) THEN 'converted'
  WHEN EXISTS (
    SELECT 1 FROM public.quotation_items qi
    WHERE qi.quotation_id=q.id AND COALESCE(qi.ordered_qty,0)>0
  ) THEN 'partial'
  ELSE 'open'
END;

UPDATE public.quotations
SET commercial_status='quote_preparation'
WHERE commercial_status='partially_converted';

-- A row-level job has no quantity breakdown, so closing remaining quotation quantity
-- is blocked whenever any non-cancelled job already references that item.
CREATE OR REPLACE FUNCTION public.cancel_quotation_item_remaining(
  _item_id uuid,
  _reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  _item public.quotation_items%ROWTYPE;
  _before public.quotation_items%ROWTYPE;
  _q public.quotations%ROWTYPE;
  _remaining numeric;
  _jobs integer;
BEGIN
  IF NOT (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'staff'::app_role)
  ) THEN
    RAISE EXCEPTION 'Only admin or office staff can close quotation item quantities';
  END IF;

  IF NULLIF(btrim(COALESCE(_reason,'')),'') IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','reason_required');
  END IF;

  SELECT * INTO _item FROM public.quotation_items WHERE id=_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',false,'error','item_not_found');
  END IF;

  SELECT * INTO _q FROM public.quotations WHERE id=_item.quotation_id FOR UPDATE;

  IF _q.status IN ('rejected','delivered') THEN
    RETURN jsonb_build_object('ok',false,'error','quotation_locked');
  END IF;

  IF _item.dispatched_at IS NOT NULL OR _item.delivered_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok',false,'error','item_already_dispatched_or_delivered');
  END IF;

  SELECT count(*) INTO _jobs
  FROM public.job_work_orders
  WHERE quotation_id=_item.quotation_id
    AND _item.id=ANY(item_ids)
    AND deleted_at IS NULL
    AND status <> 'cancelled';

  IF _jobs>0 THEN
    RETURN jsonb_build_object('ok',false,'error','job_exists');
  END IF;

  _remaining := GREATEST(
    COALESCE(_item.quantity,0)-COALESCE(_item.ordered_qty,0)-COALESCE(_item.cancelled_qty,0),
    0
  );

  IF _remaining<=0 THEN
    RETURN jsonb_build_object('ok',true,'already_closed',true);
  END IF;

  _before := _item;

  UPDATE public.quotation_items
  SET cancelled_qty=COALESCE(cancelled_qty,0)+_remaining,
      cancellation_reason=btrim(_reason),
      cancelled_at=COALESCE(cancelled_at,now()),
      cancelled_by=COALESCE(cancelled_by,auth.uid())
  WHERE id=_item.id;

  PERFORM public.refresh_quotation_item_conversion_state(_item.id);
  PERFORM public.refresh_quotation_commercial_state(_item.quotation_id);

  SELECT * INTO _item FROM public.quotation_items WHERE id=_item.id;

  INSERT INTO public.quotation_item_status_events(
    quotation_id,quotation_item_id,event_type,
    from_status,to_status,from_ordered_qty,to_ordered_qty,
    from_cancelled_qty,to_cancelled_qty,reason,changed_by
  ) VALUES(
    _item.quotation_id,_item.id,'remaining_cancelled',
    _before.conversion_status,_item.conversion_status,
    _before.ordered_qty,_item.ordered_qty,
    _before.cancelled_qty,_item.cancelled_qty,
    btrim(_reason),auth.uid()
  );

  RETURN jsonb_build_object(
    'ok',true,'cancelled_qty',_remaining,
    'conversion_status',_item.conversion_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_quotation_item_remaining(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_quotation_item_remaining(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_quotation_item_remaining(uuid,text) TO service_role;
