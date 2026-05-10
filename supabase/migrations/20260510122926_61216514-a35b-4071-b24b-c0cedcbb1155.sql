-- Lead type on quotations (Client Hub tabs: Leads / Direct Deals / Consultations / Custom Projects)
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS lead_type text NOT NULL DEFAULT 'lead';

-- Backfill existing rows to a reasonable type so the Client Hub tabs aren't all "Lead".
UPDATE public.quotations
   SET lead_type = CASE
     WHEN is_direct_order = true THEN 'direct_deal'
     WHEN source_task_id IS NOT NULL THEN 'custom_project'
     ELSE 'lead'
   END
 WHERE lead_type = 'lead';

-- Validation: only allow the 4 known values.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quotations_lead_type_check'
  ) THEN
    ALTER TABLE public.quotations
      ADD CONSTRAINT quotations_lead_type_check
      CHECK (lead_type IN ('lead','direct_deal','consultation','custom_project'));
  END IF;
END $$;

-- Warehouse pipeline stage on job work orders.
-- 'none' = still in production / not yet a warehouse concern.
-- 'in_warehouse' = finished production, sitting in stock.
-- 'ready_to_pack' = picked for a customer, being packed.
-- 'ready_for_dispatch' = packed & labelled, awaiting truck.
-- 'dispatched' = handed to logistics (out for delivery).
ALTER TABLE public.job_work_orders
  ADD COLUMN IF NOT EXISTS warehouse_status text NOT NULL DEFAULT 'none';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'job_work_orders_warehouse_status_check'
  ) THEN
    ALTER TABLE public.job_work_orders
      ADD CONSTRAINT job_work_orders_warehouse_status_check
      CHECK (warehouse_status IN ('none','in_warehouse','ready_to_pack','ready_for_dispatch','dispatched'));
  END IF;
END $$;

-- Logistics issue flag on trips for the "Issues / Delayed" tab.
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS has_issue boolean NOT NULL DEFAULT false;
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS issue_note text;
