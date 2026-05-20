-- Revoke column-level SELECT on cost_price from anon for both tables.
REVOKE SELECT (cost_price) ON public.products FROM anon;
REVOKE SELECT (cost_price) ON public.product_bundles FROM anon;

-- Ensure authenticated still has SELECT on cost_price (admins need it).
GRANT SELECT (cost_price) ON public.products TO authenticated;
GRANT SELECT (cost_price) ON public.product_bundles TO authenticated;