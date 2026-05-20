
-- Re-grant cost_price SELECT to authenticated (admins need it). Only anon stays blocked.
GRANT SELECT (cost_price) ON public.products TO authenticated;
GRANT SELECT (cost_price) ON public.product_bundles TO authenticated;
