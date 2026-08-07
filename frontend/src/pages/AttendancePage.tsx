import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { authedFetch, API_BASE_URL } from '../lib/api'

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
  is_present: boolean
  presence_status: string
}

export function AttendancePage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  // Download modal states
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false)
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))
  const [isDownloading, setIsDownloading] = useState(false)

  // Edit attendance modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedEmpIds, setSelectedEmpIds] = useState<number[]>([])
  const [dateMode, setDateMode] = useState<'SINGLE' | 'RANGE'>('SINGLE')
  const [editSingleDate, setEditSingleDate] = useState(new Date().toISOString().slice(0, 10))
  const [editFromDate, setEditFromDate] = useState(new Date().toISOString().slice(0, 10))
  const [editToDate, setEditToDate] = useState(new Date().toISOString().slice(0, 10))
  const [editStatus, setEditStatus] = useState<'PRESENT' | 'ABSENT'>('PRESENT')
  const [editTimeFrom, setEditTimeFrom] = useState('09:00')
  const [editTimeTo, setEditTimeTo] = useState('18:00')
  const [editRemarks, setEditRemarks] = useState('')
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)
  const [editMsg, setEditMsg] = useState<string | null>(null)

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
    staleTime: 15000,
    refetchInterval: 15000,
    placeholderData: (previousData) => previousData,
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
  const presentEmployees = employees.filter(
    (e) => e.is_present || e.presence_status === 'Present' || e.presence_status === 'Checked Out' || e.session_login_time !== null
  )
  const absentEmployees = employees.filter(
    (e) => !e.is_present && e.presence_status !== 'Present' && e.presence_status !== 'Checked Out' && e.session_login_time === null
  )

  const handleOpenEditModal = (emp?: Employee | null) => {
    setEditMsg(null)
    if (emp) {
      setSelectedEmpIds([emp.id])
    } else {
      setSelectedEmpIds([])
    }
    setIsEditModalOpen(true)
  }

  const handleToggleEmp = (id: number) => {
    setSelectedEmpIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  const handleSelectAllEmps = () => {
    if (selectedEmpIds.length === employees.length) {
      setSelectedEmpIds([])
    } else {
      setSelectedEmpIds(employees.map((e) => e.id))
    }
  }

  const submitEditAttendance = async () => {
    if (selectedEmpIds.length === 0) {
      alert('Please select at least one candidate.')
      return
    }

    setIsSubmittingEdit(true)
    setEditMsg(null)
    try {
      const token = await getToken()
      if (!token) throw new Error('No authentication token')

      const payload: any = {
        employee_ids: selectedEmpIds,
        status: editStatus,
        time_from: editTimeFrom,
        time_to: editTimeTo,
        remarks: editRemarks,
      }

      if (dateMode === 'SINGLE') {
        payload.date = editSingleDate
      } else {
        payload.start_date = editFromDate
        payload.end_date = editToDate
      }

      const res = await authedFetch('/api/attendance/manual-edit', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Failed to update attendance')
      }

      const data = await res.json()
      alert(data.detail || 'Attendance modified successfully!')
      queryClient.invalidateQueries({ queryKey: ['employees-attendance'] })
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      setIsEditModalOpen(false)
    } catch (err: any) {
      setEditMsg(err.message || 'Error saving attendance updates.')
    } finally {
      setIsSubmittingEdit(false)
    }
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
        `${API_BASE_URL}/api/attendance/export?start_date=${startDate}&end_date=${endDate}`,
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
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              className="btn-secondary"
              onClick={() => handleOpenEditModal(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontWeight: 600,
              }}
            >
              Edit Attendance
            </button>
            <button className="btn-primary" onClick={() => setIsDownloadModalOpen(true)}>
              Download Report
            </button>
          </div>
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
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {presentEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '1.5rem' }}>
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
                          <td style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                            {emp.presence_status === 'Present' ? (
                              <span style={{ color: '#10B981' }}>Active ({formatDuration(emp.session_duration_seconds)})</span>
                            ) : (
                              <span style={{ color: '#F59E0B' }}>Checked Out ({formatDuration(emp.session_duration_seconds)})</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn-secondary"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '6px' }}
                              onClick={() => handleOpenEditModal(emp)}
                            >
                              Edit
                            </button>
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
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {absentEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '1.5rem' }}>
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
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn-secondary"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '6px' }}
                              onClick={() => handleOpenEditModal(emp)}
                            >
                              Edit
                            </button>
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

      {/* Edit Attendance Modal */}
      {isEditModalOpen && (
        <div className="camera-modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="camera-modal" style={{ maxWidth: '540px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="camera-header" style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--panel)' }}>
              <h3 style={{ fontSize: '1.2rem', margin: 0 }}>
                Edit Candidate Attendance
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--muted)' }}
              >
                &times;
              </button>
            </div>

            {editMsg && (
              <div style={{ padding: '0.75rem 1.25rem', background: '#FEE2E2', color: '#991B1B', fontSize: '0.85rem', fontWeight: 600 }}>
                {editMsg}
              </div>
            )}

            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* 1. Candidate Selection */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>
                    Select Candidate(s) ({selectedEmpIds.length} selected)
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectAllEmps}
                    style={{ background: 'none', border: 'none', color: '#6366F1', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {selectedEmpIds.length === employees.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div
                  style={{
                    maxHeight: '130px',
                    overflowY: 'auto',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '0.4rem',
                    background: 'var(--panel)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                  }}
                >
                  {employees.map((emp) => (
                    <label
                      key={emp.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        fontSize: '0.85rem',
                        padding: '0.3rem 0.5rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        background: selectedEmpIds.includes(emp.id) ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedEmpIds.includes(emp.id)}
                        onChange={() => handleToggleEmp(emp.id)}
                      />
                      <img
                        src={emp.profile_photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(emp.name)}
                        alt={emp.name}
                        style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <span style={{ fontWeight: 600 }}>{emp.name}</span>
                      <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>({emp.employee_id})</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 2. Date Selection Mode */}
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: '0.4rem' }}>
                  Date Selection Mode
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className={dateMode === 'SINGLE' ? 'btn-primary' : 'btn-secondary'}
                    style={{ flex: 1, padding: '0.45rem', fontSize: '0.8rem' }}
                    onClick={() => setDateMode('SINGLE')}
                  >
                    Single Date
                  </button>
                  <button
                    type="button"
                    className={dateMode === 'RANGE' ? 'btn-primary' : 'btn-secondary'}
                    style={{ flex: 1, padding: '0.45rem', fontSize: '0.8rem' }}
                    onClick={() => setDateMode('RANGE')}
                  >
                    Multiple Dates / Date Range
                  </button>
                </div>
              </div>

              {/* Date Inputs */}
              {dateMode === 'SINGLE' ? (
                <div className="stack" style={{ gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Select Date</label>
                  <input
                    type="date"
                    value={editSingleDate}
                    onChange={(e) => setEditSingleDate(e.target.value)}
                    style={{
                      padding: '0.5rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--panel)',
                      color: 'var(--text)',
                    }}
                  />
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="stack" style={{ gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>From Date</label>
                    <input
                      type="date"
                      value={editFromDate}
                      onChange={(e) => setEditFromDate(e.target.value)}
                      style={{
                        padding: '0.5rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        background: 'var(--panel)',
                        color: 'var(--text)',
                      }}
                    />
                  </div>
                  <div className="stack" style={{ gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>To Date</label>
                    <input
                      type="date"
                      value={editToDate}
                      onChange={(e) => setEditToDate(e.target.value)}
                      style={{
                        padding: '0.5rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        background: 'var(--panel)',
                        color: 'var(--text)',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* 3. Attendance Status (Present / Absent) */}
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: '0.4rem' }}>
                  Mark Attendance Status
                </label>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <label
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem',
                      borderRadius: '8px',
                      border: editStatus === 'PRESENT' ? '2px solid #10B981' : '1px solid var(--border)',
                      background: editStatus === 'PRESENT' ? 'rgba(16, 185, 129, 0.1)' : 'var(--panel)',
                      color: editStatus === 'PRESENT' ? '#10B981' : 'var(--text)',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="status"
                      value="PRESENT"
                      checked={editStatus === 'PRESENT'}
                      onChange={() => setEditStatus('PRESENT')}
                      style={{ display: 'none' }}
                    />
                    Present
                  </label>
                  <label
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem',
                      borderRadius: '8px',
                      border: editStatus === 'ABSENT' ? '2px solid #EF4444' : '1px solid var(--border)',
                      background: editStatus === 'ABSENT' ? 'rgba(239, 68, 68, 0.1)' : 'var(--panel)',
                      color: editStatus === 'ABSENT' ? '#EF4444' : 'var(--text)',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="status"
                      value="ABSENT"
                      checked={editStatus === 'ABSENT'}
                      onChange={() => setEditStatus('ABSENT')}
                      style={{ display: 'none' }}
                    />
                    Absent
                  </label>
                </div>
              </div>

              {/* 4. Time From & Time To (If Present) */}
              {editStatus === 'PRESENT' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="stack" style={{ gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Time From (Check-In)</label>
                    <input
                      type="time"
                      value={editTimeFrom}
                      onChange={(e) => setEditTimeFrom(e.target.value)}
                      style={{
                        padding: '0.5rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        background: 'var(--panel)',
                        color: 'var(--text)',
                      }}
                    />
                  </div>
                  <div className="stack" style={{ gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Time To (Check-Out)</label>
                    <input
                      type="time"
                      value={editTimeTo}
                      onChange={(e) => setEditTimeTo(e.target.value)}
                      style={{
                        padding: '0.5rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        background: 'var(--panel)',
                        color: 'var(--text)',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Remarks */}
              <div className="stack" style={{ gap: '0.3rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Remarks (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Admin manual correction"
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  style={{
                    padding: '0.5rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--panel)',
                    color: 'var(--text)',
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div className="button-group-row" style={{ marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isSubmittingEdit}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={submitEditAttendance}
                  disabled={isSubmittingEdit}
                >
                  {isSubmittingEdit ? 'Saving...' : 'Save Attendance Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Date Range Download Modal */}
      {isDownloadModalOpen && (
        <div className="camera-modal-backdrop">
          <div className="camera-modal" style={{ maxWidth: '400px', width: '100%', height: 'auto' }}>
            <div className="camera-header">
              <h3 style={{ fontSize: '1.25rem' }}>Export Attendance Report</h3>
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
