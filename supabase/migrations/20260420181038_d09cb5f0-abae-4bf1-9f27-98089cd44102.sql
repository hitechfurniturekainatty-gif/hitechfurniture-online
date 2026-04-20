
-- Ensure full row data is sent on UPDATE/DELETE so the client can apply changes
ALTER TABLE public.quotations REPLICA IDENTITY FULL;
ALTER TABLE public.quotation_items REPLICA IDENTITY FULL;

-- Add tables to the realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'quotations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quotations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'quotation_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quotation_items;
  END IF;
END $$;
