-- Section 7: notify office on first partial delivery of a quotation
CREATE OR REPLACE FUNCTION public.quotation_items_partial_delivery_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _total INT;
  _delivered INT;
  _other_delivered INT;
  _q RECORD;
  _body TEXT;
BEGIN
  -- Only act when this update flips delivered_at from null -> not null
  IF NOT (NEW.delivered_at IS NOT NULL AND OLD.delivered_at IS NULL) THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE delivered_at IS NOT NULL),
         COUNT(*) FILTER (WHERE delivered_at IS NOT NULL AND id <> NEW.id)
    INTO _total, _delivered, _other_delivered
  FROM public.quotation_items
  WHERE quotation_id = NEW.quotation_id;

  -- Fire only on the FIRST partial: this row is now delivered, no others were
  -- delivered before it, and at least one item still pending.
  IF _other_delivered = 0 AND _delivered < _total THEN
    SELECT quotation_id, party_name, party_place, salesperson_name
      INTO _q
    FROM public.quotations
    WHERE id = NEW.quotation_id;

    _body := 'Quotation ' || COALESCE(_q.quotation_id, NEW.quotation_id::text)
          || ' (' || COALESCE(_q.party_name,'') || ' — ' || COALESCE(_q.party_place,'') || ')'
          || ': ' || _delivered || ' of ' || _total || ' items delivered, '
          || (_total - _delivered) || ' still pending.'
          || CASE WHEN _q.salesperson_name IS NOT NULL AND length(btrim(_q.salesperson_name)) > 0
                  THEN ' Salesperson: ' || _q.salesperson_name || '.'
                  ELSE '' END;

    INSERT INTO public.pipeline_notifications(quotation_id, stage, target_role, title, body)
    VALUES (NEW.quotation_id, 6::smallint, 'staff'::app_role,
            'Partial delivery — follow up', _body);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotation_items_partial_delivery_aft ON public.quotation_items;
CREATE TRIGGER quotation_items_partial_delivery_aft
AFTER UPDATE OF delivered_at ON public.quotation_items
FOR EACH ROW
EXECUTE FUNCTION public.quotation_items_partial_delivery_notify();