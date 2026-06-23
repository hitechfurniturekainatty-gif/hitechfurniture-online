-- Auto-resolve source complaint/service when its job_work_order is completed.
CREATE OR REPLACE FUNCTION public.job_work_orders_resolve_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'completed' AND COALESCE(OLD.status, '') IS DISTINCT FROM 'completed' THEN
    IF NEW.source_complaint_id IS NOT NULL THEN
      UPDATE public.customer_complaints
         SET status = 'resolved', updated_at = now()
       WHERE id = NEW.source_complaint_id
         AND status NOT IN ('resolved', 'closed');
    END IF;
    IF NEW.source_service_id IS NOT NULL THEN
      UPDATE public.customer_services
         SET status = 'resolved', updated_at = now()
       WHERE id = NEW.source_service_id
         AND status NOT IN ('resolved', 'closed');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_work_orders_resolve_source ON public.job_work_orders;
CREATE TRIGGER trg_job_work_orders_resolve_source
AFTER UPDATE OF status ON public.job_work_orders
FOR EACH ROW
EXECUTE FUNCTION public.job_work_orders_resolve_source();