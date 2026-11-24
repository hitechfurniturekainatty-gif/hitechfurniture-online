-- Output Books quotations → website CRM (2026-11-24)
--
-- Quotations are now typed in Output Books (QTE…), where each line picks a product and its
-- photo. n8n reads them every 5 minutes (read-only) and calls sync_ob_quotations(), which
-- creates or updates the matching website quotation. Follow-up, confirm, supplier orders,
-- delivery and payment then happen on the website.
--
-- Rules (agreed with the owner):
--   * Output Books owns: customer name, date, items, quantity, rate (after line discount),
--     GST and the product photo (stored in catalog_image_url).
--   * The website owns everything else and the sync never touches it: item photo, sketch,
--     measurement, site photos, notes, Ready stock / Custom, advance, delivery date,
--     follow-ups. A custom photo uploaded on the website therefore survives every sync.
--   * A line deleted in Output Books is deleted on the website, unless staff added a photo,
--     sketch or measurement to it; then it is kept at ₹0 and labelled "[Removed in Output Books]".
--   * Once the order is confirmed (or rejected / delivered / deleted) on the website, the
--     sync stops touching that quotation.

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS ob_trans_id bigint,
  ADD COLUMN IF NOT EXISTS ob_quote_no text,
  ADD COLUMN IF NOT EXISTS ob_updated_on text,
  ADD COLUMN IF NOT EXISTS ob_synced_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS quotations_ob_trans_id_key ON public.quotations(ob_trans_id) WHERE ob_trans_id IS NOT NULL;

ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS ob_line_key text,
  ADD COLUMN IF NOT EXISTS ob_removed boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS quotation_items_ob_line_key ON public.quotation_items(quotation_id, ob_line_key) WHERE ob_line_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_ob_quotations(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  oq jsonb; li jsonb; n int;
  q public.quotations%ROWTYPE;
  v_id uuid; v_keys text[]; v_place text; v_pct numeric; v_qty numeric; v_price numeric; v_prod uuid;
  created int := 0; updated int := 0; unchanged int := 0; locked int := 0;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service role only' USING ERRCODE = '42501';
  END IF;

  FOR oq IN SELECT * FROM jsonb_array_elements(coalesce(p->'quotes', '[]'::jsonb)) LOOP
    SELECT * INTO q FROM public.quotations WHERE ob_trans_id = (oq->>'id')::bigint FOR UPDATE;

    IF FOUND AND (q.deleted_at IS NOT NULL
        OR coalesce(q.status, '') IN ('finalized', 'completed', 'delivered', 'rejected')
        OR coalesce(q.commercial_status, '') IN ('confirmed', 'payment_pending', 'closed', 'delivered')) THEN
      locked := locked + 1; CONTINUE;
    END IF;
    IF FOUND AND q.ob_updated_on IS NOT DISTINCT FROM (oq->>'updated_on') THEN
      unchanged := unchanged + 1; CONTINUE;
    END IF;

    v_place := nullif(btrim(coalesce(oq->>'place', '')), '');
    v_pct := CASE WHEN coalesce((oq->>'taxable')::numeric, 0) > 0 AND coalesce((oq->>'tax')::numeric, 0) > 0
                  THEN round((oq->>'tax')::numeric * 100 / (oq->>'taxable')::numeric, 2) ELSE 0 END;

    IF NOT FOUND THEN
      INSERT INTO public.quotations (quotation_id, party_name, party_place, party_phone, quotation_date, notes,
                                     gst_percent, ob_trans_id, ob_quote_no, ob_updated_on, ob_synced_at)
      VALUES (public.next_quotation_id(coalesce(nullif(oq->>'name', ''), 'Customer'), coalesce(v_place, 'NA')),
              coalesce(nullif(btrim(oq->>'name'), ''), 'Customer'), coalesce(v_place, '-'),
              nullif(btrim(coalesce(oq->>'phone', '')), ''),
              coalesce((oq->>'date')::date, current_date),
              'From Output Books ' || coalesce(oq->>'no', ''),
              v_pct, (oq->>'id')::bigint, oq->>'no', oq->>'updated_on', now())
      RETURNING id INTO v_id;
      created := created + 1;
    ELSE
      v_id := q.id;
      UPDATE public.quotations
         SET party_name = coalesce(nullif(btrim(oq->>'name'), ''), party_name),
             party_place = CASE WHEN coalesce(party_place, '') IN ('', '-', 'NA') THEN coalesce(v_place, party_place) ELSE party_place END,
             party_phone = coalesce(nullif(party_phone, ''), nullif(btrim(coalesce(oq->>'phone', '')), '')),
             quotation_date = coalesce((oq->>'date')::date, quotation_date),
             gst_percent = v_pct,
             ob_quote_no = oq->>'no', ob_updated_on = oq->>'updated_on', ob_synced_at = now()
       WHERE id = v_id;
      updated := updated + 1;
    END IF;

    v_keys := ARRAY[]::text[];
    n := 0;
    FOR li IN SELECT * FROM jsonb_array_elements(coalesce(oq->'items', '[]'::jsonb)) LOOP
      n := n + 1;
      v_keys := v_keys || (li->>'key');
      v_qty := greatest(coalesce((li->>'qty')::numeric, 1), 0.001);
      -- Rate after the line discount, so website totals match Output Books.
      v_price := round(coalesce((li->>'taxable')::numeric, (li->>'rate')::numeric * v_qty, 0) / v_qty, 2);
      SELECT id INTO v_prod FROM public.products WHERE ob_item_id = (li->>'item_id')::int AND deleted_at IS NULL LIMIT 1;

      UPDATE public.quotation_items
         SET description = coalesce(nullif(btrim(li->>'name'), ''), description),
             catalog_text = nullif(btrim(coalesce(li->>'desc', '')), ''),
             quantity = v_qty, unit_price = v_price, display_order = n,
             product_id = coalesce(v_prod, product_id),
             catalog_image_url = coalesce(nullif(li->>'image', ''), catalog_image_url),
             ob_removed = false
       WHERE quotation_id = v_id AND ob_line_key = li->>'key';
      IF NOT FOUND THEN
        INSERT INTO public.quotation_items (quotation_id, ob_line_key, display_order, description, catalog_text,
                                            quantity, unit_price, product_id, catalog_image_url)
        VALUES (v_id, li->>'key', n, coalesce(nullif(btrim(li->>'name'), ''), 'Item'),
                nullif(btrim(coalesce(li->>'desc', '')), ''), v_qty, v_price, v_prod, nullif(li->>'image', ''));
      END IF;
    END LOOP;

    -- Lines no longer in Output Books.
    UPDATE public.quotation_items
       SET ob_removed = true, unit_price = 0,
           description = CASE WHEN description LIKE '[Removed in Output Books]%' THEN description
                              ELSE '[Removed in Output Books] ' || description END
     WHERE quotation_id = v_id AND ob_line_key IS NOT NULL AND NOT (ob_line_key = ANY(v_keys))
       AND (coalesce(item_image_url, '') <> '' OR coalesce(sketch_url, '') <> ''
            OR coalesce(measurement_image_url, '') <> '' OR coalesce(site_photos, '') NOT IN ('', '[]'));
    DELETE FROM public.quotation_items
     WHERE quotation_id = v_id AND ob_line_key IS NOT NULL AND NOT (ob_line_key = ANY(v_keys))
       AND NOT ob_removed;
  END LOOP;

  RETURN jsonb_build_object('created', created, 'updated', updated, 'unchanged', unchanged, 'locked', locked);
END $$;
REVOKE ALL ON FUNCTION public.sync_ob_quotations(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_ob_quotations(jsonb) TO service_role;
