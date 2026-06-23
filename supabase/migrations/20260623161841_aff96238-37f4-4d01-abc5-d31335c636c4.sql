ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS enquiry_contacted_at timestamptz;