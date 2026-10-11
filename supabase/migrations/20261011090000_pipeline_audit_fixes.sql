-- Pipeline audit fixes (2026-10-11)
-- 1. WhatsApp chats from unknown numbers become sales leads automatically.
-- 2. "Lead not contacted" reminder also covers the new sales_leads table.
-- 3. Sharing a quotation marks it Quote Sent and schedules a follow-up in 2 days.
-- 4. Customers can approve a quotation from the shared link; staff get an alert.
-- 5. production_waiting_items: confirmed custom items not yet given to a worker.

-- ───────────────────────────────────────────────────────────────────────────
-- Helpers
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.phone_key(p text)
 RETURNS text LANGUAGE sql IMMUTABLE
AS $$ SELECT NULLIF(right(regexp_replace(coalesce(p,''), '\D', '', 'g'), 10), '') $$;

-- True when this phone already belongs to a staff member, a worker, an open or
-- recent lead, or a live / recent quotation — i.e. it should NOT become a new lead.
CREATE OR REPLACE FUNCTION public.phone_is_known_contact(p text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH k AS (SELECT public.phone_key(p) AS key)
  SELECT k.key IS NULL
      OR EXISTS (SELECT 1 FROM public.profiles pr WHERE public.phone_key(pr.whatsapp_number) = k.key)
      OR EXISTS (SELECT 1 FROM public.workers w WHERE w.deleted_at IS NULL
                   AND k.key IN (public.phone_key(w.whatsapp_number), public.phone_key(w.phone), public.phone_key(w.login_phone)))
      OR EXISTS (SELECT 1 FROM public.sales_leads l WHERE l.deleted_at IS NULL
                   AND public.phone_key(l.customer_phone) = k.key
                   AND (l.status IN ('pending','contacted') OR l.created_at > now() - interval '60 days'))
      OR EXISTS (SELECT 1 FROM public.quotations q WHERE q.deleted_at IS NULL
                   AND public.phone_key(q.party_phone) = k.key
                   AND (q.commercial_status NOT IN ('closed','lost') OR q.updated_at > now() - interval '90 days'))
  FROM k
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. WhatsApp → sales lead
-- ───────────────────────────────────────────────────────────────────────────
-- "I received a image message, but I can currently only read text…" is the bot's
-- placeholder for media. Turn it into a readable note, and prefer real text.
CREATE OR REPLACE FUNCTION public.whatsapp_lead_text(t text)
 RETURNS text LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN t IS NULL OR trim(t) = '' THEN NULL
    WHEN t ~* '^I received a (\w+) message' THEN
      '(Customer sent a ' || lower((regexp_match(t, '^I received a (\w+) message', 'i'))[1]) || ' — open the WhatsApp chat)'
    ELSE left(trim(t), 1000)
  END
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_message_auto_lead()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE txt text := public.whatsapp_lead_text(NEW.message_text);
BEGIN
  IF NEW.direction IS DISTINCT FROM 'incoming' THEN RETURN NEW; END IF;
  BEGIN
    -- A real text message improves an auto lead that only had a media placeholder.
    IF txt IS NOT NULL AND left(txt, 1) <> '(' THEN
      UPDATE public.sales_leads
         SET requirement = txt, updated_at = now()
       WHERE deleted_at IS NULL AND source = 'whatsapp' AND status = 'pending'
         AND public.phone_key(customer_phone) = public.phone_key(NEW.phone)
         AND (requirement IS NULL OR left(requirement, 1) = '(');
    END IF;
    IF public.phone_is_known_contact(NEW.phone) THEN RETURN NEW; END IF;
    INSERT INTO public.sales_leads (lead_code, customer_name, customer_phone, requirement,
                                    enquiry_type, source, status, follow_up_notes)
    VALUES (public.next_lead_code(),
            COALESCE(NULLIF(trim(NEW.customer_name), ''), 'WhatsApp customer'),
            NEW.phone, txt, 'general_inquiry', 'whatsapp', 'pending',
            'Auto-created from WhatsApp chat');
  EXCEPTION WHEN others THEN
    -- Never block WhatsApp message logging because of lead creation.
    RAISE WARNING 'whatsapp_message_auto_lead failed for %: %', NEW.phone, SQLERRM;
  END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_whatsapp_message_auto_lead ON public.whatsapp_messages;
CREATE TRIGGER trg_whatsapp_message_auto_lead
  AFTER INSERT ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.whatsapp_message_auto_lead();

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Lead reminders: old quotation-style leads + new sales_leads
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_uncontacted_lead_reminders()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _a int := 0; _b int := 0;
BEGIN
  WITH ins AS (
    INSERT INTO public.pipeline_notifications (quotation_id, stage, target_role, source_type, source_id, recipients, title, body)
    SELECT q.id, 1::smallint, 'staff'::app_role, 'lead_reminder', q.id,
           public.resolve_role_recipients('staff'), 'Lead not contacted',
           q.party_name
             || CASE WHEN coalesce(q.party_phone,'') <> '' THEN ' · ' || q.party_phone ELSE '' END
             || ' — ' || floor(extract(epoch FROM (now() - q.created_at)) / 3600)::int::text || 'h overdue'
      FROM public.quotations q
     WHERE q.lead_type = 'lead' AND q.enquiry_contacted_at IS NULL
       AND q.status NOT IN ('rejected','delivered') AND q.deleted_at IS NULL
       AND q.created_at < now() - interval '4 hours'
       AND NOT EXISTS (SELECT 1 FROM public.pipeline_notifications pn
                        WHERE pn.source_type = 'lead_reminder' AND pn.source_id = q.id)
    RETURNING 1)
  SELECT count(*) INTO _a FROM ins;

  -- New Leads page. Only leads from the last 7 days alert, so old backlog
  -- (visible on the Leads page) does not flood the bell.
  WITH ins AS (
    INSERT INTO public.pipeline_notifications (quotation_id, stage, target_role, source_type, source_id, recipients, title, body)
    SELECT NULL, 1::smallint, 'staff'::app_role, 'sales_lead_reminder', l.id,
           public.resolve_role_recipients('staff'), 'Lead not contacted',
           l.lead_code || ' · ' || l.customer_name
             || CASE WHEN coalesce(l.customer_phone,'') <> '' THEN ' · ' || l.customer_phone ELSE '' END
             || ' · ' || l.source
             || ' — ' || floor(extract(epoch FROM (now() - l.created_at)) / 3600)::int::text || 'h waiting'
      FROM public.sales_leads l
     WHERE l.deleted_at IS NULL AND l.status = 'pending' AND l.contacted_at IS NULL
       AND l.created_at < now() - interval '4 hours'
       AND l.created_at > now() - interval '7 days'
       AND NOT EXISTS (SELECT 1 FROM public.pipeline_notifications pn
                        WHERE pn.source_type = 'sales_lead_reminder' AND pn.source_id = l.id)
    RETURNING 1)
  SELECT count(*) INTO _b FROM ins;
  RETURN _a + _b;
END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Quote Sent → automatic follow-up in 2 days (10:30 IST)
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.quotation_auto_followup()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.commercial_status = 'quote_sent'
     AND (TG_OP = 'INSERT' OR OLD.commercial_status IS DISTINCT FROM 'quote_sent')
     AND NEW.deleted_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.quotation_followups f
                      WHERE f.quotation_id = NEW.id AND f.status = 'pending') THEN
    INSERT INTO public.quotation_followups (quotation_id, scheduled_for, status, note, created_by)
    VALUES (NEW.id,
            ((date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') + interval '2 days 10 hours 30 minutes')
              AT TIME ZONE 'Asia/Kolkata'),
            'pending', 'Auto: quotation sent — call the customer', auth.uid());
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_quotation_auto_followup ON public.quotations;
CREATE TRIGGER trg_quotation_auto_followup
  AFTER INSERT OR UPDATE OF commercial_status ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.quotation_auto_followup();

-- Called by the app when staff share a quotation link with the customer.
CREATE OR REPLACE FUNCTION public.mark_quotation_sent(p_quotation_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE cs text;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'staff'::app_role)) THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  SELECT commercial_status INTO cs FROM public.quotations
   WHERE id = p_quotation_id AND deleted_at IS NULL AND coalesce(document_type,'quotation') = 'quotation';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF cs IN ('lead','quote_preparation') THEN
    UPDATE public.quotations SET commercial_status = 'quote_sent' WHERE id = p_quotation_id;
    RETURN jsonb_build_object('ok', true, 'changed', true);
  END IF;
  RETURN jsonb_build_object('ok', true, 'changed', false, 'commercial_status', cs);
