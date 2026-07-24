import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { authedFetch } from '../lib/api'
import { RouteMap } from '../components/RouteMap'
import { LiveLocationsMap } from '../components/LiveLocationsMap'

type Employee = {
  id: number
  employee_id: string
  name: string
  email: string
  department: string
  designation: string
  profile_photo: string
  is_active: boolean
}

type LiveLocation = {
  id: number
  employee_id: string
  name: string
  email?: string
  department?: string
  default_address?: string
  profile_photo?: string
  latitude: number
  longitude: number
  presence_status: string
  is_present: boolean
}

type RoutePoint = {
  latitude: number
  longitude: number
  timestamp?: string
}

export function TrackingPage() {
  const { employeeId: urlEmployeeId } = useParams()
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const [searchVal, setSearchVal] = useState('')

  // Query all employees for searching
  const employeesQuery = useQuery({
    queryKey: ['employees-tracking-list'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Missing token')
      const response = await authedFetch('/api/employees/', token)
      if (!response.ok) throw new Error('Unable to load employees')
      const data = await response.json()
      return (data.results ?? []) as Employee[]
    },
  })

  // Query present locations for the default map view
  const liveLocationsQuery = useQuery({
    queryKey: ['live-locations-tracking'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Missing token')
      const response = await authedFetch('/api/location/all-present-locations', token)
      if (!response.ok) throw new Error('Unable to load present locations')
      return response.json() as Promise<LiveLocation[]>
    },
    refetchInterval: 30000,
  })

  const employees = employeesQuery.data ?? []
  const liveLocations = liveLocationsQuery.data ?? []

  // Resolve selected employee either from URL or from search
  const selectedEmployee = useMemo(() => {
    if (!urlEmployeeId) return null
    return employees.find(
      (e) => e.employee_id === urlEmployeeId || String(e.id) === urlEmployeeId
    ) ?? null
  }, [urlEmployeeId, employees])

  // Fetch route details if an employee is selected
  const routeQuery = useQuery({
    queryKey: ['route-tracking', selectedEmployee?.id],
    enabled: !!selectedEmployee,
    queryFn: async () => {
      const token = await getToken()
      if (!token || !selectedEmployee) throw new Error('Missing credentials')
      const response = await authedFetch(`/api/location/employee/route/${selectedEmployee.id}`, token)
      if (!response.ok) throw new Error('Unable to load route')
      return response.json() as Promise<{
        route: RoutePoint[]
        distance_covered_meters: number
        presence_status: string
        is_present: boolean
        check_in_time: string | null
        session_duration_seconds: number | null
      }>
    },
    refetchInterval: selectedEmployee?.id ? 15000 : undefined, // Refetch every 15s when tracking a single employee
  })

  // Filter present employees list for default map view
  const filteredLiveLocations = useMemo(() => {
    if (!searchVal.trim()) return liveLocations
    const query = searchVal.toLowerCase().trim()
    return liveLocations.filter((loc) =>
      loc.name.toLowerCase().includes(query) ||
      loc.employee_id.toLowerCase().includes(query) ||
      (loc.email && loc.email.toLowerCase().includes(query)) ||
      (loc.department && loc.department.toLowerCase().includes(query))
    )
  }, [liveLocations, searchVal])

  // Filter overall employees list for the autocomplete dropdown search
  const searchResults = useMemo(() => {
    if (!searchVal.trim() || selectedEmployee) return []
    const query = searchVal.toLowerCase().trim()
    return employees.filter((e) =>
      e.name.toLowerCase().includes(query) ||
      e.employee_id.toLowerCase().includes(query) ||
      e.email.toLowerCase().includes(query)
    )
  }, [employees, searchVal, selectedEmployee])

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return '0m'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="glass-card card-soft">
        <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span className="eyebrow">Tracking center</span>
            <h3>Live Operations Tracking</h3>
            <p>View real-time coordinates of present workforce or search an employee to trace their route history.</p>
          </div>
          {selectedEmployee && (
            <button
              className="btn-secondary"
              onClick={() => {
                setSearchVal('')
                navigate('/tracking')
              }}
            >
              ✕ Back to Roster Map
            </button>
          )}
        </div>

        {/* Search input field */}
        <div style={{ position: 'relative', marginTop: '1rem', marginBottom: '0.5rem', maxWidth: '420px' }}>
          <input
            type="text"
            placeholder="Search employee by ID, name, email..."
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              background: 'var(--panel)',
              color: 'var(--text)',
              fontSize: '0.95rem'
            }}
          />
          {searchResults.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              zIndex: 1000,
              boxShadow: 'var(--shadow)',
              maxHeight: '220px',
              overflowY: 'auto',
              marginTop: '4px'
            }}>
              {searchResults.map((emp) => (
                <div
                  key={emp.id}
                  onClick={() => {
                    setSearchVal(emp.name)
                    navigate(`/tracking/${emp.employee_id}`)
                  }}
                  style={{
                    padding: '0.75rem 1rem',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <img
                    src={emp.profile_photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(emp.name) + '&background=6B2FA0&color=fff'}
                    alt={emp.name}
                    style={{ width: '28px', height: '28px', borderRadius: '50%' }}
                  />
                  <div>
                    <strong>{emp.name}</strong> <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>({emp.employee_id})</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedEmployee ? '1fr 340px' : '1fr', gap: '1.5rem' }}>
        {/* Map view */}
        <div className="glass-card card-soft" style={{ padding: '1rem', minHeight: '420px', display: 'flex', flexDirection: 'column' }}>
          {selectedEmployee ? (
            routeQuery.isLoading ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
                Loading employee route data...
              </div>
            ) : routeQuery.isError ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}>
                Error loading route map.
              </div>
            ) : (routeQuery.data?.route?.length ?? 0) === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
                No tracking route points recorded for today.
              </div>
            ) : (
              <RouteMap points={routeQuery.data?.route || []} />
            )
          ) : liveLocationsQuery.isLoading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
              Loading operations map...
            </div>
          ) : (
            <LiveLocationsMap locations={filteredLiveLocations} />
          )}
        </div>

        {/* Selected Employee Details panel */}
        {selectedEmployee && routeQuery.data && (
          <div className="glass-card card-soft stack" style={{ padding: '1.5rem', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
              <img
                src={selectedEmployee.profile_photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(selectedEmployee.name) + '&background=6B2FA0&color=fff'}
                alt={selectedEmployee.name}
                style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', marginBottom: '0.75rem', border: '3px solid var(--primary)' }}
              />
              <h4 style={{ fontSize: '1.15rem' }}>{selectedEmployee.name}</h4>
              <span style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 600 }}>{selectedEmployee.employee_id}</span>
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0.25rem 0 0 0' }}>{selectedEmployee.designation} — {selectedEmployee.department}</p>
            </div>

            <div className="stack" style={{ gap: '0.75rem', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Status:</span>
                <span className={`status-pill ${routeQuery.data.is_present ? 'active' : 'inactive'}`} style={{ transform: 'none' }}>
                  {routeQuery.data.is_present ? 'Present' : 'Absent'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Check-In Time:</span>
                <span style={{ fontWeight: 600 }}>
                  {routeQuery.data.check_in_time ? new Date(routeQuery.data.check_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Duration Active:</span>
                <span style={{ fontWeight: 600 }}>{formatDuration(routeQuery.data.session_duration_seconds)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Distance Covered:</span>
                <span style={{ fontWeight: 600 }}>{(routeQuery.data.distance_covered_meters / 1000).toFixed(2)} km</span>
              </div>
            </div>

            {routeQuery.data.route && routeQuery.data.route.length > 0 && (
              <div style={{ background: 'var(--accent-soft)', padding: '1rem', borderRadius: '12px', marginTop: 'auto' }}>
                <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary)' }}>Route Snapshot</h5>
                <p style={{ margin: '0.2rem 0', fontSize: '0.8rem' }}>
                  🏁 <strong>Start Point:</strong> {routeQuery.data.route[0].latitude.toFixed(5)}, {routeQuery.data.route[0].longitude.toFixed(5)}
                </p>
                <p style={{ margin: '0.2rem 0', fontSize: '0.8rem' }}>
                  📍 <strong>Last Location:</strong> {routeQuery.data.route[routeQuery.data.route.length - 1].latitude.toFixed(5)}, {routeQuery.data.route[routeQuery.data.route.length - 1].longitude.toFixed(5)}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
