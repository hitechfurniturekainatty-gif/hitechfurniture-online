-- Simple "Mark delivered" (2026-11-21)
--
-- Until now an order only became Delivered through a Trip (My Trips), and no trips were
-- being used, so confirmed orders never reached Delivered. This adds one safe step that
-- office staff, admin and drivers can use from the Delivery page or the order page:
--   * stamps the chosen items (default: all not yet delivered) as delivered,
--   * when nothing is left, sets the order to status 'delivered' at stage 6 and records
--     when / by whom. Existing triggers then create the payment balance (receivable) and
--     the "Request Google review" alert, exactly as a trip delivery does,
--   * alerts the office (bell + Telegram via the existing forwarder),
--   * optionally records the payment collected at the door as a delivery_collections
--     entry, which the office verifies on the Delivery Collections page as before.
-- Trips keep working unchanged.

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_by uuid,
  ADD COLUMN IF NOT EXISTS delivery_note text CHECK (delivery_note IS NULL OR length(delivery_note) <= 1000);

CREATE OR REPLACE FUNCTION public.mark_quotation_delivered(
  p_quotation_id uuid,
  p_item_ids uuid[] DEFAULT NULL,
  p_delivered_on date DEFAULT NULL,
  p_delivered_by uuid DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_amount numeric DEFAULT NULL,
  p_method text DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_promise_date date DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  q public.quotations%ROWTYPE;
  v_uid uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_at timestamptz;
  v_by uuid;
  v_ids uuid[];
  v_n int;
  v_left int;
  v_note text := NULLIF(btrim(coalesce(p_note, '')), '');
  v_who text;
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid, 'admin'::public.app_role)
       OR public.has_role(v_uid, 'staff'::public.app_role)
       OR public.has_role(v_uid, 'delivery'::public.app_role)) THEN
    RAISE EXCEPTION 'Only office staff, admin or delivery staff can mark delivery';
  END IF;

  SELECT * INTO q FROM public.quotations WHERE id = p_quotation_id FOR UPDATE;
  IF NOT FOUND OR q.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF q.status = 'rejected' OR coalesce(q.document_type, 'quotation') = 'po' THEN
    RAISE EXCEPTION 'This document cannot be delivered';
  END IF;
  IF NOT (coalesce(q.status, '') IN ('finalized', 'delivered', 'completed')
          OR coalesce(q.commercial_status, '') IN ('confirmed', 'payment_pending', 'closed', 'delivered')) THEN
    RAISE EXCEPTION 'Confirm the order before marking it delivered';
  END IF;

  IF p_delivered_on IS NOT NULL AND p_delivered_on > v_today THEN
    RAISE EXCEPTION 'Delivery date cannot be in the future';
  END IF;
  v_at := CASE WHEN p_delivered_on IS NULL OR p_delivered_on = v_today THEN now()
               ELSE (p_delivered_on::timestamp + time '12:00') AT TIME ZONE 'Asia/Kolkata' END;
  v_by := coalesce(p_delivered_by, v_uid);

  PERFORM 1 FROM public.quotation_items WHERE quotation_id = q.id ORDER BY id FOR UPDATE;
  IF p_item_ids IS NULL OR cardinality(p_item_ids) = 0 THEN
    SELECT array_agg(id) INTO v_ids FROM public.quotation_items WHERE quotation_id = q.id AND delivered_at IS NULL;
  ELSE
    IF (SELECT count(DISTINCT x) FROM unnest(p_item_ids) x) <> cardinality(p_item_ids) THEN
      RAISE EXCEPTION 'Duplicate items selected';
    END IF;
    IF (SELECT count(*) FROM public.quotation_items
         WHERE quotation_id = q.id AND id = ANY(p_item_ids) AND delivered_at IS NULL) <> cardinality(p_item_ids) THEN
      RAISE EXCEPTION 'Some selected items are already delivered or belong to another order';
    END IF;
    v_ids := p_item_ids;
  END IF;
  v_n := coalesce(cardinality(v_ids), 0);
  IF v_n = 0 AND q.status = 'delivered' THEN RAISE EXCEPTION 'This order is already delivered'; END IF;

  IF v_n > 0 THEN
    UPDATE public.quotation_items SET delivered_at = v_at WHERE id = ANY(v_ids) AND delivered_at IS NULL;
  END IF;
  SELECT count(*) INTO v_left FROM public.quotation_items WHERE quotation_id = q.id AND delivered_at IS NULL;

  IF v_left = 0 THEN
    UPDATE public.quotations
       SET status = 'delivered', pipeline_stage = 6,
           delivered_at = coalesce(delivered_at, v_at), delivered_by = coalesce(delivered_by, v_by),
           delivery_note = coalesce(v_note, delivery_note), updated_at = now()
     WHERE id = q.id;
  ELSE
    UPDATE public.quotations
       SET pipeline_stage = GREATEST(coalesce(pipeline_stage, 1), 6)::smallint,
           delivery_note = coalesce(v_note, delivery_note), updated_at = now()
     WHERE id = q.id;
  END IF;

  SELECT display_name INTO v_who FROM public.profiles WHERE user_id = v_by;
  INSERT INTO public.pipeline_notifications (quotation_id, stage, target_role, source_type, source_id, title, body)
  VALUES (q.id, 6, 'admin'::public.app_role, 'delivery', q.id,
          CASE WHEN v_left = 0 THEN 'Order delivered · ' ELSE 'Part delivered · ' END || coalesce(v_who, 'Staff'),
          coalesce(q.party_name, 'Customer') || ' · ' || coalesce(q.party_place, '') || ' · ' || coalesce(q.quotation_id, '')
            || ' — ' || v_n || ' item(s)' || CASE WHEN v_left > 0 THEN ', ' || v_left || ' still pending' ELSE '' END
            || CASE WHEN v_note IS NOT NULL THEN ' · ' || v_note ELSE '' END);

  IF p_method IS NOT NULL THEN
    INSERT INTO public.delivery_collections (quotation_id, amount, method, reference_no, promise_date, note, collected_by, collected_at)
    VALUES (q.id, CASE WHEN p_method = 'none' THEN 0 ELSE coalesce(p_amount, 0) END, p_method,
            NULLIF(btrim(coalesce(p_reference, '')), ''), p_promise_date, v_note, v_by, v_at);
  END IF;

  RETURN jsonb_build_object('ok', true, 'delivered_items', v_n, 'items_left', v_left,
                            'status', CASE WHEN v_left = 0 THEN 'delivered' ELSE q.status END);
END $$;

REVOKE ALL ON FUNCTION public.mark_quotation_delivered(uuid, uuid[], date, uuid, text, numeric, text, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_quotation_delivered(uuid, uuid[], date, uuid, text, numeric, text, text, date) TO authenticated, service_role;

-- Tidy the orders already marked delivered earlier (some were left at stage 1 or 4).
UPDATE public.quotations
   SET pipeline_stage = 6, delivered_at = coalesce(delivered_at, updated_at)
 WHERE status = 'delivered' AND deleted_at IS NULL
   AND (pipeline_stage IS DISTINCT FROM 6 OR delivered_at IS NULL);
