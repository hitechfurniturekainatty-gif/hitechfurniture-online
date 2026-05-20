-- Revoke the broad table-level SELECT on anon so column-level grants take effect.
REVOKE SELECT ON public.products FROM anon;
REVOKE SELECT ON public.product_bundles FROM anon;

-- Grant anon SELECT only on non-sensitive columns (everything except cost_price).
GRANT SELECT (
  id, main_category_id, sub_category_id, product_name, product_code, description,
  mrp, offer_price, available_colors, material, dimensions, stock_quantity,
  is_featured, is_published, created_at, updated_at, reorder_level, deleted_at,
  deleted_by, location_id, stock_status, floor_display_order
) ON public.products TO anon;

GRANT SELECT (
  id, bundle_code, name, description, main_category_id, sub_category_id,
  main_image_url, mrp, offer_price, available_colors, material, dimensions,
  is_featured, is_published, stock_status, floor_display_order, deleted_at,
  deleted_by, created_by, created_at, updated_at
) ON public.product_bundles TO anon;

-- Authenticated keeps full table SELECT (admin/staff need cost_price for editor).
GRANT SELECT ON public.products TO authenticated;
GRANT SELECT ON public.product_bundles TO authenticated;