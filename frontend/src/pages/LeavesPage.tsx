import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { useSearchParams } from 'react-router-dom'
import { AlertCircle, CheckCircle2, FileText, Clock, XCircle, Calendar } from 'lucide-react'
import { authedFetch } from '../lib/api'

export interface LeaveItem {
  id: number
  employee: number
  employee_id: string
  employee_name: string
  employee_email: string
  department: string
  designation: string
  leave_type: string
  leave_type_display: string
  start_date: string
  end_date: string
  total_days: number
  reason: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  rejection_reason?: string
  applied_at: string
  reviewed_at?: string | null
  reviewed_by?: number | null
  reviewed_by_name?: string | null
  created_at: string
  updated_at: string
}

export interface AdminLeavesResponse {
  summary: {
    total: number
    pending: number
    approved: number
    rejected: number
  }
  results: LeaveItem[]
}

export function LeavesPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const initialStatus = searchParams.get('status') || 'ALL'
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus.toUpperCase())
  const [departmentFilter, setDepartmentFilter] = useState<string>('')
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [startDateFilter, setStartDateFilter] = useState<string>('')
  const [endDateFilter, setEndDateFilter] = useState<string>('')

  // Modals state
  const [approvingLeave, setApprovingLeave] = useState<LeaveItem | null>(null)
  const [rejectingLeave, setRejectingLeave] = useState<LeaveItem | null>(null)
  const [rejectionReason, setRejectionReason] = useState<string>('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  const leavesQuery = useQuery({
    queryKey: [
      'admin-leaves',
      statusFilter,
      departmentFilter,
      leaveTypeFilter,
      searchQuery,
      startDateFilter,
      endDateFilter,
    ],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Missing token')

      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter)
      if (departmentFilter) params.append('department', departmentFilter)
      if (leaveTypeFilter) params.append('leave_type', leaveTypeFilter)
      if (searchQuery.trim()) params.append('q', searchQuery.trim())
      if (startDateFilter) params.append('start_date', startDateFilter)
      if (endDateFilter) params.append('end_date', endDateFilter)

      const res = await authedFetch(`/api/leaves/admin/?${params.toString()}`, token)
      if (!res.ok) throw new Error('Failed to load leave requests')
      return res.json() as Promise<AdminLeavesResponse>
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
  })

  const approveMutation = useMutation({
    mutationFn: async (leaveId: number) => {
      const token = await getToken()
      if (!token) throw new Error('Missing token')
      const res = await authedFetch(`/api/leaves/${leaveId}/approve/`, token, {
        method: 'PATCH',
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || 'Failed to approve leave request')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-leaves'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] })
      setActionSuccess('Leave request approved successfully.')
      setApprovingLeave(null)
      setTimeout(() => setActionSuccess(null), 4000)
    },
    onError: (err: any) => {
      setActionError(err.message || 'Operation failed')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async ({ leaveId, reason }: { leaveId: number; reason: string }) => {
      const token = await getToken()
      if (!token) throw new Error('Missing token')
      const res = await authedFetch(`/api/leaves/${leaveId}/reject/`, token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejection_reason: reason }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || 'Failed to reject leave request')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-leaves'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] })
      setActionSuccess('Leave request rejected successfully.')
      setRejectingLeave(null)
      setRejectionReason('')
      setTimeout(() => setActionSuccess(null), 4000)
    },
    onError: (err: any) => {
      setActionError(err.message || 'Operation failed')
    },
  })

  const handleStatusTabClick = (tab: string) => {
    setStatusFilter(tab)
    setSearchParams(tab === 'ALL' ? {} : { status: tab })
  }

  const leaves = useMemo(() => {
    const data = leavesQuery.data
    if (!data) return []
    if (Array.isArray(data.results)) return data.results
    if (Array.isArray(data)) return data
    return []
  }, [leavesQuery.data])

  // Extract distinct departments from leaves for filter dropdown
  const departments = useMemo(() => {
    const set = new Set<string>()
    leaves.forEach((l) => {
      if (l.department) set.add(l.department)
    })
    return Array.from(set).sort()
  }, [leaves])

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—'
    try {
      const [y, m, d] = dateStr.split('-')
      if (y && m && d) {
        const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
        return dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      }
      return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch {
      return dateStr
    }
  }

  const formatDateTime = (isoStr: string) => {
    if (!isoStr) return '—'
    try {
      return new Date(isoStr).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    } catch {
      return isoStr
    }
  }

  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 768 : false))

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const getStatusBadge = (statusVal: string) => {
    switch (statusVal) {
      case 'PENDING':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'rgba(245, 158, 11, 0.12)',
              color: '#D97706',
              padding: '0.3rem 0.75rem',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 700,
            }}
          >
            <Clock size={13} /> Pending
          </span>
        )
      case 'APPROVED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'rgba(34, 197, 94, 0.12)',
              color: '#16A34A',
              padding: '0.3rem 0.75rem',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 700,
            }}
          >
            <CheckCircle2 size={13} /> Approved
          </span>
        )
      case 'REJECTED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#DC2626',
              padding: '0.3rem 0.75rem',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 700,
            }}
          >
            <XCircle size={13} /> Rejected
          </span>
        )
      default:
        return <span>{statusVal}</span>
    }
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Top Banners */}
      {actionSuccess && (
        <div
          style={{
            background: 'rgba(34, 197, 94, 0.1)',
            color: '#16A34A',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '12px',
            padding: '0.85rem 1rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#DC2626',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            padding: '0.85rem 1rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{actionError}</span>
        </div>
      )}

      {/* Hero Overview Header */}
      <div className="glass-card card-soft" style={{ padding: '2rem' }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <span className="eyebrow" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', fontSize: '0.75rem' }}>
            LEAVE MANAGEMENT
          </span>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.2rem 0' }}>Employee Leave Requests</h3>
        </div>

        {/* Filter Controls Row */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((tab) => {
              const active = statusFilter === tab
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleStatusTabClick(tab)}
                  style={{
                    padding: '0.5rem 1.2rem',
                    borderRadius: '10px',
                    border: 'none',
                    background: active ? 'var(--primary)' : 'transparent',
                    color: active ? '#ffffff' : 'var(--muted)',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab === 'ALL' ? 'All Leaves' : tab.charAt(0) + tab.slice(1).toLowerCase()}
                </button>
              )
            })}
          </div>

          {/* Search and Dropdown Filters */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', alignItems: 'center' }}>
            {/* Search */}
            <input
              type="text"
              placeholder="Search employee / employee ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '0.65rem 1rem',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--panel)',
                color: 'var(--text)',
                fontSize: '0.85rem',
                width: '100%',
              }}
            />

            {/* Department Filter */}
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              style={{
                padding: '0.65rem 1rem',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--panel)',
                color: 'var(--text)',
                fontSize: '0.85rem',
                width: '100%',
              }}
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            {/* Leave Type Filter */}
            <select
              value={leaveTypeFilter}
              onChange={(e) => setLeaveTypeFilter(e.target.value)}
              style={{
                padding: '0.65rem 1rem',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--panel)',
                color: 'var(--text)',
                fontSize: '0.85rem',
                width: '100%',
              }}
            >
              <option value="">All Leave Types</option>
              <option value="CASUAL">Casual Leave</option>
              <option value="SICK">Sick Leave</option>
              <option value="MATERNITY_PATERNITY">Maternity / Paternity Leave</option>
              <option value="BEREAVEMENT">Bereavement Leave</option>
              <option value="UNPAID">Unpaid Leave</option>
            </select>

            {/* Date Filters */}
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <input
                type="date"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
                title="From Date"
                style={{
                  padding: '0.6rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--panel)',
                  color: 'var(--text)',
                  fontSize: '0.8rem',
                  width: '100%',
                }}
              />
              <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>to</span>
              <input
                type="date"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
                title="To Date"
                style={{
                  padding: '0.6rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--panel)',
                  color: 'var(--text)',
                  fontSize: '0.8rem',
                  width: '100%',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Leaves List / Table */}
      <div className="glass-card card-soft" style={{ padding: '1.5rem', overflowX: 'auto' }}>
        {leavesQuery.isLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
            Loading leave requests...
          </div>
        ) : leaves.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--muted)' }}>
            <FileText size={38} color="var(--muted)" style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
            <h4 style={{ margin: 0, fontWeight: 700, color: 'var(--text)' }}>
              {statusFilter === 'PENDING' ? 'No pending leave requests.' : 'No leave requests yet.'}
            </h4>
            <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.85rem' }}>
              {statusFilter === 'PENDING'
                ? 'All employee leave requests have been reviewed.'
                : 'Leave requests submitted by employees will appear here.'}
            </p>
          </div>
        ) : isMobile ? (
          /* Mobile Card View for Screens <= 768px */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {leaves.map((leave) => {
              const isPending = leave.status === 'PENDING'
              return (
                <div
                  key={leave.id}
                  style={{
                    background: 'var(--panel)',
                    border: '1px solid var(--border)',
                    borderRadius: '14px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.95rem' }}>
                        {leave.employee_name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600, marginTop: '0.15rem' }}>
                        {leave.employee_id} {leave.department ? `· ${leave.department}` : ''}
                      </div>
                    </div>
                    <div>{getStatusBadge(leave.status)}</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span
                      style={{
                        background: 'rgba(107, 47, 160, 0.08)',
                        color: 'var(--primary)',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                      }}
                    >
                      {leave.leave_type_display || leave.leave_type}
                    </span>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: 'var(--text)',
                        background: 'var(--accent-soft)',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '6px',
                      }}
                    >
                      {leave.total_days} {leave.total_days === 1 ? 'day' : 'days'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--text)', fontWeight: 500 }}>
                    <Calendar size={14} color="var(--primary)" />
                    <span>{formatDate(leave.start_date)}</span>
                    <span>→</span>
                    <span>{formatDate(leave.end_date)}</span>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: '1.4' }}>
                    <strong style={{ color: 'var(--text)', fontWeight: 600 }}>Reason: </strong>
                    "{leave.reason}"
                  </div>

                  {leave.status === 'REJECTED' && leave.rejection_reason && (
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: '#DC2626',
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        padding: '0.4rem 0.6rem',
                        borderRadius: '8px',
                      }}
                    >
                      <strong>Rejection reason:</strong> {leave.rejection_reason}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.6rem', borderTop: '1px solid var(--border)', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                      Applied {formatDate(leave.applied_at)}
                    </span>
                    {isPending ? (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setActionError(null)
                            setApprovingLeave(leave)
                          }}
                          style={{
                            background: '#16A34A',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '0.45rem 0.9rem',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                          }}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActionError(null)
                            setRejectionReason('')
                            setRejectingLeave(leave)
                          }}
                          style={{
                            background: 'rgba(239, 68, 68, 0.08)',
                            color: '#DC2626',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '8px',
                            padding: '0.45rem 0.9rem',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    ) : leave.reviewed_by_name ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                        Reviewed by {leave.reviewed_by_name}
                      </span>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* Desktop Table View */
          <table className="table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 0.5rem' }}>
            <thead>
              <tr style={{ color: 'var(--muted)', fontSize: '0.8rem', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 1rem' }}>EMPLOYEE</th>
                <th style={{ padding: '0.75rem 1rem' }}>LEAVE TYPE</th>
                <th style={{ padding: '0.75rem 1rem' }}>DATES & DURATION</th>
                <th style={{ padding: '0.75rem 1rem' }}>REASON</th>
                <th style={{ padding: '0.75rem 1rem' }}>APPLIED DATE</th>
                <th style={{ padding: '0.75rem 1rem' }}>STATUS</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {leaves.map((leave) => {
                const isPending = leave.status === 'PENDING'
                return (
                  <tr
                    key={leave.id}
                    style={{
                      background: 'var(--panel)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                      borderRadius: '12px',
                    }}
                  >
                    {/* Employee info */}
                    <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.95rem' }}>
                        {leave.employee_name}
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.2rem' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600 }}>
                          {leave.employee_id}
                        </span>
                        {leave.department && (
                          <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                            · {leave.department}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Leave Type */}
                    <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                      <span
                        style={{
                          background: 'rgba(107, 47, 160, 0.08)',
                          color: 'var(--primary)',
                          padding: '0.25rem 0.65rem',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                        }}
                      >
                        {leave.leave_type_display || leave.leave_type}
                      </span>
                    </td>

                    {/* Dates & Duration */}
                    <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>
                        {formatDate(leave.start_date)} — {formatDate(leave.end_date)}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
                        <strong>{leave.total_days}</strong> {leave.total_days === 1 ? 'day' : 'days'}
                      </div>
                    </td>

                    {/* Reason */}
                    <td style={{ padding: '1rem', verticalAlign: 'middle', maxWidth: '280px' }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: '0.85rem',
                          color: 'var(--text)',
                          wordBreak: 'break-word',
                          lineHeight: '1.4',
                        }}
                      >
                        "{leave.reason}"
                      </p>
                      {leave.status === 'REJECTED' && leave.rejection_reason && (
                        <div
                          style={{
                            marginTop: '0.35rem',
                            fontSize: '0.8rem',
                            color: '#DC2626',
                            background: 'rgba(239,68,68,0.06)',
                            padding: '0.3rem 0.5rem',
                            borderRadius: '6px',
                          }}
                        >
                          <strong>Rejection reason:</strong> {leave.rejection_reason}
                        </div>
                      )}
                    </td>

                    {/* Applied Date */}
                    <td style={{ padding: '1rem', verticalAlign: 'middle', fontSize: '0.85rem', color: 'var(--muted)' }}>
                      {formatDateTime(leave.applied_at)}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                      <div>{getStatusBadge(leave.status)}</div>
                      {leave.reviewed_by_name && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                          by {leave.reviewed_by_name}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                      {isPending ? (
                        <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setActionError(null)
                              setApprovingLeave(leave)
                            }}
                            style={{
                              background: '#16A34A',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '0.45rem 0.85rem',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActionError(null)
                              setRejectionReason('')
                              setRejectingLeave(leave)
                            }}
                            style={{
                              background: 'rgba(239, 68, 68, 0.08)',
                              color: '#DC2626',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              borderRadius: '8px',
                              padding: '0.45rem 0.85rem',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontStyle: 'italic' }}>
                          Processed
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Confirmation Modal for APPROVE */}
      {approvingLeave && (
        <div className="camera-modal-backdrop" style={{ zIndex: 9999 }}>
          <div
            className="camera-modal"
            style={{
              maxWidth: '460px',
              width: '90%',
              padding: '1.75rem',
              borderRadius: '20px',
              background: 'var(--panel)',
            }}
          >
            <h4 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.75rem 0', color: 'var(--text)' }}>
              Approve Leave Request?
            </h4>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', lineHeight: '1.5', margin: '0 0 1.25rem 0' }}>
              Are you sure you want to approve this leave request for{' '}
              <strong style={{ color: 'var(--text)' }}>{approvingLeave.employee_name}</strong> (
              {approvingLeave.employee_id})?
            </p>

            <div
              style={{
                background: 'var(--accent-soft)',
                borderRadius: '12px',
                padding: '1rem',
                marginBottom: '1.5rem',
                fontSize: '0.85rem',
              }}
            >
              <div>
                <strong>Leave Type:</strong> {approvingLeave.leave_type_display}
              </div>
              <div style={{ marginTop: '0.3rem' }}>
                <strong>Duration:</strong> {formatDate(approvingLeave.start_date)} to {formatDate(approvingLeave.end_date)} (
                {approvingLeave.total_days} {approvingLeave.total_days === 1 ? 'day' : 'days'})
              </div>
              <div style={{ marginTop: '0.3rem' }}>
                <strong>Reason:</strong> "{approvingLeave.reason}"
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={approveMutation.isPending}
                onClick={() => setApprovingLeave(null)}
                style={{ width: 'auto', padding: '0.6rem 1.2rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={approveMutation.isPending}
                onClick={() => approveMutation.mutate(approvingLeave.id)}
                style={{ width: 'auto', padding: '0.6rem 1.5rem', background: '#16A34A', border: 'none' }}
              >
                {approveMutation.isPending ? 'Approving...' : 'Yes, Approve Leave'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectingLeave && (
        <div className="camera-modal-backdrop" style={{ zIndex: 9999 }}>
          <div
            className="camera-modal"
            style={{
              maxWidth: '480px',
              width: '90%',
              padding: '1.75rem',
              borderRadius: '20px',
              background: 'var(--panel)',
            }}
          >
            <h4 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.75rem 0', color: '#DC2626' }}>
              Reject Leave Request
            </h4>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', lineHeight: '1.5', margin: '0 0 1.25rem 0' }}>
              Provide a reason for rejecting the leave request of{' '}
              <strong style={{ color: 'var(--text)' }}>{rejectingLeave.employee_name}</strong>:
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                Rejection Reason (Optional):
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Leave cannot be approved due to staffing requirements."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: '0.85rem',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={rejectMutation.isPending}
                onClick={() => setRejectingLeave(null)}
                style={{ width: 'auto', padding: '0.6rem 1.2rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rejectMutation.isPending}
                onClick={() => rejectMutation.mutate({ leaveId: rejectingLeave.id, reason: rejectionReason })}
                style={{
                  width: 'auto',
                  padding: '0.6rem 1.5rem',
                  background: '#DC2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
