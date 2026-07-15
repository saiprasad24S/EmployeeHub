import { useMemo } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet'
import { divIcon } from 'leaflet'
import type { LatLngExpression } from 'leaflet'

type RouteMapProps = {
  points: Array<{ latitude: number; longitude: number; timestamp?: string | null }>
  lastKnownLocation?: { latitude: number; longitude: number; timestamp?: string | null; accuracy?: number | null } | null
  profilePhoto?: string | null
  name?: string
}

const createMarkerIcon = (label: string, color: string) => divIcon({
  html: `<div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:999px;background:${color};color:white;border:2px solid white;box-shadow:0 4px 12px rgba(0,0,0,.25);font-size:0.72rem;font-weight:700;">${label}</div>`,
  className: '',
  iconSize: [30, 30],
})

const createProfileIcon = (photo: string | undefined | null, name: string) => divIcon({
  html: `<div style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:999px;padding:2px;background:rgba(255,255,255,0.9);box-shadow:0 6px 16px rgba(0,0,0,.22);overflow:hidden;border:2px solid white;"><img src="${photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=6B2FA0&color=fff'}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:999px;" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6B2FA0&color=fff'"/></div>`,
  className: 'route-profile-icon',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
})

export function RouteMap({ points, lastKnownLocation, profilePhoto, name }: RouteMapProps) {
  const fallbackCenter: LatLngExpression = [12.9716, 77.5946]
  const currentPoint = useMemo(() => (points.length > 0 ? points[points.length - 1] : lastKnownLocation), [points, lastKnownLocation])
  const startPoint = useMemo(() => points[0] ?? lastKnownLocation, [points, lastKnownLocation])
  const endPoint = useMemo(() => points[points.length - 1] ?? lastKnownLocation, [points, lastKnownLocation])
  const center: LatLngExpression = useMemo(
    () => (currentPoint ? [currentPoint.latitude, currentPoint.longitude] : fallbackCenter),
    [currentPoint],
  )
  const routePositions = useMemo(
    () => points.map((point) => [point.latitude, point.longitude] as [number, number]),
    [points],
  )

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
          <Marker
            position={[currentPoint.latitude, currentPoint.longitude]}
            icon={profilePhoto ? createProfileIcon(profilePhoto, name ?? 'Employee') : createMarkerIcon('O', '#F59E0B')}
          >
            <Popup>{profilePhoto ? 'Current route location' : 'Current route location'}</Popup>
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
