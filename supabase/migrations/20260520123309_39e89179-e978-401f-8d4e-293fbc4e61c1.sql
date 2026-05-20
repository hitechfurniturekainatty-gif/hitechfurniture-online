
-- delivery_routes: remove public read, allow authenticated app users
DROP POLICY IF EXISTS "Public read delivery routes" ON public.delivery_routes;
CREATE POLICY "Auth staff read delivery routes"
  ON public.delivery_routes FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
      OR has_role(auth.uid(), 'warehouse'::app_role)
      OR has_role(auth.uid(), 'delivery'::app_role)
      OR has_role(auth.uid(), 'measurement_staff'::app_role)
      OR has_role(auth.uid(), 'worker'::app_role)
    )
  );

-- route_waypoints: remove public read, allow authenticated app users
DROP POLICY IF EXISTS "Public read waypoints" ON public.route_waypoints;
CREATE POLICY "Auth staff read waypoints"
  ON public.route_waypoints FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'staff'::app_role)
    OR has_role(auth.uid(), 'warehouse'::app_role)
    OR has_role(auth.uid(), 'delivery'::app_role)
    OR has_role(auth.uid(), 'measurement_staff'::app_role)
    OR has_role(auth.uid(), 'worker'::app_role)
  );

-- product_locations: remove public read, allow authenticated app users
DROP POLICY IF EXISTS "Public read product locations" ON public.product_locations;
CREATE POLICY "Auth staff read product locations"
  ON public.product_locations FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'staff'::app_role)
    OR has_role(auth.uid(), 'warehouse'::app_role)
    OR has_role(auth.uid(), 'delivery'::app_role)
    OR has_role(auth.uid(), 'measurement_staff'::app_role)
    OR has_role(auth.uid(), 'worker'::app_role)
  );
