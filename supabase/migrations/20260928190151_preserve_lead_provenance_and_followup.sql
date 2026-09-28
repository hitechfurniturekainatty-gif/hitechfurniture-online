ALTER TABLE public.sales_leads ADD COLUMN IF NOT EXISTS follow_up_notes text;
CREATE OR REPLACE FUNCTION public.convert_sales_lead_to_quotation(p_lead_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public'
AS $function$
DECLARE l public.sales_leads%ROWTYPE; qid text; q uuid; salesman text;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'staff'::public.app_role)) THEN
    RAISE EXCEPTION 'Not authorized to convert leads';
  END IF;
  SELECT * INTO l FROM public.sales_leads WHERE id=p_lead_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','lead_not_found'); END IF;
  IF l.converted_quotation_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok',true,'quotation_id',l.converted_quotation_id,'already_converted',true);
  END IF;
  IF l.status NOT IN ('pending','contacted') THEN
    RETURN jsonb_build_object('ok',false,'error','Reopen this lead before creating a quotation');
  END IF;
  SELECT display_name INTO salesman FROM public.profiles WHERE user_id=l.assigned_to;
  qid := public.next_quotation_id(l.customer_name,l.customer_place);
  INSERT INTO public.quotations(quotation_id,party_name,party_place,party_phone,notes,salesperson_name,created_by,lead_type,enquiry_type,status,pipeline_stage,commercial_status)
  VALUES(qid,l.customer_name,COALESCE(l.customer_place,''),l.customer_phone,l.requirement,salesman,auth.uid(),'lead',l.enquiry_type,'drafted',2,'quote_preparation') RETURNING id INTO q;
  IF COALESCE(l.requirement,'') <> '' OR l.item_image_url IS NOT NULL THEN
    INSERT INTO public.quotation_items(quotation_id,display_order,description,item_image_url,quantity,unit_price,amount,fulfillment_route)
    VALUES(q,1,COALESCE(NULLIF(l.requirement,''),'Customer requirement'),l.item_image_url,1,COALESCE(l.suggested_amount,0),COALESCE(l.suggested_amount,0),'custom');
  END IF;
  UPDATE public.sales_leads SET status='converted',converted_quotation_id=q,converted_at=now(),updated_at=now() WHERE id=p_lead_id;
  RETURN jsonb_build_object('ok',true,'quotation_id',q,'quotation_code',qid,'already_converted',false);
END $function$;
