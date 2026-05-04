ALTER TABLE public.homepage_settings
  ADD COLUMN IF NOT EXISTS hero_arch_image_url text,
  ADD COLUMN IF NOT EXISTS hero_glass_door_image_url text,
  ADD COLUMN IF NOT EXISTS hero_interior_image_url text;