-- Receivables table (admin-only) + Backlog PIN admin_settings + RPCs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.receivables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_no text,
  customer_name text,
  place text,
  phone text,
  pending_amount numeric NOT NULL DEFAULT 0,
  raw_text text,
  batch integer NOT NULL DEFAULT 1,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "receivables_admin_all" ON public.receivables
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER receivables_set_updated_at
  BEFORE UPDATE ON public.receivables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_receivables_created_at ON public.receivables(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_receivables_batch ON public.receivables(batch);

-- Admin-only key/value settings (used for the Backlog PIN hash)
CREATE TABLE IF NOT EXISTS public.admin_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- No direct access from clients; everything goes through SECURITY DEFINER RPCs
CREATE POLICY "admin_settings_no_direct" ON public.admin_settings
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- Set / change the Backlog PIN (admin only). Stored as bcrypt hash via pgcrypto.
CREATE OR REPLACE FUNCTION public.set_backlog_pin(_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can set the Backlog PIN';
  END IF;
  IF _pin IS NULL OR length(btrim(_pin)) < 4 THEN
    RAISE EXCEPTION 'PIN must be at least 4 characters';
  END IF;
  INSERT INTO public.admin_settings(key, value, updated_by, updated_at)
  VALUES ('backlog_pin_hash', extensions.crypt(_pin, extensions.gen_salt('bf', 10)), auth.uid(), now())
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_by = EXCLUDED.updated_by,
        updated_at = now();
END;
$$;

-- Verify a PIN. Admin only. Returns true if matches, false otherwise.
-- If no PIN is set yet, returns true ONLY for the first-time setup case (handled in UI).
CREATE OR REPLACE FUNCTION public.verify_backlog_pin(_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _hash text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN false;
  END IF;
  SELECT value INTO _hash FROM public.admin_settings WHERE key = 'backlog_pin_hash';
  IF _hash IS NULL THEN
    RETURN false; -- not configured
  END IF;
  RETURN _hash = extensions.crypt(_pin, _hash);
END;
$$;

-- Helper: is a Backlog PIN configured? (admin only)
CREATE OR REPLACE FUNCTION public.backlog_pin_is_set()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN false;
  END IF;
  RETURN EXISTS (SELECT 1 FROM public.admin_settings WHERE key = 'backlog_pin_hash');
END;
$$;

REVOKE ALL ON FUNCTION public.set_backlog_pin(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_backlog_pin(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.backlog_pin_is_set() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_backlog_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_backlog_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.backlog_pin_is_set() TO authenticated;