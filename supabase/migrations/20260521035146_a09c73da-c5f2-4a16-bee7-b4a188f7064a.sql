-- Delivery-note specific shared view: 24-hour expiry from dispatched_at,
-- image fallback to product_images / product_bundles, and no amount fields.
CREATE OR REPLACE FUNCTION public.get_shared_delivery_note(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  q_row public.quotations%ROWTYPE;
  items jsonb;
BEGIN
  SELECT * INTO q_row FROM public.quotations WHERE share_token = p_token LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- 24-hour expiry from dispatch time. If never dispatched, fall back to updated_at.
  IF COALESCE(q_row.dispatched_at, q_row.updated_at) < (now() - INTERVAL '24 hours') THEN
    RETURN jsonb_build_object('expired', true);
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'description', i.description,
        'quantity', i.quantity,
        'measurement', i.measurement,
        'item_image_url', COALESCE(
          i.item_image_url,
          (SELECT pi.image_url FROM public.product_images pi
             WHERE pi.product_id = i.product_id
             ORDER BY pi.display_order NULLS LAST LIMIT 1),
          (SELECT pb.main_image_url FROM public.product_bundles pb
             WHERE pb.id = i.bundle_id LIMIT 1)
        ),
        'measurement_image_url', i.measurement_image_url,
        'catalog_text', i.catalog_text,
        'catalog_image_url', i.catalog_image_url,
        'sketch_url', i.sketch_url,
        'site_photos', i.site_photos,
        'fulfillment_route', i.fulfillment_route
      )
      ORDER BY i.display_order NULLS LAST, i.created_at
    ),
    '[]'::jsonb
  )
  INTO items
  FROM public.quotation_items i
  WHERE i.quotation_id = q_row.id;

  RETURN jsonb_build_object(
    'quotation', jsonb_build_object(
      'id', q_row.id,
      'quotation_id', q_row.quotation_id,
      'party_name', q_row.party_name,
      'party_phone', q_row.party_phone,
      'party_place', q_row.party_place,
      'party_address', q_row.party_address,
      'status', q_row.status,
      'notes', q_row.notes,
      'updated_at', q_row.updated_at,
      'dispatched_at', q_row.dispatched_at,
      'expires_at', (COALESCE(q_row.dispatched_at, q_row.updated_at) + INTERVAL '24 hours')
    ),
    'items', items
  );
END;
$$;