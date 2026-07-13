import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { authedFetch } from '../lib/api'
import { RouteMap } from '../components/RouteMap'

export function TrackingPage() {
  const { employeeId } = useParams()
  const { getToken } = useAuth()

  const routeQuery = useQuery({
    queryKey: ['route', employeeId],
    enabled: Boolean(employeeId),
    queryFn: async () => {
      const token = await getToken()
      if (!token || !employeeId) throw new Error('Missing token or employee id')
      const response = await authedFetch(`/api/location/employee/route/${employeeId}`, token)
      if (!response.ok) throw new Error('Unable to load route')
      return response.json() as Promise<{ route: Array<{ latitude: number; longitude: number; timestamp: string }> }>
    },
  })

  const points = routeQuery.data?.route || []

  return (
    <section className="glass-card card-soft">
      <div className="section-header" style={{ marginBottom: '1rem' }}>
        <div>
          <span className="eyebrow">Tracking</span>
          <h3>Employee route history</h3>
          <p>Showing live Leaflet + OpenStreetMap routing for employee {employeeId}</p>
        </div>
      </div>
      
      {routeQuery.isLoading ? (
        <div className="route-loading">Loading route data...</div>
      ) : routeQuery.isError ? (
        <div className="route-loading" style={{ color: 'var(--danger)' }}>Unable to load route history right now.</div>
      ) : points.length === 0 ? (
        <div className="route-loading">No route recorded for today. Employees are absent or there is no live tracking data yet.</div>
      ) : (
        <RouteMap points={points} />
      )}
    </section>
  )
}
