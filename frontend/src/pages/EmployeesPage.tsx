import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { authedFetch, API_BASE_URL } from '../lib/api'
import { useSearch } from '../context/SearchContext'
import { RouteMap } from '../components/RouteMap'

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
  is_face_registered: boolean
  default_address: string
  default_latitude: number | string | null
  default_longitude: number | string | null
  default_radius: number
  session_login_time: string | null
  session_logout_time: string | null
  session_duration_seconds: number
  active_session: boolean
  presence_status: string
}

type RoutePoint = {
  latitude: number
  longitude: number
}

export function EmployeesPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)

  // Form states
  const [empId, setEmpId] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [department, setDepartment] = useState('')
  const [designation, setDesignation] = useState('')
  const [defaultAddress, setDefaultAddress] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [radius, setRadius] = useState('100')
  const [isActive, setIsActive] = useState(true)
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null)

  const [isGeocoding, setIsGeocoding] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const employeesQuery = useQuery({
    queryKey: ['employees'],
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

  const { searchQuery } = useSearch()
  const rawEmployees = employeesQuery.data ?? []

  const employees = useMemo(() => {
    if (!searchQuery.trim()) return rawEmployees
    const query = searchQuery.toLowerCase().trim()
    return rawEmployees.filter(
      (emp) =>
        emp.name.toLowerCase().includes(query) ||
        emp.employee_id.toLowerCase().includes(query) ||
        emp.email.toLowerCase().includes(query) ||
        (emp.phone && emp.phone.toLowerCase().includes(query)) ||
        (emp.department && emp.department.toLowerCase().includes(query)) ||
        (emp.default_address && emp.default_address.toLowerCase().includes(query))
    )
  }, [rawEmployees, searchQuery])

  // Create/Update Mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: { formData: FormData; id?: number }) => {
      const token = await getToken()
      if (!token) throw new Error('No auth token')

      const url = payload.id ? `/api/employees/${payload.id}/` : '/api/employees/'
      const method = payload.id ? 'PUT' : 'POST'

      const res = await fetch(`${API_BASE_URL}${url}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: payload.formData,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || JSON.stringify(errData) || 'Failed to save employee')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['employees-attendance'] })
      closeForm()
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Operation failed')
    },
  })

  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null)
  const [deleteRemark, setDeleteRemark] = useState('')

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (payload: { id: number; remark: string }) => {
      const token = await getToken()
      if (!token) throw new Error('No auth token')
      const res = await authedFetch(`/api/employees/${payload.id}/?remark=${encodeURIComponent(payload.remark)}`, token, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete employee')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['employees-attendance'] })
      setDeletingEmployee(null)
      setDeleteRemark('')
    },
  })

  const openCreateForm = () => {
    setEditingEmployee(null)
    setEmpId('')
    setName('')
    setEmail('')
    setPhone('')
    setDepartment('')
    setDesignation('')
    setDefaultAddress('')
    setLatitude('')
    setLongitude('')
    setRadius('100')
    setIsActive(true)
    setProfilePhotoFile(null)
    setErrorMsg(null)
    setIsFormOpen(true)
  }

  const openEditForm = (employee: Employee) => {
    setEditingEmployee(employee)
    setEmpId(employee.employee_id)
    setName(employee.name)
    setEmail(employee.email)
    setPhone(employee.phone || '')
    setDepartment(employee.department || '')
    setDesignation(employee.designation || '')
    setDefaultAddress(employee.default_address || '')
    setLatitude(employee.default_latitude ? String(employee.default_latitude) : '')
    setLongitude(employee.default_longitude ? String(employee.default_longitude) : '')
    setRadius(String(employee.default_radius ?? 100))
    setIsActive(employee.is_active)
    setProfilePhotoFile(null)
    setErrorMsg(null)
    setIsFormOpen(true)
  }

  const closeForm = () => {
    setIsFormOpen(false)
    setEditingEmployee(null)
    setProfilePhotoFile(null)
    setErrorMsg(null)
  }

  const handleGeocode = async () => {
    if (!defaultAddress.trim()) {
      setErrorMsg('Please enter an address first to auto-detect coordinates.')
      return
    }
    setIsGeocoding(true)
    setErrorMsg(null)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(defaultAddress)}&limit=1`
      )
      if (!res.ok) throw new Error('Geocoding service unavailable.')
      const data = await res.json()
      if (data && data.length > 0) {
        setLatitude(parseFloat(data[0].lat).toFixed(7))
        setLongitude(parseFloat(data[0].lon).toFixed(7))
      } else {
        setErrorMsg('Could not find coordinates for this address. Please enter them manually.')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to auto-detect coordinates.')
    } finally {
      setIsGeocoding(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!empId || !name || !email) {
      setErrorMsg('Employee ID, Name, and Email are required.')
      return
    }

    const formData = new FormData()
    formData.append('employee_id', empId)
    formData.append('name', name)
    formData.append('email', email)
    formData.append('phone', phone)
    formData.append('department', department)
    formData.append('designation', designation)
    formData.append('default_address', defaultAddress)
    if (latitude) formData.append('default_latitude', latitude)
    if (longitude) formData.append('default_longitude', longitude)
    formData.append('default_radius', radius)
    formData.append('is_active', String(isActive))

    if (profilePhotoFile) {
      formData.append('profile_photo_file', profilePhotoFile)
    }

    saveMutation.mutate({ formData, id: editingEmployee?.id })
  }

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this employee profile?')) {
      deleteMutation.mutate({ id, remark: 'Manual deletion' })
    }
  }

  const formatTimeStr = (isoString: string | null) => {
    if (!isoString) return ''
    try {
      return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()
    } catch {
      return ''
    }
  }

  const formatDuration = (seconds: number | undefined) => {
    if (!seconds) return '0m'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="glass-card card-soft" style={{ padding: '2rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <span className="eyebrow" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', fontSize: '0.75rem' }}>
            EMPLOYEES
          </span>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.2rem 0' }}>Workforce Overview</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
            All employees with their attendance status, login/logout times, and location tracking.
          </p>
        </div>

        {/* Purple Banner Button across top of table */}
        <button
          onClick={openCreateForm}
          style={{
            width: '100%',
            padding: '0.9rem',
            background: '#6B2FA0',
            color: '#ffffff',
            border: 'none',
            borderRadius: '14px',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
            marginBottom: '1.5rem',
            boxShadow: '0 4px 14px rgba(107, 47, 160, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            transition: 'transform 0.2s ease',
          }}
        >
          + Create Employee
        </button>

        {employeesQuery.isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>Loading workforce...</div>
        ) : (
          <div className="table-wrap data-table-shell">
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 0.5rem' }}>
              <thead>
                <tr style={{ textTransform: 'uppercase', fontSize: '0.75rem', color: 'var(--muted)', letterSpacing: '0.04em' }}>
                  <th style={{ textAlign: 'center' }}>PHOTO</th>
                  <th>EMPLOYEE ID</th>
                  <th>NAME</th>
                  <th>EMAIL</th>
                  <th>PHONE</th>
                  <th>DEPARTMENT</th>
                  <th style={{ textAlign: 'center' }}>DEFAULT ADDRESS</th>
                  <th>CURRENT STATUS</th>
                  <th>SESSION DETAILS</th>
                  <th style={{ textAlign: 'center' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>
                      No employees registered. Click "+ Create Employee" above to add one.
                    </td>
                  </tr>
                ) : (
                  employees.map((employee) => {
                    const isPresent = employee.active_session || employee.session_login_time !== null
                    const loginTime = formatTimeStr(employee.session_login_time)
                    const logoutTime = formatTimeStr(employee.session_logout_time)

                    return (
                      <tr key={employee.employee_id} style={{ background: 'var(--panel)', borderRadius: '12px' }}>
                        {/* PHOTO */}
                        <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.75rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                            <img
                              src={employee.profile_photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(employee.name) + '&background=6B2FA0&color=fff'}
                              alt={employee.name}
                              style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }}
                            />
                            <button
                              onClick={() => openEditForm(employee)}
                              style={{
                                border: '1px solid var(--border)',
                                background: 'var(--panel)',
                                borderRadius: '12px',
                                padding: '0.15rem 0.5rem',
                                fontSize: '0.7rem',
                                cursor: 'pointer',
                                color: 'var(--text)'
                              }}
                            >
                              Edit
                            </button>
                          </div>
                        </td>

                        {/* EMPLOYEE ID */}
                        <td style={{ fontWeight: 600, fontSize: '0.9rem' }}>{employee.employee_id}</td>

                        {/* NAME */}
                        <td style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>{employee.name}</td>

                        {/* EMAIL */}
                        <td style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{employee.email}</td>

                        {/* PHONE */}
                        <td style={{ fontSize: '0.85rem' }}>{employee.phone || '—'}</td>

                        {/* DEPARTMENT */}
                        <td style={{ fontSize: '0.85rem' }}>{employee.department || '—'}</td>

                        {/* DEFAULT ADDRESS */}
                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--muted)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={employee.default_address}>
                              {employee.default_address || '—'}
                            </span>
                            <button
                              onClick={() => openEditForm(employee)}
                              style={{
                                border: '1px solid var(--border)',
                                background: 'var(--panel)',
                                borderRadius: '12px',
                                padding: '0.2rem 0.6rem',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                color: 'var(--text)'
                              }}
                            >
                              Edit Address
                            </button>
                          </div>
                        </td>

                        {/* CURRENT STATUS */}
                        <td style={{ verticalAlign: 'middle' }}>
                          {isPresent ? (
                            <div>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#10B981', fontWeight: 600, fontSize: '0.85rem' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
                                Present
                              </span>
                              {loginTime && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
                                  Check-in {loginTime}
                                </div>
                              )}
                              {logoutTime && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.1rem', fontWeight: 500 }}>
                                  Checked out {logoutTime} ({formatDuration(employee.session_duration_seconds)})
                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#EF4444', fontWeight: 600, fontSize: '0.85rem' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444' }} />
                                Absent
                              </span>
                              {logoutTime && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.1rem', fontWeight: 500 }}>
                                  Checked out {logoutTime} ({formatDuration(employee.session_duration_seconds)})
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* SESSION DETAILS */}
                        <td style={{ verticalAlign: 'middle', fontSize: '0.75rem', color: 'var(--muted)' }}>
                          {isPresent ? (
                            <div>
                              <div>📍 Location verified via portal</div>
                              <div>
                                {employee.active_session
                                  ? 'Active working session'
                                  : logoutTime
                                  ? `Checkout ${logoutTime}`
                                  : ''}
                              </div>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>

                        {/* ACTIONS */}
                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                          <button
                            onClick={() => setSelectedEmployee(selectedEmployee?.id === employee.id ? null : employee)}
                            style={{
                              border: '1px solid var(--border)',
                              background: 'var(--panel)',
                              borderRadius: '20px',
                              padding: '0.4rem 0.9rem',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              color: 'var(--text)',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                            }}
                          >
                            📍 {selectedEmployee?.id === employee.id ? 'Close' : 'Track'}
                          </button>
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

      {/* Selected Employee Route History */}
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
              style={{ padding: '0.4rem 0.8rem', width: 'auto' }}
            >
              ✕ Close
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1rem' }}>
            <div style={{ height: '350px', borderRadius: '14px', overflow: 'hidden' }}>
              {routeQuery.isLoading ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--panel)' }}>
                  Loading track...
                </div>
              ) : (
                <RouteMap points={routeQuery.data?.route || []} />
              )}
            </div>

            <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div style={{ background: 'var(--accent-soft)', padding: '1rem', borderRadius: '12px' }}>
                <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary)' }}>Geofence Configuration</h5>
                <p style={{ margin: '0.2rem 0', fontSize: '0.875rem' }}>
                  <strong>Default Address:</strong> {selectedEmployee.default_address || 'Not set'}
                </p>
                <p style={{ margin: '0.2rem 0', fontSize: '0.875rem' }}>
                  <strong>Coordinates:</strong> {selectedEmployee.default_latitude ? `${selectedEmployee.default_latitude}, ${selectedEmployee.default_longitude}` : 'Not set'}
                </p>
                <p style={{ margin: '0.2rem 0', fontSize: '0.875rem' }}>
                  <strong>Radius:</strong> {selectedEmployee.default_radius ? (selectedEmployee.default_radius > 10 ? (selectedEmployee.default_radius / 1000).toFixed(1) : selectedEmployee.default_radius) : 0.1} km
                </p>
              </div>

              {routeQuery.data && routeQuery.data.distance_covered_meters > 0 && (
                <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '1rem', borderRadius: '12px', color: '#10B981' }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>
                    📏 Distance Traveled Today: {(routeQuery.data.distance_covered_meters / 1000).toFixed(2)} km
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Roster Edit/Create Modal */}
      {isFormOpen && (
        <div className="camera-modal-backdrop">
          <div className="camera-modal" style={{ maxWidth: '520px', width: '100%', height: 'auto', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="camera-header">
              <h3 style={{ fontSize: '1.25rem' }}>
                {editingEmployee ? '✏️ Edit Employee Profile' : '👤 Register New Employee'}
              </h3>
              <button
                onClick={closeForm}
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

            <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {errorMsg && (
                <div style={{ padding: '0.8rem', background: 'rgba(239, 68, 68, 0.08)', color: 'var(--danger)', borderRadius: '8px', fontSize: '0.85rem' }}>
                  ⚠️ {errorMsg}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="stack" style={{ gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Employee ID</label>
                  <input
                    type="text"
                    value={empId}
                    onChange={(e) => setEmpId(e.target.value)}
                    placeholder="e.g. EMP005"
                    disabled={!!editingEmployee}
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
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Priyan Bose"
                    style={{
                      padding: '0.6rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border)',
                      background: 'var(--panel)',
                      color: 'var(--text)',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="stack" style={{ gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. priyan@gmail.com"
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
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +91 9876543210"
                    style={{
                      padding: '0.6rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border)',
                      background: 'var(--panel)',
                      color: 'var(--text)',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="stack" style={{ gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Department</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Healthcare"
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
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Designation</label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Senior Nurse"
                    style={{
                      padding: '0.6rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border)',
                      background: 'var(--panel)',
                      color: 'var(--text)',
                    }}
                  />
                </div>
              </div>

              <div className="stack" style={{ gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Default Address</label>
                <textarea
                  value={defaultAddress}
                  onChange={(e) => setDefaultAddress(e.target.value)}
                  placeholder="e.g. Madhapur, Hyderabad"
                  rows={2}
                  style={{
                    padding: '0.6rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    background: 'var(--panel)',
                    color: 'var(--text)',
                    resize: 'vertical',
                  }}
                />
                <button
                  type="button"
                  onClick={handleGeocode}
                  disabled={isGeocoding}
                  style={{
                    alignSelf: 'flex-start',
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.8rem',
                    borderRadius: '8px',
                    background: 'rgba(107, 47, 160, 0.08)',
                    color: 'var(--primary)',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    marginTop: '0.2rem'
                  }}
                >
                  {isGeocoding ? '🔄 Locating...' : '📍 Auto-detect Coordinates'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="stack" style={{ gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Latitude</label>
                  <input
                    type="number"
                    step="0.0000001"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="e.g. 17.4483"
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
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Longitude</label>
                  <input
                    type="number"
                    step="0.0000001"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="e.g. 78.3915"
                    style={{
                      padding: '0.6rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border)',
                      background: 'var(--panel)',
                      color: 'var(--text)',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="stack" style={{ gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Geofence Radius (km)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={radius}
                    onChange={(e) => setRadius(e.target.value)}
                    placeholder="e.g. 0.1 or 1"
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
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Profile Picture File</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        setProfilePhotoFile(e.target.files[0])
                      }
                    }}
                    style={{
                      padding: '0.5rem',
                      fontSize: '0.85rem',
                      color: 'var(--text)',
                    }}
                  />
                </div>
              </div>

              <div className="stack" style={{ gap: '0.4rem', flexDirection: 'row', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  id="isActiveCheck"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="isActiveCheck" style={{ fontSize: '0.9rem', cursor: 'pointer', userSelect: 'none' }}>
                  Active Profile Status
                </label>
              </div>

              <div className="button-group-row" style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {editingEmployee ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ background: 'rgba(239, 68, 68, 0.08)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.3)', width: 'auto', padding: '0.6rem 1rem' }}
                    onClick={() => {
                      const empToDelete = editingEmployee
                      closeForm()
                      setDeletingEmployee(empToDelete)
                      setDeleteRemark('')
                    }}
                  >
                    🗑️ Delete Profile
                  </button>
                ) : <div />}
                <div style={{ display: 'flex', gap: '0.75rem', width: 'auto' }}>
                  <button type="button" className="btn-secondary" onClick={closeForm} disabled={saveMutation.isPending} style={{ width: 'auto' }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={saveMutation.isPending} style={{ width: 'auto' }}>
                    {saveMutation.isPending ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Employee Remark Modal */}
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
