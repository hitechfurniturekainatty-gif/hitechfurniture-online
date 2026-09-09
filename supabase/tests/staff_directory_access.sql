BEGIN;
DO $$ BEGIN
 IF has_function_privilege('anon','public.get_all_auth_users()','EXECUTE') THEN RAISE EXCEPTION 'Anonymous directory access'; END IF;
 IF NOT has_function_privilege('service_role','public.get_all_auth_users()','EXECUTE') THEN RAISE EXCEPTION 'Server directory permission missing'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{"role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.get_all_auth_users()) THEN RAISE EXCEPTION 'Roleless directory access'; END IF; END $$;
RESET ROLE;
SELECT set_config('test.user_count',(SELECT count(*)::text FROM auth.users),true);
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SET LOCAL ROLE service_role;
DO $$ BEGIN IF (SELECT count(*) FROM public.get_all_auth_users()) <> current_setting('test.user_count')::bigint THEN RAISE EXCEPTION 'Server directory count mismatch'; END IF; END $$;
ROLLBACK;
