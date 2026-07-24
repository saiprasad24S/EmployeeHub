import { MapContainer, Marker, Polyline, TileLayer, Popup } from 'react-leaflet'
import { divIcon } from 'leaflet'
import type { LatLngExpression } from 'leaflet'

type RouteMapProps = {
  points: Array<{ latitude: number; longitude: number; timestamp?: string }>
}

const startIcon = divIcon({
  html: `<div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:#10B981;color:white;font-weight:bold;font-size:12px;border:3px solid white;box-shadow:0 4px 10px rgba(0,0,0,0.3);">Start</div>`,
  className: 'route-start-pin',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
})

const endIcon = divIcon({
  html: `<div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:#EF4444;color:white;font-weight:bold;font-size:12px;border:3px solid white;box-shadow:0 4px 10px rgba(0,0,0,0.3);">End</div>`,
  className: 'route-end-pin',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
})

export function RouteMap({ points }: RouteMapProps) {
  const center: LatLngExpression = points.length > 0 ? [points[0].latitude, points[0].longitude] : [12.9716, 77.5946]

  const startPoint = points.length > 0 ? points[0] : null
  const endPoint = points.length > 0 ? points[points.length - 1] : null

  return (
    <div className="map-card" style={{ height: '100%', minHeight: '350px', borderRadius: '14px', overflow: 'hidden' }}>
      <MapContainer key={`route-${center[0]}-${center[1]}-${points.length}`} center={center} zoom={13} scrollWheelZoom className="map-view" style={{ height: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.length > 0 ? (
          <>
            <Polyline positions={points.map((point) => [point.latitude, point.longitude])} pathOptions={{ color: '#6B2FA0', weight: 4 }} />
            {startPoint && (
              <Marker position={[startPoint.latitude, startPoint.longitude]} icon={startIcon}>
                <Popup>
                  <div style={{ padding: '0.2rem' }}>
                    <strong style={{ color: '#10B981', fontSize: '0.9rem' }}>🏁 Start Location</strong>
                    <br />
                    <span style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                      {startPoint.latitude.toFixed(5)}, {startPoint.longitude.toFixed(5)}
                    </span>
                  </div>
                </Popup>
              </Marker>
            )}
            {endPoint && (
              <Marker position={[endPoint.latitude, endPoint.longitude]} icon={endIcon}>
                <Popup>
                  <div style={{ padding: '0.2rem' }}>
                    <strong style={{ color: '#EF4444', fontSize: '0.9rem' }}>📍 End / Last Location</strong>
                    <br />
                    <span style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                      {endPoint.latitude.toFixed(5)}, {endPoint.longitude.toFixed(5)}
                    </span>
                  </div>
                </Popup>
              </Marker>
            )}
          </>
        ) : null}
      </MapContainer>
    </div>
  )
}
