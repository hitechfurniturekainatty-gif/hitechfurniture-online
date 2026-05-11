-- =========================================================
-- Tighten inventory RLS: write = admin (or admin+warehouse), read = staff/auth
-- Office Staff loses write on Categories/Products/Variants
-- New 'warehouse' role: read products + manage stock counts/movements
-- =========================================================

-- ---------- main_categories ----------
DROP POLICY IF EXISTS "Staff insert main categories" ON public.main_categories;
DROP POLICY IF EXISTS "Staff update main categories" ON public.main_categories;
CREATE POLICY "Admins insert main categories" ON public.main_categories
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update main categories" ON public.main_categories
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ---------- sub_categories ----------
DROP POLICY IF EXISTS "Staff insert sub categories" ON public.sub_categories;
DROP POLICY IF EXISTS "Staff update sub categories" ON public.sub_categories;
CREATE POLICY "Admins insert sub categories" ON public.sub_categories
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update sub categories" ON public.sub_categories
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ---------- products ----------
DROP POLICY IF EXISTS "Staff insert products" ON public.products;
DROP POLICY IF EXISTS "Staff update products" ON public.products;
DROP POLICY IF EXISTS "Staff full read products" ON public.products;
CREATE POLICY "Admins insert products" ON public.products
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update products" ON public.products
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Auth staff read products" ON public.products
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR ((has_role(auth.uid(), 'staff'::app_role)
         OR has_role(auth.uid(), 'warehouse'::app_role)
         OR has_role(auth.uid(), 'delivery'::app_role)
         OR has_role(auth.uid(), 'measurement_staff'::app_role))
        AND deleted_at IS NULL)
  );

-- ---------- product_variants ----------
DROP POLICY IF EXISTS "Staff insert product variants" ON public.product_variants;
DROP POLICY IF EXISTS "Staff update product variants" ON public.product_variants;
DROP POLICY IF EXISTS "Staff delete product variants" ON public.product_variants;
CREATE POLICY "Admins insert product variants" ON public.product_variants
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update product variants" ON public.product_variants
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete product variants" ON public.product_variants
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ---------- product_images ----------
DROP POLICY IF EXISTS "Staff insert product images" ON public.product_images;
DROP POLICY IF EXISTS "Staff update product images" ON public.product_images;
DROP POLICY IF EXISTS "Staff delete product images" ON public.product_images;
CREATE POLICY "Admins insert product images" ON public.product_images
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update product images" ON public.product_images
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete product images" ON public.product_images
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ---------- product_variant_stock (warehouse can manage) ----------
DROP POLICY IF EXISTS "Staff insert variant stock" ON public.product_variant_stock;
DROP POLICY IF EXISTS "Staff update variant stock" ON public.product_variant_stock;
DROP POLICY IF EXISTS "Staff delete variant stock" ON public.product_variant_stock;
CREATE POLICY "Admins or warehouse insert variant stock" ON public.product_variant_stock
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'warehouse'::app_role));
CREATE POLICY "Admins or warehouse update variant stock" ON public.product_variant_stock
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'warehouse'::app_role));
CREATE POLICY "Admins delete variant stock" ON public.product_variant_stock
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ---------- stock_movements (warehouse can record) ----------
DROP POLICY IF EXISTS "stock_movements_insert" ON public.stock_movements;
DROP POLICY IF EXISTS "stock_movements_select" ON public.stock_movements;
CREATE POLICY "stock_movements_insert" ON public.stock_movements
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'warehouse'::app_role));
CREATE POLICY "stock_movements_select" ON public.stock_movements
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'warehouse'::app_role)
    OR has_role(auth.uid(), 'staff'::app_role)
  );

-- ---------- pipeline_notifications: allow warehouse role ----------
-- (existing pn_select already routes by target_role; warehouse just needs to be a valid enum)

-- ---------- trips: allow warehouse to read ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Trips read by warehouse' AND tablename='trips') THEN
    CREATE POLICY "Trips read by warehouse" ON public.trips
      FOR SELECT TO authenticated
      USING (has_role(auth.uid(), 'warehouse'::app_role) AND deleted_at IS NULL);
  END IF;
END$$;

-- ---------- trip_quotations: allow warehouse to read ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Trip quotations read by warehouse' AND tablename='trip_quotations') THEN
    CREATE POLICY "Trip quotations read by warehouse" ON public.trip_quotations
      FOR SELECT TO authenticated
      USING (has_role(auth.uid(), 'warehouse'::app_role));
  END IF;
END$$;

-- ---------- quotation_items: allow warehouse to view + dispatch ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'items_select_warehouse' AND tablename='quotation_items') THEN
    CREATE POLICY "items_select_warehouse" ON public.quotation_items
      FOR SELECT TO authenticated
      USING (has_role(auth.uid(), 'warehouse'::app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'items_update_warehouse_dispatch' AND tablename='quotation_items') THEN
    CREATE POLICY "items_update_warehouse_dispatch" ON public.quotation_items
      FOR UPDATE TO authenticated
      USING (has_role(auth.uid(), 'warehouse'::app_role));
  END IF;
END$$;

-- ---------- quotations: allow warehouse to view (read-only) ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'quotations_select_warehouse' AND tablename='quotations') THEN
    CREATE POLICY "quotations_select_warehouse" ON public.quotations
      FOR SELECT TO authenticated
      USING (has_role(auth.uid(), 'warehouse'::app_role) AND deleted_at IS NULL);
  END IF;
END$$;
