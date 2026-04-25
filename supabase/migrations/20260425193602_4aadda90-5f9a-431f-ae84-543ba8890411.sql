
CREATE TABLE public.quotation_attached_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id UUID NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'image',
  caption TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_qan_quotation ON public.quotation_attached_notes(quotation_id);

ALTER TABLE public.quotation_attached_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qan_select_staff"
  ON public.quotation_attached_notes
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "qan_insert_staff"
  ON public.quotation_attached_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "qan_update_staff"
  ON public.quotation_attached_notes
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "qan_delete_staff"
  ON public.quotation_attached_notes
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE TRIGGER trg_qan_updated_at
  BEFORE UPDATE ON public.quotation_attached_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
