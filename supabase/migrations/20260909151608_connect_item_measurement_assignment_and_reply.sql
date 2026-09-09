ALTER TABLE public.measurement_tasks ADD COLUMN IF NOT EXISTS item_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.measurement_tasks ADD COLUMN IF NOT EXISTS completion_note text;
CREATE OR REPLACE FUNCTION private.assign_item_measurement(q_id uuid, staff_id uuid, selected_ids uuid[], route_id uuid, visit_on date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q public.quotations; task_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')) THEN RAISE EXCEPTION 'Office access required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=staff_id AND role IN ('measurement_staff','staff','admin')) THEN RAISE EXCEPTION 'Choose measurement staff'; END IF;
 SELECT * INTO q FROM public.quotations WHERE id=q_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Quotation not found'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(selected_ids) x WHERE NOT EXISTS(SELECT 1 FROM public.quotation_items i WHERE i.id=x AND i.quotation_id=q_id)) THEN RAISE EXCEPTION 'Item does not belong to quotation'; END IF;
 IF EXISTS(SELECT 1 FROM public.measurement_tasks WHERE draft_quotation_id=q_id AND deleted_at IS NULL AND status<>'completed') THEN RAISE EXCEPTION 'A pending measurement task already exists. Open Measurement Tasks to manage it.'; END IF;
 INSERT INTO public.measurement_tasks(customer_name,customer_phone,customer_place,customer_address,requirement,assigned_to,created_by,draft_quotation_id,item_ids,delivery_route_id,visit_date)
 VALUES(q.party_name,q.party_phone,q.party_place,q.party_address,q.notes,staff_id,auth.uid(),q.id,coalesce(selected_ids,'{}'),route_id,visit_on) RETURNING id INTO task_id;
 UPDATE public.quotations SET source_task_id=task_id,delivery_route_id=route_id,enquiry_contacted_at=now() WHERE id=q.id;
 INSERT INTO public.pipeline_notifications(quotation_id,stage,target_role,title,body) VALUES(q.id,2,'measurement_staff','Measurement assigned',q.party_name);
 RETURN task_id;
END $$;
CREATE OR REPLACE FUNCTION public.assign_item_measurement(q_id uuid, staff_id uuid, selected_ids uuid[], route_id uuid, visit_on date)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.assign_item_measurement(q_id,staff_id,selected_ids,route_id,visit_on); $$;
REVOKE ALL ON FUNCTION private.assign_item_measurement(uuid,uuid,uuid[],uuid,date), public.assign_item_measurement(uuid,uuid,uuid[],uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.assign_item_measurement(uuid,uuid,uuid[],uuid,date), public.assign_item_measurement(uuid,uuid,uuid[],uuid,date) TO authenticated;
CREATE OR REPLACE FUNCTION private.complete_item_measurement(task_id uuid, replies jsonb, reply_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.measurement_tasks; row jsonb; expected integer;
BEGIN
 SELECT * INTO t FROM public.measurement_tasks WHERE id=task_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff') OR (public.has_role(auth.uid(),'measurement_staff') AND t.assigned_to=auth.uid())) THEN RAISE EXCEPTION 'Task access denied' USING ERRCODE='42501'; END IF;
 IF t.status='completed' THEN RETURN; END IF;
 expected := cardinality(t.item_ids);
 IF expected=0 THEN RAISE EXCEPTION 'Use quotation Submit for pricing for a general measurement task'; END IF;
 IF replies IS NULL OR jsonb_typeof(replies)<>'array' OR jsonb_array_length(replies)<>expected OR (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(replies) x)<>expected THEN RAISE EXCEPTION 'Reply required for every assigned item'; END IF;
 FOR row IN SELECT * FROM jsonb_array_elements(replies) LOOP
  IF NOT ((row->>'id')::uuid=ANY(t.item_ids)) OR nullif(trim(row->>'measurement'),'') IS NULL THEN RAISE EXCEPTION 'Enter measurements for every assigned item'; END IF;
  UPDATE public.quotation_items SET measurement=row->>'measurement',measurement_image_url=coalesce(nullif(row->>'photo',''),measurement_image_url)
  WHERE id=(row->>'id')::uuid AND quotation_id=t.draft_quotation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assigned item no longer exists'; END IF;
 END LOOP;
 UPDATE public.measurement_tasks SET status='completed',completed_at=now(),completion_note=reply_note WHERE id=t.id;
 UPDATE public.quotations SET submitted_for_pricing_at=now() WHERE id=t.draft_quotation_id;
 INSERT INTO public.pipeline_notifications(quotation_id,stage,target_role,title,body) VALUES(t.draft_quotation_id,3,'staff','Measurement completed',t.customer_name || ' — ' || coalesce(reply_note,''));
END $$;
CREATE OR REPLACE FUNCTION public.complete_item_measurement(task_id uuid,replies jsonb,reply_note text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.complete_item_measurement(task_id,replies,reply_note); $$;
REVOKE ALL ON FUNCTION private.complete_item_measurement(uuid,jsonb,text), public.complete_item_measurement(uuid,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.complete_item_measurement(uuid,jsonb,text), public.complete_item_measurement(uuid,jsonb,text) TO authenticated;
NOTIFY pgrst,'reload schema';
