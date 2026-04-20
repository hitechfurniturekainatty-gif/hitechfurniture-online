
CREATE INDEX IF NOT EXISTS idx_quotations_status_created
  ON public.quotations (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quotations_created_by_created
  ON public.quotations (created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quotations_created_at
  ON public.quotations (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation
  ON public.quotation_items (quotation_id, display_order);

CREATE INDEX IF NOT EXISTS idx_products_published_created
  ON public.products (is_published, created_at DESC)
  WHERE is_published = true;

CREATE INDEX IF NOT EXISTS idx_sub_categories_main_cat
  ON public.sub_categories (main_category_id, display_order);

CREATE INDEX IF NOT EXISTS idx_product_images_product_order
  ON public.product_images (product_id, display_order);

CREATE INDEX IF NOT EXISTS idx_trips_route_date
  ON public.trips (route_id, trip_date DESC);

CREATE INDEX IF NOT EXISTS idx_trips_driver_date
  ON public.trips (assigned_driver_id, trip_date DESC);

CREATE INDEX IF NOT EXISTS idx_measurement_tasks_draft
  ON public.measurement_tasks (draft_quotation_id)
  WHERE draft_quotation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_roles_user_role
  ON public.user_roles (user_id, role);

ANALYZE public.quotations;
ANALYZE public.quotation_items;
ANALYZE public.products;
ANALYZE public.product_images;
ANALYZE public.sub_categories;
ANALYZE public.trips;
ANALYZE public.measurement_tasks;
ANALYZE public.user_roles;
