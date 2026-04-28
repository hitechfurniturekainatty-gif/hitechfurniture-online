ALTER TABLE public.main_categories REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.main_categories;