END $$;
REVOKE ALL ON FUNCTION public.mark_quotation_sent(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mark_quotation_sent(uuid) TO authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Customer approval from the shared quotation link
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS customer_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_approval_note text;

CREATE OR REPLACE FUNCTION public.approve_shared_quotation(p_token uuid, p_note text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE q public.quotations%ROWTYPE;
BEGIN
  SELECT * INTO q FROM public.quotations
   WHERE share_token = p_token AND deleted_at IS NULL
     AND coalesce(document_type,'quotation') = 'quotation'
   FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF q.customer_approved_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'approved_at', q.customer_approved_at);
  END IF;
  IF q.commercial_status IN ('lost','closed') OR q.status = 'rejected' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'closed');
  END IF;

  UPDATE public.quotations
     SET customer_approved_at = now(),
         customer_approval_note = left(NULLIF(trim(p_note), ''), 500)
   WHERE id = q.id;

  INSERT INTO public.pipeline_notifications (quotation_id, stage, target_role, source_type, source_id, recipients, title, body)
  VALUES (q.id, coalesce(q.pipeline_stage, 1)::smallint, 'staff'::app_role, 'customer_approval', q.id,
          public.resolve_role_recipients('staff'),
          'Customer approved quotation',
          q.quotation_id || ' · ' || q.party_name
            || CASE WHEN coalesce(q.party_phone,'') <> '' THEN ' · ' || q.party_phone ELSE '' END
            || ' — collect advance & confirm order'
            || CASE WHEN NULLIF(trim(p_note), '') IS NOT NULL THEN ' · Note: ' || left(trim(p_note), 120) ELSE '' END);

  RETURN jsonb_build_object('ok', true, 'already', false, 'approved_at', now());
