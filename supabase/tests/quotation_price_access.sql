BEGIN;
-- Apply only after quotation_items-aware catalogCostFetch is confirmed deployed.
REVOKE SELECT ON public.quotation_items FROM authenticated, anon;
REVOKE SELECT (unit_price, amount) ON public.quotation_items FROM authenticated, anon;
DO $$ DECLARE cols text; BEGIN
 SELECT string_agg(quote_ident(column_name), ',') INTO cols FROM information_schema.columns
 WHERE table_schema='public' AND table_name='quotation_items' AND column_name NOT IN ('unit_price','amount');
 EXECUTE format('GRANT SELECT (%s) ON public.quotation_items TO authenticated',cols);
END $$;
NOTIFY pgrst, 'reload schema';

DO $$ BEGIN
 IF has_column_privilege('authenticated','public.quotation_items','unit_price','SELECT')
 OR has_column_privilege('authenticated','public.quotation_items','amount','SELECT') THEN
 RAISE EXCEPTION 'Direct price access remains'; END IF;
 IF NOT has_column_privilege('authenticated','public.quotation_items','description','SELECT') THEN
 RAISE EXCEPTION 'Safe item access lost'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000001"}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF public.get_catalog_costs('quotation_items',ARRAY[]::uuid[]) <> '{}'::jsonb THEN
 RAISE EXCEPTION 'Unauthorized lookup'; END IF;
 BEGIN
 PERFORM unit_price FROM public.quotation_items LIMIT 1;
 RAISE EXCEPTION 'Direct price query allowed' USING ERRCODE='P0002';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
DO $$ DECLARE item record; prices jsonb; BEGIN
 SELECT id,unit_price,amount INTO item FROM public.quotation_items LIMIT 1;
 IF FOUND THEN
 prices := public.get_catalog_costs('quotation_items',ARRAY[item.id]);
 IF prices->item.id::text IS DISTINCT FROM jsonb_build_object('unit_price',item.unit_price,'amount',item.amount) THEN
 RAISE EXCEPTION 'Authorized prices changed'; END IF;
 END IF;
END $$;
ROLLBACK;
