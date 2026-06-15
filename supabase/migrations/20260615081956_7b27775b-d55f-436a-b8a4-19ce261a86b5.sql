
CREATE OR REPLACE FUNCTION public.protect_cost_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin')
     AND NOT public.has_role(auth.uid(), 'staff') THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.cost_price = OLD.cost_price;
    ELSIF TG_OP = 'INSERT' THEN
      NEW.cost_price = NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_bundle_cost_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin')
     AND NOT public.has_role(auth.uid(), 'staff') THEN
    IF TG_OP = 'UPDATE' THEN NEW.cost_price = OLD.cost_price;
    ELSIF TG_OP = 'INSERT' THEN NEW.cost_price = NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
