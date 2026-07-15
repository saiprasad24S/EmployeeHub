import { useMemo } from 'react'
import { MapContainer, Marker, TileLayer, Popup } from 'react-leaflet'
import { divIcon } from 'leaflet'
import type { LatLngExpression } from 'leaflet'

type LiveLocationsMapProps = {
  locations: Array<{ id: number; employee_id: string; name: string; email?: string; department?: string; default_address?: string; profile_photo?: string; latitude: number; longitude: number }>
}

const createProfileIcon = (photo: string | undefined, name: string) => divIcon({
  html: `<div style="display:flex;align-items:center;justify-content:center;width:54px;height:54px;border-radius:999px;padding:3px;background:linear-gradient(135deg,#6B2FA0,#8B5CF6);box-shadow:0 8px 20px rgba(0,0,0,.28);overflow:hidden;"><img src="${photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=6B2FA0&color=fff'}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:999px;border:2px solid white;" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6B2FA0&color=fff'" /></div>`,
  className: 'profile-pin-icon',
  iconSize: [54, 54],
  iconAnchor: [27, 27],
})

export function LiveLocationsMap({ locations }: LiveLocationsMapProps) {
  const markers = useMemo(() => {
    const normalized = locations.filter((loc) => {
      const latitude = Number(loc.latitude)
      const longitude = Number(loc.longitude)
      return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude !== 0 && longitude !== 0
    })

    return normalized.map((loc) => ({
      ...loc,
      latitude: Number(loc.latitude),
      longitude: Number(loc.longitude),
      icon: createProfileIcon(loc.profile_photo, loc.name),
    }))
  }, [locations])

  const center: LatLngExpression = markers.length > 0
    ? [markers[0].latitude, markers[0].longitude]
    : [12.9716, 77.5946]

  return (
    <div className="map-card" style={{ height: '350px', borderRadius: '14px', overflow: 'hidden' }}>
      <MapContainer key={`live-${center[0]}-${center[1]}`} center={center} zoom={12} scrollWheelZoom className="map-view" style={{ height: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((loc) => (
          <Marker key={loc.id} position={[loc.latitude, loc.longitude]} icon={loc.icon}>
            <Popup>
              <div style={{ padding: '0.2rem', minWidth: '180px' }}>
                <strong style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>{loc.name}</strong>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>
                  ID: {loc.employee_id}
                </p>
                {loc.email ? <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: 'var(--muted)' }}>{loc.email}</p> : null}
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
