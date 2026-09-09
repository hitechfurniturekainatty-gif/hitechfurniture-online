CREATE TABLE IF NOT EXISTS private.stage_proof_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), enabled boolean NOT NULL DEFAULT false
);
INSERT INTO private.stage_proof_settings(id,enabled) VALUES(true,false) ON CONFLICT DO NOTHING;
REVOKE ALL ON private.stage_proof_settings FROM PUBLIC,anon,authenticated;
CREATE TABLE public.stage_photo_proofs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source_table text NOT NULL, source_id uuid NOT NULL, quotation_id uuid,
 previous_stage jsonb NOT NULL, next_stage jsonb NOT NULL,
 photo_url text NOT NULL, object_path text NOT NULL,
 recorded_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 transaction_id bigint NOT NULL DEFAULT txid_current()
);
ALTER TABLE public.stage_photo_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stage_photo_proofs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.stage_photo_proofs TO authenticated;
CREATE POLICY stage_photo_read ON public.stage_photo_proofs FOR SELECT TO authenticated
 USING (recorded_by=auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE INDEX stage_photo_quote_idx ON public.stage_photo_proofs(quotation_id,created_at DESC);
CREATE INDEX stage_photo_object_idx ON public.stage_photo_proofs(object_path);
CREATE OR REPLACE FUNCTION private.require_stage_photo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE before_state jsonb; after_state jsonb; k text; before_values jsonb='{}'; after_values jsonb='{}'; proof text; quote_id uuid;
BEGIN
 IF NOT (SELECT enabled FROM private.stage_proof_settings WHERE id=true) THEN RETURN NEW; END IF;
 before_state=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
 after_state=to_jsonb(NEW);
 FOREACH k IN ARRAY TG_ARGV LOOP
  IF (before_state->k) IS DISTINCT FROM (after_state->k) THEN
   before_values=before_values || jsonb_build_object(k,before_state->k);
   after_values=after_values || jsonb_build_object(k,after_state->k);
  END IF;
 END LOOP;
 IF after_values='{}'::jsonb THEN RETURN NEW; END IF;
 proof=coalesce(current_setting('request.headers',true)::jsonb->>'x-client-info','');
 IF proof NOT LIKE 'hitech-stage-proof:stage-proofs/%' THEN
  RAISE EXCEPTION 'STAGE_PHOTO_REQUIRED' USING ERRCODE='PT409';
 END IF;
 proof=substr(proof,length('hitech-stage-proof:')+1);
 IF auth.uid() IS NULL OR NOT EXISTS (
  SELECT 1 FROM storage.objects o WHERE o.bucket_id='quotations' AND o.name=proof
   AND o.owner_id=auth.uid()::text AND o.created_at>now()-interval '15 minutes'
   AND o.metadata->>'mimetype' LIKE 'image/%'
 ) OR EXISTS (SELECT 1 FROM public.stage_photo_proofs p WHERE p.object_path=proof AND p.transaction_id<>txid_current()) THEN
  RAISE EXCEPTION 'Upload a new photo for this stage' USING ERRCODE='PT409';
 END IF;
 quote_id=CASE WHEN TG_TABLE_NAME='quotations' THEN (after_state->>'id')::uuid ELSE coalesce(after_state->>'quotation_id',after_state->>'draft_quotation_id')::uuid END;
 INSERT INTO public.stage_photo_proofs(source_table,source_id,quotation_id,previous_stage,next_stage,photo_url,object_path,recorded_by)
 VALUES(TG_TABLE_NAME,(after_state->>'id')::uuid,quote_id,before_values,after_values,
 'https://ejxautrxbcemrncpzjyg.supabase.co/storage/v1/object/public/quotations/'||proof,proof,auth.uid());
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.require_stage_photo() FROM PUBLIC,anon,authenticated;
-- AFTER triggers inspect the actual final stage, including automatic transitions.
CREATE TRIGGER zzz_stage_photo AFTER UPDATE ON public.quotations FOR EACH ROW EXECUTE FUNCTION private.require_stage_photo('pipeline_stage','status','commercial_status','submitted_for_pricing_at','confirmed_at','dispatched_at');
CREATE TRIGGER zzz_stage_photo AFTER UPDATE ON public.quotation_items FOR EACH ROW EXECUTE FUNCTION private.require_stage_photo('dispatched_at','delivered_at');
CREATE TRIGGER zzz_stage_photo AFTER INSERT OR UPDATE ON public.job_work_orders FOR EACH ROW EXECUTE FUNCTION private.require_stage_photo('status','warehouse_status');
CREATE TRIGGER zzz_stage_photo AFTER UPDATE ON public.measurement_tasks FOR EACH ROW EXECUTE FUNCTION private.require_stage_photo('status','completed_at');
CREATE TRIGGER zzz_stage_photo AFTER UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION private.require_stage_photo('status');
CREATE TRIGGER zzz_stage_photo AFTER UPDATE ON public.trip_quotations FOR EACH ROW EXECUTE FUNCTION private.require_stage_photo('delivered_at');
CREATE TRIGGER zzz_stage_photo AFTER UPDATE ON public.receivables FOR EACH ROW EXECUTE FUNCTION private.require_stage_photo('closed_at');
NOTIFY pgrst,'reload schema';
