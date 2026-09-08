-- Restrict service integration tables to service_role; staff analytics stays read-only.
ALTER POLICY "Allow service access" ON public.whatsapp_inbound_log TO service_role;
ALTER POLICY "Allow service access" ON public.whatsapp_followups_sent TO service_role;
ALTER POLICY "service_role_all_vendor_item_map" ON public.vendor_item_map TO service_role;
ALTER POLICY "service_role_all_pending_catalog_items" ON public.pending_catalog_items TO service_role;
ALTER POLICY "service_role_all_busy_item_master" ON public.busy_item_master TO service_role;
ALTER POLICY "service_role_all_busy_creditors" ON public.busy_creditors TO service_role;
ALTER POLICY "invoice_processing_log_service_all" ON public.invoice_processing_log TO service_role;
CREATE POLICY "Office read whatsapp_inbound_log" ON public.whatsapp_inbound_log FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')));
CREATE POLICY "Office read whatsapp_followups_sent" ON public.whatsapp_followups_sent FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')));
DROP POLICY IF EXISTS "Allow public insert quotations" ON public.quotations;
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$ BEGIN
INSERT INTO public.profiles(user_id, display_name, email) VALUES(NEW.id,COALESCE(NEW.raw_user_meta_data->>'display_name',split_part(NEW.email,'@',1)),NEW.email);
-- Roles are assigned only by the verified admin/worker provisioning endpoint.
RETURN NEW; END; $fn$;
REVOKE EXECUTE ON FUNCTION public.quotations_status_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_quotation_stage(_quotation_id uuid, _stage smallint, _target_role app_role, _title text, _body text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_stock_movement() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_bundle_stock(_bundle_id uuid, _qty numeric, _reason text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trip_quotations_autoadvance() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_bundle_stock(_bundle_id uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_role_recipients(p_role text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.customer_complaints_notify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.customer_services_notify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.job_work_orders_notify_assignment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pipeline_notifications_forward() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_quotation_receivable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_receivable_followup_summary() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.jobs_autoadvance() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_job_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.measurement_tasks_autoadvance() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_receivable_payment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bundle_items_recompute() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.job_work_orders_notify_warehouse() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.job_work_orders_resolve_source() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pipeline_notifications_autofill() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prepare_receivable_payment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.products_recompute_bundles() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_bundle_cost_price() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_cost_price() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.quotation_items_bundle_consume() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.quotation_items_check_completion() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.quotation_items_dispatch_advance() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.quotations_delivery_review_notify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.quotations_initial_notify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.quotations_initial_stage() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.quotations_set_updated_by() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.quotations_stage_autoadvance() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.quotations_status_autobump() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.quotations_status_log() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.quotations_sync_status_from_stage() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_quotation_totals() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_job_item_warehouse_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_receivable_to_quotation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trip_quotations_mark_delivered() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trips_notify_driver() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.next_quotation_id(_party text, _place text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _scope TEXT;
  _next INT;
  _safe_party TEXT;
  _safe_place TEXT;
  _fy TEXT;
  _y INT;
  _m INT;
  _start_year INT;
  _end_year INT;
BEGIN
 IF COALESCE(auth.role(),'') <> 'service_role' AND NOT ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')) OR public.has_role(auth.uid(), 'measurement_staff')) THEN RAISE EXCEPTION 'Staff access required' USING ERRCODE='42501'; END IF;

  -- Sanitize party and place (keep spaces collapsed to single space, strip other punctuation)
  _safe_party := btrim(regexp_replace(coalesce(_party, 'NA'), '[^a-zA-Z0-9 ]+', '', 'g'));
  _safe_place := btrim(regexp_replace(coalesce(_place, 'NA'), '[^a-zA-Z0-9 ]+', '', 'g'));
  IF length(_safe_party) = 0 THEN _safe_party := 'NA'; END IF;
  IF length(_safe_place) = 0 THEN _safe_place := 'NA'; END IF;

  -- Compute Indian financial year (Apr–Mar), e.g. 2026/27
  _y := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
  _m := EXTRACT(MONTH FROM CURRENT_DATE)::INT;
  IF _m >= 4 THEN
    _start_year := _y;
    _end_year := _y + 1;
  ELSE
    _start_year := _y - 1;
    _end_year := _y;
  END IF;
  _fy := _start_year::TEXT || '/' || lpad((_end_year % 100)::TEXT, 2, '0');

  -- Per financial-year global counter (audit-safe: never reused even after deletes)
  _scope := 'fy-' || _fy;
  INSERT INTO public.quotation_counters(scope, last_serial)
    VALUES (_scope, 1)
  ON CONFLICT (scope) DO UPDATE
    SET last_serial = public.quotation_counters.last_serial + 1
  RETURNING last_serial INTO _next;

  -- Format: 2026/27-001 / Rahul / Kalpetta
  RETURN _fy || '-' || lpad(_next::TEXT, 3, '0') || ' / ' || initcap(_safe_party) || ' / ' || initcap(_safe_place);
END;
$function$;

CREATE OR REPLACE FUNCTION public.next_po_id(_party text, _place text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _scope TEXT;
  _next INT;
  _safe_party TEXT;
  _safe_place TEXT;
  _fy TEXT;
  _y INT;
  _m INT;
  _start_year INT;
  _end_year INT;
BEGIN
 IF COALESCE(auth.role(),'') <> 'service_role' AND NOT ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))) THEN RAISE EXCEPTION 'Staff access required' USING ERRCODE='42501'; END IF;

  _safe_party := btrim(regexp_replace(coalesce(_party, 'NA'), '[^a-zA-Z0-9 ]+', '', 'g'));
  _safe_place := btrim(regexp_replace(coalesce(_place, 'NA'), '[^a-zA-Z0-9 ]+', '', 'g'));
  IF length(_safe_party) = 0 THEN _safe_party := 'NA'; END IF;
  IF length(_safe_place) = 0 THEN _safe_place := 'NA'; END IF;

  _y := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
  _m := EXTRACT(MONTH FROM CURRENT_DATE)::INT;
  IF _m >= 4 THEN
    _start_year := _y;
    _end_year := _y + 1;
  ELSE
    _start_year := _y - 1;
    _end_year := _y;
  END IF;
  _fy := _start_year::TEXT || '/' || lpad((_end_year % 100)::TEXT, 2, '0');

  -- Per-FY PO counter (separate scope from quotations)
  _scope := 'po-fy-' || _fy;
  INSERT INTO public.quotation_counters(scope, last_serial)
    VALUES (_scope, 1)
  ON CONFLICT (scope) DO UPDATE
    SET last_serial = public.quotation_counters.last_serial + 1
  RETURNING last_serial INTO _next;

  RETURN 'PO-' || _fy || '-' || lpad(_next::TEXT, 3, '0') || ' / ' || initcap(_safe_party) || ' / ' || initcap(_safe_place);
END;
$function$;

CREATE OR REPLACE FUNCTION public.next_service_id()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _scope TEXT;
  _next INT;
  _fy TEXT;
  _y INT; _m INT; _start_year INT; _end_year INT;
BEGIN
 IF COALESCE(auth.role(),'') <> 'service_role' AND NOT ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))) THEN RAISE EXCEPTION 'Staff access required' USING ERRCODE='42501'; END IF;

  _y := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
  _m := EXTRACT(MONTH FROM CURRENT_DATE)::INT;
  IF _m >= 4 THEN _start_year := _y; _end_year := _y + 1;
  ELSE _start_year := _y - 1; _end_year := _y; END IF;
  _fy := _start_year::TEXT || '/' || lpad((_end_year % 100)::TEXT, 2, '0');

  _scope := 'sv-fy-' || _fy;
  INSERT INTO public.quotation_counters(scope, last_serial)
    VALUES (_scope, 1)
  ON CONFLICT (scope) DO UPDATE
    SET last_serial = public.quotation_counters.last_serial + 1
  RETURNING last_serial INTO _next;

  RETURN 'SV-' || _fy || '-' || lpad(_next::TEXT, 3, '0');
