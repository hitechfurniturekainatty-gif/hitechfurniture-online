
ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_qitems_qid_delivered
  ON public.quotation_items(quotation_id) WHERE delivered_at IS NULL;

-- When every item on a quotation has delivered_at set, auto-flip the
-- quotation to 'delivered'. Only fires when an item is marked delivered.
CREATE OR REPLACE FUNCTION public.quotation_items_check_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _qid UUID;
  _total INT;
  _delivered INT;
  _status TEXT;
BEGIN
  _qid := COALESCE(NEW.quotation_id, OLD.quotation_id);
  IF _qid IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE delivered_at IS NOT NULL)
    INTO _total, _delivered
  FROM public.quotation_items
  WHERE quotation_id = _qid;

  SELECT status INTO _status FROM public.quotations WHERE id = _qid;

  IF _total > 0 AND _delivered = _total AND _status IS DISTINCT FROM 'delivered' THEN
    UPDATE public.quotations
       SET status = 'delivered', updated_at = now()
     WHERE id = _qid;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS qitems_check_completion ON public.quotation_items;
CREATE TRIGGER qitems_check_completion
AFTER INSERT OR UPDATE OF delivered_at ON public.quotation_items
FOR EACH ROW EXECUTE FUNCTION public.quotation_items_check_completion();
