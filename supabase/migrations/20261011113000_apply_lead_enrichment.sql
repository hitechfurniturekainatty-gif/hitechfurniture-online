-- Called by n8n workflow "[WA] Lead AI Enrichment" with Claude's JSON result.
-- Staff edits win: name only replaces a WhatsApp handle / placeholder, place only fills a blank,
-- budget only fills when empty. Not-a-sales-enquiry is noted, never auto-cancelled.
CREATE OR REPLACE FUNCTION public.apply_lead_enrichment(p_lead_id uuid, p_result jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  l public.sales_leads%ROWTYPE;
  r jsonb := coalesce(p_result, '{}'::jsonb);
  v_name text := NULLIF(trim(r->>'customer_name'), '');
  v_place text := NULLIF(trim(r->>'place'), '');
  v_req text := NULLIF(trim(r->>'requirement_summary'), '');
  v_type text := r->>'enquiry_type';
  v_budget numeric;
  v_marker text := 'AI: may not be a sales enquiry';
  v_notes text;
BEGIN
  SELECT * INTO l FROM public.sales_leads WHERE id = p_lead_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;

  BEGIN v_budget := NULLIF(r->>'budget_inr','')::numeric; EXCEPTION WHEN others THEN v_budget := NULL; END;

  v_notes := l.follow_up_notes;
  IF (r->>'is_sales_enquiry') = 'false' AND position(v_marker in coalesce(v_notes,'')) = 0 THEN
    v_notes := trim(v_marker || coalesce(' — ' || left(NULLIF(trim(r->>'reason'),''), 120), '') || E'\n' || coalesce(v_notes,''));
  END IF;

  UPDATE public.sales_leads SET
    customer_name = CASE WHEN v_name IS NOT NULL AND length(v_name) <= 60
                          AND (l.customer_name = 'WhatsApp customer' OR l.customer_name !~ '^[[:alpha:]][[:alpha:] .''-]{1,39}$')
                         THEN v_name ELSE customer_name END,
    customer_place = CASE WHEN v_place IS NOT NULL AND length(v_place) <= 80 AND coalesce(customer_place,'') = ''
                          THEN v_place ELSE customer_place END,
    requirement = coalesce(left(v_req, 500), requirement),
    enquiry_type = CASE WHEN v_type IN ('new_purchase','custom_design','delivery_installation','general_inquiry') THEN v_type ELSE enquiry_type END,
    suggested_amount = CASE WHEN v_budget > 0 AND v_budget < 10000000 AND coalesce(suggested_amount,0) = 0
                            THEN round(v_budget) ELSE suggested_amount END,
    follow_up_notes = v_notes,
    ai_enriched_at = now(),
    updated_at = now()
  WHERE id = p_lead_id;
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.apply_lead_enrichment(uuid, jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_lead_enrichment(uuid, jsonb) TO service_role;
