
CREATE TABLE public.admin_vault_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  heading TEXT NOT NULL,
  link TEXT,
  username TEXT,
  password TEXT,
  extras JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_vault_entries TO authenticated;
GRANT ALL ON public.admin_vault_entries TO service_role;

ALTER TABLE public.admin_vault_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage vault entries"
  ON public.admin_vault_entries
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_admin_vault_entries_updated_at
  BEFORE UPDATE ON public.admin_vault_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
