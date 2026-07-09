import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { authedFetch } from '../lib/api'
import { MetricCard } from '../components/MetricCard'
import { RouteMap } from '../components/RouteMap'

export function DashboardPage() {
  const { getToken } = useAuth()
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
      <div className="split-layout">
        <div className="glass-card card-soft">
          <div className="section-header">
            <div>
              <span className="eyebrow">Route monitoring</span>
              <h4>Live route snapshot</h4>
            </div>
            <span className="badge success">Tracking active</span>
          </div>
          <RouteMap points={[
            { latitude: 12.9716, longitude: 77.5946 },
            { latitude: 12.9725, longitude: 77.6021 },
            { latitude: 12.9751, longitude: 77.6089 },
          ]} />
        </div>
        <div className="glass-card card-soft stack">
          <div className="section-header">
            <div>
              <span className="eyebrow">Operational rules</span>
              <h4>Attendance policy</h4>
            </div>
          </div>
          <ul className="info-list">
            <li>Check-in is allowed only inside the active assignment radius.</li>
            <li>Selfies are verified against stored InsightFace embeddings.</li>
            <li>Location logs are restricted to authenticated admins and the owning employee.</li>
            <li>GPS points are collected only during an active working session.</li>
          </ul>
        </div>
      </div>
    </section>
  )
}
