-- Run as postgres. Every fixture and write is rolled back; no real customer records are changed.
BEGIN;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES ('f79b351b-18bb-428b-b832-7859c3ec7244','security-test@example.invalid','{}');
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id='f79b351b-18bb-428b-b832-7859c3ec7244') THEN RAISE EXCEPTION 'Signup granted a role'; END IF;
 IF has_column_privilege('anon','public.products','cost_price','SELECT') THEN RAISE EXCEPTION 'Public product cost exposed'; END IF;
 IF has_column_privilege('anon','public.product_bundles','cost_price','SELECT') THEN RAISE EXCEPTION 'Public bundle cost exposed'; END IF;
 IF has_function_privilege('authenticated','public.set_quotation_stage(uuid,smallint,public.app_role,text,text)','EXECUTE') THEN RAISE EXCEPTION 'Internal stage helper exposed'; END IF;
END $$;
SET LOCAL ROLE anon;
SELECT count(*) FROM public.products_safe_search;
DO $$ BEGIN
 BEGIN IF EXISTS(SELECT 1 FROM public.whatsapp_inbound_log) THEN RAISE EXCEPTION 'Anonymous integration access'; END IF; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN IF EXISTS(SELECT 1 FROM public.busy_creditors) THEN RAISE EXCEPTION 'Anonymous creditor access'; END IF; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   INSERT INTO storage.objects(bucket_id,name) VALUES('quotations','security-test-blocked');
   RAISE EXCEPTION 'Anonymous upload allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF public.get_shared_quotation('f79b351b-18bb-428b-b832-7859c3ec7244') IS NOT NULL THEN RAISE EXCEPTION 'Invalid share returned data'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"f79b351b-18bb-428b-b832-7859c3ec7244","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.quotations) THEN RAISE EXCEPTION 'Roleless quotation access'; END IF;
 IF EXISTS(SELECT 1 FROM public.products) THEN RAISE EXCEPTION 'Roleless product cost access'; END IF;
 BEGIN PERFORM public.start_lead_chat('f79b351b-18bb-428b-b832-7859c3ec7244'); RAISE EXCEPTION 'Roleless lead update'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
INSERT INTO public.user_roles(user_id,role) VALUES('f79b351b-18bb-428b-b832-7859c3ec7244','admin');
SET LOCAL ROLE authenticated;
SELECT count(*) FROM public.products_staff_catalog;
SELECT count(*) FROM public.command_center_snapshot;
INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('quotations','security-test-authorized','f79b351b-18bb-428b-b832-7859c3ec7244');
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE name='security-test-authorized') THEN RAISE EXCEPTION 'Admin cannot read uploaded file'; END IF; END $$;
RESET ROLE;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES ('37791ea8-0db4-418b-b65c-06d73c514b93','security-worker@example.invalid','{}');
INSERT INTO public.user_roles(user_id,role) VALUES('37791ea8-0db4-418b-b65c-06d73c514b93','worker');
SELECT set_config('request.jwt.claims','{"sub":"37791ea8-0db4-418b-b65c-06d73c514b93","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('quotations','security-worker-own','37791ea8-0db4-418b-b65c-06d73c514b93');
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE name='security-worker-own') THEN RAISE EXCEPTION 'Worker cannot read own upload'; END IF;
 IF EXISTS(SELECT 1 FROM storage.objects WHERE name='security-test-authorized') THEN RAISE EXCEPTION 'Worker can read unrelated attachment'; END IF;
END $$;
ROLLBACK;
