ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS salesperson_name text;

CREATE INDEX IF NOT EXISTS idx_quotations_salesperson_name
  ON public.quotations (salesperson_name);