import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { authedFetch } from '../lib/api'
import { RouteMap } from '../components/RouteMap'
import { useSearch } from '../context/SearchContext'

type EmployeeSummary = {
  id: number
  employee_id: string
  name: string
  email: string
  phone?: string
  department?: string
  default_address?: string
  profile_photo?: string
  is_present?: boolean
  presence_status?: string
  check_in_time?: string | null
  session_duration_seconds?: number | null
  latitude?: number
  longitude?: number
  timestamp?: string | null
}

type TrackingEmployee = EmployeeSummary & {
  route?: Array<{ latitude: number; longitude: number; timestamp: string }>
  last_known_location?: { latitude: number; longitude: number; timestamp?: string | null; accuracy?: number | null } | null
  distance_covered_meters?: number
}

export function TrackingPage() {
  const { employeeId } = useParams()
  const { getToken } = useAuth()
  const { searchQuery, setSearchQuery } = useSearch()
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(employeeId ?? null)

  const employeesQuery = useQuery({
    queryKey: ['tracking-employees'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Missing token')
      const response = await authedFetch('/api/location/all-present-locations', token)
      if (!response.ok) throw new Error('Unable to load live employees')
      return response.json() as Promise<EmployeeSummary[]>
    },
    refetchInterval: 20000,
  })

  useEffect(() => {
    if (!employeeId) {
      setSelectedEmployeeId((current) => current ?? null)
      return
    }
    setSelectedEmployeeId(employeeId)
  }, [employeeId])

  const searchValue = searchQuery.trim().toLowerCase()
  const filteredEmployees = useMemo(() => {
    if (!searchValue) return (employeesQuery.data ?? [])
    return (employeesQuery.data ?? []).filter((employee) => {
      const haystacks = [employee.employee_id, employee.name, employee.email, employee.phone, employee.department, employee.default_address]
      return haystacks.some((value) => (value ?? '').toLowerCase().includes(searchValue))
    })
  }, [employeesQuery.data, searchValue])

  const resolvedEmployeeId = useMemo(() => {
    if (selectedEmployeeId) return selectedEmployeeId
    if (filteredEmployees.length > 0) return filteredEmployees[0].employee_id
    return null
  }, [filteredEmployees, selectedEmployeeId])

  useEffect(() => {
    if (!resolvedEmployeeId) return
    setSelectedEmployeeId(resolvedEmployeeId)
  }, [resolvedEmployeeId])

  const routeQuery = useQuery({
    queryKey: ['tracking-route', resolvedEmployeeId],
    enabled: Boolean(resolvedEmployeeId),
    queryFn: async () => {
      const token = await getToken()
      if (!token || !resolvedEmployeeId) throw new Error('Missing token or employee id')
      const response = await authedFetch(`/api/location/employee/route/${resolvedEmployeeId}`, token)
      if (response.status === 404) {
        return { route: [], last_known_location: null, presence_status: 'Absent', is_present: false, check_in_time: null, session_duration_seconds: 0, distance_covered_meters: 0 } as Partial<TrackingEmployee>
      }
      if (!response.ok) throw new Error('Unable to load route')
      return response.json() as Promise<TrackingEmployee>
    },
    refetchInterval: 20000,
  })

  const points = routeQuery.data?.route || []
  const lastKnownLocation = routeQuery.data?.last_known_location ?? null
  const selectedEmployee = (employeesQuery.data ?? []).find((employee) => employee.employee_id === resolvedEmployeeId) ?? null
  const activeCount = (employeesQuery.data ?? []).filter((employee) => employee.is_present).length

  const formatTime = (value?: string | null) => {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
  }

  const formatDuration = (seconds?: number | null) => {
    if (!seconds || seconds <= 0) return '—'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours && minutes) return `${hours}h ${minutes}m`
    if (hours) return `${hours}h`
    return `${minutes}m`
  }

  return (
    <section className="glass-card card-soft" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="section-header" style={{ marginBottom: '0.25rem' }}>
        <div>
          <span className="eyebrow">Tracking</span>
          <h3>Live employee tracking</h3>
          <p>Showing all currently present employees and their active-session route history.</p>
        </div>
        <div className="glass-card" style={{ padding: '0.65rem 0.8rem', minWidth: '280px' }}>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by name, employee ID, email, phone, or department"
            style={{ width: '100%', padding: '0.6rem 0.7rem', borderRadius: '10px', border: '1px solid var(--panel-border)', background: 'var(--panel)', color: 'var(--text)' }}
          />
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.45rem' }}>
            {filteredEmployees.length} active match{filteredEmployees.length === 1 ? '' : 'es'}
          </div>
        </div>
      </div>

      {employeesQuery.isLoading ? (
        <div className="route-loading">Loading live employee data...</div>
      ) : employeesQuery.isError ? (
        <div className="route-loading" style={{ color: 'var(--danger)' }}>Unable to load live tracking data right now.</div>
      ) : activeCount === 0 ? (
        <div className="route-loading">No active employees are currently being tracked.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1rem', alignItems: 'start' }}>
          <div className="glass-card" style={{ padding: '0.9rem' }}>
            {routeQuery.isLoading ? (
              <div className="route-loading">Loading route data...</div>
            ) : routeQuery.isError ? (
              <div className="route-loading" style={{ color: 'var(--danger)' }}>Unable to load route history right now.</div>
            ) : points.length === 0 && !lastKnownLocation ? (
              <div className="route-loading">No active session route has been recorded yet for this employee.</div>
            ) : (
              <RouteMap points={points} lastKnownLocation={lastKnownLocation} profilePhoto={selectedEmployee?.profile_photo} name={selectedEmployee?.name} />
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="glass-card" style={{ padding: '0.95rem' }}>
              <h4 style={{ marginBottom: '0.7rem' }}>Active employees</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', maxHeight: '260px', overflowY: 'auto' }}>
                {filteredEmployees.map((employee) => {
                  const isSelected = employee.employee_id === resolvedEmployeeId
                  return (
                    <button
                      key={employee.id}
                      type="button"
                      onClick={() => setSelectedEmployeeId(employee.employee_id)}
                      style={{ textAlign: 'left', padding: '0.7rem', borderRadius: '12px', border: isSelected ? '1px solid var(--primary)' : '1px solid var(--panel-border)', background: isSelected ? 'rgba(107,47,160,0.08)' : 'var(--panel)', color: 'var(--text)', cursor: 'pointer' }}
                    >
                      <div style={{ fontWeight: 700 }}>{employee.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{employee.employee_id}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.2rem' }}>{employee.email}</div>
                      <div style={{ fontSize: '0.75rem', color: employee.is_present ? '#10B981' : 'var(--muted)', marginTop: '0.2rem' }}>
                        {employee.is_present ? 'Present' : 'Absent'}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {selectedEmployee ? (
              <div className="glass-card" style={{ padding: '0.95rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '0.7rem' }}>
                  <img src={selectedEmployee.profile_photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(selectedEmployee.name) + '&background=6B2FA0&color=fff'} alt={selectedEmployee.name} style={{ width: '46px', height: '46px', borderRadius: '50%', objectFit: 'cover' }} />
                  <div>
                    <div style={{ fontWeight: 700 }}>{selectedEmployee.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{selectedEmployee.employee_id}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
                  <div><strong style={{ color: 'var(--text)' }}>Status:</strong> {routeQuery.data?.presence_status ?? (selectedEmployee.is_present ? 'Present' : 'Absent')}</div>
                  <div><strong style={{ color: 'var(--text)' }}>Check-in:</strong> {formatTime(routeQuery.data?.check_in_time ?? selectedEmployee.check_in_time ?? null)}</div>
                  <div><strong style={{ color: 'var(--text)' }}>Session duration:</strong> {formatDuration(routeQuery.data?.session_duration_seconds ?? selectedEmployee.session_duration_seconds ?? null)}</div>
                  <div><strong style={{ color: 'var(--text)' }}>Last updated:</strong> {formatTime(selectedEmployee.timestamp ?? null)}</div>
                  <div><strong style={{ color: 'var(--text)' }}>Coordinates:</strong> {selectedEmployee.latitude != null && selectedEmployee.longitude != null ? `${selectedEmployee.latitude.toFixed(5)}, ${selectedEmployee.longitude.toFixed(5)}` : '—'}</div>
                  <div><strong style={{ color: 'var(--text)' }}>Distance today:</strong> {(routeQuery.data?.distance_covered_meters ?? 0).toFixed(0)} m</div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  )
}
