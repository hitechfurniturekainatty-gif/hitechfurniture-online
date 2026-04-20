import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { HUB } from "@/lib/logistics";

// Leaflet's default marker icons reference image files via Webpack-style
// require() that Vite doesn't resolve. Re-point them to CDN copies so pins
// render without us bundling the assets ourselves.
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

/** Tiny helper to colour-tint markers via a circular div icon. */
export const coloredIcon = (color: string, label?: string) =>
  L.divIcon({
    className: "lov-leaflet-color-marker",
    html: `<div style="background:${color};width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:700;">${label ?? ""}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });

export const hubIcon = L.divIcon({
  className: "lov-leaflet-hub-marker",
  html: `<div style="background:hsl(187 65% 24%);width:32px;height:32px;border-radius:50%;border:3px solid white;box-shadow:0 3px 8px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;color:white;font-size:14px;">★</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

type LeafletMapProps = {
  height?: string | number;
  center?: [number, number];
  zoom?: number;
  showHub?: boolean;
  /** Click handler with [lat,lng] — used by Route Manager to drop pins. */
  onMapClick?: (latlng: [number, number]) => void;
  children?: React.ReactNode;
  /** Programmatically fit to these points whenever they change. */
  fitBounds?: [number, number][];
  className?: string;
};

const FitBounds = ({ points }: { points: [number, number][] }) => {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 12));
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => L.latLng(p[0], p[1])));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [points, map]);
  return null;
};

const ClickHandler = ({ onClick }: { onClick: (latlng: [number, number]) => void }) => {
  const map = useMap();
  useEffect(() => {
    const handler = (e: L.LeafletMouseEvent) => onClick([e.latlng.lat, e.latlng.lng]);
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [map, onClick]);
  return null;
};

export const LeafletMap = ({
  height = 400,
  center = [HUB.lat, HUB.lng],
  zoom = 11,
  showHub = true,
  onMapClick,
  children,
  fitBounds,
  className,
}: LeafletMapProps) => {
  return (
    <div className={className} style={{ height, width: "100%", borderRadius: "0.75rem", overflow: "hidden", border: "1px solid hsl(var(--border))" }}>
      <MapContainer center={center} zoom={zoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {showHub && (
          <Marker position={[HUB.lat, HUB.lng]} icon={hubIcon}>
            <Popup>
              <strong>{HUB.name}</strong>
              <br />
              {HUB.place}
              <br />
              <em>Hub (Source)</em>
            </Popup>
          </Marker>
        )}
        {onMapClick && <ClickHandler onClick={onMapClick} />}
        {fitBounds && fitBounds.length > 0 && <FitBounds points={fitBounds} />}
        {children}
      </MapContainer>
    </div>
  );
};

export { Marker, Popup, Polyline };