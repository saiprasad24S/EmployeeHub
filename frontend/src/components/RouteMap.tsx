import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet'
import { divIcon } from 'leaflet'
import type { LatLngExpression } from 'leaflet'

type RouteMapProps = {
  points: Array<{ latitude: number; longitude: number; timestamp?: string }>
  lastKnownLocation?: { latitude: number; longitude: number; timestamp?: string; accuracy?: number } | null
}

const createMarkerIcon = (label: string, color: string) => divIcon({
  html: `<div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:999px;background:${color};color:white;border:2px solid white;box-shadow:0 4px 12px rgba(0,0,0,.25);font-size:0.72rem;font-weight:700;">${label}</div>`,
  className: '',
  iconSize: [30, 30],
})

export function RouteMap({ points, lastKnownLocation }: RouteMapProps) {
  const fallbackCenter: LatLngExpression = [12.9716, 77.5946]
  const currentPoint = points.length > 0 ? points[Math.max(0, Math.floor((points.length - 1) / 2))] : lastKnownLocation
  const startPoint = points[0] ?? lastKnownLocation
  const endPoint = points[points.length - 1] ?? lastKnownLocation
  const center: LatLngExpression = currentPoint ? [currentPoint.latitude, currentPoint.longitude] : fallbackCenter

  return (
    <div className="map-card">
      <MapContainer key={`${center[0]}-${center[1]}`} center={center} zoom={13} scrollWheelZoom className="map-view">
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.length > 1 ? (
          <Polyline positions={points.map((point) => [point.latitude, point.longitude])} pathOptions={{ color: '#6B2FA0', weight: 4 }} />
        ) : null}
        {startPoint ? (
          <Marker position={[startPoint.latitude, startPoint.longitude]} icon={createMarkerIcon('S', '#10B981')}>
            <Popup>Start route</Popup>
          </Marker>
        ) : null}
        {currentPoint ? (
          <Marker position={[currentPoint.latitude, currentPoint.longitude]} icon={createMarkerIcon('O', '#F59E0B')}>
            <Popup>Current route location</Popup>
          </Marker>
        ) : null}
        {endPoint ? (
          <Marker position={[endPoint.latitude, endPoint.longitude]} icon={createMarkerIcon('E', '#6B2FA0')}>
            <Popup>End route</Popup>
          </Marker>
        ) : null}
        {!points.length && lastKnownLocation ? (
          <Marker position={[lastKnownLocation.latitude, lastKnownLocation.longitude]} icon={createMarkerIcon('L', '#EF4444')}>
            <Popup>Last tracked location</Popup>
          </Marker>
        ) : null}
      </MapContainer>
    </div>
  )
}
