-- =========================================================
-- 1. CUSTOMER SERVICES (SV-XXX) — repair / renovation requests
-- =========================================================
CREATE TABLE public.customer_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_code TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_place TEXT NOT NULL,
  customer_address TEXT,
  item_description TEXT NOT NULL,
  work_needed TEXT,
  estimated_cost NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  photos TEXT, -- newline-joined URLs (matches measurement_image style)
  status TEXT NOT NULL DEFAULT 'pending', -- pending | scheduled | technician_visited | converted | resolved | cancelled
  delivery_route_id UUID REFERENCES public.delivery_routes(id) ON DELETE SET NULL,
  delivery_place TEXT,
  quotation_id UUID REFERENCES public.quotations(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services_select" ON public.customer_services
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "services_insert" ON public.customer_services
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "services_update" ON public.customer_services
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "services_delete" ON public.customer_services
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_customer_services_updated_at
BEFORE UPDATE ON public.customer_services
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_customer_services_status ON public.customer_services(status);
CREATE INDEX idx_customer_services_route ON public.customer_services(delivery_route_id);

-- =========================================================
-- 2. CUSTOMER COMPLAINTS (CP-XXX) — warranty / after-sales
-- =========================================================
CREATE TABLE public.customer_complaints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_code TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_place TEXT NOT NULL,
  customer_address TEXT,
  original_quotation_id UUID REFERENCES public.quotations(id) ON DELETE SET NULL,
  original_quotation_code TEXT, -- denormalised label for free-text reference
  issue_description TEXT NOT NULL,
  photos TEXT, -- newline-joined URLs
  paid_parts_amount NUMERIC NOT NULL DEFAULT 0,
  paid_parts_description TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | scheduled | technician_visited | resolved | cancelled
  delivery_route_id UUID REFERENCES public.delivery_routes(id) ON DELETE SET NULL,
  delivery_place TEXT,
  service_quotation_id UUID REFERENCES public.quotations(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "complaints_select" ON public.customer_complaints
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "complaints_insert" ON public.customer_complaints
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "complaints_update" ON public.customer_complaints
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "complaints_delete" ON public.customer_complaints
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_customer_complaints_updated_at
BEFORE UPDATE ON public.customer_complaints
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_customer_complaints_status ON public.customer_complaints(status);
CREATE INDEX idx_customer_complaints_route ON public.customer_complaints(delivery_route_id);

-- =========================================================
-- 3. ID generators (FY-scoped, strict sequential, no reuse)
-- =========================================================
CREATE OR REPLACE FUNCTION public.next_service_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _scope TEXT;
  _next INT;
  _fy TEXT;
  _y INT; _m INT; _start_year INT; _end_year INT;
BEGIN
  _y := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
  _m := EXTRACT(MONTH FROM CURRENT_DATE)::INT;
  IF _m >= 4 THEN _start_year := _y; _end_year := _y + 1;
  ELSE _start_year := _y - 1; _end_year := _y; END IF;
  _fy := _start_year::TEXT || '/' || lpad((_end_year % 100)::TEXT, 2, '0');

  _scope := 'sv-fy-' || _fy;
  INSERT INTO public.quotation_counters(scope, last_serial)
    VALUES (_scope, 1)
  ON CONFLICT (scope) DO UPDATE
    SET last_serial = public.quotation_counters.last_serial + 1
  RETURNING last_serial INTO _next;

  RETURN 'SV-' || _fy || '-' || lpad(_next::TEXT, 3, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.next_complaint_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _scope TEXT;
  _next INT;
  _fy TEXT;
  _y INT; _m INT; _start_year INT; _end_year INT;
BEGIN
  _y := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
  _m := EXTRACT(MONTH FROM CURRENT_DATE)::INT;
  IF _m >= 4 THEN _start_year := _y; _end_year := _y + 1;
  ELSE _start_year := _y - 1; _end_year := _y; END IF;
  _fy := _start_year::TEXT || '/' || lpad((_end_year % 100)::TEXT, 2, '0');

  _scope := 'cp-fy-' || _fy;
  INSERT INTO public.quotation_counters(scope, last_serial)
    VALUES (_scope, 1)
  ON CONFLICT (scope) DO UPDATE
    SET last_serial = public.quotation_counters.last_serial + 1
  RETURNING last_serial INTO _next;

  RETURN 'CP-' || _fy || '-' || lpad(_next::TEXT, 3, '0');
END;
$$;

-- =========================================================
-- 4. Quotations: tag service-originated docs
-- =========================================================
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS service_type TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS source_service_id UUID REFERENCES public.customer_services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_complaint_id UUID REFERENCES public.customer_complaints(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotations_service_type ON public.quotations(service_type);

-- =========================================================
-- 5. Job work orders: type + urgency + service/complaint sources
-- =========================================================
ALTER TABLE public.job_work_orders
  ADD COLUMN IF NOT EXISTS job_type TEXT NOT NULL DEFAULT 'production',
  ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_service_id UUID REFERENCES public.customer_services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_complaint_id UUID REFERENCES public.customer_complaints(id) ON DELETE SET NULL;

-- Allow a job order to belong to a service/complaint instead of a quotation
ALTER TABLE public.job_work_orders ALTER COLUMN quotation_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_job_type ON public.job_work_orders(job_type);
CREATE INDEX IF NOT EXISTS idx_jobs_source_service ON public.job_work_orders(source_service_id);
CREATE INDEX IF NOT EXISTS idx_jobs_source_complaint ON public.job_work_orders(source_complaint_id);