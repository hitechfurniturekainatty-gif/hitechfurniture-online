
-- Split the audit trigger: BEFORE for auto-bump on UPDATE, AFTER for history logging
DROP TRIGGER IF EXISTS quotations_status_audit ON public.quotations;
DROP TRIGGER IF EXISTS quotations_status_audit_before ON public.quotations;
DROP TRIGGER IF EXISTS quotations_status_audit_after ON public.quotations;

-- BEFORE UPDATE: only handle the auto drafted -> finalized bump
CREATE OR REPLACE FUNCTION public.quotations_status_autobump()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF COALESCE(NEW.advance_amount, 0) > 0
     AND COALESCE(OLD.advance_amount, 0) = 0
     AND NEW.status = 'drafted' THEN
    NEW.status := 'finalized';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER quotations_status_autobump
BEFORE UPDATE ON public.quotations
FOR EACH ROW EXECUTE FUNCTION public.quotations_status_autobump();

-- AFTER INSERT/UPDATE: log to history (now the quotation row exists for FK)
CREATE OR REPLACE FUNCTION public.quotations_status_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.quotation_status_history (quotation_id, status, changed_by)
    VALUES (NEW.id, NEW.status, COALESCE(NEW.created_by, auth.uid()));
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.quotation_status_history (quotation_id, status, changed_by)
    VALUES (NEW.id, NEW.status, auth.uid());
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER quotations_status_log
AFTER INSERT OR UPDATE ON public.quotations
FOR EACH ROW EXECUTE FUNCTION public.quotations_status_log();
