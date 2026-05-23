-- Parties (clients) for Scheme Calculator
CREATE TABLE public.scheme_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  place text,
  address text,
  gst_number text,
  category text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.scheme_parties ENABLE ROW LEVEL SECURITY;
CREATE POLICY sp_select ON public.scheme_parties FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));
CREATE POLICY sp_insert ON public.scheme_parties FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));
CREATE POLICY sp_update ON public.scheme_parties FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));
CREATE POLICY sp_delete ON public.scheme_parties FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER sp_updated_at BEFORE UPDATE ON public.scheme_parties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX scheme_parties_name_idx ON public.scheme_parties (lower(name));

-- Saved schemes
-- kind: 'company' | 'own' | 'slab' | 'bogo' | 'percent' | 'cashback'
-- config holds rule-specific parameters as JSON
CREATE TABLE public.scheme_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL,
  period text NOT NULL DEFAULT 'monthly',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.scheme_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY sr_select ON public.scheme_rules FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));
CREATE POLICY sr_insert ON public.scheme_rules FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));
CREATE POLICY sr_update ON public.scheme_rules FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));
CREATE POLICY sr_delete ON public.scheme_rules FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER sr_updated_at BEFORE UPDATE ON public.scheme_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();