
CREATE TABLE public.scheme_vendor_months (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.scheme_parties(id) ON DELETE CASCADE,
  fy_year integer NOT NULL,           -- e.g. 2026 means FY Apr-2026 → Mar-2027
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  scheme_kind text NOT NULL DEFAULT 'company',
  scheme_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  purchases_text text,
  purchase_rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (party_id, fy_year, month)
);

CREATE INDEX scheme_vendor_months_party_idx ON public.scheme_vendor_months (party_id, fy_year, month);

ALTER TABLE public.scheme_vendor_months ENABLE ROW LEVEL SECURITY;

CREATE POLICY svm_select ON public.scheme_vendor_months FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));
CREATE POLICY svm_insert ON public.scheme_vendor_months FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));
CREATE POLICY svm_update ON public.scheme_vendor_months FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));
CREATE POLICY svm_delete ON public.scheme_vendor_months FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER svm_updated_at BEFORE UPDATE ON public.scheme_vendor_months
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
