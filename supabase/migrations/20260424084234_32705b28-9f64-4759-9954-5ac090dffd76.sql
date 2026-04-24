
-- =========================================================
-- Soft-delete (Trash bin) for admin-only restore, 30 day window
-- Tables covered:
--   quotations, job_work_orders, customer_services, customer_complaints,
--   products, main_categories, sub_categories, workers,
--   delivery_routes, trips, measurement_tasks
-- =========================================================

-- 1) Add deleted_at + deleted_by to all target tables
ALTER TABLE public.quotations          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE public.job_work_orders     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE public.customer_services   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE public.customer_complaints ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE public.products            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE public.main_categories     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE public.sub_categories      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE public.workers             ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE public.delivery_routes     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE public.trips               ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE public.measurement_tasks   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS deleted_by UUID;

-- 2) Indexes for fast list/trash queries
CREATE INDEX IF NOT EXISTS idx_quotations_deleted_at          ON public.quotations(deleted_at);
CREATE INDEX IF NOT EXISTS idx_job_work_orders_deleted_at     ON public.job_work_orders(deleted_at);
CREATE INDEX IF NOT EXISTS idx_customer_services_deleted_at   ON public.customer_services(deleted_at);
CREATE INDEX IF NOT EXISTS idx_customer_complaints_deleted_at ON public.customer_complaints(deleted_at);
CREATE INDEX IF NOT EXISTS idx_products_deleted_at            ON public.products(deleted_at);
CREATE INDEX IF NOT EXISTS idx_main_categories_deleted_at     ON public.main_categories(deleted_at);
CREATE INDEX IF NOT EXISTS idx_sub_categories_deleted_at      ON public.sub_categories(deleted_at);
CREATE INDEX IF NOT EXISTS idx_workers_deleted_at             ON public.workers(deleted_at);
CREATE INDEX IF NOT EXISTS idx_delivery_routes_deleted_at     ON public.delivery_routes(deleted_at);
CREATE INDEX IF NOT EXISTS idx_trips_deleted_at               ON public.trips(deleted_at);
CREATE INDEX IF NOT EXISTS idx_measurement_tasks_deleted_at   ON public.measurement_tasks(deleted_at);

-- 3) Update RLS SELECT policies on user-facing tables so non-admins
--    automatically hide trashed rows. Admins still see everything
--    (so the Trash page works without a separate policy).
--    We DROP and recreate each SELECT policy.

-- quotations
DROP POLICY IF EXISTS quotations_select ON public.quotations;
CREATE POLICY quotations_select ON public.quotations
FOR SELECT TO authenticated
USING (
  (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      (has_role(auth.uid(), 'staff'::app_role)
       OR (has_role(auth.uid(), 'measurement_staff'::app_role) AND created_by = auth.uid())
      )
      AND deleted_at IS NULL
    )
  )
);

DROP POLICY IF EXISTS quotations_select_worker ON public.quotations;
CREATE POLICY quotations_select_worker ON public.quotations
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.job_work_orders j
    WHERE j.worker_id = current_worker_id() AND j.quotation_id = quotations.id
  )
);

-- job_work_orders
DROP POLICY IF EXISTS jobs_select ON public.job_work_orders;
CREATE POLICY jobs_select ON public.job_work_orders
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'staff'::app_role)
    AND deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS jobs_select_worker ON public.job_work_orders;
CREATE POLICY jobs_select_worker ON public.job_work_orders
FOR SELECT TO authenticated
USING (worker_id = current_worker_id() AND deleted_at IS NULL);

-- customer_services
DROP POLICY IF EXISTS services_select ON public.customer_services;
CREATE POLICY services_select ON public.customer_services
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'staff'::app_role) AND deleted_at IS NULL)
);

-- customer_complaints
DROP POLICY IF EXISTS complaints_select ON public.customer_complaints;
CREATE POLICY complaints_select ON public.customer_complaints
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'staff'::app_role) AND deleted_at IS NULL)
);

-- products: public read (only non-deleted, published), staff full read
DROP POLICY IF EXISTS "Public read published products" ON public.products;
CREATE POLICY "Public read published products" ON public.products
FOR SELECT TO public
USING (is_published = true AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Staff full read products" ON public.products;
CREATE POLICY "Staff full read products" ON public.products
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'staff'::app_role) AND deleted_at IS NULL)
);

-- main_categories: public read non-deleted
DROP POLICY IF EXISTS "Public read main categories" ON public.main_categories;
CREATE POLICY "Public read main categories" ON public.main_categories
FOR SELECT TO public
USING (deleted_at IS NULL);

