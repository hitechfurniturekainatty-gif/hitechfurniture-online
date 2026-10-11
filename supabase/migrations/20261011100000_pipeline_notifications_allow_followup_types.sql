-- quotation_followup_due / receivable_followup_due were emitted by existing cron jobs
-- but never allowed here, so those reminders could never be saved.
-- sales_lead_reminder / customer_approval are new (20261011090000_pipeline_audit_fixes).
ALTER TABLE public.pipeline_notifications DROP CONSTRAINT pipeline_notifications_source_type_check;
ALTER TABLE public.pipeline_notifications ADD CONSTRAINT pipeline_notifications_source_type_check
  CHECK (source_type = ANY (ARRAY['quotation','lead','complaint','service','job','delivery','lead_reminder',
    'job_stuck','payment_reminder','quotation_expiry','delivery_review','whatsapp_lead','lead_chat','delivery_prep',
    'quotation_followup_due','receivable_followup_due','sales_lead_reminder','customer_approval']::text[]));