END;
$function$;

CREATE OR REPLACE FUNCTION public.next_complaint_id()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _scope TEXT;
  _next INT;
  _fy TEXT;
  _y INT; _m INT; _start_year INT; _end_year INT;
BEGIN
 IF COALESCE(auth.role(),'') <> 'service_role' AND NOT ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))) THEN RAISE EXCEPTION 'Staff access required' USING ERRCODE='42501'; END IF;

  _y := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
  _m := EXTRACT(MONTH FROM CURRENT_DATE)::INT;
  IF _m >= 4 THEN _start_year := _y; _end_year := _y + 1;
  ELSE _start_year := _y - 1; _end_year := _y; END IF;
  _fy := _start_year::TEXT || '/' || lpad((_end_year % 100)::TEXT, 2, '0');

  _scope := 'cp-fy-' || _fy;
  INSERT INTO public.quotation_counters(scope, last_serial)
    VALUES (_scope, 1)
  ON CONFLICT (scope) DO UPDATE
    SET last_serial = public.quotation_counters.last_serial + 1
  RETURNING last_serial INTO _next;

  RETURN 'CP-' || _fy || '-' || lpad(_next::TEXT, 3, '0');
END;
$function$;

CREATE OR REPLACE FUNCTION public.start_lead_chat(p_quotation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _phone text;
  _name text;
BEGIN
 IF COALESCE(auth.role(),'') <> 'service_role' AND NOT ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))) THEN RAISE EXCEPTION 'Staff access required' USING ERRCODE='42501'; END IF;

  SELECT party_phone, party_name INTO _phone, _name
    FROM public.quotations WHERE id = p_quotation_id;

  IF _phone IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No phone on this lead');
  END IF;

  UPDATE public.quotations
     SET enquiry_contacted_at = COALESCE(enquiry_contacted_at, now())
   WHERE id = p_quotation_id;

  INSERT INTO public.pipeline_notifications
    (quotation_id, source_type, source_id, stage, target_role, title, body, recipients)
  VALUES
    (p_quotation_id, 'lead_chat', p_quotation_id, 1, 'admin'::app_role, 'Lead first contact', COALESCE(_name,'Customer'),
     ARRAY[regexp_replace(_phone, '[^0-9]', '', 'g')]::text[]);

  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.verify_catalog_pin(_pin text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _hash text;
BEGIN
 IF COALESCE(auth.role(),'') <> 'service_role' AND NOT ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))) THEN RAISE EXCEPTION 'Staff access required' USING ERRCODE='42501'; END IF;

  SELECT value INTO _hash FROM public.admin_settings WHERE key = 'catalog_pin_hash';
  IF _hash IS NULL THEN
    RETURN false;
  END IF;
  RETURN _hash = extensions.crypt(_pin, _hash);
