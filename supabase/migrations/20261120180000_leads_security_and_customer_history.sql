-- Leads security + customer history (2026-11-20)
-- 1. sales_leads was readable and writable by ANY logged-in account (USING true),
--    including delivery/measurement logins and anyone who signs up on /auth.
--    Now only office staff and admins, matching customer_complaints/services.
--    The website enquiry form and WhatsApp AI use the service key and are unaffected.
-- 2. customer_history(phone): one call that gathers everything we know about a
--    customer by the last 10 digits of the phone. SECURITY INVOKER, so every part
--    still obeys the caller's own access rules.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. sales_leads access
-- ───────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff read sales leads" ON public.sales_leads;
DROP POLICY IF EXISTS "staff write sales leads" ON public.sales_leads;
DROP POLICY IF EXISTS sales_leads_select ON public.sales_leads;
DROP POLICY IF EXISTS sales_leads_insert ON public.sales_leads;
DROP POLICY IF EXISTS sales_leads_update ON public.sales_leads;
DROP POLICY IF EXISTS sales_leads_delete ON public.sales_leads;

CREATE POLICY sales_leads_select ON public.sales_leads FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()),'admin'::public.app_role) OR public.has_role((SELECT auth.uid()),'staff'::public.app_role));
CREATE POLICY sales_leads_insert ON public.sales_leads FOR INSERT TO authenticated
  WITH CHECK (public.has_role((SELECT auth.uid()),'admin'::public.app_role) OR public.has_role((SELECT auth.uid()),'staff'::public.app_role));
CREATE POLICY sales_leads_update ON public.sales_leads FOR UPDATE TO authenticated
  USING (public.has_role((SELECT auth.uid()),'admin'::public.app_role) OR public.has_role((SELECT auth.uid()),'staff'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()),'admin'::public.app_role) OR public.has_role((SELECT auth.uid()),'staff'::public.app_role));
CREATE POLICY sales_leads_delete ON public.sales_leads FOR DELETE TO authenticated
  USING (public.has_role((SELECT auth.uid()),'admin'::public.app_role));

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Customer history by phone
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.customer_history(p_phone text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$
DECLARE k text := public.phone_key(p_phone);
BEGIN
  IF k IS NULL OR length(k) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Enter a phone number');
  END IF;
  IF NOT (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'staff'::public.app_role)) THEN
    RAISE EXCEPTION 'Office staff only';
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'phone_key', k,
    'leads', coalesce((SELECT jsonb_agg(x ORDER BY x.created_at DESC) FROM (
        SELECT l.id, l.lead_code, l.customer_name, l.customer_place, l.source, l.status, l.lost_reason,
               l.requirement, l.next_follow_up_at, l.converted_quotation_id, l.assigned_to, l.created_at,
               (SELECT count(*) FROM public.sales_lead_followups f WHERE f.lead_id = l.id) AS followups
          FROM public.sales_leads l
         WHERE l.deleted_at IS NULL AND public.phone_key(l.customer_phone) = k) x), '[]'::jsonb),
    'quotations', coalesce((SELECT jsonb_agg(x ORDER BY x.created_at DESC) FROM (
        SELECT q.id, q.quotation_id, q.party_name, q.party_place, q.commercial_status, q.status,
               q.pipeline_stage, q.total, q.created_at
          FROM public.quotations q
         WHERE q.deleted_at IS NULL AND public.phone_key(q.party_phone) = k) x), '[]'::jsonb),
    'complaints', coalesce((SELECT jsonb_agg(x ORDER BY x.created_at DESC) FROM (
        SELECT c.id, c.complaint_code, c.customer_name, c.issue_description, c.status, c.created_at
          FROM public.customer_complaints c
         WHERE c.deleted_at IS NULL AND public.phone_key(c.customer_phone) = k) x), '[]'::jsonb),
    'services', coalesce((SELECT jsonb_agg(x ORDER BY x.created_at DESC) FROM (
        SELECT s.id, s.service_code, s.customer_name, s.work_needed, s.status, s.created_at
          FROM public.customer_services s
         WHERE s.deleted_at IS NULL AND public.phone_key(s.customer_phone) = k) x), '[]'::jsonb),
    'receivables', coalesce((SELECT jsonb_agg(x ORDER BY x.created_at DESC) FROM (
        SELECT r.id, r.customer_name, r.bill_no, r.original_amount, r.pending_amount,
               r.next_follow_up_at, r.closed_at, r.created_at
          FROM public.receivables r
         WHERE public.phone_key(r.phone) = k) x), '[]'::jsonb)
  );
END $$;
REVOKE ALL ON FUNCTION public.customer_history(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_history(text) TO authenticated, service_role;
