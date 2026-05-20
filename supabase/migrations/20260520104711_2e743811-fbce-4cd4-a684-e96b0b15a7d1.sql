ALTER TABLE public.homepage_settings
ADD COLUMN IF NOT EXISTS show_public_catalog boolean NOT NULL DEFAULT true;