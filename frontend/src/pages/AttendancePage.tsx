import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { authedFetch } from '../lib/api'

type Employee = {
  id: number
  employee_id: string
  name: string
  email: string
  department: string
  designation: string
  profile_photo: string
  is_active: boolean
  session_login_time: string | null
  session_logout_time: string | null
  session_duration_seconds: number
  active_session: boolean
  presence_status: string
}

export function AttendancePage() {
  const { getToken } = useAuth()
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false)
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))
  const [isDownloading, setIsDownloading] = useState(false)

  const employeesQuery = useQuery({
    queryKey: ['employees-attendance'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Missing token')
      const response = await authedFetch('/api/employees/', token)
      if (!response.ok) throw new Error('Unable to load employees')
      const data = await response.json()
      return (data.results ?? []) as Employee[]
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const employees = employeesQuery.data ?? []

  const formatDuration = (seconds: number | undefined) => {
    if (!seconds) return '0m'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
  }

  const getTodaySessionDetails = (employee: Employee) => {
    if (!employee.session_login_time) return null
    const loginDate = new Date(employee.session_login_time)
    const logoutDate = employee.session_logout_time ? new Date(employee.session_logout_time) : null
    const todayStr = new Date().toDateString()

    const isLoginToday = loginDate.toDateString() === todayStr
    const isLogoutToday = logoutDate ? logoutDate.toDateString() === todayStr : false
    const isActive = employee.active_session

    if (isActive || isLoginToday || isLogoutToday) {
      return {
        loginDate,
        logoutDate,
        isActive,
        isLoginToday,
        isLogoutToday,
      }
    }
    return null
  }

  const triggerExportDownload = async () => {
    if (!startDate || !endDate) {
      alert('Please select both start and end dates.')
      return
    }
    setIsDownloading(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('No authentication token')

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'}/api/attendance/export?start_date=${startDate}&end_date=${endDate}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || 'Export failed')
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `attendance_${startDate}_to_${endDate}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      setIsDownloadModalOpen(false)
    } catch (err: any) {
      alert(err.message || 'Failed to download attendance report')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="glass-card card-soft">
        <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="eyebrow">Attendance Board</span>
            <h3>Today's Attendance Status</h3>
            <p>Monitors check-ins, check-outs, and active night-shift sessions for all registered employees.</p>
          </div>
          <button className="btn-primary" onClick={() => setIsDownloadModalOpen(true)}>
            📥 Download Report
          </button>
        </div>

        {employeesQuery.isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>Loading attendance details...</div>
        ) : (
          <div className="table-wrap data-table-shell">
            <table>
              <thead>
                <tr>
                  <th>Photo</th>
                  <th>Employee ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Today's Check-In</th>
                  <th>Today's Check-Out</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>
                      No employees registered.
                    </td>
                  </tr>
                ) : (
                  employees.map((employee) => {
                    const session = getTodaySessionDetails(employee)
                    return (
                      <tr key={employee.employee_id}>
                        <td>
                          <img
                            src={employee.profile_photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(employee.name) + '&background=6B2FA0&color=fff'}
                            alt={employee.name}
                            style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                        </td>
                        <td>{employee.employee_id}</td>
                        <td style={{ fontWeight: 600 }}>{employee.name}</td>
                        <td>{employee.email}</td>
                        <td>{employee.department}</td>
                        <td>{employee.designation}</td>
                        <td>
                          {session ? (
                            <div>
                              <span style={{ color: '#10B981', fontWeight: 600, fontSize: '0.85rem' }}>
                                ✅ {session.isLoginToday ? '' : 'Yesterday '}{session.loginDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>—</span>
                          )}
                        </td>
                        <td>
                          {session ? (
                            session.isActive ? (
                              <span style={{ color: '#10B981', fontWeight: 600, fontSize: '0.85rem' }}>
                                🟢 Still Active
                              </span>
                            ) : session.logoutDate ? (
                              <div>
                                <span style={{ color: '#EF4444', fontWeight: 600, fontSize: '0.85rem' }}>
                                  🔴 {session.logoutDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <br />
                                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                                  ({formatDuration(employee.session_duration_seconds)})
                                </span>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>—</span>
                            )
                          ) : (
                            <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>—</span>
                          )}
                        </td>
                        <td>
                          <span className={`status-pill ${session && session.isActive ? 'active' : 'inactive'}`}>
                            {session && session.isActive ? 'Present' : 'Absent'}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Date Range Modal */}
      {isDownloadModalOpen && (
        <div className="camera-modal-backdrop">
          <div className="camera-modal" style={{ maxWidth: '400px', width: '100%', height: 'auto' }}>
            <div className="camera-header">
              <h3 style={{ fontSize: '1.25rem' }}>📅 Export Attendance Report</h3>
              <button
                onClick={() => setIsDownloadModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                }}
              >
                &times;
              </button>
            </div>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="stack" style={{ gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>From Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    padding: '0.6rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    background: 'var(--panel)',
                    color: 'var(--text)',
                  }}
                />
              </div>
              <div className="stack" style={{ gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>To Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    padding: '0.6rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    background: 'var(--panel)',
                    color: 'var(--text)',
                  }}
                />
              </div>
              <div className="button-group-row" style={{ marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsDownloadModalOpen(false)}
                  disabled={isDownloading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={triggerExportDownload}
                  disabled={isDownloading}
                >
                  {isDownloading ? 'Downloading...' : 'Download Excel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
