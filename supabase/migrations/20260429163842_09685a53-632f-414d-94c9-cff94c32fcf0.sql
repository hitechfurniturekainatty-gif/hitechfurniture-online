
-- 1. Migrate existing data to the new 4-status model
UPDATE public.quotations SET status = 'drafted'   WHERE status = 'draft';
UPDATE public.quotations SET status = 'finalized' WHERE status IN ('sent', 'accepted');
UPDATE public.quotations SET status = 'delivered' WHERE status = 'completed';

-- 2. New default for fresh rows
ALTER TABLE public.quotations ALTER COLUMN status SET DEFAULT 'drafted';

-- 3. Status history table
CREATE TABLE IF NOT EXISTS public.quotation_status_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id  UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  status        TEXT NOT NULL,
  changed_by    UUID,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qsh_quotation ON public.quotation_status_history(quotation_id, changed_at DESC);

ALTER TABLE public.quotation_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qsh_select ON public.quotation_status_history;
CREATE POLICY qsh_select ON public.quotation_status_history
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quotations q
    WHERE q.id = quotation_status_history.quotation_id
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'staff'::app_role)
        OR (public.has_role(auth.uid(), 'measurement_staff'::app_role) AND q.created_by = auth.uid())
      )
  ));

-- No direct writes — only the trigger inserts rows.
DROP POLICY IF EXISTS qsh_no_write ON public.quotation_status_history;
CREATE POLICY qsh_no_write ON public.quotation_status_history
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- 4. Trigger: log every status change + auto-finalize on advance > 0
CREATE OR REPLACE FUNCTION public.quotations_status_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auto-bump drafted → finalized when an advance is recorded.
  IF TG_OP = 'UPDATE'
     AND COALESCE(NEW.advance_amount, 0) > 0
     AND COALESCE(OLD.advance_amount, 0) = 0
     AND NEW.status = 'drafted' THEN
    NEW.status := 'finalized';
  END IF;

  -- Log status changes (including the very first insert).
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.quotation_status_history (quotation_id, status, changed_by)
    VALUES (NEW.id, NEW.status, COALESCE(NEW.created_by, auth.uid()));
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.quotation_status_history (quotation_id, status, changed_by)
    VALUES (NEW.id, NEW.status, auth.uid());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotations_status_audit ON public.quotations;
CREATE TRIGGER trg_quotations_status_audit
BEFORE INSERT OR UPDATE OF status, advance_amount ON public.quotations
FOR EACH ROW EXECUTE FUNCTION public.quotations_status_audit();

-- 5. Backfill an initial history row for quotations that don't have one yet.
INSERT INTO public.quotation_status_history (quotation_id, status, changed_by, changed_at)
SELECT q.id, q.status, q.created_by, q.created_at
FROM public.quotations q
WHERE NOT EXISTS (
  SELECT 1 FROM public.quotation_status_history h WHERE h.quotation_id = q.id
);
