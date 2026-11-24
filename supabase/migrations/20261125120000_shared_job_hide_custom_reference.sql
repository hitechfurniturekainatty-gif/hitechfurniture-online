-- Shared job-work link (worker's WhatsApp link): a custom (made-to-order) item's catalog
-- photo is only a reference model, not the piece to make, so it is not sent (2026-11-25).
-- Display only — nothing stored changes.
CREATE OR REPLACE FUNCTION public.get_shared_job_work_order(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  jw_row public.job_work_orders%ROWTYPE;
  q_row public.quotations%ROWTYPE;
  items jsonb;
BEGIN
  SELECT * INTO jw_row FROM public.job_work_orders WHERE share_token = p_token AND deleted_at IS NULL LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO q_row FROM public.quotations WHERE id = jw_row.quotation_id AND deleted_at IS NULL LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'description', i.description,
      'quantity', i.quantity,
      'measurement', i.measurement,
      'item_image_url', i.item_image_url,
      'measurement_image_url', i.measurement_image_url,
      'catalog_text', i.catalog_text,
      'catalog_image_url', CASE WHEN i.fulfillment_route = 'custom' OR i.stock_decision = 'custom'
                                THEN NULL ELSE i.catalog_image_url END,
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
      'id', jw_row.id, 'status', jw_row.status, 'notes', jw_row.notes,
      'is_urgent', jw_row.is_urgent, 'created_at', jw_row.created_at, 'item_ids', jw_row.item_ids
    ),
    'quotation_code', q_row.quotation_id,
    'party_place', q_row.party_place,
    'items', items
  );
END $$;
