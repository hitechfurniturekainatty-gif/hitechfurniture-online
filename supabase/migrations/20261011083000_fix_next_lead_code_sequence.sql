-- next_lead_code concatenated every digit in old codes and lpad(...,4) truncated
-- the result to '2026', so every call returned LD-2026-2026 and the UNIQUE(lead_code)
-- insert failed for all website enquiries after 2026-09-28.
CREATE OR REPLACE FUNCTION public.next_lead_code()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  yr text := to_char(now() at time zone 'Asia/Kolkata','YYYY');
  n integer;
  candidate text;
BEGIN
  SELECT COALESCE(MAX((regexp_match(lead_code, '^LD-' || yr || '-(\d+)$'))[1]::integer), 0) + 1
    INTO n
    FROM public.sales_leads
   WHERE lead_code ~ ('^LD-' || yr || '-\d+$')
     AND lead_code <> 'LD-' || yr || '-' || yr;  -- ignore the one bad code produced by the old bug
  LOOP
    candidate := 'LD-' || yr || '-' || lpad(n::text, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.sales_leads WHERE lead_code = candidate);
    n := n + 1;
  END LOOP;
  RETURN candidate;
END $function$;
