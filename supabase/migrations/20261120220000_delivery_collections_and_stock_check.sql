-- Delivery payment collection + ready-stock shortage check (2026-11-20)
--
-- 1. delivery_collections: the driver records what the customer paid at the door
--    (or why not, with a promise date). Nothing touches the customer's balance until
--    the office counts the cash / checks the UPI and presses Verify. Verify adds a normal
--    receivable_payments row, so balances, order closing and reports work as before.
-- 2. quotation_stock_shortages(quotation): for ready-stock rows, compares the quantity
--    with Output Books stock minus what other open orders already hold.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Collections
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.delivery_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0 CHECK (amount >= 0 AND amount <= 100000000),
  method text NOT NULL CHECK (method IN ('cash','upi','cheque','card','none')),
  reference_no text CHECK (reference_no IS NULL OR length(reference_no) <= 100),
  promise_date date,
  note text CHECK (note IS NULL OR length(note) <= 1000),
  collected_by uuid NOT NULL DEFAULT auth.uid(),
  collected_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  verified_by uuid,
  verified_at timestamptz,
  verify_note text,
  receivable_payment_id uuid,
  CONSTRAINT dc_none_means_zero CHECK ((method = 'none') = (amount = 0)),
  CONSTRAINT dc_none_needs_promise CHECK (method <> 'none' OR promise_date IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS delivery_collections_status_idx ON public.delivery_collections(status, collected_at DESC);
CREATE INDEX IF NOT EXISTS delivery_collections_quotation_idx ON public.delivery_collections(quotation_id);

ALTER TABLE public.delivery_collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dc_select ON public.delivery_collections;
CREATE POLICY dc_select ON public.delivery_collections FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()),'admin'::public.app_role) OR public.has_role((SELECT auth.uid()),'staff'::public.app_role)
         OR collected_by = (SELECT auth.uid()));
DROP POLICY IF EXISTS dc_insert ON public.delivery_collections;
CREATE POLICY dc_insert ON public.delivery_collections FOR INSERT TO authenticated
  WITH CHECK (collected_by = (SELECT auth.uid()) AND status = 'pending'
              AND (public.has_role((SELECT auth.uid()),'admin'::public.app_role) OR public.has_role((SELECT auth.uid()),'staff'::public.app_role)
                   OR public.has_role((SELECT auth.uid()),'delivery'::public.app_role)));
-- No UPDATE/DELETE policy: changes only through verify_delivery_collection().
GRANT SELECT, INSERT ON public.delivery_collections TO authenticated;
GRANT ALL ON public.delivery_collections TO service_role;

-- Office verifies (adds the payment) or rejects an entry.
CREATE OR REPLACE FUNCTION public.verify_delivery_collection(p_id uuid, p_accept boolean, p_note text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE c public.delivery_collections%ROWTYPE; rid uuid; pid uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'staff'::public.app_role)) THEN
    RAISE EXCEPTION 'Office staff only';
  END IF;
  SELECT * INTO c FROM public.delivery_collections WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','Entry not found'); END IF;
  IF c.status <> 'pending' THEN RETURN jsonb_build_object('ok',false,'error','Already '||c.status); END IF;

  IF NOT p_accept THEN
    UPDATE public.delivery_collections SET status='rejected', verified_by=auth.uid(), verified_at=now(), verify_note=NULLIF(btrim(p_note),'') WHERE id=p_id;
    RETURN jsonb_build_object('ok',true,'status','rejected');
  END IF;

  SELECT id INTO rid FROM public.receivables WHERE quotation_id = c.quotation_id AND source = 'quotation' ORDER BY created_at DESC LIMIT 1;

  IF c.amount > 0 THEN
    IF rid IS NULL THEN
      RETURN jsonb_build_object('ok',false,'error','No balance record yet: mark the delivered items in My Trips first');
    END IF;
    INSERT INTO public.receivable_payments(receivable_id, quotation_id, amount, payment_method, reference_no, note, received_at, received_by)
    VALUES (rid, c.quotation_id, c.amount, c.method, c.reference_no,
            concat_ws(' · ', 'Collected on delivery', NULLIF(btrim(c.note),''), NULLIF(btrim(p_note),'')), c.collected_at, c.collected_by)
    RETURNING id INTO pid;
  END IF;

  -- Promise date for the rest goes onto the receivable follow-up.
  IF rid IS NOT NULL AND c.promise_date IS NOT NULL THEN
    UPDATE public.receivables SET next_follow_up_at = (c.promise_date::timestamp + time '10:30') AT TIME ZONE 'Asia/Kolkata',
           notes = concat_ws(E'\n', notes, to_char(now() AT TIME ZONE 'Asia/Kolkata','DD Mon')||' delivery: '||coalesce(NULLIF(btrim(c.note),''),'balance promised')||' (promise '||to_char(c.promise_date,'DD Mon')||')')
     WHERE id = rid;
  END IF;

  UPDATE public.delivery_collections SET status='verified', verified_by=auth.uid(), verified_at=now(),
         verify_note=NULLIF(btrim(p_note),''), receivable_payment_id=pid WHERE id=p_id;
  RETURN jsonb_build_object('ok',true,'status','verified','payment_id',pid);
