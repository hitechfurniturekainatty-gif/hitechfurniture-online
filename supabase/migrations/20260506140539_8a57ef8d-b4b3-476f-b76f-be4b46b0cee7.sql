-- 1. product_locations table
CREATE TABLE public.product_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building TEXT NOT NULL,
  floor TEXT NOT NULL,
  section TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX product_locations_unique_idx
  ON public.product_locations (building, floor, COALESCE(section, ''));

ALTER TABLE public.product_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read product locations"
  ON public.product_locations FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage product locations"
  ON public.product_locations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER product_locations_updated_at
  BEFORE UPDATE ON public.product_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. products: location + stock status
ALTER TABLE public.products
  ADD COLUMN location_id UUID REFERENCES public.product_locations(id) ON DELETE SET NULL,
  ADD COLUMN stock_status TEXT NOT NULL DEFAULT 'in_stock'
    CHECK (stock_status IN ('in_stock', 'out_of_stock'));

CREATE INDEX products_location_idx ON public.products(location_id);
CREATE INDEX products_stock_status_idx ON public.products(stock_status);

-- 3. Seed default locations
INSERT INTO public.product_locations (building, floor, section, display_order) VALUES
  ('Main Shop', 'Ground Floor', NULL, 10),
  ('Main Shop', '1st Floor', NULL, 20),
  ('Main Shop', '2nd Floor', NULL, 30),
  ('Suzuki Godown', 'Ground Floor', NULL, 40),
  ('Suzuki Godown', '1st Floor', NULL, 50),
  ('Suzuki Godown', '2nd Floor', NULL, 60),
  ('JCB Godown', 'Ground Floor', NULL, 70),
  ('JCB Godown', '1st Floor', NULL, 80);

-- 4. Catalog PIN helpers (mirrors backlog PIN pattern)
CREATE OR REPLACE FUNCTION public.catalog_pin_is_set()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.admin_settings WHERE key = 'catalog_pin_hash');
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_catalog_pin(_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _hash text;
BEGIN
  SELECT value INTO _hash FROM public.admin_settings WHERE key = 'catalog_pin_hash';
  IF _hash IS NULL THEN
    RETURN false;
  END IF;
  RETURN _hash = extensions.crypt(_pin, _hash);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_catalog_pin(_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can set the Catalog PIN';
  END IF;
  IF _pin IS NULL OR length(btrim(_pin)) < 4 THEN
    RAISE EXCEPTION 'PIN must be at least 4 characters';
  END IF;
  INSERT INTO public.admin_settings(key, value, updated_by, updated_at)
  VALUES ('catalog_pin_hash', extensions.crypt(_pin, extensions.gen_salt('bf', 10)), auth.uid(), now())
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_by = EXCLUDED.updated_by,
        updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.catalog_pin_is_set() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.verify_catalog_pin(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.set_catalog_pin(text) TO authenticated;