import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { authedFetch } from '../lib/api'
import { RouteMap } from '../components/RouteMap'

type Employee = {
  id: number
  employee_id: string
  name: string
  email: string
  department: string
  designation: string
  profile_photo: string
  is_active: boolean
  is_face_registered: boolean
}

type AttendanceRecord = {
  id: number
  employee_employee_id: string
  employee_name: string
  attendance_type: string
  photo_url: string
  latitude: string
  longitude: string
  address: string
  timestamp: string
  status: string
}

type RoutePoint = {
  latitude: number
  longitude: number
}

export function EmployeesPage() {
  const { getToken } = useAuth()
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)

  const employeesQuery = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Missing token')
      const response = await authedFetch('/api/employees/', token)
      if (!response.ok) throw new Error('Unable to load employees')
      return response.json() as Promise<{ results?: Employee[] }>
    },
  })

  const attendanceQuery = useQuery({
    queryKey: ['attendance-all'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Missing token')
      const response = await authedFetch('/api/attendance/', token)
      if (!response.ok) throw new Error('Unable to load attendance')
      return response.json() as Promise<AttendanceRecord[]>
    },
  })

  const routeQuery = useQuery({
    queryKey: ['employee-route', selectedEmployee?.id],
    enabled: !!selectedEmployee,
    queryFn: async () => {
      const token = await getToken()
      if (!token || !selectedEmployee) throw new Error('No token')
      const response = await authedFetch(`/api/location/employee/route/${selectedEmployee.id}`, token)
      if (!response.ok) return { route: [] as RoutePoint[], distance_covered_meters: 0 }
      return response.json() as Promise<{ route: RoutePoint[]; distance_covered_meters: number }>
    },
  })

  const employees = employeesQuery.data?.results ?? []
  const attendance = attendanceQuery.data ?? []

  // Group attendance by employee
  const getEmployeeAttendance = (empId: string) => {
    return attendance
      .filter((a) => a.employee_employee_id === empId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  // Get latest check-in and check-out for today
  const getTodayTimes = (empId: string) => {
    const today = new Date().toISOString().slice(0, 10)
    const records = getEmployeeAttendance(empId).filter((a) =>
      a.timestamp.startsWith(today)
    )
    const checkIn = records.find((r) => r.attendance_type === 'CHECK_IN')
    const checkOut = records.find((r) => r.attendance_type === 'CHECK_OUT')
    return { checkIn, checkOut }
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="glass-card card-soft">
        <div className="section-header">
          <div>
            <span className="eyebrow">Employees</span>
            <h3>Workforce Overview</h3>
            <p>All employees with their attendance status, login/logout times, and location tracking.</p>
          </div>
        </div>
        <div className="table-wrap data-table-shell">
          <table>
            <thead>
              <tr>
                <th>Photo</th>
                <th>Employee ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Today's Check-In</th>
                <th>Today's Check-Out</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => {
                const { checkIn, checkOut } = getTodayTimes(employee.employee_id)
                return (
                  <tr key={employee.employee_id}>
                    <td>
                      <img
                        src={employee.profile_photo || (checkIn?.photo_url) || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(employee.name) + '&background=6B2FA0&color=fff'}
                        alt={employee.name}
                        style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    </td>
                    <td>{employee.employee_id}</td>
                    <td style={{ fontWeight: 600 }}>{employee.name}</td>
                    <td>{employee.email}</td>
                    <td>{employee.department}</td>
                    <td>
                      {checkIn ? (
                        <div>
                          <span style={{ color: '#10B981', fontWeight: 600, fontSize: '0.85rem' }}>
                            ✅ {new Date(checkIn.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <br />
                          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                            📍 {checkIn.address || `${Number(checkIn.latitude).toFixed(4)}, ${Number(checkIn.longitude).toFixed(4)}`}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>—</span>
                      )}
                    </td>
                    <td>
                      {checkOut ? (
                        <div>
                          <span style={{ color: '#EF4444', fontWeight: 600, fontSize: '0.85rem' }}>
                            🔴 {new Date(checkOut.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <br />
                          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                            📍 {checkOut.address || `${Number(checkOut.latitude).toFixed(4)}, ${Number(checkOut.longitude).toFixed(4)}`}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                          {checkIn ? '🟢 Still Active' : '—'}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`status-pill ${employee.is_active ? 'active' : 'inactive'}`}>
                        {employee.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn-secondary"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                        onClick={() => setSelectedEmployee(selectedEmployee?.id === employee.id ? null : employee)}
                      >
                        {selectedEmployee?.id === employee.id ? 'Hide Map' : '📍 Track'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Employee Detail + Map */}
      {selectedEmployee && (
        <div className="glass-card card-soft" style={{ padding: '1.5rem' }}>
          <div className="section-header">
            <div>
              <span className="eyebrow">Employee Tracking</span>
              <h4>
                {selectedEmployee.name} ({selectedEmployee.employee_id}) — Today's Route
              </h4>
            </div>
            <button
              className="ghost-button"
              onClick={() => setSelectedEmployee(null)}
              style={{ padding: '0.4rem 0.8rem' }}
            >
              ✕ Close
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1rem' }}>
            {/* Map */}
            <div style={{ height: '350px', borderRadius: '14px', overflow: 'hidden' }}>
              {routeQuery.isLoading ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--panel)', borderRadius: '14px' }}>
                  Loading route...
                </div>
              ) : (
                <RouteMap points={routeQuery.data?.route || []} />
              )}
            </div>

            {/* Attendance Log */}
            <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
              <h5 style={{ marginBottom: '0.75rem', color: 'var(--text)' }}>Attendance History</h5>
              {getEmployeeAttendance(selectedEmployee.employee_id).length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>No attendance records found.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {getEmployeeAttendance(selectedEmployee.employee_id).slice(0, 20).map((record) => (
                    <div
                      key={record.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.6rem 0.8rem',
                        background: record.attendance_type === 'CHECK_IN' ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
                        borderRadius: '10px',
                        borderLeft: `3px solid ${record.attendance_type === 'CHECK_IN' ? '#10B981' : '#EF4444'}`,
                      }}
                    >
                      {record.photo_url && (
                        <img
                          src={record.photo_url}
                          alt="attendance"
                          style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                      )}
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: record.attendance_type === 'CHECK_IN' ? '#10B981' : '#EF4444' }}>
                          {record.attendance_type === 'CHECK_IN' ? '✅ Check In' : '🔴 Check Out'}
                        </span>
                        <br />
                        <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                          {new Date(record.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {routeQuery.data && routeQuery.data.distance_covered_meters > 0 && (
            <div style={{ marginTop: '1rem', padding: '0.8rem', background: 'rgba(107,47,160,0.06)', borderRadius: '10px' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600, margin: 0 }}>
                📏 Total Distance Covered Today: {(routeQuery.data.distance_covered_meters / 1000).toFixed(2)} km
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
