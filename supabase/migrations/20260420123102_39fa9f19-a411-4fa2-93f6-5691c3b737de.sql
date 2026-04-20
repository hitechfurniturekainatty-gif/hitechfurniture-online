-- delivery_routes
CREATE TABLE public.delivery_routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  destination_name TEXT NOT NULL,
  destination_lat NUMERIC(10,7) NOT NULL,
  destination_lng NUMERIC(10,7) NOT NULL,
  color TEXT NOT NULL DEFAULT '#0A6E3D',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read delivery routes" ON public.delivery_routes
  FOR SELECT TO public USING (true);
CREATE POLICY "Admins insert delivery routes" ON public.delivery_routes
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update delivery routes" ON public.delivery_routes
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete delivery routes" ON public.delivery_routes
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_delivery_routes_updated
  BEFORE UPDATE ON public.delivery_routes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- route_waypoints
CREATE TABLE public.route_waypoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES public.delivery_routes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  lat NUMERIC(10,7) NOT NULL,
  lng NUMERIC(10,7) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.route_waypoints ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_route_waypoints_route ON public.route_waypoints(route_id, display_order);

CREATE POLICY "Public read waypoints" ON public.route_waypoints
  FOR SELECT TO public USING (true);
CREATE POLICY "Admins insert waypoints" ON public.route_waypoints
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update waypoints" ON public.route_waypoints
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete waypoints" ON public.route_waypoints
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- trips
CREATE TABLE public.trips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID REFERENCES public.delivery_routes(id) ON DELETE SET NULL,
  trip_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'planned',
  assigned_driver_id UUID,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_trips_driver ON public.trips(assigned_driver_id);
CREATE INDEX idx_trips_status ON public.trips(status);

CREATE POLICY "Trips select by office admin or assigned driver" ON public.trips
  FOR SELECT TO authenticated USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'staff'::app_role)
    OR (has_role(auth.uid(), 'delivery'::app_role) AND assigned_driver_id = auth.uid())
  );
CREATE POLICY "Trips insert by office admin" ON public.trips
  FOR INSERT TO authenticated WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)
  );
CREATE POLICY "Trips update by office admin or assigned driver" ON public.trips
  FOR UPDATE TO authenticated USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'staff'::app_role)
    OR (has_role(auth.uid(), 'delivery'::app_role) AND assigned_driver_id = auth.uid())
  );
CREATE POLICY "Trips delete by admin" ON public.trips
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_trips_updated
  BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- trip_quotations
CREATE TABLE public.trip_quotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  stop_order INTEGER NOT NULL DEFAULT 0,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trip_id, quotation_id)
);
ALTER TABLE public.trip_quotations ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_trip_quotations_trip ON public.trip_quotations(trip_id, stop_order);

CREATE POLICY "Trip quotations select" ON public.trip_quotations
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_quotations.trip_id AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
      OR (has_role(auth.uid(), 'delivery'::app_role) AND t.assigned_driver_id = auth.uid())
    ))
  );
CREATE POLICY "Trip quotations insert by office admin" ON public.trip_quotations
  FOR INSERT TO authenticated WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)
  );
CREATE POLICY "Trip quotations update by office admin or driver" ON public.trip_quotations
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_quotations.trip_id AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
      OR (has_role(auth.uid(), 'delivery'::app_role) AND t.assigned_driver_id = auth.uid())
    ))
  );
CREATE POLICY "Trip quotations delete by office admin" ON public.trip_quotations
  FOR DELETE TO authenticated USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)
  );

-- Add delivery columns to quotations
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS delivery_route_id UUID REFERENCES public.delivery_routes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_place TEXT;

-- Seed: Mananthavady Route
DO $$
DECLARE _route_id UUID;
BEGIN
  INSERT INTO public.delivery_routes (name, destination_name, destination_lat, destination_lng, color)
  VALUES ('Mananthavady Route', 'Mananthavady', 11.8014000, 76.0050000, '#0A6E3D')
  RETURNING id INTO _route_id;

  INSERT INTO public.route_waypoints (route_id, name, lat, lng, display_order) VALUES
    (_route_id, 'Kainatty (Hub)', 11.6094000, 76.0836000, 0),
    (_route_id, 'Kambalakkad', 11.6533000, 76.0789000, 1),
    (_route_id, 'Panamaram', 11.7383000, 76.0664000, 2),
    (_route_id, 'Mananthavady', 11.8014000, 76.0050000, 3);
END $$;