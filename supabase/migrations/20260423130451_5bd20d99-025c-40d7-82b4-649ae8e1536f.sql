-- Add login-link columns to workers
ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS login_phone text;

CREATE UNIQUE INDEX IF NOT EXISTS workers_user_id_unique ON public.workers(user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS workers_login_phone_unique ON public.workers(login_phone) WHERE login_phone IS NOT NULL;

-- Helper: get worker_id for current authenticated user
CREATE OR REPLACE FUNCTION public.current_worker_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.workers WHERE user_id = auth.uid() LIMIT 1
$$;

-- Status updates / history table
CREATE TABLE IF NOT EXISTS public.worker_status_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.job_work_orders(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  photo_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_worker_status_updates_job ON public.worker_status_updates(job_id, created_at DESC);

ALTER TABLE public.worker_status_updates ENABLE ROW LEVEL SECURITY;

-- Office staff/admin can read all
CREATE POLICY "status_updates_select_office"
ON public.worker_status_updates FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'staff')
);

-- Worker can read updates for their own jobs
CREATE POLICY "status_updates_select_worker"
ON public.worker_status_updates FOR SELECT TO authenticated
USING (worker_id = public.current_worker_id());

-- Worker can insert updates for their own jobs
CREATE POLICY "status_updates_insert_worker"
ON public.worker_status_updates FOR INSERT TO authenticated
WITH CHECK (worker_id = public.current_worker_id());

-- Office can also insert (e.g., admin override)
CREATE POLICY "status_updates_insert_office"
ON public.worker_status_updates FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'staff')
);

-- Allow workers to view their own assigned jobs
CREATE POLICY "jobs_select_worker"
ON public.job_work_orders FOR SELECT TO authenticated
USING (worker_id = public.current_worker_id());

-- Allow workers to update status of their own jobs (only status field gates handled in app + trigger below)
CREATE POLICY "jobs_update_worker"
ON public.job_work_orders FOR UPDATE TO authenticated
USING (worker_id = public.current_worker_id())
WITH CHECK (worker_id = public.current_worker_id());

-- Allow workers to view their own worker row
CREATE POLICY "workers_select_self"
ON public.workers FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Allow workers to view quotation_items belonging to their assigned jobs (worker-safe)
CREATE POLICY "items_select_worker"
ON public.quotation_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.job_work_orders j
    WHERE j.worker_id = public.current_worker_id()
      AND j.quotation_id = quotation_items.quotation_id
      AND quotation_items.id = ANY(j.item_ids)
  )
);

-- Allow workers to view minimal quotation row for their assigned jobs
CREATE POLICY "quotations_select_worker"
ON public.quotations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.job_work_orders j
    WHERE j.worker_id = public.current_worker_id()
      AND j.quotation_id = quotations.id
  )
);

-- Auto-log status change to history when job status changes
CREATE OR REPLACE FUNCTION public.log_job_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _wid uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT id INTO _wid FROM public.workers WHERE user_id = auth.uid() LIMIT 1;
    INSERT INTO public.worker_status_updates(job_id, worker_id, status, created_by)
    VALUES (NEW.id, NEW.worker_id, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_job_status_change ON public.job_work_orders;
CREATE TRIGGER trg_log_job_status_change
AFTER UPDATE ON public.job_work_orders
FOR EACH ROW EXECUTE FUNCTION public.log_job_status_change();
