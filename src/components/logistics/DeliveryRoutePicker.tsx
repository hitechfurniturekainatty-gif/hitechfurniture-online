import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MapPin, Route as RouteIcon } from "lucide-react";
import {
  type RouteWithWaypoints,
  suggestRoutesForPlace,
} from "@/lib/logistics";

type Props = {
  /** Free-text place (city / village). Falls back when no route matches. */
  place: string;
  routeId: string | null;
  onChange: (next: { place: string; routeId: string | null }) => void;
  label?: string;
};

/**
 * Combined input: staff types a place, we suggest matching routes from
 * Route Manager. If nothing matches, they can pick the route manually
 * from a dropdown so every quotation is still tagged.
 */
export const DeliveryRoutePicker = ({ place, routeId, onChange, label = "Delivery Route / Place" }: Props) => {
  const [routes, setRoutes] = useState<RouteWithWaypoints[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: r }, { data: w }] = await Promise.all([
        supabase.from("delivery_routes").select("*").eq("is_active", true).order("name"),
        supabase.from("route_waypoints").select("*").order("display_order"),
      ]);
      if (cancelled) return;
      const merged: RouteWithWaypoints[] = (r ?? []).map((row: any) => ({
        id: row.id,
        name: row.name,
        destination_name: row.destination_name,
        destination_lat: Number(row.destination_lat),
        destination_lng: Number(row.destination_lng),
        color: row.color,
        is_active: row.is_active,
        waypoints: ((w ?? []) as any[])
          .filter((x) => x.route_id === row.id)
          .map((x) => ({
            id: x.id,
            name: x.name,
            lat: Number(x.lat),
            lng: Number(x.lng),
            display_order: x.display_order,
          })),
      }));
      setRoutes(merged);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const suggestions = useMemo(() => suggestRoutesForPlace(place, routes).slice(0, 4), [place, routes]);
  const hasMatch = !!routeId;

  // Auto-pick the best matching route when a place is set but no route is
  // tagged yet (e.g. just after picking from Contacts). Only auto-fills when
  // the top match is strong (exact or prefix), to avoid wrong tagging.
  useEffect(() => {
    if (routeId) return;
    if (!place.trim()) return;
    if (suggestions.length === 0) return;
    const top = suggestions[0];
    if (top.score >= 60) {
      onChange({ place, routeId: top.route.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place, suggestions, routeId]);

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <MapPin className="h-3.5 w-3.5" /> {label}
      </Label>
      <Input
        value={place}
        onChange={(e) => onChange({ place: e.target.value, routeId })}
        placeholder="e.g. Meppadi, Mananthavady, Pulpally..."
      />

      {/* Auto-suggested routes — clicking tags the quotation */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[11px] text-muted-foreground">Suggested route:</span>
          {suggestions.map((s) => {
            const active = s.route.id === routeId;
            return (
              <button
                type="button"
                key={s.route.id}
                onClick={() => onChange({ place: place || s.matchedName, routeId: s.route.id })}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-muted"
                }`}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: s.route.color }}
                />
                {s.route.name}
                <span className="opacity-70">· {s.matchedName}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Manual fallback so unmatched places still get tagged */}
      <div className="flex items-center gap-2">
        <RouteIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <Select
          value={routeId ?? "__none__"}
          onValueChange={(v) => onChange({ place, routeId: v === "__none__" ? null : v })}
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder={loading ? "Loading routes..." : "Pick a route manually"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— Untagged —</SelectItem>
            {routes.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name} ({r.destination_name})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasMatch && (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            Tagged
          </Badge>
        )}
      </div>
      {!hasMatch && place.trim() && (
        <p className="text-[11px] text-accent-foreground/80">
          No route matched "{place}". Pick one above so dispatch can plan the trip.
        </p>
      )}
    </div>
  );
};