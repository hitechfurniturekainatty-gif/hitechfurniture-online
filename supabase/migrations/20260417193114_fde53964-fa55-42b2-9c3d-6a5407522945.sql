
-- Measurement tasks
CREATE TABLE public.measurement_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_place TEXT NOT NULL,
  customer_address TEXT,
  requirement TEXT,
  assigned_to UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  draft_quotation_id UUID REFERENCES public.quotations(id) ON DELETE SET NULL,
  created_by UUID,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.measurement_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select" ON public.measurement_tasks FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'staff'::public.app_role)
  OR (public.has_role(auth.uid(), 'measurement_staff'::public.app_role) AND assigned_to = auth.uid())
);
CREATE POLICY "tasks_insert" ON public.measurement_tasks FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'staff'::public.app_role));
CREATE POLICY "tasks_update" ON public.measurement_tasks FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'staff'::public.app_role)
  OR (public.has_role(auth.uid(), 'measurement_staff'::public.app_role) AND assigned_to = auth.uid())
);
CREATE POLICY "tasks_delete" ON public.measurement_tasks FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER tr_measurement_tasks_updated BEFORE UPDATE ON public.measurement_tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_measurement_tasks_assigned ON public.measurement_tasks(assigned_to);
CREATE INDEX idx_measurement_tasks_status ON public.measurement_tasks(status);

-- Job work orders
CREATE TABLE public.job_work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE RESTRICT,
  item_ids UUID[] NOT NULL DEFAULT '{}',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'assigned',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.job_work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jobs_select" ON public.job_work_orders FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'staff'::public.app_role));
CREATE POLICY "jobs_insert" ON public.job_work_orders FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'staff'::public.app_role));
CREATE POLICY "jobs_update" ON public.job_work_orders FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'staff'::public.app_role));
CREATE POLICY "jobs_delete" ON public.job_work_orders FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER tr_job_orders_updated BEFORE UPDATE ON public.job_work_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Lock down the counters table (server-only via SECURITY DEFINER fn)
CREATE POLICY "counters_no_access" ON public.quotation_counters
FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- Fix function search_path warnings
ALTER FUNCTION public.compute_item_amount() SET search_path = public;
ALTER FUNCTION public.recalc_on_gst_change() SET search_path = public;

-- Quotation images bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('quotation-images','quotation-images', true)
ON CONFLICT (id) DO NOTHING;

-- Files are publicly readable by direct URL (needed for PDFs and previews).
-- Listing is restricted (lint fix).
CREATE POLICY "quot_images_read_by_path" ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'quotation-images');

CREATE POLICY "quot_images_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'quotation-images');
CREATE POLICY "quot_images_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'quotation-images' AND (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'staff'::public.app_role)
  OR public.has_role(auth.uid(), 'measurement_staff'::public.app_role)
));
CREATE POLICY "quot_images_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'quotation-images' AND (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'staff'::public.app_role)
));
