-- Apply only AFTER the catalogCostFetch frontend is confirmed deployed.
-- Older clients requesting cost_price directly will receive permission errors.
CREATE OR REPLACE VIEW public.products_staff_catalog WITH (security_invoker=true) AS
 SELECT p.id,
    p.product_name,
    p.product_code,
    p.mrp,
    p.offer_price,
    (private.catalog_costs('products',ARRAY[p.id])->>p.id::text)::numeric AS cost_price,
    p.stock_quantity,
    p.reorder_level,
    p.stock_status,
    p.primary_material,
    p.secondary_material,
    p.color_finish,
    p.dim_height,
    p.dim_width,
    p.dim_depth,
    p.warranty_period,
    p.delivery_condition,
    p.hsn_code,
    p.gst_rate,
    p.primary_image_url,
    p.main_category_id,
    p.sub_category_id,
    p.review_status,
    p.creation_method,
    pl.building,
    pl.floor,
    pl.section,
    pl.part,
    p.floor_display_order
   FROM (products p
     LEFT JOIN product_locations pl ON ((pl.id = p.location_id)))
  WHERE ((p.deleted_at IS NULL) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'warehouse'::app_role) OR has_role(auth.uid(), 'delivery'::app_role) OR has_role(auth.uid(), 'measurement_staff'::app_role)));
CREATE OR REPLACE VIEW public.products_inventory_filterable WITH (security_invoker=true) AS
 SELECT p.id,
    p.product_code,
    p.product_name,
    p.description,
    mc.id AS main_category_id,
    mc.name AS main_category_name,
    mc.slug AS main_category_slug,
    sc.id AS sub_category_id,
    sc.name AS sub_category_name,
    sc.slug AS sub_category_slug,
    p.stock_quantity,
    p.stock_status,
    p.reorder_level,
    p.mrp,
    p.offer_price,
    (private.catalog_costs('products',ARRAY[p.id])->>p.id::text)::numeric AS cost_price,
    p.primary_material,
    p.secondary_material,
    p.color_finish,
    p.available_colors,
    p.dimensions,
    p.dim_height,
    p.dim_width,
    p.dim_depth,
    p.hsn_code,
    p.gst_rate,
    p.location_id,
    pl.building,
    pl.floor,
    pl.section,
    pl.part,
    p.primary_image_url,
    ( SELECT count(*) AS count
           FROM product_images pi
          WHERE (pi.product_id = p.id)) AS gallery_image_count,
    p.is_published,
    p.review_status,
    p.creation_method,
    p.floor_display_order,
    p.created_at,
    p.updated_at
   FROM (((products p
     JOIN main_categories mc ON ((mc.id = p.main_category_id)))
     LEFT JOIN sub_categories sc ON ((sc.id = p.sub_category_id)))
     LEFT JOIN product_locations pl ON ((pl.id = p.location_id)))
  WHERE (p.deleted_at IS NULL);
DO $$ DECLARE t text; cols text; BEGIN
 FOREACH t IN ARRAY ARRAY['products','product_bundles'] LOOP
  EXECUTE format('REVOKE SELECT ON public.%I FROM authenticated',t);
  EXECUTE format('REVOKE SELECT (cost_price) ON public.%I FROM authenticated',t);
  SELECT string_agg(quote_ident(column_name),',') INTO cols FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name<>'cost_price';
  EXECUTE format('GRANT SELECT (%s) ON public.%I TO authenticated',cols,t);
 END LOOP;
END $$;
NOTIFY pgrst, 'reload schema';


