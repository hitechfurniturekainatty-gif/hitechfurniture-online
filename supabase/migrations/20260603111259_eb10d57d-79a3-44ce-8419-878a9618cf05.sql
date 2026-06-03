ALTER POLICY "Staff read product images" ON public.product_images TO authenticated;
ALTER POLICY "Staff read product variants" ON public.product_variants TO authenticated;
ALTER POLICY "Staff read bundle images" ON public.bundle_images TO authenticated;
ALTER POLICY "Staff read bundle items" ON public.bundle_items TO authenticated;
ALTER POLICY "Staff read variant stock" ON public.product_variant_stock TO authenticated;

ALTER POLICY "Staff can view scheme party notes" ON public.scheme_party_notes TO authenticated;
ALTER POLICY "Staff can insert scheme party notes" ON public.scheme_party_notes TO authenticated;
ALTER POLICY "Staff can delete scheme party notes" ON public.scheme_party_notes TO authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;