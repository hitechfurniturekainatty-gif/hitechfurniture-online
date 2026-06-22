CREATE OR REPLACE FUNCTION public.notify_stale_partial_deliveries()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _inserted INT := 0;
BEGIN
  WITH agg AS (
    SELECT qi.quotation_id,
           COUNT(*) AS total_items,
           COUNT(*) FILTER (WHERE qi.delivered_at IS NOT NULL) AS delivered_items,
           MIN(qi.delivered_at) FILTER (WHERE qi.delivered_at IS NOT NULL) AS first_delivered_at
      FROM public.quotation_items qi
     GROUP BY qi.quotation_id
  ),
  candidates AS (
    SELECT q.id, q.quotation_id AS code, q.party_name, q.party_place, q.salesperson_name,
           a.total_items, a.delivered_items, a.first_delivered_at
      FROM agg a
      JOIN public.quotations q ON q.id = a.quotation_id
     WHERE q.deleted_at IS NULL
       AND q.status IS DISTINCT FROM 'rejected'
       AND q.status IS DISTINCT FROM 'delivered'
       AND a.delivered_items > 0
       AND a.delivered_items < a.total_items
       AND a.first_delivered_at < (now() - INTERVAL '5 days')
       AND NOT EXISTS (
         SELECT 1 FROM public.pipeline_notifications pn
          WHERE pn.quotation_id = q.id
            AND pn.title = 'Stale partial delivery'
            AND pn.created_at > (now() - INTERVAL '2 days')
       )
  ),
  ins AS (
    INSERT INTO public.pipeline_notifications (quotation_id, stage, target_role, title, body)
    SELECT c.id, 6::smallint, 'staff'::app_role,
           'Stale partial delivery',
           'Quotation ' || COALESCE(c.code, c.id::text)
             || ' (' || COALESCE(c.party_name,'') || ' — ' || COALESCE(c.party_place,'') || ')'
             || ': ' || c.delivered_items || ' of ' || c.total_items || ' items delivered, '
             || (c.total_items - c.delivered_items) || ' still pending since '
             || to_char(c.first_delivered_at::date, 'DD Mon') || '.'
             || CASE WHEN c.salesperson_name IS NOT NULL AND length(btrim(c.salesperson_name)) > 0
                     THEN ' Salesperson: ' || c.salesperson_name || '.'
                     ELSE '' END
      FROM candidates c
    RETURNING 1
  )
  SELECT count(*) INTO _inserted FROM ins;
  RETURN _inserted;
END;
$$;