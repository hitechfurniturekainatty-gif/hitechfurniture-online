
-- Master vehicles list
CREATE TABLE IF NOT EXISTS public.delivery_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_number text NOT NULL,
  label text,
  driver_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dv_admin_all ON public.delivery_vehicles;
CREATE POLICY dv_admin_all ON public.delivery_vehicles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS dv_staff_read ON public.delivery_vehicles;
CREATE POLICY dv_staff_read ON public.delivery_vehicles
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'staff'::app_role)
    OR public.has_role(auth.uid(), 'warehouse'::app_role)
    OR public.has_role(auth.uid(), 'delivery'::app_role)
  );

DROP TRIGGER IF EXISTS trg_dv_updated_at ON public.delivery_vehicles;
CREATE TRIGGER trg_dv_updated_at
  BEFORE UPDATE ON public.delivery_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the two company vehicles (idempotent)
INSERT INTO public.delivery_vehicles (vehicle_number, label, display_order)
SELECT 'KL12G8207', 'Vehicle 1', 1
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_vehicles WHERE vehicle_number = 'KL12G8207');
INSERT INTO public.delivery_vehicles (vehicle_number, label, display_order)
SELECT 'KL73B0032', 'Vehicle 2', 2
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_vehicles WHERE vehicle_number = 'KL73B0032');

-- Quotation dispatch link
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS dispatch_vehicle_id uuid REFERENCES public.delivery_vehicles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dispatch_driver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz;

-- Tighten delivery role visibility so each driver only sees rows
-- assigned to them. Outside-vehicle dispatches (no driver_id) stay visible
-- to every delivery user so any driver can claim them.
DROP POLICY IF EXISTS quotations_select_delivery_stage ON public.quotations;
CREATE POLICY quotations_select_delivery_stage ON public.quotations
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'delivery'::app_role)
    AND deleted_at IS NULL
    AND pipeline_stage = 6
    AND (dispatch_driver_id IS NULL OR dispatch_driver_id = auth.uid())
  );

DROP POLICY IF EXISTS items_select_delivery_stage ON public.quotation_items;
CREATE POLICY items_select_delivery_stage ON public.quotation_items
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'delivery'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.quotations q
      WHERE q.id = quotation_items.quotation_id
        AND q.deleted_at IS NULL
        AND q.pipeline_stage = 6
        AND (q.dispatch_driver_id IS NULL OR q.dispatch_driver_id = auth.uid())
    )
  );
