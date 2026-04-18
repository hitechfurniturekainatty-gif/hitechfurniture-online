CREATE OR REPLACE FUNCTION public.next_quotation_id(_party text, _place text)
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
  -- Sanitize party and place (keep spaces collapsed to single space, strip other punctuation)
  _safe_party := btrim(regexp_replace(coalesce(_party, 'NA'), '[^a-zA-Z0-9 ]+', '', 'g'));
  _safe_place := btrim(regexp_replace(coalesce(_place, 'NA'), '[^a-zA-Z0-9 ]+', '', 'g'));
  IF length(_safe_party) = 0 THEN _safe_party := 'NA'; END IF;
  IF length(_safe_place) = 0 THEN _safe_place := 'NA'; END IF;

  -- Compute Indian financial year (Apr–Mar), e.g. 2026/27
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

  -- Per financial-year global counter (audit-safe: never reused even after deletes)
  _scope := 'fy-' || _fy;
  INSERT INTO public.quotation_counters(scope, last_serial)
    VALUES (_scope, 1)
  ON CONFLICT (scope) DO UPDATE
    SET last_serial = public.quotation_counters.last_serial + 1
  RETURNING last_serial INTO _next;

  -- Format: 2026/27-001 / Rahul / Kalpetta
  RETURN _fy || '-' || lpad(_next::TEXT, 3, '0') || ' / ' || initcap(_safe_party) || ' / ' || initcap(_safe_place);
END;
$function$;