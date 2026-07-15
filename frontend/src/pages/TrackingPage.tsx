import { useMemo } from 'react'
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
  department?: string
  default_address?: string
  profile_photo?: string
}

export function TrackingPage() {
  const { employeeId } = useParams()
  const { getToken } = useAuth()
  const { searchQuery } = useSearch()

  const employeesQuery = useQuery({
    queryKey: ['tracking-employees'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Missing token')
      const response = await authedFetch('/api/employees/', token)
      if (!response.ok) throw new Error('Unable to load employees')
      const data = await response.json()
      return (data.results ?? []) as EmployeeSummary[]
    },
  })

  const resolvedEmployeeId = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return employeeId ?? null

    const matches = (employeesQuery.data ?? []).filter((employee) => {
      const haystacks = [employee.employee_id, employee.name, employee.email, employee.department, employee.default_address]
      return haystacks.some((value) => (value ?? '').toLowerCase().includes(query))
    })

    return matches[0]?.employee_id ?? employeeId ?? null
  }, [employeeId, employeesQuery.data, searchQuery])

  const routeQuery = useQuery({
    queryKey: ['route', resolvedEmployeeId],
    enabled: Boolean(resolvedEmployeeId),
    queryFn: async () => {
      const token = await getToken()
      if (!token || !resolvedEmployeeId) throw new Error('Missing token or employee id')
      const response = await authedFetch(`/api/location/employee/route/${resolvedEmployeeId}`, token)
      if (response.status === 404) {
        return { route: [], last_known_location: null }
      }
      if (!response.ok) throw new Error('Unable to load route')
      return response.json() as Promise<{
        route: Array<{ latitude: number; longitude: number; timestamp: string }>
        last_known_location?: { latitude: number; longitude: number; timestamp?: string } | null
      }>
    },
  })

  const points = routeQuery.data?.route || []
  const lastKnownLocation = routeQuery.data?.last_known_location ?? null
  const selectedEmployee = (employeesQuery.data ?? []).find((employee) => employee.employee_id === resolvedEmployeeId)

  return (
    <section className="glass-card card-soft">
      <div className="section-header" style={{ marginBottom: '1rem' }}>
        <div>
          <span className="eyebrow">Tracking</span>
          <h3>Employee route history</h3>
          <p>{selectedEmployee ? `Showing route for ${selectedEmployee.name} (${selectedEmployee.employee_id})` : 'Showing live Leaflet + OpenStreetMap routing for the selected employee'}</p>
        </div>
      </div>

      {routeQuery.isLoading ? (
        <div className="route-loading">Loading route data...</div>
      ) : routeQuery.isError ? (
        <div className="route-loading" style={{ color: 'var(--danger)' }}>Unable to load route history right now.</div>
      ) : points.length === 0 && !lastKnownLocation ? (
        <div className="route-loading">No route recorded for today. Employees are absent or there is no live tracking data yet.</div>
      ) : (
        <RouteMap points={points} lastKnownLocation={lastKnownLocation} profilePhoto={selectedEmployee?.profile_photo} name={selectedEmployee?.name} />
      )}
    </section>
  )
}
