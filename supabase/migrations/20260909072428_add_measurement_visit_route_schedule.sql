ALTER TABLE public.measurement_tasks ADD COLUMN IF NOT EXISTS visit_date date, ADD COLUMN IF NOT EXISTS delivery_route_id uuid REFERENCES public.delivery_routes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS measurement_visit_route_idx ON public.measurement_tasks(visit_date,delivery_route_id) WHERE deleted_at IS NULL AND status <> 'completed';
NOTIFY pgrst,'reload schema';
