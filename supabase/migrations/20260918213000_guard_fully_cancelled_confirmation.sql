-- Prevent a fully-cancelled quotation from being falsely reported as confirmed.
CREATE OR REPLACE FUNCTION public.confirm_quotation_to_order(_quotation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $confirm$
DECLARE
  _q public.quotations%ROWTYPE;
  _item public.quotation_items%ROWTYPE;
  _before public.quotation_items%ROWTYPE;
  _remaining numeric;
  _request_key uuid := gen_random_uuid();
  _label text;
  _orderable_count integer;
BEGIN
  IF NOT (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'staff'::app_role)
  ) THEN
    RAISE EXCEPTION 'Only admin or office staff can confirm a quotation';
  END IF;

  SELECT * INTO _q
  FROM public.quotations
  WHERE id=_quotation_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',false,'error','quotation_not_found');
  END IF;

  IF _q.status IN ('rejected','delivered') THEN
    RETURN jsonb_build_object('ok',false,'error','quotation_not_confirmable','status',_q.status);
  END IF;

  SELECT count(*) INTO _orderable_count
  FROM public.quotation_items
  WHERE quotation_id=_quotation_id
    AND (
      COALESCE(ordered_qty,0)>0
      OR COALESCE(quantity,0)-COALESCE(ordered_qty,0)-COALESCE(cancelled_qty,0)>0
    );

  IF _orderable_count=0 THEN
    RETURN jsonb_build_object('ok',false,'error','no_orderable_items');
  END IF;

  IF _q.item_conversion_status='converted'
     AND _q.commercial_status IN ('confirmed','payment_pending','closed') THEN
    RETURN jsonb_build_object(
      'ok',true,'already_confirmed',true,'id',_q.id,'status',_q.status,
      'commercial_status',_q.commercial_status,'pipeline_stage',_q.pipeline_stage,
      'confirmed_at',_q.confirmed_at
    );
  END IF;

  FOR _item IN
    SELECT * FROM public.quotation_items
    WHERE quotation_id=_quotation_id
    FOR UPDATE
  LOOP
    _remaining := GREATEST(
      COALESCE(_item.quantity,0)
      - COALESCE(_item.ordered_qty,0)
      - COALESCE(_item.cancelled_qty,0),
      0
    );

    IF _remaining<=0 OR _item.conversion_status IN ('lost','closed') THEN
      CONTINUE;
    END IF;

    _before := _item;

    INSERT INTO public.quotation_item_order_conversions(
      quotation_id,quotation_item_id,converted_qty,request_key,converted_by
    )
    VALUES(_quotation_id,_item.id,_remaining,_request_key,auth.uid());

    UPDATE public.quotation_items
    SET ordered_qty=COALESCE(ordered_qty,0)+_remaining,
        converted_at=COALESCE(converted_at,now()),
        converted_by=COALESCE(converted_by,auth.uid())
    WHERE id=_item.id;

    PERFORM public.refresh_quotation_item_conversion_state(_item.id);
    SELECT * INTO _item FROM public.quotation_items WHERE id=_item.id;

    INSERT INTO public.quotation_item_status_events(
      quotation_id,quotation_item_id,event_type,
      from_status,to_status,
      from_ordered_qty,to_ordered_qty,
      from_cancelled_qty,to_cancelled_qty,
      changed_by,metadata
    ) VALUES(
      _quotation_id,_item.id,'full_confirmation',
      _before.conversion_status,_item.conversion_status,
      _before.ordered_qty,_item.ordered_qty,
      _before.cancelled_qty,_item.cancelled_qty,
      auth.uid(),
      jsonb_build_object('request_key',_request_key,'converted_qty',_remaining)
    );
  END LOOP;

  UPDATE public.quotations
  SET status='finalized',
      pipeline_stage=GREATEST(COALESCE(pipeline_stage,1),3),
      updated_at=now()
  WHERE id=_quotation_id;

  PERFORM public.refresh_quotation_commercial_state(_quotation_id);

  _label := COALESCE(_q.party_name,'Customer') || ' — ' || COALESCE(_q.party_place,'');

  IF COALESCE(_q.pipeline_stage,1)<3 THEN
    INSERT INTO public.pipeline_notifications(
      quotation_id,stage,target_role,title,body,source_type,source_id
    )
    VALUES(
      _quotation_id,3,'staff'::app_role,'Order confirmed',_label,
      'quotation',_quotation_id
    );
  END IF;

  SELECT * INTO _q FROM public.quotations WHERE id=_quotation_id;

  RETURN jsonb_build_object(
    'ok',true,'already_confirmed',false,'id',_q.id,'status',_q.status,
    'commercial_status',_q.commercial_status,'pipeline_stage',_q.pipeline_stage,
    'confirmed_at',_q.confirmed_at,'item_conversion_status',_q.item_conversion_status
  );
END;
$confirm$;

REVOKE ALL ON FUNCTION public.confirm_quotation_to_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_quotation_to_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_quotation_to_order(uuid) TO service_role;
