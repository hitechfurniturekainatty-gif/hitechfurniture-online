-- Confirm an accepted quotation and move the SAME record into the existing Order/OPS pipeline.
-- Idempotent: repeated clicks/retries never create another quotation, customer, item or order row.

CREATE OR REPLACE FUNCTION public.confirm_quotation_to_order(_quotation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _q public.quotations%ROWTYPE;
  _label text;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'staff'::app_role)
  ) THEN
    RAISE EXCEPTION 'Only admin or office staff can confirm a quotation';
  END IF;

  SELECT *
    INTO _q
    FROM public.quotations
   WHERE id = _quotation_id
     AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'quotation_not_found');
  END IF;

  IF _q.status IN ('rejected', 'delivered') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'quotation_not_confirmable', 'status', _q.status);
  END IF;

  -- Retry-safe: if already promoted, return the current row without creating
  -- another notification or changing source/customer/item links.
  IF COALESCE(_q.pipeline_stage, 1) >= 3
     AND _q.status = 'finalized'
     AND _q.commercial_status = 'confirmed' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_confirmed', true,
      'id', _q.id,
      'status', _q.status,
      'commercial_status', _q.commercial_status,
      'pipeline_stage', _q.pipeline_stage,
      'confirmed_at', _q.confirmed_at
    );
  END IF;

  UPDATE public.quotations
     SET status = 'finalized',
         commercial_status = 'confirmed',
         confirmed_at = COALESCE(confirmed_at, now()),
         updated_at = now()
   WHERE id = _quotation_id;

  _label := COALESCE(_q.party_name, 'Customer') || ' — ' || COALESCE(_q.party_place, '');

  -- Reuse the established pipeline transition. It is forward-only and creates
  -- the OPS notification once; it does not copy quotation_items or customer data.
  IF COALESCE(_q.pipeline_stage, 1) < 3 THEN
    PERFORM public.set_quotation_stage(
      _quotation_id,
      3,
      'staff'::app_role,
      'Order confirmed',
      _label
    );
  END IF;

  SELECT * INTO _q FROM public.quotations WHERE id = _quotation_id;

  RETURN jsonb_build_object(
    'ok', true,
    'already_confirmed', false,
    'id', _q.id,
    'status', _q.status,
    'commercial_status', _q.commercial_status,
    'pipeline_stage', _q.pipeline_stage,
    'confirmed_at', _q.confirmed_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_quotation_to_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_quotation_to_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_quotation_to_order(uuid) TO service_role;

COMMENT ON FUNCTION public.confirm_quotation_to_order(uuid) IS
  'Idempotently confirms an accepted quotation and promotes the same record to the existing Stage-3 OPS/order pipeline.';
