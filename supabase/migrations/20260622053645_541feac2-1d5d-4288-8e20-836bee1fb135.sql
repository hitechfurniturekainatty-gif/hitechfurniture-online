
ALTER TABLE public.quotations
  DROP CONSTRAINT IF EXISTS quotations_pipeline_stage_check;
ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_pipeline_stage_check
  CHECK (pipeline_stage BETWEEN 1 AND 7);

ALTER TABLE public.pipeline_notifications
  DROP CONSTRAINT IF EXISTS pipeline_notifications_stage_check;
ALTER TABLE public.pipeline_notifications
  ADD CONSTRAINT pipeline_notifications_stage_check
  CHECK (stage BETWEEN 1 AND 7);
