
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS dispatch_vehicle text,
  ADD COLUMN IF NOT EXISTS dispatch_vehicle_number text,
  ADD COLUMN IF NOT EXISTS dispatch_driver_name text,
  ADD COLUMN IF NOT EXISTS dispatch_driver_phone text;

DROP POLICY IF EXISTS quotations_update_warehouse_dispatch ON public.quotations;
CREATE POLICY quotations_update_warehouse_dispatch
ON public.quotations
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'warehouse'::app_role) AND pipeline_stage = 5)
WITH CHECK (public.has_role(auth.uid(), 'warehouse'::app_role));
