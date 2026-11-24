-- Output Books quotations become open leads to follow up (2026-11-25)
--
-- Owner's rule: everything typed in Output Books goes into Leads & Follow-up and moves
-- through the normal route from there. A quotation in Output Books is not yet a sale, so:
--   * its lead is OPEN (status "contacted", stage "Quotation") with a next call in 2 days,
--     assigned to a salesman by the usual pool; the requirement lists the items and total
--     and the first product photo is shown on the lead;
--   * the website quotation stays behind it as a draft (it holds the items and photos and
--     is opened from the lead when the customer agrees);
--   * Confirm Order on that quotation marks the lead Converted;
--   * marking the lead Lost / Cancelled rejects its draft quotation.
-- Replaces the earlier behaviour (lead created already Converted).

CREATE OR REPLACE FUNCTION public.link_ob_quote_lead(p_quotation_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  q public.quotations%ROWTYPE;
  v_norm text;
  v_lead uuid;
  v_summary text;
  v_photo text;
BEGIN
  SELECT * INTO q FROM public.quotations WHERE id = p_quotation_id;
  IF NOT FOUND OR q.ob_trans_id IS NULL THEN RETURN NULL; END IF;

  SELECT string_agg(i.description || ' ×' || trim(to_char(i.quantity, 'FM999990.##')), ', ' ORDER BY i.display_order),
         (array_agg(coalesce(nullif(i.item_image_url, ''), i.catalog_image_url) ORDER BY i.display_order)
            FILTER (WHERE coalesce(nullif(i.item_image_url, ''), i.catalog_image_url) IS NOT NULL))[1]
    INTO v_summary, v_photo
    FROM public.quotation_items i WHERE i.quotation_id = q.id AND NOT i.ob_removed;
  v_summary := left('Output Books ' || coalesce(q.ob_quote_no, '') || ' · ' || coalesce(v_summary, '')
                    || ' · ₹' || to_char(q.total, 'FM99,99,99,999'), 500);

  -- Already linked: keep the item summary and photo up to date while it is open.
  SELECT id INTO v_lead FROM public.sales_leads WHERE converted_quotation_id = q.id LIMIT 1;
  IF v_lead IS NOT NULL THEN
    UPDATE public.sales_leads
       SET requirement = v_summary, item_image_url = coalesce(v_photo, item_image_url), updated_at = now()
     WHERE id = v_lead AND status IN ('pending', 'contacted');
    RETURN v_lead;
  END IF;

  -- Same customer already enquired (website, Instagram, WhatsApp …): that lead carries on.
  v_norm := right(regexp_replace(coalesce(q.party_phone, ''), '\D', '', 'g'), 10);
  IF length(v_norm) = 10 THEN
    SELECT id INTO v_lead FROM public.sales_leads
     WHERE converted_quotation_id IS NULL AND deleted_at IS NULL
       AND status IN ('pending', 'contacted')
       AND phone_norm = v_norm
     ORDER BY created_at DESC LIMIT 1;
    IF v_lead IS NOT NULL THEN
      UPDATE public.sales_leads
         SET status = 'contacted', converted_quotation_id = q.id,
             requirement = v_summary, item_image_url = coalesce(v_photo, item_image_url),
             next_follow_up_at = CASE WHEN next_follow_up_at IS NULL OR next_follow_up_at < now()
                                      THEN public.next_ist_slot(2) ELSE next_follow_up_at END,
             updated_at = now()
       WHERE id = v_lead;
      RETURN v_lead;
    END IF;
  END IF;

  -- New walk-in customer.
  INSERT INTO public.sales_leads (lead_code, customer_name, customer_phone, customer_place, requirement,
                                  item_image_url, source, status, converted_quotation_id, next_follow_up_at)
  VALUES (public.next_lead_code(), q.party_name, nullif(q.party_phone, ''),
          nullif(nullif(q.party_place, '-'), 'NA'), v_summary, v_photo,
          'walkin', 'contacted', q.id, public.next_ist_slot(2))
  RETURNING id INTO v_lead;
  RETURN v_lead;
END $$;
REVOKE ALL ON FUNCTION public.link_ob_quote_lead(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_ob_quote_lead(uuid) TO service_role;

-- Run the link for every synced quotation (new and updated), so the lead summary stays fresh.
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
       AND coalesce(q.status, '') = 'drafted'
       AND (q.ob_synced_at > now() - interval '2 minutes'
            OR NOT EXISTS (SELECT 1 FROM public.sales_leads l WHERE l.converted_quotation_id = q.id))
  LOOP
    PERFORM public.link_ob_quote_lead(v_id);
    linked := linked + 1;
  END LOOP;
  RETURN r || jsonb_build_object('leads_linked', linked);
END $$;
REVOKE ALL ON FUNCTION public.sync_ob_quotations_linked(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_ob_quotations_linked(jsonb) TO service_role;

-- Confirm Order → the lead is won.
CREATE OR REPLACE FUNCTION public.quotation_confirm_converts_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF (coalesce(NEW.status, '') IN ('finalized', 'completed', 'delivered')
      OR coalesce(NEW.commercial_status, '') IN ('confirmed', 'payment_pending', 'closed', 'delivered'))
     AND NOT (coalesce(OLD.status, '') IN ('finalized', 'completed', 'delivered')
              OR coalesce(OLD.commercial_status, '') IN ('confirmed', 'payment_pending', 'closed', 'delivered')) THEN
    UPDATE public.sales_leads SET status = 'converted', updated_at = now()
     WHERE converted_quotation_id = NEW.id AND status IN ('pending', 'contacted');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_quotation_confirm_converts_lead ON public.quotations;
CREATE TRIGGER trg_quotation_confirm_converts_lead AFTER UPDATE OF status, commercial_status ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.quotation_confirm_converts_lead();

-- Lead lost / cancelled → its draft quotation is rejected (only drafts; orders are never touched).
CREATE OR REPLACE FUNCTION public.lead_lost_rejects_draft()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status IN ('lost', 'cancelled') AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.converted_quotation_id IS NOT NULL THEN
    UPDATE public.quotations SET status = 'rejected'
     WHERE id = NEW.converted_quotation_id AND coalesce(status, '') = 'drafted'
       AND coalesce(commercial_status, '') NOT IN ('confirmed', 'payment_pending', 'closed', 'delivered');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_lead_lost_rejects_draft ON public.sales_leads;
CREATE TRIGGER trg_lead_lost_rejects_draft AFTER UPDATE OF status ON public.sales_leads
  FOR EACH ROW EXECUTE FUNCTION public.lead_lost_rejects_draft();

REVOKE ALL ON FUNCTION public.quotation_confirm_converts_lead() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lead_lost_rejects_draft() FROM PUBLIC, anon, authenticated;

-- Re-open the leads made earlier as "converted" for Output Books drafts, so they get followed up.
UPDATE public.sales_leads l
   SET status = 'contacted', next_follow_up_at = public.next_ist_slot(1), updated_at = now()
  FROM public.quotations q
 WHERE l.converted_quotation_id = q.id AND q.ob_trans_id IS NOT NULL
   AND l.status = 'converted' AND coalesce(q.status, '') = 'drafted';
DO $$ DECLARE v uuid; BEGIN
  FOR v IN SELECT id FROM public.quotations WHERE ob_trans_id IS NOT NULL AND deleted_at IS NULL AND status = 'drafted' LOOP
    PERFORM public.link_ob_quote_lead(v);
  END LOOP;
END $$;
