
CREATE TABLE IF NOT EXISTS public.vault_config (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE,
  master_password TEXT NOT NULL,
  secret_pin TEXT NOT NULL,
  recovery_phone TEXT,
  recovery_dob TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT vault_config_singleton CHECK (id = TRUE)
);

GRANT SELECT, INSERT, UPDATE ON public.vault_config TO authenticated;
GRANT ALL ON public.vault_config TO service_role;

ALTER TABLE public.vault_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage vault config"
ON public.vault_config FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.vault_config (id, master_password, secret_pin, recovery_phone, recovery_dob)
VALUES (TRUE, 'Admin@Hitech2026', '9946', '9605656290', '01-02-2025')
ON CONFLICT (id) DO NOTHING;

CREATE TRIGGER vault_config_set_updated_at
BEFORE UPDATE ON public.vault_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
