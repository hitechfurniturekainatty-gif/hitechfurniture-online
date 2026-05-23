
DROP POLICY IF EXISTS "Public read bundle images" ON public.bundle_images;
CREATE POLICY "Public read bundle images" ON public.bundle_images FOR SELECT
USING (EXISTS (SELECT 1 FROM public.product_bundles b WHERE b.id = bundle_images.bundle_id AND b.is_published = true AND b.deleted_at IS NULL));
CREATE POLICY "Staff read bundle images" ON public.bundle_images FOR SELECT
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role) OR has_role(auth.uid(),'warehouse'::app_role) OR has_role(auth.uid(),'delivery'::app_role) OR has_role(auth.uid(),'measurement_staff'::app_role));

DROP POLICY IF EXISTS "Public read bundle items" ON public.bundle_items;
CREATE POLICY "Public read bundle items" ON public.bundle_items FOR SELECT
USING (EXISTS (SELECT 1 FROM public.product_bundles b WHERE b.id = bundle_items.bundle_id AND b.is_published = true AND b.deleted_at IS NULL));
CREATE POLICY "Staff read bundle items" ON public.bundle_items FOR SELECT
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role) OR has_role(auth.uid(),'warehouse'::app_role) OR has_role(auth.uid(),'delivery'::app_role) OR has_role(auth.uid(),'measurement_staff'::app_role));

DROP POLICY IF EXISTS "Public read product images" ON public.product_images;
CREATE POLICY "Public read product images" ON public.product_images FOR SELECT
USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_images.product_id AND p.is_published = true AND p.deleted_at IS NULL));
CREATE POLICY "Staff read product images" ON public.product_images FOR SELECT
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role) OR has_role(auth.uid(),'warehouse'::app_role) OR has_role(auth.uid(),'delivery'::app_role) OR has_role(auth.uid(),'measurement_staff'::app_role));

DROP POLICY IF EXISTS "Public read product variants" ON public.product_variants;
CREATE POLICY "Public read product variants" ON public.product_variants FOR SELECT
USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variants.product_id AND p.is_published = true AND p.deleted_at IS NULL));
CREATE POLICY "Staff read product variants" ON public.product_variants FOR SELECT
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role) OR has_role(auth.uid(),'warehouse'::app_role) OR has_role(auth.uid(),'delivery'::app_role) OR has_role(auth.uid(),'measurement_staff'::app_role));

DROP POLICY IF EXISTS "Public read variant stock" ON public.product_variant_stock;
CREATE POLICY "Public read variant stock" ON public.product_variant_stock FOR SELECT
USING (EXISTS (SELECT 1 FROM public.product_variants v JOIN public.products p ON p.id = v.product_id WHERE v.id = product_variant_stock.variant_id AND p.is_published = true AND p.deleted_at IS NULL));
CREATE POLICY "Staff read variant stock" ON public.product_variant_stock FOR SELECT
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role) OR has_role(auth.uid(),'warehouse'::app_role) OR has_role(auth.uid(),'delivery'::app_role) OR has_role(auth.uid(),'measurement_staff'::app_role));

-- Hide cost_price from anonymous via column-level grants
REVOKE SELECT ON public.products FROM anon;
GRANT SELECT (
  id, main_category_id, sub_category_id, product_name, product_code, description,
  mrp, offer_price, available_colors, material, dimensions, stock_quantity,
  is_featured, is_published, created_at, updated_at, reorder_level,
  deleted_at, deleted_by, location_id, stock_status, floor_display_order
) ON public.products TO anon;

REVOKE SELECT ON public.product_bundles FROM anon;
GRANT SELECT (
  id, bundle_code, name, description, main_category_id, sub_category_id, main_image_url,
  mrp, offer_price, available_colors, material, dimensions, is_featured, is_published,
  stock_status, floor_display_order, deleted_at, deleted_by, created_by, created_at,
  updated_at, location_id, show_item_prices_public, show_item_prices_staff
) ON public.product_bundles TO anon;
