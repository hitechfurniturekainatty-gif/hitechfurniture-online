-- Staff floor operations are transactional, admin-only and recorded.
CREATE TABLE IF NOT EXISTS public.staff_floor_changes (
  request_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL CHECK (action IN ('arrange','move','stock')),
  details jsonb NOT NULL
);
ALTER TABLE public.staff_floor_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read floor changes" ON public.staff_floor_changes
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
GRANT SELECT ON public.staff_floor_changes TO authenticated;

CREATE OR REPLACE FUNCTION public.save_staff_floor(
  p_request_id uuid, p_action text, p_items jsonb, p_location uuid DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  item jsonb; row_id uuid; row_kind text; old_location uuid; old_order integer;
  target_row uuid; variant_id_value uuid; qty integer; index_value integer := 0;
  common_location uuid; first_item boolean := true;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_request_id IS NULL OR p_action NOT IN ('arrange','move')
     OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) < 1
     OR jsonb_array_length(p_items) > 5000 THEN RAISE EXCEPTION 'Invalid floor operation'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('staff_floor_changes'));
  IF EXISTS (SELECT 1 FROM public.staff_floor_changes WHERE request_id=p_request_id) THEN RETURN; END IF;
  IF p_action='move' AND NOT EXISTS (SELECT 1 FROM public.product_locations WHERE id=p_location AND is_active) THEN
    RAISE EXCEPTION 'Choose an active destination';
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_items)) <>
     (SELECT count(DISTINCT (value->>'kind') || ':' || (value->>'id')) FROM jsonb_array_elements(p_items)) THEN
    RAISE EXCEPTION 'Duplicate floor items';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    row_id := (item->>'id')::uuid; row_kind := item->>'kind';
    old_location := NULL; old_order := NULL;
    IF row_kind='product' THEN
      SELECT location_id,coalesce(floor_display_order,0) INTO old_location,old_order FROM public.products WHERE id=row_id AND deleted_at IS NULL FOR UPDATE;
    ELSIF row_kind='variant' THEN
      SELECT coalesce(v.location_id,p.location_id),coalesce(v.floor_display_order,0) INTO old_location,old_order
        FROM public.product_variants v JOIN public.products p ON p.id=v.product_id
        WHERE v.id=row_id AND p.deleted_at IS NULL FOR UPDATE OF v,p;
    ELSIF row_kind='variant_stock' THEN
      SELECT s.location_id,coalesce(s.floor_display_order,0) INTO old_location,old_order
        FROM public.product_variant_stock s JOIN public.product_variants v ON v.id=s.variant_id JOIN public.products p ON p.id=v.product_id
        WHERE s.id=row_id AND p.deleted_at IS NULL FOR UPDATE OF s;
    ELSIF row_kind='bundle' THEN
      SELECT location_id,coalesce(floor_display_order,0) INTO old_location,old_order FROM public.product_bundles WHERE id=row_id AND deleted_at IS NULL FOR UPDATE;
    ELSE RAISE EXCEPTION 'Unknown floor item'; END IF;
    IF old_order IS NULL THEN RAISE EXCEPTION 'Item no longer available. Refresh the catalog.'; END IF;
    IF old_location IS DISTINCT FROM nullif(item->>'location_id','')::uuid
      OR old_order IS DISTINCT FROM (item->>'floor_display_order')::integer THEN
      RAISE EXCEPTION 'Display changed. Refresh before saving.';
    END IF;
    IF p_action='arrange' THEN
      IF old_location IS NULL THEN RAISE EXCEPTION 'Set the item location first'; END IF;
      IF first_item THEN common_location := old_location; first_item := false; END IF;
      IF common_location IS DISTINCT FROM old_location THEN RAISE EXCEPTION 'Arrange one section at a time'; END IF;
    END IF;
    index_value := index_value+1;
    IF p_action='arrange' THEN
      IF row_kind='product' THEN UPDATE public.products SET floor_display_order=index_value*10 WHERE id=row_id;
      ELSIF row_kind='variant' THEN UPDATE public.product_variants SET floor_display_order=index_value*10 WHERE id=row_id;
      ELSIF row_kind='variant_stock' THEN UPDATE public.product_variant_stock SET floor_display_order=index_value*10 WHERE id=row_id;
      ELSE UPDATE public.product_bundles SET floor_display_order=index_value*10 WHERE id=row_id; END IF;
    ELSIF old_location IS DISTINCT FROM p_location THEN
      IF row_kind='product' THEN UPDATE public.products SET location_id=p_location,floor_display_order=0 WHERE id=row_id;
      ELSIF row_kind='variant' THEN UPDATE public.product_variants SET location_id=p_location,floor_display_order=0 WHERE id=row_id;
      ELSIF row_kind='bundle' THEN UPDATE public.product_bundles SET location_id=p_location,floor_display_order=0 WHERE id=row_id;
      ELSE
        SELECT variant_id,quantity INTO variant_id_value,qty FROM public.product_variant_stock WHERE id=row_id;
        SELECT id INTO target_row FROM public.product_variant_stock WHERE variant_id=variant_id_value AND location_id=p_location FOR UPDATE;
        IF target_row IS NOT NULL THEN
          UPDATE public.product_variant_stock SET quantity=quantity+qty WHERE id=target_row;
          UPDATE public.product_variant_stock SET quantity=0,floor_display_order=0 WHERE id=row_id;
        ELSE UPDATE public.product_variant_stock SET location_id=p_location,floor_display_order=0 WHERE id=row_id; END IF;
      END IF;
    END IF;
  END LOOP;
  INSERT INTO public.staff_floor_changes(request_id,created_by,action,details)
    VALUES(p_request_id,auth.uid(),p_action,jsonb_build_object('items',p_items,'destination',p_location));