END $$;
REVOKE ALL ON FUNCTION public.approve_shared_quotation(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.approve_shared_quotation(uuid, text) TO anon, authenticated;

-- Expose approval state on the shared page.
CREATE OR REPLACE FUNCTION public.get_shared_quotation(p_token uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  q_row public.quotations%ROWTYPE;
  items jsonb;
BEGIN
  SELECT * INTO q_row FROM public.quotations WHERE share_token = p_token AND deleted_at IS NULL LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', i.id, 'description', i.description, 'quantity', i.quantity,
           'measurement', i.measurement, 'item_image_url', i.item_image_url,
           'measurement_image_url', i.measurement_image_url, 'catalog_text', i.catalog_text,
           'catalog_image_url', i.catalog_image_url, 'sketch_url', i.sketch_url,
           'site_photos', i.site_photos, 'unit_price', i.unit_price, 'total_price', i.amount,
           'fulfillment_route', i.fulfillment_route)
         ORDER BY i.display_order NULLS LAST, i.created_at), '[]'::jsonb)
    INTO items
    FROM public.quotation_items i WHERE i.quotation_id = q_row.id;

  RETURN jsonb_build_object(
    'quotation', jsonb_build_object(
      'id', q_row.id, 'quotation_id', q_row.quotation_id, 'party_name', q_row.party_name,
      'party_phone', q_row.party_phone, 'party_place', q_row.party_place, 'status', q_row.status,
      'total_amount', q_row.total, 'advance_amount', q_row.advance_amount, 'notes', q_row.notes,
      'updated_at', q_row.updated_at,
      'commercial_status', q_row.commercial_status,
      'customer_approved_at', q_row.customer_approved_at),
    'items', items);
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. Confirmed custom items still waiting for a worker job
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.production_waiting_items
WITH (security_invoker = true) AS
SELECT i.id AS item_id, i.quotation_id, q.quotation_id AS quotation_code,
       q.party_name, q.party_place, q.party_phone, q.expected_delivery_date, q.confirmed_at,
       i.description, i.quantity, i.measurement, i.item_image_url, i.display_order
  FROM public.quotation_items i
  JOIN public.quotations q ON q.id = i.quotation_id
 WHERE q.deleted_at IS NULL
   AND q.commercial_status IN ('confirmed','payment_pending')
   AND q.status <> 'delivered'
   AND coalesce(i.stock_decision, i.fulfillment_route) = 'custom'
   AND i.delivered_at IS NULL
   AND coalesce(i.cancelled_qty, 0) < coalesce(i.quantity, 1)
   AND NOT EXISTS (SELECT 1 FROM public.job_work_orders j
                    WHERE j.deleted_at IS NULL AND i.id = ANY (j.item_ids));
GRANT SELECT ON public.production_waiting_items TO authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- One-time backfills
-- ───────────────────────────────────────────────────────────────────────────
-- a) Follow-up tomorrow 10:30 IST for open quotations that have none scheduled.
INSERT INTO public.quotation_followups (quotation_id, scheduled_for, status, note)
SELECT q.id,
       ((date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') + interval '1 day 10 hours 30 minutes') AT TIME ZONE 'Asia/Kolkata'),
       'pending', 'Auto (audit 11-Oct): no follow-up was scheduled'
  FROM public.quotations q
 WHERE q.deleted_at IS NULL AND coalesce(q.document_type,'quotation') = 'quotation'
   AND q.commercial_status IN ('quote_preparation','quote_sent','follow_up')
   AND NOT EXISTS (SELECT 1 FROM public.quotation_followups f WHERE f.quotation_id = q.id AND f.status = 'pending');

-- b) Leads for WhatsApp numbers that chatted in the last 30 days and are unknown.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (public.phone_key(m.phone)) m.phone, m.customer_name, m.message_text, m.created_at
      FROM public.whatsapp_messages m
     WHERE m.direction = 'incoming' AND m.created_at > now() - interval '30 days'
       AND public.phone_key(m.phone) IS NOT NULL
     ORDER BY public.phone_key(m.phone), m.created_at DESC
  LOOP
    IF NOT public.phone_is_known_contact(r.phone) THEN
      INSERT INTO public.sales_leads (lead_code, customer_name, customer_phone, requirement,
                                      enquiry_type, source, status, follow_up_notes, created_at, updated_at)
      VALUES (public.next_lead_code(),
              COALESCE(NULLIF(trim(r.customer_name), ''), 'WhatsApp customer'),
              r.phone, public.whatsapp_lead_text(r.message_text),
              'general_inquiry', 'whatsapp', 'pending',
              'Auto-created from WhatsApp chat (backfill, audit 11-Oct)', r.created_at, now());
    END IF;
  END LOOP;
END $$;

-- Applied on 2026-10-11 in parts (supabase migrations: pipeline_audit_whatsapp_auto_lead,
-- pipeline_audit_followup_approval_production, pipeline_audit_backfill,
-- pipeline_audit_whatsapp_lead_text). Backfill created 40 WhatsApp leads and 20 follow-ups.
