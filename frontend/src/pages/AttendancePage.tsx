import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { authedFetch, API_BASE_URL } from '../lib/api'

type AttendanceRecord = {
  employee_employee_id: string
  employee_name: string
  attendance_type: string
  photo_url: string
  address: string
  timestamp: string
  status: string
}

type EmployeeSummary = {
  id: number
  employee_id: string
  name: string
  email: string
  profile_photo: string
  default_address: string
}

export function AttendancePage() {
  const { getToken } = useAuth()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  const employeesQuery = useQuery({
    queryKey: ['attendance-employees'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Missing token')
      const response = await authedFetch('/api/employees/', token)
      if (!response.ok) throw new Error('Unable to load employees')
      const data = await response.json()
      return (data.results ?? []) as EmployeeSummary[]
    },
  })

  const attendanceQuery = useQuery({
    queryKey: ['attendance-page'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Missing token')
      const response = await authedFetch('/api/attendance/', token)
      if (!response.ok) throw new Error('Unable to load attendance')
      return response.json() as Promise<AttendanceRecord[]>
    },
  })

  const employees = employeesQuery.data ?? []
  const attendance = attendanceQuery.data ?? []

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const presentEmployees = useMemo(() => employees.filter((employee) => {
    const todayRecords = attendance.filter((record) => record.employee_employee_id === employee.employee_id && record.timestamp.startsWith(today))
    return todayRecords.some((record) => record.attendance_type === 'CHECK_IN')
  }), [attendance, employees, today])

  const absentEmployees = useMemo(() => employees.filter((employee) => {
    const todayRecords = attendance.filter((record) => record.employee_employee_id === employee.employee_id && record.timestamp.startsWith(today))
    return !todayRecords.some((record) => record.attendance_type === 'CHECK_IN')
  }), [attendance, employees, today])

  const handleExport = async () => {
    if (!startDate || !endDate) {
      alert('Please choose a start and end date.')
      return
    }
    setIsExporting(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('Missing token')
      const response = await fetch(`${API_BASE_URL}/api/attendance/export?start_date=${startDate}&end_date=${endDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Unable to download attendance report')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `attendance_${startDate}_${endDate}.xlsx`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error: any) {
      alert(error.message || 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <section className="glass-card card-soft" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="section-header">
        <div>
          <span className="eyebrow">Attendance</span>
          <h3>Present and absent workforce</h3>
          <p>Review employee status at a glance with a scrollable roster for present and absent staff.</p>
        </div>
        <div className="glass-card" style={{ padding: '0.75rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          <button className="btn-primary" onClick={handleExport} disabled={isExporting}>
            {isExporting ? 'Downloading…' : 'Download Excel'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <div className="glass-card" style={{ padding: '1rem', maxHeight: '460px', overflowY: 'auto' }}>
          <h4 style={{ marginBottom: '0.8rem' }}>Present</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {presentEmployees.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>No employees are present today.</p>
            ) : presentEmployees.map((employee) => (
              <div key={employee.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem', border: '1px solid var(--panel-border)', borderRadius: '12px', background: 'rgba(34,197,94,0.06)' }}>
                <img src={employee.profile_photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(employee.name) + '&background=6B2FA0&color=fff'} alt={employee.name} style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{employee.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{employee.email}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{employee.employee_id}</div>
                </div>
                <div style={{ textAlign: 'right', color: '#10B981', fontWeight: 700, fontSize: '0.82rem' }}>Present</div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1rem', maxHeight: '460px', overflowY: 'auto' }}>
          <h4 style={{ marginBottom: '0.8rem' }}>Absent</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {absentEmployees.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>All employees are present today.</p>
            ) : absentEmployees.map((employee) => (
              <div key={employee.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem', border: '1px solid var(--panel-border)', borderRadius: '12px', background: 'rgba(239,68,68,0.06)' }}>
                <img src={employee.profile_photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(employee.name) + '&background=6B2FA0&color=fff'} alt={employee.name} style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{employee.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{employee.email}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{employee.employee_id}</div>
                </div>
                <div style={{ textAlign: 'right', color: '#EF4444', fontWeight: 700, fontSize: '0.82rem' }}>Absent</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
