-- Complete safeguards for partial item conversion, cancellation/reopen, audit, and atomic item-level payments.

ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS cancelled_qty numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES auth.users(id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='quotation_items_conversion_qty_bounds'
      AND conrelid='public.quotation_items'::regclass
  ) THEN
    ALTER TABLE public.quotation_items
      ADD CONSTRAINT quotation_items_conversion_qty_bounds
      CHECK (
        ordered_qty >= 0
        AND cancelled_qty >= 0
        AND ordered_qty + cancelled_qty <= quantity
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.quotation_item_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  quotation_item_id uuid NOT NULL REFERENCES public.quotation_items(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_status text,
  to_status text,
  from_ordered_qty numeric,
  to_ordered_qty numeric,
  from_cancelled_qty numeric,
  to_cancelled_qty numeric,
  reason text,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS quotation_item_status_events_item_idx
  ON public.quotation_item_status_events(quotation_item_id, changed_at DESC);

ALTER TABLE public.quotation_item_status_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "office read item status events" ON public.quotation_item_status_events;
CREATE POLICY "office read item status events"
ON public.quotation_item_status_events FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(),'admin'::app_role)
  OR public.has_role(auth.uid(),'staff'::app_role)
);

ALTER TABLE public.receivable_payments
  ADD COLUMN IF NOT EXISTS client_request_key uuid;

