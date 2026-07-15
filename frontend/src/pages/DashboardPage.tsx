import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { authedFetch } from '../lib/api'
import { MetricCard } from '../components/MetricCard'
import { LiveLocationsMap } from '../components/LiveLocationsMap'

export function DashboardPage() {
  const { getToken } = useAuth()

  // Fetch metrics (total, present, absent)
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

  // Fetch live locations of present employees
  const locationsQuery = useQuery({
    queryKey: ['dashboard-locations'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Missing token')
      const response = await authedFetch('/api/location/all-present-locations', token)
      if (!response.ok) throw new Error('Unable to load locations')
      return response.json() as Promise<
        Array<{
          id: number
          employee_id: string
          name: string
          email?: string
          department?: string
          default_address?: string
          profile_photo?: string
          latitude: number
          longitude: number
        }>
      >
    },
  })

  const totalEmployees = metricsQuery.data?.total_employees ?? 0
  const presentCount = metricsQuery.data?.present_employees ?? 0
  const absentCount = metricsQuery.data?.absent_employees ?? 0
  const locations = locationsQuery.data ?? []
  const hasRenderableLocations = locations.some((location) => Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude)))

  return (
    <section className="page-grid" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="hero-card hero-split">
        <div className="hero-copy">
          <span className="eyebrow">Today at a glance</span>
          <h3>Attendance, routing, and field coverage</h3>
          <p>Secure healthcare operations for Skandan clinicians, nurses, and admins.</p>
        </div>
        <div className="hero-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
          <MetricCard label="Total Employees" value={String(totalEmployees)} />
          <MetricCard label="Present Employees" value={String(presentCount)} />
          <MetricCard label="Absent Employees" value={String(absentCount)} />
        </div>
      </div>

      <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <MetricCard label="Total Employees" value={String(totalEmployees)} />
        <MetricCard label="Present Employees" value={String(presentCount)} />
        <MetricCard label="Absent Employees" value={String(absentCount)} />
      </div>

      <div className="split-layout" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Map Section */}
        <div className="glass-card card-soft">
          <div className="section-header" style={{ marginBottom: '1rem' }}>
            <div>
              <span className="eyebrow">Route monitoring</span>
              <h4>Live route snapshot</h4>
            </div>
            {presentCount > 0 && <span className="badge success">Tracking active</span>}
          </div>

          {presentCount === 0 ? (
            <div
              style={{
                height: '350px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(239, 68, 68, 0.05)',
                border: '1px dashed var(--danger)',
                borderRadius: '14px',
                color: 'var(--danger)',
                fontWeight: 600,
                fontSize: '1rem',
              }}
            >
              ⚠️ All employees are absent today. No present employee locations are available to display.
            </div>
          ) : locationsQuery.isLoading ? (
            <div style={{ height: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--panel)', borderRadius: '14px' }}>
              Loading live locations...
            </div>
          ) : hasRenderableLocations ? (
            <LiveLocationsMap locations={locations} />
          ) : (
            <div style={{ height: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(59, 130, 246, 0.05)', border: '1px dashed var(--primary)', borderRadius: '14px', color: 'var(--primary)', fontWeight: 600, fontSize: '1rem' }}>
              No live coordinates are available yet for the active employees.
            </div>
          )}
        </div>

        {/* Operational Rules */}
        <div className="glass-card card-soft stack">
          <div className="section-header">
            <div>
              <span className="eyebrow">Operational rules</span>
              <h4>Attendance policy</h4>
            </div>
          </div>
          <ul className="info-list" style={{ paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem', color: 'var(--muted)', fontSize: '0.9rem' }}>
            <li>Check-in is allowed only inside the scheduled assignment radius or default location.</li>
            <li>Selfies are verified against stored InsightFace embeddings.</li>
            <li>Location logs are restricted to authenticated admins and the owning employee.</li>
            <li>GPS points are collected only during an active working session.</li>
          </ul>
        </div>
      </div>
    </section>
  )
}
