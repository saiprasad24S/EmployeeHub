import { useEffect } from 'react'
import { MapContainer, Marker, Polyline, TileLayer, Popup, useMap } from 'react-leaflet'
import { divIcon, latLngBounds } from 'leaflet'
import type { LatLngExpression } from 'leaflet'

type RouteMapProps = {
  points: Array<{ latitude: number; longitude: number; timestamp?: string; type?: string }>
  isLive?: boolean
}

const startIcon = divIcon({
  html: `<div style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:#10B981;color:white;font-weight:bold;font-size:11px;border:3px solid white;box-shadow:0 4px 10px rgba(0,0,0,0.3);">START</div>`,
  className: 'route-start-pin',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
})

const endIcon = divIcon({
  html: `<div style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:#EF4444;color:white;font-weight:bold;font-size:11px;border:3px solid white;box-shadow:0 4px 10px rgba(0,0,0,0.3);">END</div>`,
  className: 'route-end-pin',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
})

const liveIcon = divIcon({
  html: `<div style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:#6B2FA0;color:white;font-weight:bold;font-size:11px;border:3px solid white;box-shadow:0 4px 10px rgba(107,47,160,0.4);animation:pulse 2s infinite;">LIVE</div>`,
  className: 'route-live-pin',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
})

function MapAutoBounds({ points }: { points: Array<{ latitude: number; longitude: number }> }) {
  const map = useMap()

  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 14)
      return
    }
    const bounds = latLngBounds(points.map((p) => [p.latitude, p.longitude]))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
  }, [map, points])

  return null
}

export function RouteMap({ points, isLive = false }: RouteMapProps) {
  const center: LatLngExpression = points.length > 0 ? [points[0].latitude, points[0].longitude] : [12.9716, 77.5946]

  const startPoint = points.length > 0 ? points[0] : null
  const endPoint = points.length > 0 ? points[points.length - 1] : null

  const formatTimestamp = (ts?: string) => {
    if (!ts) return ''
    try {
      return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch {
      return ts
    }
  }

  return (
    <div className="map-card" style={{ height: '100%', minHeight: '380px', borderRadius: '14px', overflow: 'hidden' }}>
      <MapContainer center={center} zoom={13} scrollWheelZoom className="map-view" style={{ height: '100%', minHeight: '380px' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapAutoBounds points={points} />
        {points.length > 0 && (
          <>
            <Polyline
              positions={points.map((point) => [point.latitude, point.longitude])}
              pathOptions={{ color: '#6B2FA0', weight: 5, opacity: 0.85 }}
            />
            {startPoint && (
              <Marker position={[startPoint.latitude, startPoint.longitude]} icon={startIcon}>
                <Popup>
                  <div style={{ padding: '0.2rem' }}>
                    <strong style={{ color: '#10B981', fontSize: '0.9rem' }}>🏁 Route Start Location</strong>
                    {startPoint.timestamp && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
                        Time: {formatTimestamp(startPoint.timestamp)}
                      </div>
                    )}
                    <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', marginTop: '0.2rem' }}>
                      {startPoint.latitude.toFixed(5)}, {startPoint.longitude.toFixed(5)}
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}
            {endPoint && points.length > 1 && (
              <Marker position={[endPoint.latitude, endPoint.longitude]} icon={isLive ? liveIcon : endIcon}>
                <Popup>
                  <div style={{ padding: '0.2rem' }}>
                    <strong style={{ color: isLive ? '#6B2FA0' : '#EF4444', fontSize: '0.9rem' }}>
                      {isLive ? '📍 Live Location' : '🏁 Route End Location'}
                    </strong>
                    {endPoint.timestamp && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
                        Time: {formatTimestamp(endPoint.timestamp)}
                      </div>
                    )}
                    <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', marginTop: '0.2rem' }}>
                      {endPoint.latitude.toFixed(5)}, {endPoint.longitude.toFixed(5)}
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}
          </>
        )}
      </MapContainer>
    </div>
  )
}
