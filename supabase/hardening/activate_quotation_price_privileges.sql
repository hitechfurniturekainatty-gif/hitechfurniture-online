-- Apply only after quotation_items-aware catalogCostFetch is confirmed deployed.
REVOKE SELECT ON public.quotation_items FROM authenticated, anon;
REVOKE SELECT (unit_price, amount) ON public.quotation_items FROM authenticated, anon;
DO $$ DECLARE cols text; BEGIN
 SELECT string_agg(quote_ident(column_name), ',') INTO cols FROM information_schema.columns
 WHERE table_schema='public' AND table_name='quotation_items' AND column_name NOT IN ('unit_price','amount');
 EXECUTE format('GRANT SELECT (%s) ON public.quotation_items TO authenticated',cols);
END $$;
NOTIFY pgrst, 'reload schema';
