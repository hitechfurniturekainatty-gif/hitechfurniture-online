-- 1. Add reorder_level column to products (low-stock threshold per product)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS reorder_level integer NOT NULL DEFAULT 5;

-- 2. Stock movement log: every change in stock with reason + note
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  change_qty integer NOT NULL,           -- positive = stock-in, negative = stock-out
  reason text NOT NULL,                  -- 'purchase' | 'sale' | 'damage' | 'return' | 'adjustment' | 'production'
  note text,
  resulting_stock integer NOT NULL,      -- snapshot of stock_quantity AFTER change
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product_created
  ON public.stock_movements (product_id, created_at DESC);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_movements_select"
  ON public.stock_movements FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "stock_movements_insert"
  ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "stock_movements_delete"
  ON public.stock_movements FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Trigger: applying a stock movement updates products.stock_quantity atomically
CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_stock integer;
BEGIN
  IF NEW.change_qty = 0 THEN
    RAISE EXCEPTION 'change_qty cannot be zero';
  END IF;

  UPDATE public.products
     SET stock_quantity = GREATEST(stock_quantity + NEW.change_qty, 0),
         updated_at = now()
   WHERE id = NEW.product_id
   RETURNING stock_quantity INTO _new_stock;

  IF _new_stock IS NULL THEN
    RAISE EXCEPTION 'Product % not found', NEW.product_id;
  END IF;

  NEW.resulting_stock := _new_stock;
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_stock_movement ON public.stock_movements;
CREATE TRIGGER trg_apply_stock_movement
  BEFORE INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();