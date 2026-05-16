
-- =========================================================
-- PRODUCT BUNDLES (Combos / Sets)
-- =========================================================

CREATE TABLE public.product_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  main_category_id uuid NOT NULL,
  sub_category_id uuid,
  main_image_url text,
  mrp numeric NOT NULL DEFAULT 0,
  offer_price numeric,
  cost_price numeric,
  available_colors text[] DEFAULT '{}',
  material text,
  dimensions text,
  is_featured boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT true,
  stock_status text NOT NULL DEFAULT 'in_stock',
  floor_display_order integer NOT NULL DEFAULT 0,
  deleted_at timestamptz,
  deleted_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.bundle_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id uuid NOT NULL REFERENCES public.product_bundles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  quantity numeric NOT NULL DEFAULT 1 CHECK (quantity > 0),
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bundle_id, product_id)
);
CREATE INDEX idx_bundle_items_product ON public.bundle_items(product_id);

CREATE TABLE public.bundle_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id uuid NOT NULL REFERENCES public.product_bundles(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Quotation line can reference a bundle
ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS bundle_id uuid;

-- =========================================================
-- TRIGGERS
-- =========================================================

CREATE TRIGGER trg_product_bundles_updated_at
BEFORE UPDATE ON public.product_bundles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Protect cost_price on bundles (mirrors products)
CREATE OR REPLACE FUNCTION public.protect_bundle_cost_price()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    IF TG_OP = 'UPDATE' THEN NEW.cost_price = OLD.cost_price;
    ELSIF TG_OP = 'INSERT' THEN NEW.cost_price = NULL;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_protect_bundle_cost_price
BEFORE INSERT OR UPDATE ON public.product_bundles
FOR EACH ROW EXECUTE FUNCTION public.protect_bundle_cost_price();

-- Recompute one bundle's stock status from its linked items
CREATE OR REPLACE FUNCTION public.recompute_bundle_stock(_bundle_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _oos boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.bundle_items bi
    JOIN public.products p ON p.id = bi.product_id
    WHERE bi.bundle_id = _bundle_id
      AND (p.deleted_at IS NOT NULL
           OR p.stock_status = 'out_of_stock'
           OR p.stock_quantity < bi.quantity)
  ) INTO _oos;

  UPDATE public.product_bundles
     SET stock_status = CASE WHEN _oos THEN 'out_of_stock' ELSE 'in_stock' END
   WHERE id = _bundle_id;
END; $$;

-- bundle_items change → recompute that bundle
CREATE OR REPLACE FUNCTION public.bundle_items_recompute()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_bundle_stock(COALESCE(NEW.bundle_id, OLD.bundle_id));
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER trg_bundle_items_recompute
AFTER INSERT OR UPDATE OR DELETE ON public.bundle_items
FOR EACH ROW EXECUTE FUNCTION public.bundle_items_recompute();

-- products stock change → recompute every bundle containing the product
CREATE OR REPLACE FUNCTION public.products_recompute_bundles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _b uuid;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.stock_quantity IS NOT DISTINCT FROM OLD.stock_quantity
     AND NEW.stock_status IS NOT DISTINCT FROM OLD.stock_status
     AND NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at THEN
    RETURN NEW;
  END IF;
  FOR _b IN SELECT bundle_id FROM public.bundle_items WHERE product_id = NEW.id LOOP
    PERFORM public.recompute_bundle_stock(_b);
  END LOOP;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_products_recompute_bundles
AFTER UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.products_recompute_bundles();

-- Deduct linked-item stock for a bundle delivery
CREATE OR REPLACE FUNCTION public.consume_bundle_stock(_bundle_id uuid, _qty numeric, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  IF _qty IS NULL OR _qty <= 0 THEN RETURN; END IF;
  FOR r IN
    SELECT product_id, quantity FROM public.bundle_items WHERE bundle_id = _bundle_id
  LOOP
    INSERT INTO public.stock_movements(product_id, change_qty, reason, note, created_by)
    VALUES (r.product_id, -CEIL(r.quantity * _qty)::int,
            COALESCE(_reason, 'bundle_delivery'),
            'Bundle ' || _bundle_id::text, auth.uid());
  END LOOP;
END; $$;

-- When a quotation item with bundle_id flips to delivered, consume linked stock
CREATE OR REPLACE FUNCTION public.quotation_items_bundle_consume()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.bundle_id IS NOT NULL
     AND NEW.delivered_at IS NOT NULL
     AND (OLD.delivered_at IS NULL) THEN
    PERFORM public.consume_bundle_stock(NEW.bundle_id, COALESCE(NEW.quantity,1),
      'Quotation item ' || NEW.id::text);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_quotation_items_bundle_consume
AFTER UPDATE ON public.quotation_items
FOR EACH ROW EXECUTE FUNCTION public.quotation_items_bundle_consume();

-- =========================================================
-- RLS
-- =========================================================

ALTER TABLE public.product_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundle_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundle_images    ENABLE ROW LEVEL SECURITY;

-- product_bundles
CREATE POLICY "Public read published bundles" ON public.product_bundles
  FOR SELECT TO public USING (is_published = true AND deleted_at IS NULL);

CREATE POLICY "Auth staff read bundles" ON public.product_bundles
  FOR SELECT TO authenticated USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR ((has_role(auth.uid(), 'staff'::app_role)
         OR has_role(auth.uid(), 'warehouse'::app_role)
         OR has_role(auth.uid(), 'delivery'::app_role)
         OR has_role(auth.uid(), 'measurement_staff'::app_role)) AND deleted_at IS NULL)
  );

CREATE POLICY "Admins insert bundles" ON public.product_bundles
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update bundles" ON public.product_bundles
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete bundles" ON public.product_bundles
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- bundle_items
CREATE POLICY "Public read bundle items" ON public.bundle_items
  FOR SELECT TO public USING (true);
CREATE POLICY "Admins write bundle items" ON public.bundle_items
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- bundle_images
CREATE POLICY "Public read bundle images" ON public.bundle_images
  FOR SELECT TO public USING (true);
CREATE POLICY "Admins write bundle images" ON public.bundle_images
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
