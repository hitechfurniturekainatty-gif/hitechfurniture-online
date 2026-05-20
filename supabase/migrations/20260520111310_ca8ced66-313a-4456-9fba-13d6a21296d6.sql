
-- 1. Revoke EXECUTE from PUBLIC on all SECURITY DEFINER functions in public schema
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, p.proname AS func_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
                   r.schema_name, r.func_name, r.args);
  END LOOP;
END$$;

-- 2. Re-grant EXECUTE for functions the authenticated app actually calls
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_worker_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_quotation_id(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_po_id(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_complaint_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_service_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_catalog_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_pin_is_set() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_backlog_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.backlog_pin_is_set() TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_backlog_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_trash() TO authenticated;

-- 3. Public (share-link) functions — must be callable by anon AND authenticated
GRANT EXECUTE ON FUNCTION public.get_shared_quotation(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_job_work_order(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_catalog_pin(text) TO anon, authenticated;
