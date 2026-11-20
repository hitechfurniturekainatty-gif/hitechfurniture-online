-- Lead follow-up history + due-date reminders (2026-11-20)
-- 1. sales_lead_followups: every call / note on a lead is kept as its own row.
--    Before this, sales_leads.follow_up_notes was overwritten on each save.
-- 2. log_sales_lead_followup(): one safe call that records the attempt and moves
--    the lead's next follow-up date forward.
-- 3. check_due_lead_followups(): when the next follow-up time arrives, remind the
--    assigned salesman; if it is still not done 24h later, alert the admins.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. History table
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sales_lead_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.sales_leads(id) ON DELETE CASCADE,
  outcome text NOT NULL DEFAULT 'note' CHECK (outcome IN
    ('note','no_answer','busy','interested','showroom_visit','quotation_requested','not_interested')),
  note text CHECK (note IS NULL OR length(note) <= 2000),
  next_follow_up_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_lead_followups_lead_idx
  ON public.sales_lead_followups(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sales_leads_due_followup_idx
  ON public.sales_leads(next_follow_up_at)
  WHERE deleted_at IS NULL AND status IN ('pending','contacted');

ALTER TABLE public.sales_lead_followups ENABLE ROW LEVEL SECURITY;

-- Office staff and admins only (not workers, not customers). History is append-only
-- for staff; only an admin can remove a wrong entry.
DROP POLICY IF EXISTS slf_select ON public.sales_lead_followups;
CREATE POLICY slf_select ON public.sales_lead_followups FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'staff'::public.app_role));
DROP POLICY IF EXISTS slf_insert ON public.sales_lead_followups;
CREATE POLICY slf_insert ON public.sales_lead_followups FOR INSERT TO authenticated
  WITH CHECK ((public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'staff'::public.app_role))
              AND created_by = auth.uid());
DROP POLICY IF EXISTS slf_delete ON public.sales_lead_followups;
CREATE POLICY slf_delete ON public.sales_lead_followups FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role));

GRANT SELECT, INSERT, DELETE ON public.sales_lead_followups TO authenticated;
GRANT ALL ON public.sales_lead_followups TO service_role;

-- Keep the existing single note visible as the first history entry.
INSERT INTO public.sales_lead_followups (lead_id, outcome, note, next_follow_up_at, created_by, created_at)
SELECT l.id, 'note', left(l.follow_up_notes, 2000), l.next_follow_up_at, l.created_by, l.updated_at
  FROM public.sales_leads l
 WHERE l.deleted_at IS NULL
   AND coalesce(btrim(l.follow_up_notes), '') <> ''
   AND NOT EXISTS (SELECT 1 FROM public.sales_lead_followups f WHERE f.lead_id = l.id);

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Log a follow-up
-- ───────────────────────────────────────────────────────────────────────────
-- Outcomes that mean the customer was actually reached.
CREATE OR REPLACE FUNCTION public.lead_outcome_reached(p text)
 RETURNS boolean LANGUAGE sql IMMUTABLE
AS $$ SELECT p IN ('busy','interested','showroom_visit','quotation_requested','not_interested') $$;

CREATE OR REPLACE FUNCTION public.log_sales_lead_followup(
  p_lead_id uuid, p_outcome text, p_note text, p_next_follow_up_at timestamptz)
 RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public'
AS $$
DECLARE l public.sales_leads%ROWTYPE; fid uuid; open_lead boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin'::public.app_role)
                                OR public.has_role(auth.uid(),'staff'::public.app_role)) THEN
    RAISE EXCEPTION 'Not authorized to log lead follow-ups';
  END IF;
  SELECT * INTO l FROM public.sales_leads WHERE id = p_lead_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','Lead not found'); END IF;

  open_lead := l.status IN ('pending','contacted');
  IF p_outcome = 'note' AND coalesce(btrim(p_note),'') = '' THEN
    RETURN jsonb_build_object('ok',false,'error','Write a note');
  END IF;
  -- An open lead must always have a next step, except when the customer said no
  -- (staff then mark it Lost from the lead form).
  IF open_lead AND p_next_follow_up_at IS NULL AND p_outcome <> 'not_interested' THEN
    RETURN jsonb_build_object('ok',false,'error','Set the next follow-up date');
  END IF;

  INSERT INTO public.sales_lead_followups (lead_id, outcome, note, next_follow_up_at, created_by)
  VALUES (p_lead_id, p_outcome, NULLIF(btrim(p_note),''), p_next_follow_up_at, auth.uid())
  RETURNING id INTO fid;

  UPDATE public.sales_leads SET
    next_follow_up_at = CASE WHEN open_lead AND p_next_follow_up_at IS NOT NULL THEN p_next_follow_up_at ELSE next_follow_up_at END,
    contacted_at      = CASE WHEN public.lead_outcome_reached(p_outcome) THEN coalesce(contacted_at, now()) ELSE contacted_at END,
    status            = CASE WHEN status = 'pending' AND public.lead_outcome_reached(p_outcome) THEN 'contacted' ELSE status END,
    -- Old screens still read this field; keep it showing the latest note.
    follow_up_notes   = coalesce(NULLIF(btrim(p_note),''), follow_up_notes),
    updated_at        = now()
  WHERE id = p_lead_id;

  RETURN jsonb_build_object('ok',true,'followup_id',fid);
