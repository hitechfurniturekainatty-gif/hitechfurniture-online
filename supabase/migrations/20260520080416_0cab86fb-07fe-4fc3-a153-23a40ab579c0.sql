
CREATE OR REPLACE FUNCTION public.get_shared_quotation(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  q_row public.quotations%ROWTYPE;
  items jsonb;
BEGIN
  SELECT * INTO q_row FROM public.quotations WHERE share_token = p_token LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
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
        'site_photos', i.site_photos,
        'unit_price', i.unit_price,
        'total_price', i.total_price,
        'fulfillment_route', i.fulfillment_route
      )
      ORDER BY i.sort_order NULLS LAST, i.created_at
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
      'status', q_row.status,
      'total_amount', q_row.total,
      'advance_amount', q_row.advance_amount,
      'notes', q_row.notes,
      'updated_at', q_row.updated_at
    ),
    'items', items
  );
END;
$function$;