-- Add admin SELECT for deleted main_categories
DROP POLICY IF EXISTS "Admins read deleted main categories" ON public.main_categories;
CREATE POLICY "Admins read deleted main categories" ON public.main_categories
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- sub_categories: public read non-deleted
DROP POLICY IF EXISTS "Public read sub categories" ON public.sub_categories;
CREATE POLICY "Public read sub categories" ON public.sub_categories
FOR SELECT TO public
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Admins read deleted sub categories" ON public.sub_categories;
CREATE POLICY "Admins read deleted sub categories" ON public.sub_categories
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- workers
DROP POLICY IF EXISTS workers_select ON public.workers;
CREATE POLICY workers_select ON public.workers
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'measurement_staff'::app_role))
    AND deleted_at IS NULL
  )
);

-- delivery_routes: public read non-deleted
DROP POLICY IF EXISTS "Public read delivery routes" ON public.delivery_routes;
CREATE POLICY "Public read delivery routes" ON public.delivery_routes
FOR SELECT TO public
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Admins read deleted delivery routes" ON public.delivery_routes;
CREATE POLICY "Admins read deleted delivery routes" ON public.delivery_routes
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- trips
DROP POLICY IF EXISTS "Trips select by office admin or assigned driver" ON public.trips;
CREATE POLICY "Trips select by office admin or assigned driver" ON public.trips
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    (
      has_role(auth.uid(), 'staff'::app_role)
      OR (has_role(auth.uid(), 'delivery'::app_role) AND assigned_driver_id = auth.uid())
    )
    AND deleted_at IS NULL
  )
);

-- measurement_tasks
DROP POLICY IF EXISTS tasks_select ON public.measurement_tasks;
CREATE POLICY tasks_select ON public.measurement_tasks
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    (
      has_role(auth.uid(), 'staff'::app_role)
      OR (has_role(auth.uid(), 'measurement_staff'::app_role) AND assigned_to = auth.uid())
    )
    AND deleted_at IS NULL
  )
);

-- 4) UPDATE policies: allow admins to soft-delete/restore by updating deleted_at columns
--    Existing UPDATE policies for admin/staff already permit setting these columns.

-- 5) Auto-purge function: hard delete rows trashed for more than 30 days.
--    Admins (or a scheduled job) can call this manually.
CREATE OR REPLACE FUNCTION public.purge_old_trash()
RETURNS TABLE(table_name TEXT, removed INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cutoff TIMESTAMPTZ := now() - INTERVAL '30 days';
  _n INT;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can purge trash';
  END IF;

  DELETE FROM public.quotations          WHERE deleted_at IS NOT NULL AND deleted_at < _cutoff; GET DIAGNOSTICS _n = ROW_COUNT; table_name := 'quotations'; removed := _n; RETURN NEXT;
  DELETE FROM public.job_work_orders     WHERE deleted_at IS NOT NULL AND deleted_at < _cutoff; GET DIAGNOSTICS _n = ROW_COUNT; table_name := 'job_work_orders'; removed := _n; RETURN NEXT;
  DELETE FROM public.customer_services   WHERE deleted_at IS NOT NULL AND deleted_at < _cutoff; GET DIAGNOSTICS _n = ROW_COUNT; table_name := 'customer_services'; removed := _n; RETURN NEXT;
  DELETE FROM public.customer_complaints WHERE deleted_at IS NOT NULL AND deleted_at < _cutoff; GET DIAGNOSTICS _n = ROW_COUNT; table_name := 'customer_complaints'; removed := _n; RETURN NEXT;
  DELETE FROM public.products            WHERE deleted_at IS NOT NULL AND deleted_at < _cutoff; GET DIAGNOSTICS _n = ROW_COUNT; table_name := 'products'; removed := _n; RETURN NEXT;
  DELETE FROM public.main_categories     WHERE deleted_at IS NOT NULL AND deleted_at < _cutoff; GET DIAGNOSTICS _n = ROW_COUNT; table_name := 'main_categories'; removed := _n; RETURN NEXT;
  DELETE FROM public.sub_categories      WHERE deleted_at IS NOT NULL AND deleted_at < _cutoff; GET DIAGNOSTICS _n = ROW_COUNT; table_name := 'sub_categories'; removed := _n; RETURN NEXT;
  DELETE FROM public.workers             WHERE deleted_at IS NOT NULL AND deleted_at < _cutoff; GET DIAGNOSTICS _n = ROW_COUNT; table_name := 'workers'; removed := _n; RETURN NEXT;
  DELETE FROM public.delivery_routes     WHERE deleted_at IS NOT NULL AND deleted_at < _cutoff; GET DIAGNOSTICS _n = ROW_COUNT; table_name := 'delivery_routes'; removed := _n; RETURN NEXT;
  DELETE FROM public.trips               WHERE deleted_at IS NOT NULL AND deleted_at < _cutoff; GET DIAGNOSTICS _n = ROW_COUNT; table_name := 'trips'; removed := _n; RETURN NEXT;
  DELETE FROM public.measurement_tasks   WHERE deleted_at IS NOT NULL AND deleted_at < _cutoff; GET DIAGNOSTICS _n = ROW_COUNT; table_name := 'measurement_tasks'; removed := _n; RETURN NEXT;
END;
$$;
