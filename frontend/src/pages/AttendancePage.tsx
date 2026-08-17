import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
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

  // Whole Month Attendance Calendar State
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1)
  const [selectedCalendarDates, setSelectedCalendarDates] = useState<string[]>([])

  // Candidate Search State
  const [candidateSearchQuery, setCandidateSearchQuery] = useState('')
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false)

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
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  })

  const employees = employeesQuery.data ?? []

  const activeEmpId = selectedEmpIds[0]
  const activeEmp = useMemo(() => employees.find((e) => e.id === activeEmpId), [employees, activeEmpId])

  const candidateMonthlyAttendanceQuery = useQuery({
    queryKey: ['candidate-month-attendance', activeEmp?.id, activeEmp?.employee_id, selectedYear, selectedMonth],
    enabled: isEditModalOpen && !!activeEmp,
    queryFn: async () => {
      const token = await getToken()
      if (!token || !activeEmp) return null
      const res = await authedFetch(
        `/api/attendance/employee-month?employee_id=${encodeURIComponent(activeEmp.employee_id)}&year=${selectedYear}&month=${selectedMonth}`,
        token
      )
      if (!res.ok) return null
      return res.json()
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  })

  const monthData = candidateMonthlyAttendanceQuery.data

  // Generate candidate calendar days grid matching Candidate Portal 100% identically
  const calendarGridItems = useMemo(() => {
    const yr = selectedYear
    const moIdx = selectedMonth - 1

    const firstDay = new Date(yr, moIdx, 1)
    const lastDay = new Date(yr, moIdx + 1, 0)

    const startingDayOfWeek = firstDay.getDay()
    const totalDays = lastDay.getDate()

    const presentDates = new Set(
      (monthData?.days || [])
        .filter((d: any) => d.status === 'PRESENT')
        .map((d: any) => d.date)
    )

    const now = new Date()
    const items: (any | null)[] = []

    // Leading empty weekday padding slots
    for (let i = 0; i < startingDayOfWeek; i++) {
      items.push(null)
    }

    for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
      const d = new Date(yr, moIdx, dayNum)
      const dateStr = d.toDateString()

      const padMonth = String(selectedMonth).padStart(2, '0')
      const padDay = String(dayNum).padStart(2, '0')
      const isoDateStr = `${yr}-${padMonth}-${padDay}`

      const isToday = dateStr === now.toDateString()
      const isPast = d < new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const isPastOrToday = isPast || isToday

      const isPresent = presentDates.has(isoDateStr)

      items.push({
        date: isoDateStr,
        dateStr,
        dayNumber: dayNum,
        day_number: dayNum,
        isToday,
        isPast,
        isPastOrToday,
        isPresent,
      })
    }

    return items
  }, [selectedYear, selectedMonth, monthData])

  const monthStats = useMemo(() => {
    const validDays = calendarGridItems.filter((item) => item !== null)
    const presentCount = validDays.filter((item) => item?.isPresent).length
    const totalCount = validDays.length
    const absentCount = totalCount - presentCount

    return {
      totalDays: totalCount,
      presentCount,
      absentCount,
      monthName: new Date(selectedYear, selectedMonth - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' }),
    }
  }, [calendarGridItems, selectedYear, selectedMonth])

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

  const filteredSearchEmployees = useMemo(() => {
    if (!candidateSearchQuery.trim()) return employees
    const q = candidateSearchQuery.toLowerCase().trim()
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.employee_id.toLowerCase().includes(q) ||
        (e.department && e.department.toLowerCase().includes(q))
    )
  }, [employees, candidateSearchQuery])

  const handleOpenEditModal = (emp?: Employee | null) => {
    setEditMsg(null)
    const targetEmp = emp || (employees.length > 0 ? employees[0] : null)
    if (targetEmp) {
      setSelectedEmpIds([targetEmp.id])
      setCandidateSearchQuery(`${targetEmp.name} (${targetEmp.employee_id})`)
    } else {
      setSelectedEmpIds([])
      setCandidateSearchQuery('')
    }
    setIsSearchDropdownOpen(false)
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

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12)
      setSelectedYear((y) => y - 1)
    } else {
      setSelectedMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1)
      setSelectedYear((y) => y + 1)
    } else {
      setSelectedMonth((m) => m + 1)
    }
  }

  const handleToggleCalendarDate = (dateStr: string) => {
    setSelectedCalendarDates((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr]
    )
  }

  const handleQuickMarkDateStatus = async (targetDates: string[], statusToSet: 'PRESENT' | 'ABSENT') => {
    if (selectedEmpIds.length === 0) {
      alert('Please select a candidate first.')
      return
    }
    if (targetDates.length === 0) {
      alert('Please select at least one date.')
      return
    }

    setIsSubmittingEdit(true)
    setEditMsg(null)
    try {
      const token = await getToken()
      if (!token) throw new Error('No authentication token')

      const payload: any = {
        employee_ids: selectedEmpIds,
        status: statusToSet,
        time_from: editTimeFrom,
        time_to: editTimeTo,
        remarks: editRemarks || `Manual ${statusToSet.toLowerCase()} update by admin`,
      }

      if (targetDates.length === 1) {
        payload.date = targetDates[0]
      } else {
        payload.start_date = targetDates[0]
        payload.end_date = targetDates[targetDates.length - 1]
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

      setEditMsg(`Successfully marked ${targetDates.length} date(s) as ${statusToSet}.`)
      setSelectedCalendarDates([])

      // Invalidate month attendance query and employee attendance table
      queryClient.invalidateQueries({ queryKey: ['candidate-month-attendance'] })
      queryClient.invalidateQueries({ queryKey: ['employees-attendance'] })
    } catch (err: any) {
      setEditMsg(err.message || 'Error updating attendance.')
    } finally {
      setIsSubmittingEdit(false)
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
      setEditMsg(data.detail || 'Attendance modified successfully!')

      // Invalidate month attendance query and employee attendance table
      queryClient.invalidateQueries({ queryKey: ['candidate-month-attendance'] })
      queryClient.invalidateQueries({ queryKey: ['employees-attendance'] })
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

      const response = await authedFetch(
        `/api/attendance/export?start_date=${startDate}&end_date=${endDate}`,
        token
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
          <div className="camera-modal" style={{ maxWidth: '840px', width: '95%', maxHeight: '92vh', overflowY: 'auto', borderRadius: '16px' }}>
            <div className="camera-header" style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--panel)', borderBottom: '1px solid var(--border)', padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 700 }}>
                  Edit Candidate Attendance & Monthly View
                </h3>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  style={{ background: 'none', border: 'none', fontSize: '1.6rem', cursor: 'pointer', color: 'var(--muted)' }}
                >
                  &times;
                </button>
              </div>
            </div>

            {editMsg && (
              <div style={{ padding: '0.75rem 1.25rem', background: 'rgba(16, 185, 129, 0.1)', color: '#065F46', fontSize: '0.85rem', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>
                {editMsg}
              </div>
            )}

            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Candidate Search Input Field */}
              <div style={{ position: 'relative' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: '0.4rem' }}>
                  Search Candidate
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Search candidate by name or ID (e.g. EMP001)..."
                    value={candidateSearchQuery}
                    onFocus={() => setIsSearchDropdownOpen(true)}
                    onChange={(e) => {
                      setCandidateSearchQuery(e.target.value)
                      setIsSearchDropdownOpen(true)
                    }}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.85rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border)',
                      background: 'var(--panel)',
                      color: 'var(--text)',
                      fontSize: '0.88rem',
                      fontWeight: 500,
                    }}
                  />
                  {candidateSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setCandidateSearchQuery('')
                        setIsSearchDropdownOpen(true)
                      }}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--muted)',
                        fontSize: '1.1rem',
                        cursor: 'pointer',
                      }}
                    >
                      &times;
                    </button>
                  )}
                </div>

                {/* Search Dropdown */}
                {isSearchDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 100,
                      marginTop: '4px',
                      maxHeight: '220px',
                      overflowY: 'auto',
                      background: 'var(--panel)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                      padding: '0.4rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                    }}
                  >
                    {filteredSearchEmployees.length === 0 ? (
                      <div style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
                        No candidates found matching "{candidateSearchQuery}"
                      </div>
                    ) : (
                      filteredSearchEmployees.map((emp) => {
                        const isSelected = selectedEmpIds.includes(emp.id)
                        return (
                          <div
                            key={emp.id}
                            onClick={() => {
                              setSelectedEmpIds([emp.id])
                              setCandidateSearchQuery(`${emp.name} (${emp.employee_id})`)
                              setIsSearchDropdownOpen(false)
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.5rem 0.75rem',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                              transition: 'background 0.12s ease',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <img
                                src={emp.profile_photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(emp.name)}
                                alt={emp.name}
                                style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                              />
                              <div>
                                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)' }}>{emp.name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{emp.employee_id} {emp.department ? `· ${emp.department}` : ''}</div>
                              </div>
                            </div>
                            {isSelected && (
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', background: 'rgba(107, 47, 160, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                                Selected
                              </span>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Candidate Info Bar & Month Navigator */}
              {selectedEmpIds.length > 0 && (
                <div style={{ background: 'var(--accent-soft)', padding: '1rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {monthData?.profile_photo && (
                        <img
                          src={monthData.profile_photo}
                          alt="Candidate"
                          style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }}
                        />
                      )}
                      <div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>
                          {monthData?.employee_name || employees.find((e) => e.id === selectedEmpIds[0])?.name}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                          Candidate ID: {monthData?.employee_id || employees.find((e) => e.id === selectedEmpIds[0])?.employee_id}
                        </div>
                      </div>
                    </div>

                    {/* Month Navigator */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--panel)', padding: '0.25rem 0.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <button
                        type="button"
                        onClick={handlePrevMonth}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: 700, padding: '0.2rem 0.5rem', color: 'var(--primary)' }}
                      >
                        ◀
                      </button>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>
                        {monthStats.monthName}
                      </span>
                      <button
                        type="button"
                        onClick={handleNextMonth}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: 700, padding: '0.2rem 0.5rem', color: 'var(--primary)' }}
                      >
                        ▶
                      </button>
                    </div>
                  </div>

                  {/* Summary Bar */}
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.82rem' }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#065F46', padding: '0.35rem 0.75rem', borderRadius: '6px', fontWeight: 700 }}>
                      Present: {monthStats.presentCount} Days
                    </div>
                    <div style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#991B1B', padding: '0.35rem 0.75rem', borderRadius: '6px', fontWeight: 700 }}>
                      Unmarked / Off: {monthStats.absentCount} Days
                    </div>
                    <div style={{ background: 'var(--panel)', color: 'var(--text)', padding: '0.35rem 0.75rem', borderRadius: '6px', fontWeight: 600, border: '1px solid var(--border)' }}>
                      Total Days: {monthStats.totalDays}
                    </div>
                  </div>
                </div>
              )}

              {/* Attendance Calendar (Exact Candidate Portal Style) */}
              <div className="glass-card card-soft" style={{ padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--panel)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', fontWeight: 700 }}>
                    Attendance Calendar
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', background: 'var(--bg)', padding: '0.35rem 0.75rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                      {monthStats.monthName}
                    </span>
                    <div style={{ display: 'flex', gap: '0.4rem', fontSize: '0.75rem' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const allDates = calendarGridItems
                            .filter((item): item is NonNullable<typeof item> => item !== null)
                            .map((d) => d.date)
                          setSelectedCalendarDates(allDates)
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Select All
                      </button>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => setSelectedCalendarDates([])}
                        style={{ background: 'none', border: 'none', color: 'var(--muted)', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Clear ({selectedCalendarDates.length})
                      </button>
                    </div>
                  </div>
                </div>

                {/* Day Name Headers (Sun..Sat) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', textAlign: 'center', marginBottom: '0.5rem' }}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                      {d}
                    </div>
                  ))}
                </div>

                {/* Days Grid (Exact Candidate Portal Component Style) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', maxHeight: '360px', overflowY: 'auto', paddingRight: '0.2rem' }}>
                    {calendarGridItems.map((item, idx) => {
                      if (!item) {
                        return <div key={`empty-${idx}`} style={{ minHeight: '58px', background: 'transparent' }} />
                      }

                      const isSelectedDate = selectedCalendarDates.includes(item.date)

                      return (
                        <div
                          key={item.date}
                          onClick={() => handleToggleCalendarDate(item.date)}
                          style={{
                            minHeight: '58px',
                            background: isSelectedDate ? 'rgba(99, 102, 241, 0.08)' : 'var(--panel)',
                            border: item.isToday
                              ? '2px solid var(--primary)'
                              : isSelectedDate
                              ? '2px solid #6366F1'
                              : '1px solid var(--border)',
                            borderRadius: '12px',
                            padding: '0.4rem',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span style={{ fontSize: '0.8rem', fontWeight: item.isToday ? 800 : 600 }}>
                            {item.dayNumber}
                          </span>

                          {item.isPastOrToday ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleQuickMarkDateStatus([item.date], item.isPresent ? 'ABSENT' : 'PRESENT')
                              }}
                              disabled={isSubmittingEdit}
                              title={`Click to toggle ${item.date} status (${item.isPresent ? 'Present' : 'Absent'})`}
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                width: '22px',
                                height: '22px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '50%',
                                border: 'none',
                                background: item.isPresent ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: item.isPresent ? '#10B981' : '#EF4444',
                                marginTop: '0.2rem',
                                cursor: 'pointer',
                              }}
                            >
                              {item.isPresent ? 'P' : 'A'}
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.2rem' }}>—</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
              </div>

              {/* Batch Action Bar */}
              <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>
                  Batch Edit Options {selectedCalendarDates.length > 0 && `(${selectedCalendarDates.length} Date(s) Selected)`}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="stack" style={{ gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>Check-In Time</label>
                    <input
                      type="time"
                      value={editTimeFrom}
                      onChange={(e) => setEditTimeFrom(e.target.value)}
                      style={{ padding: '0.45rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div className="stack" style={{ gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>Check-Out Time</label>
                    <input
                      type="time"
                      value={editTimeTo}
                      onChange={(e) => setEditTimeTo(e.target.value)}
                      style={{ padding: '0.45rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                <div className="stack" style={{ gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>Remarks (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Admin monthly attendance update"
                    value={editRemarks}
                    onChange={(e) => setEditRemarks(e.target.value)}
                    style={{ padding: '0.45rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.85rem' }}
                  />
                </div>

                {/* Batch Action Buttons */}
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedCalendarDates.length > 0) {
                        handleQuickMarkDateStatus(selectedCalendarDates, 'PRESENT')
                      } else {
                        submitEditAttendance()
                      }
                    }}
                    disabled={isSubmittingEdit}
                    style={{
                      flex: 1,
                      padding: '0.6rem',
                      borderRadius: '8px',
                      background: '#10B981',
                      color: '#FFF',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    {isSubmittingEdit ? 'Updating...' : selectedCalendarDates.length > 0 ? `Mark ${selectedCalendarDates.length} Selected Dates Present` : 'Mark Selected Candidate Present'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (selectedCalendarDates.length > 0) {
                        handleQuickMarkDateStatus(selectedCalendarDates, 'ABSENT')
                      } else {
                        setEditStatus('ABSENT')
                        submitEditAttendance()
                      }
                    }}
                    disabled={isSubmittingEdit}
                    style={{
                      flex: 1,
                      padding: '0.6rem',
                      borderRadius: '8px',
                      background: '#EF4444',
                      color: '#FFF',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    {isSubmittingEdit ? 'Updating...' : selectedCalendarDates.length > 0 ? `Mark ${selectedCalendarDates.length} Selected Dates Absent` : 'Mark Selected Candidate Absent'}
                  </button>
                </div>
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
