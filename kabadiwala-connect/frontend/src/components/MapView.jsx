import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Bundlers break Leaflet's default icon paths; set them explicitly.
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

// OpenStreetMap tiles. Attribution is required by the OSM tile usage policy.
export default function MapView({ markers = [], center = [13.0827, 80.2707], zoom = 12, height = 320 }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-100" style={{ height }}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {markers
          .filter((m) => m.lat != null && m.lng != null)
          .map((m, i) => (
            <Marker key={i} position={[m.lat, m.lng]}>
              <Popup>{m.label}</Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
}
