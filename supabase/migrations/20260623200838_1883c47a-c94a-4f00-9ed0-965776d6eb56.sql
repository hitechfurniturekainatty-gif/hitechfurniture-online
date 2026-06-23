-- Reserved stock helper: per-product committed quantity from quotations that
-- have been finalized (advance taken / order confirmed) but whose items have
-- not yet been delivered. Custom-built items don't draw from ready stock so
-- they're excluded.
CREATE OR REPLACE FUNCTION public.get_reserved_stock()
RETURNS TABLE (product_id uuid, reserved numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT qi.product_id,
         COALESCE(SUM(qi.quantity), 0)::numeric AS reserved
    FROM public.quotation_items qi
    JOIN public.quotations q ON q.id = qi.quotation_id
   WHERE qi.product_id IS NOT NULL
     AND qi.delivered_at IS NULL
     AND qi.fulfillment_route = 'ready_stock'
     AND q.deleted_at IS NULL
     AND q.status NOT IN ('rejected', 'delivered', 'drafted')
   GROUP BY qi.product_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_reserved_stock() TO authenticated, service_role;