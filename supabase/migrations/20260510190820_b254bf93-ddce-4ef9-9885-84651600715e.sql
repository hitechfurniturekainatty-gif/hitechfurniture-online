-- Add share tokens for live mobile-link sharing of quotations and work orders
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS share_token uuid UNIQUE DEFAULT gen_random_uuid();

UPDATE public.quotations SET share_token = gen_random_uuid() WHERE share_token IS NULL;

ALTER TABLE public.job_work_orders
  ADD COLUMN IF NOT EXISTS share_token uuid UNIQUE DEFAULT gen_random_uuid();

UPDATE public.job_work_orders SET share_token = gen_random_uuid() WHERE share_token IS NULL;

-- Security-definer RPC: returns a shareable JSON snapshot of a quotation by token.
-- Excludes nothing (customers see full details); for worker job view we use a
-- separate RPC that omits prices.
CREATE OR REPLACE FUNCTION public.get_shared_quotation(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q_row public.quotations%ROWTYPE;
  items jsonb;
BEGIN
  SELECT * INTO q_row FROM public.quotations WHERE share_token = p_token LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(i.*) ORDER BY i.sort_order NULLS LAST, i.created_at), '[]'::jsonb)
    INTO items
  FROM public.quotation_items i
  WHERE i.quotation_id = q_row.id;

  RETURN jsonb_build_object(
    'quotation', to_jsonb(q_row),
    'items', items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_quotation(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_shared_quotation(uuid) TO anon, authenticated;

-- Worker-safe job sheet by share token (no prices, no customer phone).
CREATE OR REPLACE FUNCTION public.get_shared_job_work_order(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jw_row public.job_work_orders%ROWTYPE;
  q_row public.quotations%ROWTYPE;
  items jsonb;
BEGIN
  SELECT * INTO jw_row FROM public.job_work_orders WHERE share_token = p_token LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO q_row FROM public.quotations WHERE id = jw_row.quotation_id LIMIT 1;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'description', i.description,
      'quantity', i.quantity,
      'measurement', i.measurement,
      'item_image_url', i.item_image_url,
      'measurement_image_url', i.measurement_image_url,
      'catalog_text', i.catalog_text,
      'catalog_image_url', i.catalog_image_url,
      'sketch_url', i.sketch_url,
      'site_photos', i.site_photos
    )
    ORDER BY array_position(jw_row.item_ids, i.id)
  ), '[]'::jsonb)
    INTO items
  FROM public.quotation_items i
  WHERE i.id = ANY(jw_row.item_ids);

  RETURN jsonb_build_object(
    'job', jsonb_build_object(
      'id', jw_row.id,
      'status', jw_row.status,
      'notes', jw_row.notes,
      'is_urgent', jw_row.is_urgent,
      'created_at', jw_row.created_at,
      'item_ids', jw_row.item_ids
    ),
    'quotation_code', q_row.quotation_id,
    'party_place', q_row.party_place,
    'items', items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_job_work_order(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_shared_job_work_order(uuid) TO anon, authenticated;