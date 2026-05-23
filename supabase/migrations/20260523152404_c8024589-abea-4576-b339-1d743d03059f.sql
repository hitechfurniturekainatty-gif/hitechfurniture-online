ALTER TABLE public.scheme_vendor_months
  ADD COLUMN IF NOT EXISTS invoices jsonb NOT NULL DEFAULT '[]'::jsonb;