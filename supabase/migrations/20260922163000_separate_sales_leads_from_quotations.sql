-- Separate sales leads from operational quotations.
-- New enquiries live in sales_leads. A quotation is created only on explicit conversion.
CREATE TABLE IF NOT EXISTS public.sales_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_code text NOT NULL UNIQUE,
  customer_name text NOT NULL,
  customer_phone text,
  customer_place text,
  requirement text,
  enquiry_type text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('website','manual','whatsapp','other')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','contacted','converted','lost','cancelled')),
  item_image_url text,
  suggested_amount numeric NOT NULL DEFAULT 0,
  assigned_to uuid,
  contacted_at timestamptz,
  next_follow_up_at timestamptz,
  converted_quotation_id uuid REFERENCES public.quotations(id) ON DELETE SET NULL,
  converted_at timestamptz,
  lost_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS sales_leads_status_idx ON public.sales_leads(status, created_at DESC);
CREATE INDEX IF NOT EXISTS sales_leads_source_idx ON public.sales_leads(source, created_at DESC);
CREATE INDEX IF NOT EXISTS sales_leads_converted_quote_idx ON public.sales_leads(converted_quotation_id);

ALTER TABLE public.sales_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read sales leads" ON public.sales_leads;
CREATE POLICY "staff read sales leads" ON public.sales_leads FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "staff write sales leads" ON public.sales_leads;
CREATE POLICY "staff write sales leads" ON public.sales_leads FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.sales_leads TO authenticated;
GRANT ALL ON public.sales_leads TO service_role;

CREATE OR REPLACE FUNCTION public.next_lead_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(lead_code, '\\D','','g'),'')::integer),0)+1 INTO n FROM public.sales_leads;
  RETURN 'LD-' || to_char(current_date,'YYYY') || '-' || lpad(n::text,4,'0');
END $$;
REVOKE ALL ON FUNCTION public.next_lead_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_lead_code() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.convert_sales_lead_to_quotation(p_lead_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE l public.sales_leads%ROWTYPE; qid text; q uuid;
BEGIN
  SELECT * INTO l FROM public.sales_leads WHERE id=p_lead_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','lead_not_found'); END IF;
  IF l.converted_quotation_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok',true,'quotation_id',l.converted_quotation_id,'already_converted',true);
  END IF;
  qid := public.next_quotation_id(l.customer_name,l.customer_place);
  INSERT INTO public.quotations(
    quotation_id,party_name,party_place,party_phone,notes,salesperson_name,
    lead_type,enquiry_type,status,pipeline_stage,commercial_status
  ) VALUES (
    qid,l.customer_name,COALESCE(l.customer_place,''),l.customer_phone,l.requirement,
    NULL,'lead',l.enquiry_type,'drafted',2,'quote_preparation'
  ) RETURNING id INTO q;
  IF COALESCE(l.requirement,'') <> '' OR l.item_image_url IS NOT NULL THEN
    INSERT INTO public.quotation_items(
      quotation_id,display_order,description,item_image_url,quantity,unit_price,amount,fulfillment_route
    ) VALUES (q,1,COALESCE(NULLIF(l.requirement,''),'Customer requirement'),l.item_image_url,1,
      COALESCE(l.suggested_amount,0),COALESCE(l.suggested_amount,0),'custom');
  END IF;
  UPDATE public.sales_leads SET status='converted',converted_quotation_id=q,converted_at=now(),updated_at=now()
  WHERE id=p_lead_id;
  RETURN jsonb_build_object('ok',true,'quotation_id',q,'quotation_code',qid,'already_converted',false);
END $$;
REVOKE ALL ON FUNCTION public.convert_sales_lead_to_quotation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_sales_lead_to_quotation(uuid) TO authenticated, service_role;

-- Preserve historical stage-1 lead reporting without duplicating quotations.
INSERT INTO public.sales_leads(
  lead_code,customer_name,customer_phone,customer_place,requirement,enquiry_type,source,status,
  contacted_at,converted_quotation_id,converted_at,created_by,created_at
)
SELECT
  'LEG-' || q.quotation_id,q.party_name,q.party_phone,q.party_place,q.notes,q.enquiry_type,
  'website',
  CASE WHEN q.status='rejected' THEN 'lost'
       WHEN COALESCE(q.pipeline_stage,1)>=2 THEN 'converted'
       WHEN q.enquiry_contacted_at IS NOT NULL THEN 'contacted'
       ELSE 'pending' END,
  q.enquiry_contacted_at,
  CASE WHEN COALESCE(q.pipeline_stage,1)>=2 THEN q.id ELSE NULL END,
  CASE WHEN COALESCE(q.pipeline_stage,1)>=2 THEN COALESCE(q.updated_at,q.created_at) ELSE NULL END,
  q.created_by,q.created_at
FROM public.quotations q
WHERE q.lead_type='lead'
  AND (q.salesperson_name='Website Enquiry' OR (q.enquiry_type IS NOT NULL AND q.created_by IS NULL))
  AND NOT EXISTS (SELECT 1 FROM public.sales_leads l WHERE l.lead_code='LEG-' || q.quotation_id);

COMMENT ON TABLE public.sales_leads IS 'Pre-quotation sales funnel. Only explicit conversion creates an operational quotation.';
