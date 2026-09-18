-- Item-level partial order conversion + item-level payment allocation.

ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS ordered_qty numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversion_status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS converted_at timestamptz,
  ADD COLUMN IF NOT EXISTS converted_by uuid REFERENCES auth.users(id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='quotation_items_ordered_qty_bounds'
      AND conrelid='public.quotation_items'::regclass
  ) THEN
    ALTER TABLE public.quotation_items
      ADD CONSTRAINT quotation_items_ordered_qty_bounds
      CHECK (ordered_qty >= 0 AND ordered_qty <= quantity);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='quotation_items_conversion_status_check'
      AND conrelid='public.quotation_items'::regclass
  ) THEN
    ALTER TABLE public.quotation_items
      ADD CONSTRAINT quotation_items_conversion_status_check
      CHECK (conversion_status IN ('open','partially_ordered','ordered','lost','closed'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.quotation_item_order_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  quotation_item_id uuid NOT NULL REFERENCES public.quotation_items(id) ON DELETE CASCADE,
  converted_qty numeric NOT NULL CHECK (converted_qty > 0),
  request_key uuid NOT NULL,
  converted_by uuid REFERENCES auth.users(id),
  converted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_key, quotation_item_id)
);

CREATE INDEX IF NOT EXISTS quotation_item_order_conversions_quote_idx
  ON public.quotation_item_order_conversions(quotation_id, converted_at DESC);

ALTER TABLE public.quotation_item_order_conversions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "office read quotation item conversions" ON public.quotation_item_order_conversions;
CREATE POLICY "office read quotation item conversions"
ON public.quotation_item_order_conversions FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(),'admin'::app_role)
  OR public.has_role(auth.uid(),'staff'::app_role)
);

CREATE TABLE IF NOT EXISTS public.quotation_item_payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.receivable_payments(id) ON DELETE CASCADE,
  quotation_id uuid NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  quotation_item_id uuid NOT NULL REFERENCES public.quotation_items(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  allocated_by uuid REFERENCES auth.users(id),
  allocated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_id, quotation_item_id)
);

CREATE INDEX IF NOT EXISTS quotation_item_payment_allocations_item_idx
  ON public.quotation_item_payment_allocations(quotation_item_id, allocated_at DESC);

