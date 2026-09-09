CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.catalog_costs(catalog_kind text, item_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT (coalesce(auth.jwt()->>'role','')='service_role' OR (auth.uid() IS NOT NULL AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')))) THEN
  RETURN '{}'::jsonb;
 END IF;
 IF cardinality(item_ids)>1000 THEN RAISE EXCEPTION 'At most 1000 items per request' USING ERRCODE='22023'; END IF;
 IF catalog_kind='products' THEN
  SELECT coalesce(jsonb_object_agg(id::text,cost_price),'{}'::jsonb) INTO result FROM public.products WHERE id=ANY(item_ids);
 ELSIF catalog_kind='product_bundles' THEN
  SELECT coalesce(jsonb_object_agg(id::text,cost_price),'{}'::jsonb) INTO result FROM public.product_bundles WHERE id=ANY(item_ids);
 ELSIF catalog_kind='quotation_items' THEN
  SELECT coalesce(jsonb_object_agg(id::text,jsonb_build_object('unit_price',unit_price,'amount',amount)),'{}'::jsonb) INTO result FROM public.quotation_items WHERE id=ANY(item_ids);
 ELSE RAISE EXCEPTION 'Invalid catalogue' USING ERRCODE='22023';
 END IF;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION private.catalog_costs(text,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.catalog_costs(text,uuid[]) TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.get_catalog_costs(catalog_kind text,item_ids uuid[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT private.catalog_costs(catalog_kind,item_ids);
$$;
REVOKE ALL ON FUNCTION public.get_catalog_costs(text,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_catalog_costs(text,uuid[]) TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';