END;
$function$;

CREATE OR REPLACE FUNCTION public.catalog_pin_is_set()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
 IF COALESCE(auth.role(),'') <> 'service_role' AND NOT ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))) THEN RAISE EXCEPTION 'Staff access required' USING ERRCODE='42501'; END IF;

  RETURN EXISTS (SELECT 1 FROM public.admin_settings WHERE key = 'catalog_pin_hash');
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_reserved_stock() RETURNS TABLE(product_id uuid,reserved numeric) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $fn$
SELECT qi.product_id,COALESCE(SUM(qi.quantity),0)::numeric FROM public.quotation_items qi JOIN public.quotations q ON q.id=qi.quotation_id
WHERE ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')) OR public.has_role(auth.uid(),'warehouse')) AND qi.product_id IS NOT NULL AND qi.delivered_at IS NULL AND qi.fulfillment_route='ready_stock' AND q.deleted_at IS NULL AND q.status NOT IN ('rejected','delivered','drafted') GROUP BY qi.product_id; $fn$;
CREATE OR REPLACE FUNCTION public.get_shared_quotation(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  q_row public.quotations%ROWTYPE;
  items jsonb;
BEGIN
  SELECT * INTO q_row FROM public.quotations where share_token = p_token AND deleted_at IS NULL LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'description', i.description,
        'quantity', i.quantity,
        'measurement', i.measurement,
        'item_image_url', i.item_image_url,
        'measurement_image_url', i.measurement_image_url,
        'catalog_text', i.catalog_text,
        'catalog_image_url', i.catalog_image_url,
        'sketch_url', i.sketch_url,
        'site_photos', i.site_photos,
        'unit_price', i.unit_price,
        'total_price', i.amount,
        'fulfillment_route', i.fulfillment_route
      )
      ORDER BY i.display_order NULLS LAST, i.created_at
    ),
    '[]'::jsonb
  )
  INTO items
  FROM public.quotation_items i
  WHERE i.quotation_id = q_row.id;

  RETURN jsonb_build_object(
    'quotation', jsonb_build_object(
      'id', q_row.id,
      'quotation_id', q_row.quotation_id,
      'party_name', q_row.party_name,
      'party_phone', q_row.party_phone,
      'party_place', q_row.party_place,
      'status', q_row.status,
      'total_amount', q_row.total,
      'advance_amount', q_row.advance_amount,
      'notes', q_row.notes,
      'updated_at', q_row.updated_at
    ),
    'items', items
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_shared_quotation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_quotation(uuid) TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.get_shared_job_work_order(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  jw_row public.job_work_orders%ROWTYPE;
  q_row public.quotations%ROWTYPE;
  items jsonb;
BEGIN
  SELECT * INTO jw_row FROM public.job_work_orders where share_token = p_token AND deleted_at IS NULL LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO q_row FROM public.quotations WHERE id = jw_row.quotation_id AND deleted_at IS NULL LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'description', i.description,
      'quantity', i.quantity,
      'measurement', i.measurement,
      'item_image_url', i.item_image_url,
      'measurement_image_url', i.measurement_image_url,
      'catalog_text', i.catalog_text,
      'catalog_image_url', i.catalog_image_url,
      'sketch_url', i.sketch_url,
      'site_photos', i.site_photos
    )
    ORDER BY array_position(jw_row.item_ids, i.id)
  ), '[]'::jsonb)
    INTO items
  FROM public.quotation_items i
  WHERE i.id = ANY(jw_row.item_ids);

  RETURN jsonb_build_object(
    'job', jsonb_build_object(
      'id', jw_row.id,
      'status', jw_row.status,
      'notes', jw_row.notes,
      'is_urgent', jw_row.is_urgent,
      'created_at', jw_row.created_at,
      'item_ids', jw_row.item_ids
    ),
    'quotation_code', q_row.quotation_id,
    'party_place', q_row.party_place,
    'items', items
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_shared_job_work_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_job_work_order(uuid) TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.get_shared_delivery_note(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  q_row public.quotations%rowtype;
  items jsonb;
  route_name text;
  _ledger_balance numeric;
  _balance numeric;
begin
  select * into q_row
  from public.quotations
  where share_token = p_token AND deleted_at IS NULL
  limit 1;

  if not found then return null; end if;

  if coalesce(q_row.dispatched_at, q_row.updated_at) < (now() - interval '24 hours') then
    return jsonb_build_object('expired', true);
  end if;

  select dr.name into route_name
  from public.delivery_routes dr
  where dr.id = q_row.delivery_route_id and dr.deleted_at is null
  limit 1;

  select r.pending_amount into _ledger_balance
  from public.receivables r
  where r.quotation_id=q_row.id and r.source='quotation'
  limit 1;

  _balance := coalesce(_ledger_balance, greatest(coalesce(q_row.total,0)-coalesce(q_row.advance_amount,0),0));

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'description', i.description,
        'quantity', i.quantity,
        'measurement', i.measurement,
        'item_image_url', coalesce(
          i.item_image_url,
          (select pi.image_url from public.product_images pi where pi.product_id=i.product_id order by pi.display_order nulls last limit 1),
          (select pb.main_image_url from public.product_bundles pb where pb.id=i.bundle_id limit 1)
        ),
        'measurement_image_url', i.measurement_image_url,
        'catalog_text', i.catalog_text,
        'catalog_image_url', i.catalog_image_url,
        'sketch_url', i.sketch_url,
        'site_photos', i.site_photos,
        'item_notes', i.item_notes,
        'fulfillment_route', i.fulfillment_route,
        'dispatched_at', i.dispatched_at,
        'delivered_at', i.delivered_at
      ) order by i.display_order nulls last, i.created_at
    ), '[]'::jsonb
  ) into items
  from public.quotation_items i
  where i.quotation_id=q_row.id;

  return jsonb_build_object(
    'quotation', jsonb_build_object(
      'id', q_row.id,
      'quotation_id', q_row.quotation_id,
      'party_name', q_row.party_name,
      'party_phone', q_row.party_phone,
      'party_place', q_row.party_place,
      'party_address', q_row.party_address,
      'delivery_place', q_row.delivery_place,
      'delivery_route', route_name,
      'expected_delivery_date', q_row.expected_delivery_date,
      'status', q_row.status,
      'notes', q_row.notes,
      'advance_amount', coalesce(q_row.advance_amount,0),
      'balance_to_collect', greatest(coalesce(_balance,0),0),
      'dispatch_vehicle', q_row.dispatch_vehicle,
      'dispatch_vehicle_number', q_row.dispatch_vehicle_number,
      'dispatch_driver_name', q_row.dispatch_driver_name,
      'dispatch_driver_phone', q_row.dispatch_driver_phone,
      'updated_at', q_row.updated_at,
      'dispatched_at', q_row.dispatched_at,
      'expires_at', (coalesce(q_row.dispatched_at, q_row.updated_at) + interval '24 hours')
    ),
    'items', items
  );
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_shared_delivery_note(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_delivery_note(uuid) TO anon,authenticated,service_role;
REVOKE ALL ON public.command_center_snapshot FROM anon;
ALTER VIEW public.products_safe_search SET (security_invoker=true);
ALTER VIEW public.command_center_snapshot SET (security_invoker=true);
ALTER VIEW public.products_staff_catalog SET (security_invoker=true);
ALTER VIEW public.products_inventory_filterable SET (security_invoker=true);
-- Public callers can read catalogue attributes but cannot request supplier cost.
REVOKE SELECT ON public.products,public.product_bundles FROM anon;
DO $do$ DECLARE t text; cols text; BEGIN FOREACH t IN ARRAY ARRAY['products','product_bundles'] LOOP
 SELECT string_agg(quote_ident(column_name),',') INTO cols FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name<>'cost_price';
 EXECUTE format('GRANT SELECT (%s) ON public.%I TO anon',cols,t);
END LOOP; END $do$;
DROP POLICY IF EXISTS "quotations upload" ON storage.objects;
DROP POLICY IF EXISTS "quotations update" ON storage.objects;
DROP POLICY IF EXISTS "quotations delete" ON storage.objects;
CREATE POLICY "quotations authorized upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='quotations' AND ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')) OR public.has_role(auth.uid(),'measurement_staff') OR public.has_role(auth.uid(),'warehouse') OR public.has_role(auth.uid(),'delivery') OR public.has_role(auth.uid(),'worker')));
CREATE POLICY "quotations authorized update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='quotations' AND ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')) OR (owner_id=auth.uid()::text AND ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')) OR public.has_role(auth.uid(),'measurement_staff') OR public.has_role(auth.uid(),'warehouse') OR public.has_role(auth.uid(),'delivery') OR public.has_role(auth.uid(),'worker'))))) WITH CHECK (bucket_id='quotations' AND ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')) OR (owner_id=auth.uid()::text AND ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')) OR public.has_role(auth.uid(),'measurement_staff') OR public.has_role(auth.uid(),'warehouse') OR public.has_role(auth.uid(),'delivery') OR public.has_role(auth.uid(),'worker')))));
CREATE POLICY "quotations authorized delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='quotations' AND ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')) OR (owner_id=auth.uid()::text AND ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')) OR public.has_role(auth.uid(),'measurement_staff') OR public.has_role(auth.uid(),'warehouse') OR public.has_role(auth.uid(),'delivery') OR public.has_role(auth.uid(),'worker')))));
DROP POLICY IF EXISTS "product-images upload" ON storage.objects;
DROP POLICY IF EXISTS "product-images update" ON storage.objects;
DROP POLICY IF EXISTS "product-images delete" ON storage.objects;
CREATE POLICY "product-images authorized upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='product-images' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')));
CREATE POLICY "product-images authorized update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='product-images' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))) WITH CHECK (bucket_id='product-images' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')));
CREATE POLICY "product-images authorized delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='product-images' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')));
NOTIFY pgrst, 'reload schema';

ALTER POLICY "Public read published products" ON public.products TO anon;
ALTER POLICY "Public read published bundles" ON public.product_bundles TO anon;

