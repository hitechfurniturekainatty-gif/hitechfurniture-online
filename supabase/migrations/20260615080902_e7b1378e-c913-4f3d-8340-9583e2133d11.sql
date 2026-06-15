
-- Allow office staff (role = 'staff') the same write access as admin on inventory tables.

-- main_categories
DROP POLICY IF EXISTS "Admins insert main categories" ON public.main_categories;
DROP POLICY IF EXISTS "Admins update main categories" ON public.main_categories;
DROP POLICY IF EXISTS "Admins delete main categories" ON public.main_categories;
CREATE POLICY "Staff insert main categories" ON public.main_categories FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));
CREATE POLICY "Staff update main categories" ON public.main_categories FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));
CREATE POLICY "Staff delete main categories" ON public.main_categories FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));

-- sub_categories
DROP POLICY IF EXISTS "Admins insert sub categories" ON public.sub_categories;
DROP POLICY IF EXISTS "Admins update sub categories" ON public.sub_categories;
DROP POLICY IF EXISTS "Admins delete sub categories" ON public.sub_categories;
CREATE POLICY "Staff insert sub categories" ON public.sub_categories FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));
CREATE POLICY "Staff update sub categories" ON public.sub_categories FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));
CREATE POLICY "Staff delete sub categories" ON public.sub_categories FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));

-- products
DROP POLICY IF EXISTS "Admins insert products" ON public.products;
DROP POLICY IF EXISTS "Admins update products" ON public.products;
DROP POLICY IF EXISTS "Admins delete products" ON public.products;
CREATE POLICY "Staff insert products" ON public.products FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));
CREATE POLICY "Staff update products" ON public.products FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));
CREATE POLICY "Staff delete products" ON public.products FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));

-- product_images
DROP POLICY IF EXISTS "Admins insert product images" ON public.product_images;
DROP POLICY IF EXISTS "Admins update product images" ON public.product_images;
DROP POLICY IF EXISTS "Admins delete product images" ON public.product_images;
CREATE POLICY "Staff insert product images" ON public.product_images FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));
CREATE POLICY "Staff update product images" ON public.product_images FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));
CREATE POLICY "Staff delete product images" ON public.product_images FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));

-- product_variants
DROP POLICY IF EXISTS "Admins write product variants" ON public.product_variants;
CREATE POLICY "Staff write product variants" ON public.product_variants FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));

-- product_variant_stock
DROP POLICY IF EXISTS "Admins write product variant stock" ON public.product_variant_stock;
CREATE POLICY "Staff write product variant stock" ON public.product_variant_stock FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));

-- product_locations
DROP POLICY IF EXISTS "Admins write product locations" ON public.product_locations;
CREATE POLICY "Staff write product locations" ON public.product_locations FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));

-- stock_movements
DROP POLICY IF EXISTS "Admins write stock movements" ON public.stock_movements;
CREATE POLICY "Staff write stock movements" ON public.stock_movements FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));

-- product_bundles
DROP POLICY IF EXISTS "Admins insert bundles" ON public.product_bundles;
DROP POLICY IF EXISTS "Admins update bundles" ON public.product_bundles;
DROP POLICY IF EXISTS "Admins delete bundles" ON public.product_bundles;
CREATE POLICY "Staff insert bundles" ON public.product_bundles FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));
CREATE POLICY "Staff update bundles" ON public.product_bundles FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));
CREATE POLICY "Staff delete bundles" ON public.product_bundles FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));

-- bundle_items
DROP POLICY IF EXISTS "Admins write bundle items" ON public.bundle_items;
CREATE POLICY "Staff write bundle items" ON public.bundle_items FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));

-- bundle_images
DROP POLICY IF EXISTS "Admins write bundle images" ON public.bundle_images;
CREATE POLICY "Staff write bundle images" ON public.bundle_images FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));
