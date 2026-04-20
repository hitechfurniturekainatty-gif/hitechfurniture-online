-- New quotations should default to 0% GST, not 18%.
ALTER TABLE public.quotations
  ALTER COLUMN gst_percent SET DEFAULT 0;