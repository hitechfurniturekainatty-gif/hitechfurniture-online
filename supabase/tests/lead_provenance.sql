BEGIN;
DO $test$
DECLARE actor uuid; lead uuid; q uuid; result jsonb; original_name text;
BEGIN
 SELECT r.user_id,p.display_name INTO actor,original_name FROM public.user_roles r JOIN public.profiles p ON p.user_id=r.user_id WHERE r.role='admin' LIMIT 1;
 IF actor IS NULL THEN RAISE EXCEPTION 'Admin fixture required'; END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 SET LOCAL ROLE authenticated;
 INSERT INTO public.sales_leads(lead_code,customer_name,source,assigned_to,follow_up_notes)
 VALUES('TEST-'||gen_random_uuid(),'Workflow regression','website',actor,'Meeting scheduled') RETURNING id INTO lead;
 result:=public.convert_sales_lead_to_quotation(lead); q:=(result->>'quotation_id')::uuid;
 IF NOT (result->>'ok')::boolean OR q IS NULL THEN RAISE EXCEPTION 'Conversion failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.quotations WHERE id=q AND created_by=actor AND salesperson_name IS NOT DISTINCT FROM original_name AND status='drafted') THEN RAISE EXCEPTION 'Provenance missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sales_leads WHERE id=lead AND source='website' AND created_by IS NULL AND converted_quotation_id=q AND follow_up_notes='Meeting scheduled') THEN RAISE EXCEPTION 'Original lead changed'; END IF;
 result:=public.convert_sales_lead_to_quotation(lead);
 IF (result->>'quotation_id')::uuid<>q OR NOT (result->>'already_converted')::boolean THEN RAISE EXCEPTION 'Retry duplicated quotation'; END IF;
 INSERT INTO public.sales_leads(lead_code,customer_name,source,created_by,status) VALUES('TEST-'||gen_random_uuid(),'Manual regression','manual',actor,'lost') RETURNING id INTO lead;
 result:=public.convert_sales_lead_to_quotation(lead);
 IF (result->>'ok')::boolean THEN RAISE EXCEPTION 'Lost lead converted'; END IF;
 UPDATE public.sales_leads SET status='contacted' WHERE id=lead;
 result:=public.convert_sales_lead_to_quotation(lead);
 IF NOT (result->>'ok')::boolean OR NOT EXISTS(SELECT 1 FROM public.sales_leads WHERE id=lead AND source='manual' AND created_by=actor) THEN RAISE EXCEPTION 'Manual attribution lost'; END IF;
END $test$;
ROLLBACK;
