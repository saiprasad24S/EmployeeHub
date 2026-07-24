import { MapContainer, Marker, Polyline, TileLayer } from 'react-leaflet'
import type { LatLngExpression } from 'leaflet'

type RouteMapProps = {
  points: Array<{ latitude: number; longitude: number }>
}

export function RouteMap({ points }: RouteMapProps) {
  const center: LatLngExpression = points.length > 0 ? [points[0].latitude, points[0].longitude] : [12.9716, 77.5946]

  return (
    <div className="map-card">
      <MapContainer center={center} zoom={13} scrollWheelZoom className="map-view">
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.length > 0 ? (
          <>
            <Polyline positions={points.map((point) => [point.latitude, point.longitude])} pathOptions={{ color: '#6B2FA0', weight: 4 }} />
            <Marker position={[points[0].latitude, points[0].longitude]} />
            <Marker position={[points[points.length - 1].latitude, points[points.length - 1].longitude]} />
          </>
        ) : null}
      </MapContainer>
    </div>
  )
}