ALTER TABLE public.quotation_item_payment_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "office read quotation item payments" ON public.quotation_item_payment_allocations;
CREATE POLICY "office read quotation item payments"
ON public.quotation_item_payment_allocations FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(),'admin'::app_role)
  OR public.has_role(auth.uid(),'staff'::app_role)
);

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
  _requested numeric;
  _remaining numeric;
  _inserted integer;
  _converted_count integer := 0;
  _all_done boolean;
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

    _remaining := GREATEST(COALESCE(_item.quantity,0)-COALESCE(_item.ordered_qty,0),0);

    INSERT INTO public.quotation_item_order_conversions(
      quotation_id,quotation_item_id,converted_qty,request_key,converted_by
    )
    VALUES (_quotation_id,_item.id,_requested,_request_key,auth.uid())
    ON CONFLICT (request_key,quotation_item_id) DO NOTHING;

    GET DIAGNOSTICS _inserted = ROW_COUNT;
    IF _inserted = 0 THEN
      CONTINUE;
    END IF;

    IF _requested > _remaining THEN
      RAISE EXCEPTION 'Requested quantity exceeds remaining quantity for item %', _item.id;
    END IF;

    UPDATE public.quotation_items
    SET ordered_qty = ordered_qty + _requested,
        conversion_status = CASE
          WHEN ordered_qty + _requested >= quantity THEN 'ordered'
          ELSE 'partially_ordered'
        END,
        converted_at = COALESCE(converted_at,now()),
        converted_by = COALESCE(converted_by,auth.uid())
    WHERE id=_item.id;

    _converted_count := _converted_count + 1;
  END LOOP;

  IF _converted_count > 0 THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM public.quotation_items
      WHERE quotation_id=_quotation_id
        AND conversion_status NOT IN ('ordered','lost','closed')
    ) INTO _all_done;

    UPDATE public.quotations
    SET pipeline_stage = GREATEST(COALESCE(pipeline_stage,1),3),
        status = 'finalized',
        commercial_status = CASE WHEN _all_done THEN 'confirmed' ELSE 'partially_converted' END,
        confirmed_at = CASE WHEN _all_done THEN COALESCE(confirmed_at,now()) ELSE confirmed_at END,
        updated_at = now()
    WHERE id=_quotation_id;

    INSERT INTO public.pipeline_notifications(quotation_id,stage,target_role,title,body)
    SELECT _quotation_id,3,'staff'::app_role,'Order items converted',
           COALESCE(_q.party_name,'Customer') || ' — selected quotation items moved to Order / OPS'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.pipeline_notifications
      WHERE quotation_id=_quotation_id
        AND title='Order items converted'
        AND created_at > now() - interval '5 seconds'
    );
  END IF;

  RETURN jsonb_build_object(
    'ok',true,
    'converted_items',_converted_count,
    'commercial_status',(
      SELECT commercial_status FROM public.quotations WHERE id=_quotation_id
    ),
    'pipeline_stage',(
      SELECT pipeline_stage FROM public.quotations WHERE id=_quotation_id
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.convert_quotation_items_to_order(uuid,jsonb,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_quotation_items_to_order(uuid,jsonb,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_quotation_items_to_order(uuid,jsonb,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.allocate_payment_to_quotation_items(
  _payment_id uuid,
  _allocations jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  _payment public.receivable_payments%ROWTYPE;
  _entry jsonb;
  _item public.quotation_items%ROWTYPE;
  _amount numeric;
  _requested_total numeric := 0;
  _existing_other numeric := 0;
BEGIN
  IF NOT (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'staff'::app_role)
  ) THEN
    RAISE EXCEPTION 'Only admin or office staff can allocate payments';
  END IF;

  SELECT * INTO _payment
  FROM public.receivable_payments
  WHERE id=_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',false,'error','payment_not_found');
  END IF;

  SELECT COALESCE(sum(amount),0) INTO _existing_other
  FROM public.quotation_item_payment_allocations
  WHERE payment_id=_payment_id
    AND quotation_item_id NOT IN (
      SELECT (x->>'item_id')::uuid
      FROM jsonb_array_elements(COALESCE(_allocations,'[]'::jsonb)) x
    );

  FOR _entry IN SELECT * FROM jsonb_array_elements(COALESCE(_allocations,'[]'::jsonb))
  LOOP
    _amount := COALESCE((_entry->>'amount')::numeric,0);
    IF _amount < 0 THEN RAISE EXCEPTION 'Allocation cannot be negative'; END IF;
    IF _amount = 0 THEN CONTINUE; END IF;

    SELECT * INTO _item
    FROM public.quotation_items
    WHERE id=(_entry->>'item_id')::uuid
      AND quotation_id=_payment.quotation_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Payment allocation item does not belong to this quotation';
    END IF;

    _requested_total := _requested_total + _amount;
  END LOOP;

  IF _existing_other + _requested_total > _payment.amount THEN
    RAISE EXCEPTION 'Item allocations exceed payment amount';
  END IF;

  FOR _entry IN SELECT * FROM jsonb_array_elements(COALESCE(_allocations,'[]'::jsonb))
  LOOP
    _amount := COALESCE((_entry->>'amount')::numeric,0);
    IF _amount = 0 THEN
      DELETE FROM public.quotation_item_payment_allocations
      WHERE payment_id=_payment_id
        AND quotation_item_id=(_entry->>'item_id')::uuid;
    ELSE
      INSERT INTO public.quotation_item_payment_allocations(
        payment_id,quotation_id,quotation_item_id,amount,allocated_by
      )
      VALUES(
        _payment_id,_payment.quotation_id,(_entry->>'item_id')::uuid,_amount,auth.uid()
      )
      ON CONFLICT(payment_id,quotation_item_id)
      DO UPDATE SET amount=EXCLUDED.amount, allocated_by=auth.uid(), allocated_at=now();
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok',true,
    'allocated_total',(
      SELECT COALESCE(sum(amount),0)
      FROM public.quotation_item_payment_allocations
      WHERE payment_id=_payment_id
    ),
    'payment_amount',_payment.amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_payment_to_quotation_items(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.allocate_payment_to_quotation_items(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_payment_to_quotation_items(uuid,jsonb) TO service_role;

-- Keep full quotation confirmation consistent with item-level conversion state.
CREATE OR REPLACE FUNCTION public.confirm_quotation_to_order(_quotation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  _q public.quotations%ROWTYPE;
  _label text;
  _request_key uuid := gen_random_uuid();
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

  IF COALESCE(_q.pipeline_stage,1)>=3
     AND _q.status='finalized'
     AND _q.commercial_status='confirmed'
     AND NOT EXISTS (
       SELECT 1 FROM public.quotation_items
       WHERE quotation_id=_quotation_id
         AND conversion_status NOT IN ('ordered','lost','closed')
     ) THEN
    RETURN jsonb_build_object(
      'ok',true,'already_confirmed',true,'id',_q.id,'status',_q.status,
      'commercial_status',_q.commercial_status,'pipeline_stage',_q.pipeline_stage,
      'confirmed_at',_q.confirmed_at
    );
  END IF;

  INSERT INTO public.quotation_item_order_conversions(
    quotation_id,quotation_item_id,converted_qty,request_key,converted_by
  )
  SELECT _quotation_id,id,GREATEST(quantity-ordered_qty,0),_request_key,auth.uid()
  FROM public.quotation_items
  WHERE quotation_id=_quotation_id
    AND conversion_status NOT IN ('lost','closed','ordered')
    AND quantity>ordered_qty;

  UPDATE public.quotation_items
  SET ordered_qty=quantity,
      conversion_status='ordered',
      converted_at=COALESCE(converted_at,now()),
      converted_by=COALESCE(converted_by,auth.uid())
  WHERE quotation_id=_quotation_id
    AND conversion_status NOT IN ('lost','closed','ordered');

  UPDATE public.quotations
  SET status='finalized',
      commercial_status='confirmed',
      confirmed_at=COALESCE(confirmed_at,now()),
      pipeline_stage=GREATEST(COALESCE(pipeline_stage,1),3),
      updated_at=now()
  WHERE id=_quotation_id;

  _label := COALESCE(_q.party_name,'Customer') || ' — ' || COALESCE(_q.party_place,'');

  IF COALESCE(_q.pipeline_stage,1)<3 THEN
    INSERT INTO public.pipeline_notifications(quotation_id,stage,target_role,title,body)
    VALUES(_quotation_id,3,'staff'::app_role,'Order confirmed',_label);
  END IF;

  SELECT * INTO _q FROM public.quotations WHERE id=_quotation_id;

  RETURN jsonb_build_object(
    'ok',true,'already_confirmed',false,'id',_q.id,'status',_q.status,
    'commercial_status',_q.commercial_status,'pipeline_stage',_q.pipeline_stage,
    'confirmed_at',_q.confirmed_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_quotation_to_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_quotation_to_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_quotation_to_order(uuid) TO service_role;
