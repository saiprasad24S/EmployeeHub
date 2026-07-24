import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { authedFetch } from '../lib/api'
import { MetricCard } from '../components/MetricCard'
import { LiveLocationsMap } from '../components/LiveLocationsMap'
import { useSearch } from '../context/SearchContext'

export function DashboardPage() {
  const { getToken } = useAuth()
  const { searchQuery } = useSearch()

  const metricsQuery = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Missing token')
      const response = await authedFetch('/api/dashboard/metrics', token)
      if (!response.ok) throw new Error('Unable to load metrics')
      return response.json() as Promise<Record<string, number>>
    },
  })

  const liveLocationsQuery = useQuery({
    queryKey: ['live-locations'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Missing token')
      const response = await authedFetch('/api/location/all-present-locations', token)
      if (!response.ok) throw new Error('Unable to load locations')
      return response.json() as Promise<Array<{
        id: number
        employee_id: string
        name: string
        email?: string
        department?: string
        default_address?: string
        profile_photo?: string
        latitude: number
        longitude: number
      }>>
    },
    refetchInterval: 30000,
  })

  const filteredLocations = useMemo(() => {
    const data = liveLocationsQuery.data ?? []
    if (!searchQuery.trim()) return data
    const query = searchQuery.toLowerCase().trim()
    return data.filter((loc) =>
      loc.name.toLowerCase().includes(query) ||
      loc.employee_id.toLowerCase().includes(query) ||
      (loc.email && loc.email.toLowerCase().includes(query)) ||
      (loc.default_address && loc.default_address.toLowerCase().includes(query)) ||
      (loc.department && loc.department.toLowerCase().includes(query))
    )
  }, [liveLocationsQuery.data, searchQuery])

  return (
    <section className="page-grid">
      <div className="hero-card hero-split">
        <div className="hero-copy">
          <span className="eyebrow">Today at a glance</span>
          <h3>Attendance, routing, and field coverage</h3>
          <p>Premium healthcare operations dashboard designed for Skandan field employees and admins.</p>
          <div className="hero-pills">
            <span>Live locations</span>
            <span>Photo proof</span>
            <span>Geofence checks</span>
          </div>
        </div>
        <div className="hero-summary">
          <MetricCard label="Present Employees" value={String(metricsQuery.data?.present_employees ?? 0)} />
          <MetricCard label="Employees in Field" value={String(metricsQuery.data?.employees_in_field ?? 0)} />
        </div>
      </div>
      <div className="metrics-grid">
        <MetricCard label="Present Employees" value={String(metricsQuery.data?.present_employees ?? 0)} />
        <MetricCard label="Absent Employees" value={String(metricsQuery.data?.absent_employees ?? 0)} />
        <MetricCard label="Employees in Field" value={String(metricsQuery.data?.employees_in_field ?? 0)} />
        <MetricCard label="Completed Visits" value={String(metricsQuery.data?.completed_visits ?? 0)} />
        <MetricCard label="Pending Visits" value={String(metricsQuery.data?.pending_visits ?? 0)} />
        <MetricCard label="Distance Covered" value={`${Math.round(metricsQuery.data?.distance_covered_today_meters ?? 0)} m`} />
      </div>
      <div style={{ width: '100%', maxWidth: '1100px', margin: '0 auto' }}>
        <div className="glass-card card-soft">
          <div className="section-header">
            <div>
              <span className="eyebrow">Route monitoring</span>
              <h4>Live employee locations</h4>
            </div>
            <span className="badge success">Tracking active</span>
          </div>
          {liveLocationsQuery.isLoading ? (
            <div style={{ height: '420px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--panel)', borderRadius: '14px' }}>
              Loading map...
            </div>
          ) : (
            <LiveLocationsMap locations={filteredLocations} />
          )}
        </div>
      </div>
    </section>
  )
}
