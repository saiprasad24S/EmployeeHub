import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { authedFetch } from '../lib/api'
import { MetricCard } from '../components/MetricCard'
import { LiveLocationsMap } from '../components/LiveLocationsMap'
import { useSearch } from '../context/SearchContext'

export function DashboardPage() {
  const navigate = useNavigate()
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
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
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
    staleTime: 30_000,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
    placeholderData: (previousData) => previousData,
  })

  const filteredLocations = useMemo(() => {
    const data = Array.isArray(liveLocationsQuery.data) ? liveLocationsQuery.data : []
    if (!searchQuery.trim()) return data
    const query = searchQuery.toLowerCase().trim()
    return data.filter((loc) =>
      Boolean(
        (loc.name && loc.name.toLowerCase().includes(query)) ||
        (loc.employee_id && loc.employee_id.toLowerCase().includes(query)) ||
        (loc.email && loc.email.toLowerCase().includes(query)) ||
        (loc.default_address && loc.default_address.toLowerCase().includes(query)) ||
        (loc.department && loc.department.toLowerCase().includes(query))
      )
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

      {/* Leave Overview Section */}
      <div className="glass-card card-soft" style={{ padding: '1.5rem', width: '100%', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <span className="eyebrow" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', fontSize: '0.75rem' }}>
              LEAVE MANAGEMENT
            </span>
            <h4 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0.2rem 0' }}>Leave Overview</h4>
          </div>
          <button
            type="button"
            className="ghost-button"
            onClick={() => navigate('/leaves')}
            style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)', cursor: 'pointer', padding: '0.4rem 0.8rem' }}
          >
            View All Leaves →
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div
            onClick={() => navigate('/leaves?status=PENDING')}
            style={{
              background: 'rgba(245, 158, 11, 0.08)',
              border: '2px solid rgba(245, 158, 11, 0.4)',
              borderRadius: '14px',
              padding: '1.2rem',
              cursor: 'pointer',
              boxShadow: (metricsQuery.data?.pending_leaves ?? 0) > 0 ? '0 4px 14px rgba(245, 158, 11, 0.15)' : 'none',
              transition: 'transform 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#D97706', textTransform: 'uppercase' }}>
                Pending Review
              </span>
              {(metricsQuery.data?.pending_leaves ?? 0) > 0 && (
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#D97706' }} />
              )}
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#B45309', marginTop: '0.3rem' }}>
              {metricsQuery.data?.pending_leaves ?? 0}
            </div>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--muted)' }}>
              Click to view requests requiring action
            </p>
          </div>

          <div
            onClick={() => navigate('/leaves?status=APPROVED')}
            style={{
              background: 'rgba(34, 197, 94, 0.06)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              borderRadius: '14px',
              padding: '1.2rem',
              cursor: 'pointer',
              transition: 'transform 0.15s ease',
            }}
          >
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#16A34A', textTransform: 'uppercase' }}>
              Approved Leaves
            </span>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#15803D', marginTop: '0.3rem' }}>
              {metricsQuery.data?.approved_leaves ?? 0}
            </div>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--muted)' }}>
              Approved requests
            </p>
          </div>

          <div
            onClick={() => navigate('/leaves?status=REJECTED')}
            style={{
              background: 'rgba(239, 68, 68, 0.06)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '14px',
              padding: '1.2rem',
              cursor: 'pointer',
              transition: 'transform 0.15s ease',
            }}
          >
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#DC2626', textTransform: 'uppercase' }}>
              Rejected Leaves
            </span>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#B91C1C', marginTop: '0.3rem' }}>
              {metricsQuery.data?.rejected_leaves ?? 0}
            </div>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--muted)' }}>
              Rejected requests
            </p>
          </div>
        </div>
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
