
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS enquiry_type text
    CHECK (enquiry_type IN ('new_purchase','custom_design','delivery_installation','general_inquiry'));
CREATE INDEX IF NOT EXISTS idx_quotations_enquiry_type ON public.quotations(enquiry_type);
