import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { authedFetch } from '../lib/api'
import { useSearch } from '../context/SearchContext'
import { AlertCircle } from 'lucide-react'

type Employee = {
  id: number
  employee_id: string
  name: string
  email: string
  phone: string
  department: string
  designation: string
  profile_photo: string
  is_active: boolean
}

export function AllEmployeesPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const { searchQuery } = useSearch()

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const employeesQuery = useQuery({
    queryKey: ['all-employees'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Missing token')
      const response = await authedFetch('/api/employees/', token)
      if (!response.ok) throw new Error('Unable to load employees')
      const data = await response.json()
      return (Array.isArray(data) ? data : (data.results ?? [])) as Employee[]
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  })

  const rawEmployees = useMemo(() => Array.isArray(employeesQuery.data) ? employeesQuery.data : [], [employeesQuery.data])

  const employees = useMemo(() => {
    let filtered = rawEmployees
    
    if (statusFilter === 'active') {
      filtered = filtered.filter(emp => emp.is_active)
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter(emp => !emp.is_active)
    }

    if (!searchQuery.trim()) return filtered
    
    const query = searchQuery.toLowerCase().trim()
    return filtered.filter(
      (emp) =>
        Boolean(
          (emp.name && emp.name.toLowerCase().includes(query)) ||
          (emp.employee_id && emp.employee_id.toLowerCase().includes(query)) ||
          (emp.email && emp.email.toLowerCase().includes(query)) ||
          (emp.phone && emp.phone.toLowerCase().includes(query)) ||
          (emp.department && emp.department.toLowerCase().includes(query))
        )
    )
  }, [rawEmployees, searchQuery, statusFilter])

  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null)
  const [deleteRemark, setDeleteRemark] = useState('')

  // Delete Mutation (Permanent Delete)
  const deleteMutation = useMutation({
    mutationFn: async (payload: { id: number; remark: string }) => {
      const token = await getToken()
      if (!token) throw new Error('No auth token')
      const res = await authedFetch(`/api/employees/${payload.id}/?remark=${encodeURIComponent(payload.remark)}`, token, {
        method: 'DELETE',
      })
      if (!res.ok) {
        let message = 'Failed to delete employee'
        try {
           const errData = await res.json()
           if (errData.detail) message = errData.detail
        } catch {}
        throw new Error(message)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-employees'] })
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['employees-attendance'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] })
      setDeletingEmployee(null)
      setDeleteRemark('')
    },
    onError: (error: any) => {
      alert(`Deletion failed: ${error.message}`)
    }
  })

  // Activate Mutation (Re-activate inactive employee back to Active directory)
  const activateMutation = useMutation({
    mutationFn: async (id: number) => {
      const token = await getToken()
      if (!token) throw new Error('No auth token')
      const formData = new FormData()
      formData.append('is_active', 'true')
      const res = await authedFetch(`/api/employees/${id}/`, token, {
        method: 'PUT',
        body: formData,
      })
      if (!res.ok) throw new Error('Failed to activate employee')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-employees'] })
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['employees-attendance'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] })
    },
    onError: (error: any) => {
      alert(`Activation failed: ${error.message}`)
    }
  })

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="glass-card card-soft" style={{ padding: '2rem' }}>
        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span className="eyebrow" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', fontSize: '0.75rem' }}>
              DIRECTORY
            </span>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.2rem 0' }}>All Employees</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
              Complete record of all current and former employees.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)' }}>Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{
                padding: '0.4rem 0.7rem',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--panel)',
                color: 'var(--text)',
                fontSize: '0.85rem',
              }}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {employeesQuery.isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>Loading records...</div>
        ) : employeesQuery.isError ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#EF4444' }}>
            <AlertCircle size={24} style={{ margin: '0 auto 0.5rem' }} />
            Error loading employees.
          </div>
        ) : (
          <>
          <div className="emp-table-wrap table-wrap data-table-shell">
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 0.5rem' }}>
              <thead>
                <tr style={{ textTransform: 'uppercase', fontSize: '0.75rem', color: 'var(--muted)', letterSpacing: '0.04em' }}>
                  <th style={{ textAlign: 'center' }}>PHOTO</th>
                  <th>EMPLOYEE ID</th>
                  <th>NAME</th>
                  <th>EMAIL</th>
                  <th>PHONE</th>
                  <th>DEPARTMENT</th>
                  <th>DESIGNATION</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: 'center' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>
                      No employees found matching criteria.
                    </td>
                  </tr>
                ) : (
                  employees.map((employee) => (
                    <tr key={employee.employee_id} style={{ background: 'var(--panel)', borderRadius: '12px' }}>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.75rem' }}>
                        <img
                          src={employee.profile_photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(employee.name) + '&background=6B2FA0&color=fff'}
                          alt={employee.name}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(employee.name) + '&background=6B2FA0&color=fff'
                          }}
                          style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }}
                        />
                      </td>
                      <td style={{ fontWeight: 600, fontSize: '0.9rem' }}>{employee.employee_id}</td>
                      <td style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>{employee.name}</td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{employee.email}</td>
                      <td style={{ fontSize: '0.85rem' }}>{employee.phone || '—'}</td>
                      <td style={{ fontSize: '0.85rem' }}>{employee.department || '—'}</td>
                      <td style={{ fontSize: '0.85rem' }}>{employee.designation || '—'}</td>
                      <td style={{ verticalAlign: 'middle' }}>
                        {employee.is_active ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#10B981', fontWeight: 600, fontSize: '0.85rem', background: 'rgba(16,185,129,0.1)', padding: '0.2rem 0.5rem', borderRadius: '12px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} />
                            Active
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#EF4444', fontWeight: 600, fontSize: '0.85rem', background: 'rgba(239,68,68,0.1)', padding: '0.2rem 0.5rem', borderRadius: '12px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444' }} />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
                          {!employee.is_active && (
                            <button
                              onClick={() => activateMutation.mutate(employee.id)}
                              disabled={activateMutation.isPending}
                              style={{
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                background: 'rgba(16, 185, 129, 0.08)',
                                color: '#10B981',
                                borderRadius: '20px',
                                padding: '0.4rem 0.8rem',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                              }}
                              title="Re-activate employee back to active directory"
                            >
                              Activate
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setDeletingEmployee(employee)
                              setDeleteRemark('')
                            }}
                            style={{
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              background: 'rgba(239, 68, 68, 0.08)',
                              color: '#EF4444',
                              borderRadius: '20px',
                              padding: '0.4rem 0.8rem',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                            }}
                            title="Permanently delete profile"
                          >
                            Delete Profile
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="emp-card-list" style={{ display: 'none', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
            {employees.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>No employees found.</div>
            ) : employees.map((employee) => (
              <div key={employee.employee_id} style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)', borderRadius: '14px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <img
                    src={employee.profile_photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(employee.name) + '&background=6B2FA0&color=fff'}
                    alt={employee.name}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(employee.name) + '&background=6B2FA0&color=fff'
                    }}
                    style={{ width: '46px', height: '46px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{employee.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{employee.employee_id} · {employee.department || 'General'}</div>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600, fontSize: '0.78rem', color: employee.is_active ? '#10B981' : '#EF4444', flexShrink: 0 }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: employee.is_active ? '#10B981' : '#EF4444' }} />
                    {employee.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {employee.email} | {employee.phone || '—'}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                  {!employee.is_active && (
                    <button
                      onClick={() => activateMutation.mutate(employee.id)}
                      disabled={activateMutation.isPending}
                      style={{ border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '10px', padding: '0.3rem 0.7rem', fontSize: '0.78rem', cursor: 'pointer', color: '#10B981', fontWeight: 600 }}
                    >
                      Activate
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setDeletingEmployee(employee)
                      setDeleteRemark('')
                    }}
                    style={{ border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '10px', padding: '0.3rem 0.7rem', fontSize: '0.78rem', cursor: 'pointer', color: '#EF4444', fontWeight: 600 }}
                  >
                    Delete Profile
                  </button>
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>

      {deletingEmployee && (
        <div className="camera-modal-backdrop">
          <div className="camera-modal" style={{ maxWidth: '440px', width: '100%', height: 'auto' }}>
            <div className="camera-header">
              <h3 style={{ fontSize: '1.15rem', color: '#EF4444' }}>🗑️ Delete Employee Profile</h3>
              <button
                onClick={() => {
                  setDeletingEmployee(null)
                  setDeleteRemark('')
                }}
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
              <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>
                Are you sure you want to remove <strong>{deletingEmployee.name}</strong> (<code>{deletingEmployee.employee_id}</code>) from the employee directory?
              </p>

              <div className="stack" style={{ gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Deletion Remark / Reason (Required)</label>
                <textarea
                  value={deleteRemark}
                  onChange={(e) => setDeleteRemark(e.target.value)}
                  placeholder="e.g. Resigned on 20-Jul-2026 / Contract Ended / Discontinued"
                  rows={3}
                  style={{
                    padding: '0.6rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    background: 'var(--panel)',
                    color: 'var(--text)',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div className="button-group-row" style={{ marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setDeletingEmployee(null)
                    setDeleteRemark('')
                  }}
                  disabled={deleteMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ background: '#EF4444' }}
                  onClick={() => {
                    if (!deleteRemark.trim()) {
                      alert('Please type a deletion remark (e.g. Resigned, Contract ended, etc.)')
                      return
                    }
                    deleteMutation.mutate({ id: deletingEmployee.id, remark: deleteRemark })
                  }}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Confirm Deletion'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
