
ALTER TABLE public.receivables 
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid;

CREATE TABLE IF NOT EXISTS public.receivable_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receivable_id uuid NOT NULL REFERENCES public.receivables(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rcl_receivable ON public.receivable_call_logs(receivable_id, created_at DESC);

ALTER TABLE public.receivable_call_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rcl_admin_all" ON public.receivable_call_logs;
CREATE POLICY "rcl_admin_all" ON public.receivable_call_logs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
