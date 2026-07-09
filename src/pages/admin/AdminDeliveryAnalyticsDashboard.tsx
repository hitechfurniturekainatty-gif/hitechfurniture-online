import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Route as RouteIcon, Truck, CalendarClock } from "lucide-react";
import { KpiCard } from "@/components/overview/KpiCard";
import { AnomalyBadges, type Anomaly } from "@/components/overview/AnomalyBadge";
import { StatusDonut } from "@/components/overview/charts/StatusDonut";
import { tripStatusDonutData } from "@/lib/logistics";

type WaypointRow = { id: string; route_name: string; sequence: number; area: string };

const startOfWeek = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diffToMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diffToMonday);
  return d;
};

const AdminDeliveryAnalyticsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [activeRoutes, setActiveRoutes] = useState(0);
  const [vehiclesTotal, setVehiclesTotal] = useState(0);
  const [vehiclesActive, setVehiclesActive] = useState(0);
  const [tripsThisWeek, setTripsThisWeek] = useState(0);
  const [tripStatusCounts, setTripStatusCounts] = useState<Record<string, number>>({});
  const [tripRowCount, setTripRowCount] = useState(0);
  const [waypoints, setWaypoints] = useState<WaypointRow[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);

  const load = async () => {
    setLoading(true);
    const weekStart = startOfWeek();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const todayIso = new Date().toISOString().slice(0, 10);

    const [
      { count: activeRoutesCount },
      { data: vehicleRows },
      { data: tripRows },
      { data: waypointRows },
      { data: routeRows },
    ] = await Promise.all([
      supabase.from("delivery_routes").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("is_active", true),
      supabase.from("delivery_vehicles").select("id, is_active"),
      supabase.from("trips").select("id, route_id, trip_date, status").is("deleted_at", null),
      supabase.from("route_waypoints").select("id, route_id, name, display_order").order("display_order", { ascending: true }),
      supabase.from("delivery_routes").select("id, name").is("deleted_at", null),
    ]);

    setActiveRoutes(activeRoutesCount ?? 0);
    setVehiclesTotal((vehicleRows ?? []).length);
    setVehiclesActive((vehicleRows ?? []).filter((v: any) => v.is_active).length);

    const trips = (tripRows ?? []) as { id: string; route_id: string | null; trip_date: string; status: string }[];
    setTripRowCount(trips.length);
    setTripsThisWeek(
      trips.filter((t) => {
        const d = new Date(t.trip_date);
        return d >= weekStart && d < weekEnd;
      }).length,
    );

    const statusCounts: Record<string, number> = {};
    trips.forEach((t) => { statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1; });
    setTripStatusCounts(statusCounts);
    const donutSum = Object.values(statusCounts).reduce((a, b) => a + b, 0);
    if (donutSum !== trips.length) {
      console.warn(`AdminDeliveryAnalyticsDashboard: trip-status donut sum (${donutSum}) != trip count (${trips.length})`);
    }

    // ---- Route waypoints schedule (route, sequence, area) ----
    const routeNameById = new Map((routeRows ?? []).map((r: any) => [r.id, r.name as string]));
    setWaypoints(
      ((waypointRows ?? []) as any[]).map((w) => ({
        id: w.id,
        route_name: routeNameById.get(w.route_id) ?? "—",
        sequence: w.display_order,
        area: w.name,
      })),
    );

    // ---- Anomaly: overdue trip vs scheduled date — only once trips has
    // data, same "not delivered/cancelled and date has passed" rule used
    // on the Delivery driver's own My Trips view. ----
    const nextAnomalies: Anomaly[] = [];
    if (trips.length > 0) {
      const overdue = trips.filter((t) => t.trip_date < todayIso && t.status !== "delivered" && t.status !== "cancelled").length;
      if (overdue > 0) {
        nextAnomalies.push({
          key: "overdue-trips",
          severity: "critical",
          message: `${overdue} trip${overdue === 1 ? "" : "s"} overdue vs. scheduled date`,
          to: "/admin/trips",
        });
      }
    }
    setAnomalies(nextAnomalies);

    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-xl sm:text-2xl">Delivery Analytics</h2>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">Routes, fleet and trip schedule — live from Supabase.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="mr-2 h-4 w-4" /> Refresh</>}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <>
          <AnomalyBadges anomalies={anomalies} />

          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KpiCard label="Active routes" value={String(activeRoutes)} icon={RouteIcon} to="/admin/routes" />
            <KpiCard label="Delivery vehicles" value={String(vehiclesTotal)} icon={Truck} sub={`${vehiclesActive} active`} to="/admin/vehicles" />
            <KpiCard label="Scheduled trips this week" value={String(tripsThisWeek)} icon={CalendarClock} to="/admin/trips" />
          </div>

          <div className="mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base sm:text-lg">Trip Status Split</CardTitle>
                <p className="text-xs text-muted-foreground">All trips currently on record</p>
              </CardHeader>
              <CardContent>
                {tripRowCount === 0 ? (
                  <div className="flex h-36 items-center justify-center text-xs text-muted-foreground">No trips logged yet</div>
                ) : (
                  <StatusDonut data={tripStatusDonutData(tripStatusCounts)} />
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Route Waypoint Schedule</CardTitle>
              <p className="text-xs text-muted-foreground">Route, stop sequence and area</p>
            </CardHeader>
            <CardContent>
              {waypoints.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No waypoints set up yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-2 py-2 text-left">Route</th>
                        <th className="px-2 py-2 text-right">Sequence</th>
                        <th className="px-2 py-2 text-left">Area</th>
                      </tr>
                    </thead>
                    <tbody>
                      {waypoints.map((w) => (
                        <tr key={w.id} className="border-t border-border/60">
                          <td className="px-2 py-2 font-medium">{w.route_name}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{w.sequence}</td>
                          <td className="px-2 py-2">{w.area}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
};

export default AdminDeliveryAnalyticsDashboard;
