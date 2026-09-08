-- Synthetic identities only; no production catalogue rows are modified.
BEGIN;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES ('f79b351b-18bb-428b-b832-7859c3ec7244','security-test@example.invalid','{}');
SELECT set_config('test.catalog_ids',coalesce((SELECT jsonb_agg(id)::text FROM (SELECT id FROM public.products LIMIT 5) p),'[]'),true);
SELECT set_config('test.expected_costs',coalesce((SELECT jsonb_object_agg(id::text,cost_price)::text FROM public.products WHERE id IN (SELECT jsonb_array_elements_text(current_setting('test.catalog_ids')::jsonb)::uuid)),'{}'),true);
SET LOCAL ROLE anon;
DO $$ BEGIN
 IF public.get_catalog_costs('products',ARRAY(SELECT jsonb_array_elements_text(current_setting('test.catalog_ids')::jsonb)::uuid)) <> '{}'::jsonb THEN RAISE EXCEPTION 'Anonymous costs exposed'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"f79b351b-18bb-428b-b832-7859c3ec7244","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF public.get_catalog_costs('products',ARRAY(SELECT jsonb_array_elements_text(current_setting('test.catalog_ids')::jsonb)::uuid)) <> '{}'::jsonb THEN RAISE EXCEPTION 'Roleless costs exposed'; END IF;
END $$;
RESET ROLE;
INSERT INTO public.user_roles(user_id,role) VALUES('f79b351b-18bb-428b-b832-7859c3ec7244','warehouse');
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF public.get_catalog_costs('products',ARRAY(SELECT jsonb_array_elements_text(current_setting('test.catalog_ids')::jsonb)::uuid)) <> '{}'::jsonb THEN RAISE EXCEPTION 'Warehouse costs exposed'; END IF;
 IF EXISTS(SELECT 1 FROM public.products_staff_catalog WHERE cost_price IS NOT NULL) OR EXISTS(SELECT 1 FROM public.products_inventory_filterable WHERE cost_price IS NOT NULL) THEN RAISE EXCEPTION 'Warehouse view costs exposed'; END IF;
END $$;
RESET ROLE;
UPDATE public.user_roles SET role='staff' WHERE user_id='f79b351b-18bb-428b-b832-7859c3ec7244';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF public.get_catalog_costs('products',ARRAY(SELECT jsonb_array_elements_text(current_setting('test.catalog_ids')::jsonb)::uuid)) <> current_setting('test.expected_costs')::jsonb THEN RAISE EXCEPTION 'Staff costs incorrect'; END IF;
 BEGIN PERFORM public.get_catalog_costs('untrusted_table',ARRAY[]::uuid[]); RAISE EXCEPTION 'Invalid table accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.get_catalog_costs('products',array_fill(gen_random_uuid(),ARRAY[1001])); RAISE EXCEPTION 'Unbounded request accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
ROLLBACK;
