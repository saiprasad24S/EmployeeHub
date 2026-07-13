import { MapContainer, Marker, TileLayer, Popup } from 'react-leaflet'
import type { LatLngExpression } from 'leaflet'

type LiveLocationsMapProps = {
  locations: Array<{ id: number; employee_id: string; name: string; latitude: number; longitude: number }>
}

export function LiveLocationsMap({ locations }: LiveLocationsMapProps) {
  const center: LatLngExpression = locations.length > 0
    ? [locations[0].latitude, locations[0].longitude]
    : [12.9716, 77.5946]

  return (
    <div className="map-card" style={{ height: '350px', borderRadius: '14px', overflow: 'hidden' }}>
      <MapContainer key={`live-${center[0]}-${center[1]}`} center={center} zoom={12} scrollWheelZoom className="map-view" style={{ height: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {locations.map((loc) => (
          <Marker key={loc.id} position={[loc.latitude, loc.longitude]}>
            <Popup>
              <div style={{ padding: '0.2rem' }}>
                <strong style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>{loc.name}</strong>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>
                  ID: {loc.employee_id}
                </p>
                <span style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                  📍 {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                </span>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
