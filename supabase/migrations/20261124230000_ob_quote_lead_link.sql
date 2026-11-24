-- Connect Output Books quotations to the lead route (2026-11-24)
--
-- Every quotation synced from Output Books gets a lead, so all sales follow one route
-- (lead → quotation → order → delivery) and the source report counts shop customers too:
--   * if an open lead has the same phone (last 10 digits) — e.g. someone who asked on
--     Instagram and then came to the shop — that lead is marked Converted and linked;
--   * otherwise a "walk-in" lead is created, already Converted and linked.
-- A quotation is linked once; re-syncs never create a second lead.

CREATE OR REPLACE FUNCTION public.link_ob_quote_lead(p_quotation_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  q public.quotations%ROWTYPE;
  v_norm text;
  v_lead uuid;
BEGIN
  SELECT * INTO q FROM public.quotations WHERE id = p_quotation_id;
  IF NOT FOUND OR q.ob_trans_id IS NULL THEN RETURN NULL; END IF;

  SELECT id INTO v_lead FROM public.sales_leads WHERE converted_quotation_id = q.id LIMIT 1;
  IF v_lead IS NOT NULL THEN RETURN v_lead; END IF;

  v_norm := right(regexp_replace(coalesce(q.party_phone, ''), '\D', '', 'g'), 10);
  IF length(v_norm) = 10 THEN
    SELECT id INTO v_lead FROM public.sales_leads
     WHERE converted_quotation_id IS NULL
       AND status IN ('pending', 'contacted')
       AND right(regexp_replace(coalesce(customer_phone, ''), '\D', '', 'g'), 10) = v_norm
     ORDER BY created_at DESC LIMIT 1;
    IF v_lead IS NOT NULL THEN
      UPDATE public.sales_leads
         SET status = 'converted', converted_quotation_id = q.id, updated_at = now()
       WHERE id = v_lead;
      RETURN v_lead;
    END IF;
  END IF;

  INSERT INTO public.sales_leads (lead_code, customer_name, customer_phone, customer_place, requirement,
                                  source, status, converted_quotation_id)
  VALUES (public.next_lead_code(), q.party_name, nullif(q.party_phone, ''),
          nullif(nullif(q.party_place, '-'), 'NA'),
          'Showroom quotation · Output Books ' || coalesce(q.ob_quote_no, ''),
          'walkin', 'converted', q.id)
  RETURNING id INTO v_lead;
  RETURN v_lead;
END $$;
REVOKE ALL ON FUNCTION public.link_ob_quote_lead(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_ob_quote_lead(uuid) TO service_role;

-- Call it from the sync for every quotation it creates or updates.
CREATE OR REPLACE FUNCTION public.sync_ob_quotations_linked(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  r jsonb;
  v_id uuid;
  linked int := 0;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service role only' USING ERRCODE = '42501';
  END IF;
  r := public.sync_ob_quotations(p);
  FOR v_id IN
    SELECT q.id FROM public.quotations q
     WHERE q.ob_trans_id IN (SELECT (x->>'id')::bigint FROM jsonb_array_elements(coalesce(p->'quotes', '[]'::jsonb)) x)
       AND q.deleted_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM public.sales_leads l WHERE l.converted_quotation_id = q.id)
  LOOP
    PERFORM public.link_ob_quote_lead(v_id);
    linked := linked + 1;
  END LOOP;
  RETURN r || jsonb_build_object('leads_linked', linked);
END $$;
REVOKE ALL ON FUNCTION public.sync_ob_quotations_linked(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_ob_quotations_linked(jsonb) TO service_role;

-- Link the Output Books quotations already on the website.
DO $$ DECLARE v uuid; BEGIN
  FOR v IN SELECT id FROM public.quotations WHERE ob_trans_id IS NOT NULL AND deleted_at IS NULL LOOP
    PERFORM public.link_ob_quote_lead(v);
  END LOOP;
END $$;
