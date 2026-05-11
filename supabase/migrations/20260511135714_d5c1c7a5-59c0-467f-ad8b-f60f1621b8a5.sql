
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS updated_by uuid;

CREATE OR REPLACE FUNCTION public.quotations_set_updated_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.updated_by := auth.uid();
  END IF;
  -- when soft-deleting, also stamp deleted_by
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.deleted_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotations_set_updated_by ON public.quotations;
CREATE TRIGGER trg_quotations_set_updated_by
BEFORE UPDATE ON public.quotations
FOR EACH ROW EXECUTE FUNCTION public.quotations_set_updated_by();
