ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC NOT NULL DEFAULT 0;

-- Update GST recalculation trigger function to subtract discount before GST
CREATE OR REPLACE FUNCTION public.recalc_quotation_totals()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _qid UUID; _sub NUMERIC; _gst NUMERIC; _pct NUMERIC; _disc NUMERIC;
BEGIN
  _qid := COALESCE(NEW.quotation_id, OLD.quotation_id);
  SELECT COALESCE(SUM(quantity*unit_price),0) INTO _sub FROM public.quotation_items WHERE quotation_id = _qid;
  SELECT gst_percent, COALESCE(discount_amount,0) INTO _pct, _disc FROM public.quotations WHERE id = _qid;
  _gst := ROUND(GREATEST(_sub - COALESCE(_disc,0), 0) * COALESCE(_pct,0) / 100, 2);
  UPDATE public.quotations
    SET subtotal = _sub,
        gst_amount = _gst,
        total = GREATEST(_sub - COALESCE(_disc,0), 0) + _gst
    WHERE id = _qid;
  RETURN NULL;
END; $function$;

CREATE OR REPLACE FUNCTION public.recalc_on_gst_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE _disc NUMERIC;
BEGIN
  IF NEW.gst_percent IS DISTINCT FROM OLD.gst_percent
     OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount THEN
    _disc := COALESCE(NEW.discount_amount, 0);
    NEW.gst_amount := ROUND(GREATEST(NEW.subtotal - _disc, 0) * COALESCE(NEW.gst_percent,0) / 100, 2);
    NEW.total := GREATEST(NEW.subtotal - _disc, 0) + NEW.gst_amount;
  END IF;
  RETURN NEW;
END; $function$;