END;
$$;
REVOKE ALL ON FUNCTION public.save_staff_floor(uuid,text,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_staff_floor(uuid,text,jsonb,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.adjust_staff_floor_stock(
  p_request_id uuid, p_kind text, p_id uuid, p_change integer, p_expected integer, p_reason text, p_note text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE product_id_value uuid; variant_id_value uuid; qty integer; product_qty integer; variant_qty integer; loc uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_request_id IS NULL OR p_change IS NULL OR p_change=0 OR abs(p_change::bigint)>1000000
    OR p_expected IS NULL OR p_kind NOT IN ('product','variant','variant_stock')
    OR p_reason NOT IN ('purchase','production','return','sale','damage','adjustment') THEN RAISE EXCEPTION 'Invalid stock movement'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('staff_floor_changes'));
  IF EXISTS (SELECT 1 FROM public.staff_floor_changes WHERE request_id=p_request_id) THEN RETURN; END IF;
  -- Match the existing ledger lock order: product, variant, location stock.
  IF p_kind='product' THEN product_id_value:=p_id;
  ELSIF p_kind='variant' THEN SELECT product_id,id INTO product_id_value,variant_id_value FROM public.product_variants WHERE id=p_id;
  ELSE SELECT v.product_id,v.id INTO product_id_value,variant_id_value FROM public.product_variant_stock s JOIN public.product_variants v ON v.id=s.variant_id WHERE s.id=p_id; END IF;
  SELECT stock_quantity,location_id INTO product_qty,loc FROM public.products WHERE id=product_id_value AND deleted_at IS NULL FOR UPDATE;
  IF product_qty IS NULL THEN RAISE EXCEPTION 'Product unavailable'; END IF;
  IF p_kind='product' THEN
    IF EXISTS (SELECT 1 FROM public.product_variants WHERE product_id=product_id_value) THEN RAISE EXCEPTION 'Choose a colour to update its stock'; END IF;
    qty:=product_qty;
  ELSE
    SELECT stock_quantity,coalesce(location_id,loc) INTO variant_qty,loc FROM public.product_variants WHERE id=variant_id_value FOR UPDATE;
    IF p_kind='variant' THEN
      IF EXISTS (SELECT 1 FROM public.product_variant_stock WHERE variant_id=variant_id_value) THEN RAISE EXCEPTION 'Choose a location stock row'; END IF;
      qty:=variant_qty;
    ELSE SELECT quantity,location_id INTO qty,loc FROM public.product_variant_stock WHERE id=p_id FOR UPDATE; END IF;
  END IF;
  IF qty IS NULL OR qty<>p_expected THEN RAISE EXCEPTION 'Stock changed. Refresh and try again.'; END IF;
  IF qty+p_change<0 OR product_qty+p_change<0 OR (variant_id_value IS NOT NULL AND variant_qty+p_change<0) THEN
    RAISE EXCEPTION 'Not enough stock. Check the product and colour totals.';
  END IF;
  IF p_kind='variant_stock' THEN UPDATE public.product_variant_stock SET quantity=quantity+p_change WHERE id=p_id; END IF;
  IF variant_id_value IS NOT NULL THEN UPDATE public.product_variants SET stock_quantity=stock_quantity+p_change WHERE id=variant_id_value; END IF;
  INSERT INTO public.stock_movements(product_id,change_qty,reason,note,resulting_stock,created_by)
    VALUES(product_id_value,p_change,p_reason,concat_ws(' · ',nullif(btrim(p_note),''),'Staff Catalog',p_kind,p_id::text,'location ' || loc::text),0,auth.uid());
  UPDATE public.products SET stock_status=CASE WHEN stock_quantity>0 THEN 'in_stock' ELSE 'out_of_stock' END WHERE id=product_id_value;
  INSERT INTO public.staff_floor_changes(request_id,created_by,action,details)
    VALUES(p_request_id,auth.uid(),'stock',jsonb_build_object('kind',p_kind,'id',p_id,'change',p_change,'before',qty,'after',qty+p_change,'reason',p_reason,'location_id',loc));
END;
$$;
REVOKE ALL ON FUNCTION public.adjust_staff_floor_stock(uuid,text,uuid,integer,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.adjust_staff_floor_stock(uuid,text,uuid,integer,integer,text,text) TO authenticated;
