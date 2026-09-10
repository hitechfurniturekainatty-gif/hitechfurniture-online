-- Quotation attachments are stored in a private bucket. Storage SELECT policies
-- inspect quotation_items to confirm that a requested object belongs to an
-- authorized quotation. The authenticated role therefore needs the table-level
-- SELECT grant; row-level security still decides which quotation_items are
-- actually visible to each signed-in user.
GRANT SELECT ON TABLE public.quotation_items TO authenticated;
