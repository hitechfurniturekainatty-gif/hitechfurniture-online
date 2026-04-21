
-- Add status tracking timestamp to job_work_orders for the worker progress tracker.
ALTER TABLE public.job_work_orders
  ADD COLUMN IF NOT EXISTS status_updated_at timestamp with time zone NOT NULL DEFAULT now();

-- Index to speed up "all jobs for a given worker" queries.
CREATE INDEX IF NOT EXISTS idx_job_work_orders_worker
  ON public.job_work_orders(worker_id, created_at DESC);

-- Trigger function to bump status_updated_at whenever the status text changes.
CREATE OR REPLACE FUNCTION public.bump_job_status_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_job_status_updated_at ON public.job_work_orders;
CREATE TRIGGER trg_bump_job_status_updated_at
BEFORE UPDATE ON public.job_work_orders
FOR EACH ROW
EXECUTE FUNCTION public.bump_job_status_updated_at();

-- Reuse the existing updated_at trigger function for the row-level updated_at.
DROP TRIGGER IF EXISTS trg_job_work_orders_updated_at ON public.job_work_orders;
CREATE TRIGGER trg_job_work_orders_updated_at
BEFORE UPDATE ON public.job_work_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