CREATE UNIQUE INDEX IF NOT EXISTS receivable_payments_client_request_key_key
  ON public.receivable_payments(client_request_key)
  WHERE client_request_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.refresh_quotation_item_conversion_state(_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  _i public.quotation_items%ROWTYPE;
  _next text;
BEGIN
  SELECT * INTO _i
  FROM public.quotation_items
  WHERE id=_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  _next := CASE
    WHEN COALESCE(_i.ordered_qty,0) >= COALESCE(_i.quantity,0) THEN 'ordered'
    WHEN COALESCE(_i.ordered_qty,0) > 0
         AND COALESCE(_i.ordered_qty,0) + COALESCE(_i.cancelled_qty,0) >= COALESCE(_i.quantity,0) THEN 'closed'
    WHEN COALESCE(_i.ordered_qty,0) > 0 THEN 'partially_ordered'
    WHEN COALESCE(_i.cancelled_qty,0) >= COALESCE(_i.quantity,0) THEN 'lost'
    ELSE 'open'
  END;

  UPDATE public.quotation_items
  SET conversion_status=_next
  WHERE id=_item_id;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_quotation_item_conversion_state(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_quotation_item_conversion_state(uuid) TO service_role;

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
    )
  INTO _has_open,_has_ordered,_all_terminal;

  UPDATE public.quotations
  SET commercial_status = CASE
        WHEN _has_ordered AND _has_open THEN 'partially_converted'
        WHEN _has_ordered AND _all_terminal THEN 'confirmed'
        WHEN NOT _has_ordered AND _all_terminal THEN 'lost'
        ELSE commercial_status
      END,
      confirmed_at = CASE
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

CREATE OR REPLACE FUNCTION public.convert_quotation_items_to_order(
  _quotation_id uuid,
  _items jsonb,
  _request_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  _q public.quotations%ROWTYPE;
  _entry jsonb;
  _item public.quotation_items%ROWTYPE;
  _before public.quotation_items%ROWTYPE;
  _requested numeric;
  _remaining numeric;
  _inserted integer;
  _converted_count integer := 0;
BEGIN
  IF NOT (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'staff'::app_role)
  ) THEN
    RAISE EXCEPTION 'Only admin or office staff can convert quotation items';
  END IF;

  SELECT * INTO _q
  FROM public.quotations
  WHERE id=_quotation_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',false,'error','quotation_not_found');
  END IF;

  IF _q.status IN ('rejected','delivered') THEN
    RETURN jsonb_build_object('ok',false,'error','quotation_not_convertible');
  END IF;

  FOR _entry IN SELECT * FROM jsonb_array_elements(COALESCE(_items,'[]'::jsonb))
  LOOP
    _requested := COALESCE((_entry->>'quantity')::numeric,0);
    IF _requested <= 0 THEN CONTINUE; END IF;

    SELECT * INTO _item
    FROM public.quotation_items
    WHERE id=(_entry->>'item_id')::uuid
      AND quotation_id=_quotation_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Quotation item not found';
    END IF;

    IF _item.conversion_status IN ('lost','closed') THEN
      RAISE EXCEPTION 'Quotation item % is closed/lost', _item.id;
    END IF;

    _remaining := GREATEST(
      COALESCE(_item.quantity,0)
      - COALESCE(_item.ordered_qty,0)
      - COALESCE(_item.cancelled_qty,0),
      0
    );

    IF _requested > _remaining THEN
      RAISE EXCEPTION 'Requested quantity exceeds remaining quantity for item %', _item.id;
    END IF;

    INSERT INTO public.quotation_item_order_conversions(
      quotation_id,quotation_item_id,converted_qty,request_key,converted_by
    )
    VALUES (_quotation_id,_item.id,_requested,_request_key,auth.uid())
    ON CONFLICT (request_key,quotation_item_id) DO NOTHING;

    GET DIAGNOSTICS _inserted = ROW_COUNT;
    IF _inserted = 0 THEN
      CONTINUE;
    END IF;

    _before := _item;

    UPDATE public.quotation_items
    SET ordered_qty = COALESCE(ordered_qty,0) + _requested,
        converted_at = COALESCE(converted_at,now()),
        converted_by = COALESCE(converted_by,auth.uid())
    WHERE id=_item.id;

    PERFORM public.refresh_quotation_item_conversion_state(_item.id);

    SELECT * INTO _item FROM public.quotation_items WHERE id=_item.id;

    INSERT INTO public.quotation_item_status_events(
      quotation_id,quotation_item_id,event_type,
      from_status,to_status,
      from_ordered_qty,to_ordered_qty,
      from_cancelled_qty,to_cancelled_qty,
      changed_by,metadata
    ) VALUES (
      _quotation_id,_item.id,'converted_to_order',
      _before.conversion_status,_item.conversion_status,
      _before.ordered_qty,_item.ordered_qty,
      _before.cancelled_qty,_item.cancelled_qty,
      auth.uid(),
      jsonb_build_object('request_key',_request_key,'converted_qty',_requested)
    );

    _converted_count := _converted_count + 1;
  END LOOP;

  IF _converted_count > 0 THEN
    UPDATE public.quotations
    SET pipeline_stage=GREATEST(COALESCE(pipeline_stage,1),3),
        status='finalized',
        updated_at=now()
    WHERE id=_quotation_id;

    PERFORM public.refresh_quotation_commercial_state(_quotation_id);

    INSERT INTO public.pipeline_notifications(
      quotation_id,stage,target_role,title,body,source_type,source_id
    )
    SELECT
      _quotation_id,3,'staff'::app_role,'Order items converted',
      COALESCE(_q.party_name,'Customer') || ' — selected quotation items moved to Order / OPS',
      'quotation',_quotation_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.pipeline_notifications
      WHERE quotation_id=_quotation_id
        AND source_type='quotation'
        AND source_id=_quotation_id
        AND title='Order items converted'
        AND created_at > now()-interval '5 seconds'
    );
  END IF;

  RETURN jsonb_build_object(
    'ok',true,
    'converted_items',_converted_count,
    'commercial_status',(SELECT commercial_status FROM public.quotations WHERE id=_quotation_id),
    'pipeline_stage',(SELECT pipeline_stage FROM public.quotations WHERE id=_quotation_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.convert_quotation_items_to_order(uuid,jsonb,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_quotation_items_to_order(uuid,jsonb,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_quotation_items_to_order(uuid,jsonb,uuid) TO service_role;

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
  _active_jobs integer;
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

  SELECT * INTO _item
  FROM public.quotation_items
  WHERE id=_item_id
  FOR UPDATE;

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

  SELECT count(*) INTO _active_jobs
  FROM public.job_work_orders
  WHERE quotation_id=_item.quotation_id
    AND _item.id = ANY(item_ids)
    AND deleted_at IS NULL
    AND status NOT IN ('completed','cancelled','ready')
    AND COALESCE(warehouse_status,'none') <> 'dispatched';

  IF _active_jobs > 0 THEN
    RETURN jsonb_build_object('ok',false,'error','active_job_exists');
  END IF;

  _remaining := GREATEST(
    COALESCE(_item.quantity,0)
    - COALESCE(_item.ordered_qty,0)
    - COALESCE(_item.cancelled_qty,0),
    0
  );

  IF _remaining <= 0 THEN
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
    from_status,to_status,
    from_ordered_qty,to_ordered_qty,
    from_cancelled_qty,to_cancelled_qty,
    reason,changed_by
  ) VALUES (
    _item.quotation_id,_item.id,'remaining_cancelled',
    _before.conversion_status,_item.conversion_status,
    _before.ordered_qty,_item.ordered_qty,
    _before.cancelled_qty,_item.cancelled_qty,
    btrim(_reason),auth.uid()
  );

  RETURN jsonb_build_object(
    'ok',true,
    'cancelled_qty',_remaining,
    'conversion_status',_item.conversion_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_quotation_item_remaining(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_quotation_item_remaining(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_quotation_item_remaining(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.reopen_quotation_item_cancelled(
  _item_id uuid,
  _reason text DEFAULT NULL
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
BEGIN
  IF NOT (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'staff'::app_role)
  ) THEN
    RAISE EXCEPTION 'Only admin or office staff can reopen quotation item quantities';
  END IF;

  SELECT * INTO _item
  FROM public.quotation_items
  WHERE id=_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',false,'error','item_not_found');
  END IF;

  SELECT * INTO _q FROM public.quotations WHERE id=_item.quotation_id FOR UPDATE;

  IF _q.status IN ('rejected','delivered') THEN
    RETURN jsonb_build_object('ok',false,'error','quotation_locked');
  END IF;

  IF COALESCE(_item.cancelled_qty,0) <= 0 THEN
    RETURN jsonb_build_object('ok',true,'already_open',true);
  END IF;

  IF _item.dispatched_at IS NOT NULL OR _item.delivered_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok',false,'error','item_already_dispatched_or_delivered');
  END IF;

  _before := _item;

  UPDATE public.quotation_items
  SET cancelled_qty=0,
      cancellation_reason=NULL,
      cancelled_at=NULL,
      cancelled_by=NULL
  WHERE id=_item.id;

  PERFORM public.refresh_quotation_item_conversion_state(_item.id);
  PERFORM public.refresh_quotation_commercial_state(_item.quotation_id);

  SELECT * INTO _item FROM public.quotation_items WHERE id=_item.id;

  INSERT INTO public.quotation_item_status_events(
    quotation_id,quotation_item_id,event_type,
    from_status,to_status,
    from_ordered_qty,to_ordered_qty,
    from_cancelled_qty,to_cancelled_qty,
    reason,changed_by
  ) VALUES (
    _item.quotation_id,_item.id,'cancelled_quantity_reopened',
    _before.conversion_status,_item.conversion_status,
    _before.ordered_qty,_item.ordered_qty,
    _before.cancelled_qty,_item.cancelled_qty,
    NULLIF(btrim(COALESCE(_reason,'')),''),
    auth.uid()
  );

  RETURN jsonb_build_object(
    'ok',true,
    'reopened_qty',_before.cancelled_qty,
    'conversion_status',_item.conversion_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reopen_quotation_item_cancelled(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reopen_quotation_item_cancelled(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_quotation_item_cancelled(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.record_order_payment(
  _receivable_id uuid,
  _amount numeric,
  _payment_method text,
  _reference_no text,
  _note text,
  _allocations jsonb,
  _request_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  _r public.receivables%ROWTYPE;
  _existing public.receivable_payments%ROWTYPE;
  _payment public.receivable_payments%ROWTYPE;
  _entry jsonb;
  _item public.quotation_items%ROWTYPE;
  _allocation_amount numeric;
  _allocation_total numeric := 0;
BEGIN
  IF NOT (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'staff'::app_role)
  ) THEN
    RAISE EXCEPTION 'Only admin or office staff can record order payments';
  END IF;

  IF _request_key IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','request_key_required');
  END IF;

  SELECT * INTO _existing
  FROM public.receivable_payments
  WHERE client_request_key=_request_key;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok',true,
      'already_recorded',true,
      'payment_id',_existing.id,
      'amount',_existing.amount
    );
  END IF;

  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN jsonb_build_object('ok',false,'error','invalid_amount');
  END IF;

  SELECT * INTO _r
  FROM public.receivables
  WHERE id=_receivable_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',false,'error','receivable_not_found');
  END IF;

  IF _r.source <> 'quotation' OR _r.quotation_id IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','not_order_receivable');
  END IF;

  IF _r.closed_at IS NOT NULL OR COALESCE(_r.pending_amount,0) <= 0 THEN
    RETURN jsonb_build_object('ok',false,'error','receivable_closed');
  END IF;

  IF _amount > _r.pending_amount THEN
    RETURN jsonb_build_object(
      'ok',false,'error','amount_exceeds_pending',
      'pending_amount',_r.pending_amount
    );
  END IF;

  FOR _entry IN SELECT * FROM jsonb_array_elements(COALESCE(_allocations,'[]'::jsonb))
  LOOP
    _allocation_amount := COALESCE((_entry->>'amount')::numeric,0);
    IF _allocation_amount < 0 THEN
      RETURN jsonb_build_object('ok',false,'error','negative_allocation');
    END IF;
    IF _allocation_amount = 0 THEN CONTINUE; END IF;

    SELECT * INTO _item
    FROM public.quotation_items
    WHERE id=(_entry->>'item_id')::uuid
      AND quotation_id=_r.quotation_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok',false,'error','allocation_item_not_in_order');
    END IF;

    IF COALESCE(_item.ordered_qty,0) <= 0 THEN
      RETURN jsonb_build_object(
        'ok',false,'error','allocation_item_not_ordered',
        'item_id',_item.id
      );
    END IF;

    _allocation_total := _allocation_total + _allocation_amount;
  END LOOP;

  IF _allocation_total > _amount THEN
    RETURN jsonb_build_object(
      'ok',false,'error','allocations_exceed_payment',
      'allocation_total',_allocation_total,
      'payment_amount',_amount
    );
  END IF;

  INSERT INTO public.receivable_payments(
    receivable_id,quotation_id,amount,payment_method,reference_no,note,
    received_by,client_request_key
  )
  VALUES(
    _r.id,_r.quotation_id,_amount,NULLIF(_payment_method,''),
    NULLIF(btrim(COALESCE(_reference_no,'')),''),
    NULLIF(btrim(COALESCE(_note,'')),''),
    auth.uid(),_request_key
  )
  RETURNING * INTO _payment;

  FOR _entry IN SELECT * FROM jsonb_array_elements(COALESCE(_allocations,'[]'::jsonb))
  LOOP
    _allocation_amount := COALESCE((_entry->>'amount')::numeric,0);
    IF _allocation_amount <= 0 THEN CONTINUE; END IF;

    INSERT INTO public.quotation_item_payment_allocations(
      payment_id,quotation_id,quotation_item_id,amount,allocated_by
    )
    VALUES(
      _payment.id,_r.quotation_id,(_entry->>'item_id')::uuid,
      _allocation_amount,auth.uid()
    );
  END LOOP;

  RETURN jsonb_build_object(
    'ok',true,
    'already_recorded',false,
    'payment_id',_payment.id,
    'amount',_payment.amount,
    'allocated_total',_allocation_total,
    'unallocated_amount',_payment.amount-_allocation_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_order_payment(uuid,numeric,text,text,text,jsonb,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_order_payment(uuid,numeric,text,text,text,jsonb,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_order_payment(uuid,numeric,text,text,text,jsonb,uuid) TO service_role;

-- Legacy allocator is no longer exposed to app users; all new writes use the atomic payment RPC.
REVOKE EXECUTE ON FUNCTION public.allocate_payment_to_quotation_items(uuid,jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_payment_to_quotation_items(uuid,jsonb) TO service_role;