END $$;
REVOKE ALL ON FUNCTION public.log_sales_lead_followup(uuid,text,text,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_sales_lead_followup(uuid,text,text,timestamptz) TO authenticated, service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Due-date reminders
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.pipeline_notifications DROP CONSTRAINT IF EXISTS pipeline_notifications_source_type_check;
ALTER TABLE public.pipeline_notifications ADD CONSTRAINT pipeline_notifications_source_type_check
  CHECK (source_type = ANY (ARRAY['quotation','lead','complaint','service','job','delivery','lead_reminder',
    'job_stuck','payment_reminder','quotation_expiry','delivery_review','whatsapp_lead','lead_chat','delivery_prep',
    'quotation_followup_due','receivable_followup_due','sales_lead_reminder','customer_approval',
    'sales_lead_followup_due','sales_lead_followup_overdue']::text[]));

CREATE INDEX IF NOT EXISTS pipeline_notifications_source_idx
  ON public.pipeline_notifications(source_type, source_id, created_at DESC);

-- One reminder per lead per scheduled time: a new date gets a new reminder.
-- Leads whose date passed more than 7 days ago are left to the Leads page so the
-- first run does not flood the bell with old backlog.
CREATE OR REPLACE FUNCTION public.check_due_lead_followups()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _a int := 0; _b int := 0;
BEGIN
  WITH ins AS (
    INSERT INTO public.pipeline_notifications (quotation_id, stage, target_role, source_type, source_id, recipients, title, body)
    SELECT NULL, 1::smallint, 'staff'::app_role, 'sales_lead_followup_due', l.id,
           -- The salesman's own WhatsApp number when known; otherwise the normal staff list.
           CASE WHEN coalesce(btrim(p.whatsapp_number),'') <> '' THEN ARRAY[p.whatsapp_number] ELSE '{}'::text[] END,
           'Follow-up due' || CASE WHEN p.display_name IS NOT NULL THEN ' · ' || p.display_name ELSE ' · Not assigned' END,
           l.lead_code || ' · ' || l.customer_name
             || CASE WHEN coalesce(l.customer_phone,'') <> '' THEN ' · ' || l.customer_phone ELSE '' END
             || ' — due ' || to_char(l.next_follow_up_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon HH12:MI AM')
      FROM public.sales_leads l
      LEFT JOIN public.profiles p ON p.user_id = l.assigned_to
     WHERE l.deleted_at IS NULL AND l.status IN ('pending','contacted')
       AND l.next_follow_up_at <= now()
       AND l.next_follow_up_at > now() - interval '7 days'
       AND NOT EXISTS (SELECT 1 FROM public.pipeline_notifications pn
                        WHERE pn.source_type = 'sales_lead_followup_due' AND pn.source_id = l.id
                          AND pn.created_at >= l.next_follow_up_at)
    RETURNING 1)
  SELECT count(*) INTO _a FROM ins;

  WITH ins AS (
    INSERT INTO public.pipeline_notifications (quotation_id, stage, target_role, source_type, source_id, title, body)
    SELECT NULL, 1::smallint, 'admin'::app_role, 'sales_lead_followup_overdue', l.id,
           'Follow-up overdue 24h' || CASE WHEN p.display_name IS NOT NULL THEN ' · ' || p.display_name ELSE ' · Not assigned' END,
           l.lead_code || ' · ' || l.customer_name
             || CASE WHEN coalesce(l.customer_phone,'') <> '' THEN ' · ' || l.customer_phone ELSE '' END
             || ' — was due ' || to_char(l.next_follow_up_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon HH12:MI AM')
      FROM public.sales_leads l
      LEFT JOIN public.profiles p ON p.user_id = l.assigned_to
     WHERE l.deleted_at IS NULL AND l.status IN ('pending','contacted')
       AND l.next_follow_up_at <= now() - interval '24 hours'
       AND l.next_follow_up_at > now() - interval '7 days'
       AND NOT EXISTS (SELECT 1 FROM public.pipeline_notifications pn
                        WHERE pn.source_type = 'sales_lead_followup_overdue' AND pn.source_id = l.id
                          AND pn.created_at >= l.next_follow_up_at)
    RETURNING 1)
  SELECT count(*) INTO _b FROM ins;
  RETURN _a + _b;
END $$;
REVOKE ALL ON FUNCTION public.check_due_lead_followups() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_due_lead_followups() TO service_role;

DO $$
BEGIN
  PERFORM cron.unschedule('check-due-lead-followups');
EXCEPTION WHEN others THEN NULL;
END $$;
SELECT cron.schedule(
  'check-due-lead-followups',
  '*/15 * * * *',
  $$SELECT public.check_due_lead_followups();$$
);
