BEGIN;
DO $$ DECLARE office uuid; field_staff uuid; qid uuid; item1 uuid; item2 uuid; tid uuid; BEGIN
 SELECT user_id INTO office FROM public.user_roles WHERE role='admin' LIMIT 1;
 SELECT user_id INTO field_staff FROM public.user_roles WHERE role='measurement_staff' LIMIT 1;
 IF office IS NULL OR field_staff IS NULL THEN RAISE EXCEPTION 'Test needs existing admin and measurement roles'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',office)::text,true);
 INSERT INTO public.quotations(quotation_id,party_name,party_place,status,created_by) VALUES('MEASUREMENT-ROLLBACK-TEST','Test','Test','drafted',office) RETURNING id INTO qid;
 INSERT INTO public.quotation_items(quotation_id,description,quantity,unit_price,amount) VALUES(qid,'Selected sofa',1,100,100) RETURNING id INTO item1;
 INSERT INTO public.quotation_items(quotation_id,description,quantity,unit_price,amount) VALUES(qid,'Unselected dining',1,200,200) RETURNING id INTO item2;
 tid:=public.assign_item_measurement(qid,field_staff,ARRAY[item1],null,current_date);
 IF NOT EXISTS(SELECT 1 FROM public.measurement_tasks WHERE id=tid AND draft_quotation_id=qid AND item_ids=ARRAY[item1]) THEN RAISE EXCEPTION 'Assignment not linked'; END IF;
 PERFORM set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000001"}',true);
 BEGIN
 PERFORM public.complete_item_measurement(tid,jsonb_build_array(jsonb_build_object('id',item1,'measurement','60 x 30')),'Done');
 RAISE EXCEPTION 'Unauthorized completion allowed' USING ERRCODE='P0002';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',field_staff)::text,true);
 BEGIN
 PERFORM public.complete_item_measurement(tid,jsonb_build_array(jsonb_build_object('id',item2,'measurement','60 x 30')),'Done');
 RAISE EXCEPTION 'Unassigned item accepted' USING ERRCODE='P0002';
 EXCEPTION WHEN raise_exception THEN NULL; END;
 PERFORM public.complete_item_measurement(tid,jsonb_build_array(jsonb_build_object('id',item1,'measurement','60 x 30')),'Measured; no photo required');
 IF NOT EXISTS(SELECT 1 FROM public.measurement_tasks WHERE id=tid AND status='completed' AND completed_at IS NOT NULL) THEN RAISE EXCEPTION 'Task not complete'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.quotation_items WHERE id=item1 AND measurement='60 x 30' AND unit_price=100 AND amount=100) THEN RAISE EXCEPTION 'Measurement or price changed incorrectly'; END IF;
 IF EXISTS(SELECT 1 FROM public.quotation_items WHERE id=item2 AND measurement IS NOT NULL) THEN RAISE EXCEPTION 'Unselected item changed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.pipeline_notifications WHERE quotation_id=qid AND title='Measurement completed') THEN RAISE EXCEPTION 'Office notification missing'; END IF;
END $$;

-- Exercise the same SELECT policies used by a real logged-in measurement-staff
-- browser session instead of relying only on the privileged SQL test session.
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'role','authenticated',
    'sub',(SELECT user_id FROM public.user_roles WHERE role='measurement_staff' LIMIT 1)
  )::text,
  true
);
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE _measurement_rls_check ON COMMIT DROP AS
SELECT
  (SELECT count(*) FROM public.measurement_tasks mt
    JOIN public.quotations q ON q.id=mt.draft_quotation_id
    WHERE q.quotation_id='MEASUREMENT-ROLLBACK-TEST') AS visible_tasks,
  (SELECT count(*) FROM public.quotation_items qi
    JOIN public.quotations q ON q.id=qi.quotation_id
    WHERE q.quotation_id='MEASUREMENT-ROLLBACK-TEST'
      AND qi.description='Selected sofa') AS visible_assigned_items;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT visible_tasks FROM _measurement_rls_check) <> 1 THEN
   RAISE EXCEPTION 'Assigned measurement task is not visible through authenticated RLS';
 END IF;
 IF (SELECT visible_assigned_items FROM _measurement_rls_check) <> 1 THEN
   RAISE EXCEPTION 'Assigned quotation item is not visible through authenticated RLS';
 END IF;
END $$;
ROLLBACK;
