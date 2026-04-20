/**
 * Shared constants & helpers for the logistics / route system.
 *
 * Hub is the fixed origin for every delivery — Hitech Furniture & Interiors,
 * Kainatty, Kalpetta. Coordinates are an admin-tunable starting point.
 */
export const HUB = {
  name: "Hitech Furniture & Interiors",
  place: "Kainatty, Kalpetta",
  lat: 11.6094,
  lng: 76.0836,
} as const;

/** Default route colour palette so admins don't have to pick one for every new route. */
export const ROUTE_COLOR_PALETTE = [
  "#0A6E3D", // forest green
  "#D97706", // marigold
  "#1E40AF", // royal blue
  "#B91C1C", // brick red
  "#7C3AED", // violet
  "#0E7490", // teal
  "#A16207", // mustard
  "#15803D", // emerald
] as const;

export type LatLng = { lat: number; lng: number };

/**
 * Build a single OSRM request URL covering Hub → waypoints (in order) → destination.
 * Public OSRM demo server — fine for low traffic. Self-host later if traffic grows.
 */
export const buildOsrmUrl = (stops: LatLng[]) => {
  const coords = stops.map((s) => `${s.lng},${s.lat}`).join(";");
  return `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
};

/** Fetch a road-following polyline from OSRM. Returns [lat,lng] pairs. */
export const fetchRouteGeometry = async (stops: LatLng[]): Promise<[number, number][] | null> => {
  if (stops.length < 2) return null;
  try {
    const res = await fetch(buildOsrmUrl(stops));
    if (!res.ok) return null;
    const data = await res.json();
    const coords: [number, number][] | undefined = data?.routes?.[0]?.geometry?.coordinates;
    if (!coords) return null;
    // OSRM returns [lng,lat] — Leaflet wants [lat,lng]
    return coords.map(([lng, lat]) => [lat, lng]);
  } catch {
    return null;
  }
};

/** Approx straight-line distance in km (good enough for sort/heuristics). */
export const haversineKm = (a: LatLng, b: LatLng) => {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** Normalise a place string for fuzzy matching. */
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export type RouteWithWaypoints = {
  id: string;
  name: string;
  destination_name: string;
  destination_lat: number;
  destination_lng: number;
  color: string;
  is_active: boolean;
  waypoints: { id: string; name: string; lat: number; lng: number; display_order: number }[];
};

export type RouteSuggestion = {
  route: RouteWithWaypoints;
  /** the stop name that matched (destination or waypoint) */
  matchedName: string;
  /** higher = better match */
  score: number;
};

/**
 * Suggest matching routes for a place query.
 * Match priority:
 *   1. exact equality with destination → highest
 *   2. exact equality with any waypoint
 *   3. waypoint/destination contains query (or vice versa)
 */
export const suggestRoutesForPlace = (
  query: string,
  routes: RouteWithWaypoints[]
): RouteSuggestion[] => {
  const q = norm(query);
  if (!q) return [];
  const out: RouteSuggestion[] = [];
  for (const r of routes) {
    if (!r.is_active) continue;
    const candidates = [
      { name: r.destination_name, weight: 1 },
      ...r.waypoints.map((w) => ({ name: w.name, weight: 0.9 })),
    ];
    let best: RouteSuggestion | null = null;
    for (const c of candidates) {
      const cn = norm(c.name);
      if (!cn) continue;
      let score = 0;
      if (cn === q) score = 100 * c.weight;
      else if (cn.startsWith(q) || q.startsWith(cn)) score = 70 * c.weight;
      else if (cn.includes(q) || q.includes(cn)) score = 50 * c.weight;
      if (score > 0 && (!best || score > best.score)) {
        best = { route: r, matchedName: c.name, score };
      }
    }
    if (best) out.push(best);
  }
  return out.sort((a, b) => b.score - a.score);
};

export const tripStatusLabel = (s: string) => {
  const m: Record<string, string> = {
    planned: "Planned",
    in_transit: "In transit",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };
  return m[s] ?? s;
};

export const tripStatusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (s) {
    case "delivered":
      return "default";
    case "in_transit":
      return "secondary";
    case "cancelled":
      return "destructive";
    default:
      return "outline";
  }
};