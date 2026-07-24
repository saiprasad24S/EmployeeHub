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
      return (Array.isArray(data) ? data : (data.results ?? [])) as Employee[]
    },
    refetchInterval: 30000,
  })

  const employees = employeesQuery.data ?? []

  const formatDuration = (seconds: number | undefined) => {
    if (!seconds) return '0m'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
  }

  const formatTimeStr = (isoString: string | null) => {
    if (!isoString) return ''
    try {
      return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()
    } catch {
      return ''
    }
  }

  // Filter present and absent employees
  const presentEmployees = employees.filter((e) => e.active_session || e.session_login_time !== null)
  const absentEmployees = employees.filter((e) => !e.active_session && e.session_login_time === null)

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
          </div>
          <button className="btn-primary" onClick={() => setIsDownloadModalOpen(true)}>
            📥 Download Report
          </button>
        </div>

        {employeesQuery.isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>Loading attendance details...</div>
        ) : (
          <div className="attendance-columns">
            {/* Column 1: Present Employees */}
            <div className="glass-card card-soft" style={{ padding: '1.25rem', background: 'var(--panel)', borderRadius: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                <h4 style={{ margin: 0, color: '#10B981', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10B981' }} />
                  Present Employees ({presentEmployees.length})
                </h4>
              </div>
              <div className="table-wrap data-table-shell">
                <table style={{ width: '100%' }}>
                  <thead>
                    <tr style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase' }}>
                      <th>Photo</th>
                      <th>Emp ID</th>
                      <th>Name</th>
                      <th>Check-In</th>
                      <th>Session</th>
                    </tr>
                  </thead>
                  <tbody>
                    {presentEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: '1.5rem' }}>
                          No employees present today.
                        </td>
                      </tr>
                    ) : (
                      presentEmployees.map((emp) => (
                        <tr key={emp.employee_id}>
                          <td>
                            <img
                              src={emp.profile_photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(emp.name) + '&background=6B2FA0&color=fff'}
                              alt={emp.name}
                              style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                            />
                          </td>
                          <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>{emp.employee_id}</td>
                          <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>{emp.name}</td>
                          <td style={{ fontSize: '0.8rem', color: '#10B981', fontWeight: 600 }}>
                            {formatTimeStr(emp.session_login_time)}
                          </td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                            {emp.active_session ? '🟢 Still Active' : formatDuration(emp.session_duration_seconds)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Column 2: Absent Employees */}
            <div className="glass-card card-soft" style={{ padding: '1.25rem', background: 'var(--panel)', borderRadius: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                <h4 style={{ margin: 0, color: '#EF4444', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#EF4444' }} />
                  Absent Employees ({absentEmployees.length})
                </h4>
              </div>
              <div className="table-wrap data-table-shell">
                <table style={{ width: '100%' }}>
                  <thead>
                    <tr style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase' }}>
                      <th>Photo</th>
                      <th>Emp ID</th>
                      <th>Name</th>
                      <th>Department</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {absentEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: '1.5rem' }}>
                          No employees absent today.
                        </td>
                      </tr>
                    ) : (
                      absentEmployees.map((emp) => (
                        <tr key={emp.employee_id}>
                          <td>
                            <img
                              src={emp.profile_photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(emp.name) + '&background=6B2FA0&color=fff'}
                              alt={emp.name}
                              style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                            />
                          </td>
                          <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>{emp.employee_id}</td>
                          <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>{emp.name}</td>
                          <td style={{ fontSize: '0.85rem' }}>{emp.department || '—'}</td>
                          <td style={{ fontSize: '0.8rem', color: '#EF4444', fontWeight: 600 }}>
                            Absent
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
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
