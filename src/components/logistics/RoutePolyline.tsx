import { useEffect, useState } from "react";
import { Polyline } from "react-leaflet";
import { fetchRouteGeometry, type LatLng } from "@/lib/logistics";

/**
 * Renders a road-following polyline through the given stops by querying OSRM.
 * Falls back to a straight dashed line if OSRM is unreachable so the map
 * never goes empty.
 */
export const RoutePolyline = ({
  stops,
  color,
  weight = 5,
}: {
  stops: LatLng[];
  color: string;
  weight?: number;
}) => {
  const [geom, setGeom] = useState<[number, number][] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setGeom(null);
    setFailed(false);
    fetchRouteGeometry(stops).then((g) => {
      if (cancelled) return;
      if (g) setGeom(g);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [JSON.stringify(stops)]);

  if (geom) {
    return <Polyline positions={geom} pathOptions={{ color, weight }} />;
  }
  if (failed) {
    // Straight dashed fallback so users still see route intent
    return (
      <Polyline
        positions={stops.map((s) => [s.lat, s.lng]) as [number, number][]}
        pathOptions={{ color, weight: 3, dashArray: "8 8", opacity: 0.7 }}
      />
    );
  }
  return null;
};