-- 1. Add document_type column to quotations
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'quotation';

ALTER TABLE public.quotations
  DROP CONSTRAINT IF EXISTS quotations_document_type_check;

ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_document_type_check
  CHECK (document_type IN ('quotation', 'po'));

CREATE INDEX IF NOT EXISTS idx_quotations_document_type
  ON public.quotations(document_type);

-- 2. PO ID generator (separate counter from quotations)
CREATE OR REPLACE FUNCTION public.next_po_id(_party text, _place text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _scope TEXT;
  _next INT;
  _safe_party TEXT;
  _safe_place TEXT;
  _fy TEXT;
  _y INT;
  _m INT;
  _start_year INT;
  _end_year INT;
BEGIN
  _safe_party := btrim(regexp_replace(coalesce(_party, 'NA'), '[^a-zA-Z0-9 ]+', '', 'g'));
  _safe_place := btrim(regexp_replace(coalesce(_place, 'NA'), '[^a-zA-Z0-9 ]+', '', 'g'));
  IF length(_safe_party) = 0 THEN _safe_party := 'NA'; END IF;
  IF length(_safe_place) = 0 THEN _safe_place := 'NA'; END IF;

  _y := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
  _m := EXTRACT(MONTH FROM CURRENT_DATE)::INT;
  IF _m >= 4 THEN
    _start_year := _y;
    _end_year := _y + 1;
  ELSE
    _start_year := _y - 1;
    _end_year := _y;
  END IF;
  _fy := _start_year::TEXT || '/' || lpad((_end_year % 100)::TEXT, 2, '0');

  -- Per-FY PO counter (separate scope from quotations)
  _scope := 'po-fy-' || _fy;
  INSERT INTO public.quotation_counters(scope, last_serial)
    VALUES (_scope, 1)
  ON CONFLICT (scope) DO UPDATE
    SET last_serial = public.quotation_counters.last_serial + 1
  RETURNING last_serial INTO _next;

  RETURN 'PO-' || _fy || '-' || lpad(_next::TEXT, 3, '0') || ' / ' || initcap(_safe_party) || ' / ' || initcap(_safe_place);
END;
$function$;