END $$;
REVOKE ALL ON FUNCTION public.verify_delivery_collection(uuid,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_delivery_collection(uuid,boolean,text) TO authenticated, service_role;

-- Alert the office (bell + Telegram via the existing n8n forwarder) for every entry.
ALTER TABLE public.pipeline_notifications DROP CONSTRAINT IF EXISTS pipeline_notifications_source_type_check;
ALTER TABLE public.pipeline_notifications ADD CONSTRAINT pipeline_notifications_source_type_check
  CHECK (source_type = ANY (ARRAY['quotation','lead','complaint','service','job','delivery','lead_reminder',
    'job_stuck','payment_reminder','quotation_expiry','delivery_review','whatsapp_lead','lead_chat','delivery_prep',
    'quotation_followup_due','receivable_followup_due','sales_lead_reminder','customer_approval',
    'daily_call_list','job_status_digest','review_request','owner_daily_report','weekly_source_report',
    'sales_lead_followup_due','sales_lead_followup_overdue','delivery_collection']::text[]));

CREATE OR REPLACE FUNCTION public.delivery_collections_notify()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE q record; who text;
BEGIN
  SELECT quotation_id, party_name, party_place INTO q FROM public.quotations WHERE id = NEW.quotation_id;
  SELECT display_name INTO who FROM public.profiles WHERE user_id = NEW.collected_by;
  INSERT INTO public.pipeline_notifications (quotation_id, stage, target_role, source_type, source_id, title, body)
  VALUES (NEW.quotation_id, 6, 'admin'::app_role, 'delivery_collection', NEW.id,
          CASE WHEN NEW.method = 'none' THEN 'Payment NOT collected · ' ELSE 'Payment collected · ' END || coalesce(who,'Driver'),
          coalesce(q.party_name,'Customer') || ' · ' || coalesce(q.party_place,'') || ' · ' || coalesce(q.quotation_id,'')
            || CASE WHEN NEW.method = 'none' THEN ' — promised ' || to_char(NEW.promise_date,'DD Mon')
                    ELSE ' — ₹' || to_char(NEW.amount,'FM99,99,99,990') || ' ' || upper(NEW.method) END
            || ' · verify in Delivery Collections');
  RETURN NEW;
EXCEPTION WHEN others THEN
  RAISE WARNING 'delivery_collections_notify failed: %', SQLERRM;  -- never block the driver's entry
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_delivery_collections_notify ON public.delivery_collections;
CREATE TRIGGER trg_delivery_collections_notify AFTER INSERT ON public.delivery_collections
  FOR EACH ROW EXECUTE FUNCTION public.delivery_collections_notify();

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Ready-stock shortage check
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.quotation_stock_shortages(p_quotation_id uuid)
 RETURNS TABLE(product_id uuid, product_name text, needed numeric, in_stock numeric, held_by_others numeric, available numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH mine AS (
    SELECT qi.product_id, sum(qi.quantity)::numeric AS needed
      FROM public.quotation_items qi
     WHERE qi.quotation_id = p_quotation_id AND qi.product_id IS NOT NULL
       AND qi.fulfillment_route = 'ready_stock' AND qi.delivered_at IS NULL
     GROUP BY qi.product_id),
  others AS (
    SELECT qi.product_id, sum(qi.quantity)::numeric AS held
      FROM public.quotation_items qi JOIN public.quotations q ON q.id = qi.quotation_id
     WHERE qi.quotation_id <> p_quotation_id AND qi.product_id IN (SELECT product_id FROM mine)
       AND qi.fulfillment_route = 'ready_stock' AND qi.delivered_at IS NULL
       AND q.deleted_at IS NULL AND q.status NOT IN ('rejected','delivered','drafted')
     GROUP BY qi.product_id)
  SELECT m.product_id, p.product_name, m.needed, coalesce(p.stock_quantity,0)::numeric,
         coalesce(o.held,0), greatest(coalesce(p.stock_quantity,0) - coalesce(o.held,0), 0)
    FROM mine m JOIN public.products p ON p.id = m.product_id
    LEFT JOIN others o ON o.product_id = m.product_id
   WHERE (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'staff'::public.app_role))
     AND m.needed > greatest(coalesce(p.stock_quantity,0) - coalesce(o.held,0), 0)
$$;
REVOKE ALL ON FUNCTION public.quotation_stock_shortages(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quotation_stock_shortages(uuid) TO authenticated, service_role;
