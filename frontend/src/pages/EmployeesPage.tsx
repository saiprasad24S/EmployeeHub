import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { authedFetch } from '../lib/api'
import { RouteMap } from '../components/RouteMap'
import { useSearch } from '../context/SearchContext'

type Employee = {
  id: number
  employee_id: string
  name: string
  email: string
  phone: string
  department: string
  designation: string
  profile_photo: string
  default_address: string
  default_latitude?: string | number | null
  default_longitude?: string | number | null
  default_radius?: number | string | null
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
  presence_status?: string | null
  presence_is_active?: boolean | null
  presence_check_in_time?: string | null
  presence_session_duration_seconds?: number | null
}

type RoutePoint = {
  latitude: number
  longitude: number
}

type RouteData = {
  route: RoutePoint[]
  distance_covered_meters: number
  last_known_location?: { latitude: number; longitude: number; timestamp?: string; accuracy?: number } | null
}

const emptyEmployeeForm = {
  employee_id: '',
  name: '',
  email: '',
  phone: '',
  department: '',
  designation: '',
  default_address: '',
  default_latitude: '',
  default_longitude: '',
  default_radius: '0.1',
  is_active: true,
}

export function EmployeesPage() {
  const { getToken } = useAuth()
  const { searchQuery } = useSearch()
  const queryClient = useQueryClient()
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null)
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null)
  const [defaultAddressDraft, setDefaultAddressDraft] = useState('')
  const [defaultAddressCoordinates, setDefaultAddressCoordinates] = useState<{ latitude?: number | null; longitude?: number | null }>({})
  const [defaultRadiusDraft, setDefaultRadiusDraft] = useState<number | string>('0.1')
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [employeeForm, setEmployeeForm] = useState(emptyEmployeeForm)
  const [employeeFormError, setEmployeeFormError] = useState<string | null>(null)
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null)
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null)

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
      if (!response.ok) return { route: [] as RoutePoint[], distance_covered_meters: 0, last_known_location: null } as RouteData
      return response.json() as Promise<RouteData>
    },
  })

  const attendance = attendanceQuery.data ?? []
  const filteredEmployees = useMemo(() => {
    const employees = employeesQuery.data?.results ?? []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return employees
    return employees.filter((employee) => {
      return [employee.employee_id, employee.name, employee.email, employee.phone, employee.department, employee.default_address]
        .some((value) => (value ?? '').toLowerCase().includes(q))
    })
  }, [employeesQuery.data?.results, searchQuery])
  const employees = employeesQuery.data?.results ?? []

  const updateEmployeeAddress = useMutation({
    mutationFn: async ({ employeeId, address, latitude, longitude, radius }: { employeeId: number; address: string; latitude?: number | null; longitude?: number | null; radius?: number }) => {
      const token = await getToken()
      if (!token) throw new Error('Missing token')
      const response = await authedFetch(`/api/employees/${employeeId}/`, token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          default_address: address,
          default_latitude: latitude ?? null,
          default_longitude: longitude ?? null,
          default_radius: radius ?? 100,
        }),
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || 'Failed to update default address')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      setEditingEmployeeId(null)
      setDefaultAddressDraft('')
      setDefaultAddressCoordinates({})
      setDefaultRadiusDraft('0.1')
    },
  })

  const createEmployeeMutation = useMutation({
    mutationFn: async ({ payload, file }: { payload: Record<string, unknown>; file?: File | null }) => {
      const token = await getToken()
      if (!token) throw new Error('Missing token')
      const formData = new FormData()
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, value === true || value === false ? String(value) : String(value))
        }
      })
      if (file) {
        formData.append('profile_photo_file', file)
      }
      const response = await authedFetch('/api/employees/', token, {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || 'Failed to create employee')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      closeEmployeeModal()
    },
    onError: (error: any) => {
      setEmployeeFormError(error.message || 'Unable to create employee')
    },
  })

  const updateEmployeeMutation = useMutation({
    mutationFn: async ({ employeeId, payload, file }: { employeeId: number; payload: Record<string, unknown>; file?: File | null }) => {
      const token = await getToken()
      if (!token) throw new Error('Missing token')
      const formData = new FormData()
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, value === true || value === false ? String(value) : String(value))
        }
      })
      if (file) {
        formData.append('profile_photo_file', file)
      }
      const response = await authedFetch(`/api/employees/${employeeId}/`, token, {
        method: 'PATCH',
        body: formData,
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || 'Failed to update employee')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      closeEmployeeModal()
    },
    onError: (error: any) => {
      setEmployeeFormError(error.message || 'Unable to update employee')
    },
  })

  const getEmployeeAttendance = (empId: string) => {
    return attendance
      .filter((a) => a.employee_employee_id === empId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  const getPresenceSummary = (empId: string) => {
    const records = getEmployeeAttendance(empId)
    const latestRecord = records[0]
    const active = latestRecord?.presence_is_active === true
    const checkIn = latestRecord?.attendance_type === 'CHECK_IN' ? latestRecord : records.find((record) => record.attendance_type === 'CHECK_IN')
    const checkOut = latestRecord?.attendance_type === 'CHECK_OUT' ? latestRecord : records.find((record) => record.attendance_type === 'CHECK_OUT')
    return {
      active,
      status: active ? 'Present' : 'Absent',
      checkIn,
      checkOut,
    }
  }

  const openAddressEditor = (employee: Employee) => {
    setEditingEmployeeId(employee.id)
    setDefaultAddressDraft(employee.default_address || '')
    setDefaultAddressCoordinates({
      latitude: employee.default_latitude ? Number(employee.default_latitude) : null,
      longitude: employee.default_longitude ? Number(employee.default_longitude) : null,
    })
    setDefaultRadiusDraft(employee.default_radius ? String(Number(employee.default_radius) / 1000) : '0.1')
  }

  const saveAddress = (employee: Employee) => {
    updateEmployeeAddress.mutate({
      employeeId: employee.id,
      address: defaultAddressDraft,
      latitude: defaultAddressCoordinates.latitude ?? null,
      longitude: defaultAddressCoordinates.longitude ?? null,
      radius: Math.max(1, Number(defaultRadiusDraft) * 1000),
    })
  }

  useEffect(() => {
    const addressToGeocode = editingEmployee ? employeeForm.default_address : defaultAddressDraft
    if (!addressToGeocode?.trim()) {
      return
    }
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(addressToGeocode)}`)
        const data = (await response.json()) as Array<{ lat: string; lon: string }>
        if (data[0]) {
          const latitude = Number(data[0].lat)
          const longitude = Number(data[0].lon)
          setDefaultAddressCoordinates({ latitude, longitude })
          if (editingEmployee) {
            setEmployeeForm((current) => ({
              ...current,
              default_latitude: String(latitude),
              default_longitude: String(longitude),
            }))
          }
        }
      } catch {
        // Ignore geocoding failures and keep the typed address as-is.
      }
    }, 700)

    return () => window.clearTimeout(timer)
  }, [defaultAddressDraft, editingEmployee, employeeForm.default_address])

  const openCreateEmployeeModal = () => {
    setEditingEmployee(null)
    setEmployeeForm({ ...emptyEmployeeForm })
    setEmployeeFormError(null)
    setProfilePhotoFile(null)
    setProfilePhotoPreview(null)
    setIsEmployeeModalOpen(true)
  }

  const openEditEmployeeModal = (employee: Employee) => {
    setEditingEmployee(employee)
    setEmployeeForm({
      employee_id: employee.employee_id,
      name: employee.name,
      email: employee.email,
      phone: employee.phone || '',
      department: employee.department || '',
      designation: employee.designation || '',
      default_address: employee.default_address || '',
      default_latitude: employee.default_latitude ? String(employee.default_latitude) : '',
      default_longitude: employee.default_longitude ? String(employee.default_longitude) : '',
      default_radius: employee.default_radius ? String(Number(employee.default_radius) / 1000) : '0.1',
      is_active: employee.is_active,
    })
    setEmployeeFormError(null)
    setIsEmployeeModalOpen(true)
  }

  const closeEmployeeModal = () => {
    setIsEmployeeModalOpen(false)
    setEditingEmployee(null)
    setEmployeeForm({ ...emptyEmployeeForm })
    setEmployeeFormError(null)
    setProfilePhotoFile(null)
    setProfilePhotoPreview(null)
  }

  const handleEmployeeSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const payload = {
      employee_id: employeeForm.employee_id.trim(),
      name: employeeForm.name.trim(),
      email: employeeForm.email.trim(),
      phone: employeeForm.phone.trim(),
      department: employeeForm.department.trim(),
      designation: employeeForm.designation.trim(),
      default_address: employeeForm.default_address.trim(),
      default_latitude: employeeForm.default_latitude ? Number(employeeForm.default_latitude) : null,
      default_longitude: employeeForm.default_longitude ? Number(employeeForm.default_longitude) : null,
      default_radius: employeeForm.default_radius ? Number(employeeForm.default_radius) * 1000 : 100,
      is_active: employeeForm.is_active,
    }

    if (!payload.employee_id || !payload.name || !payload.email) {
      setEmployeeFormError('Employee ID, name, and email are required.')
      return
    }

    if (editingEmployee) {
      updateEmployeeMutation.mutate({ employeeId: editingEmployee.id, payload, file: profilePhotoFile })
    } else {
      createEmployeeMutation.mutate({ payload, file: profilePhotoFile })
    }
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
          <button className="btn-primary" onClick={openCreateEmployeeModal} style={{ padding: '0.5rem 0.9rem' }}>
            + Create Employee
          </button>
        </div>
        <div className="table-wrap data-table-shell">
          <table>
            <thead>
              <tr>
                <th>Photo</th>
                <th>Employee ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Department</th>
                <th>Default Address</th>
                <th>Current Status</th>
                <th>Session Details</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((employee) => {
                const { active, checkIn, checkOut } = getPresenceSummary(employee.employee_id)
                return (
                  <tr key={employee.employee_id}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.35rem' }}>
                        <img
                          src={employee.profile_photo || (checkIn?.photo_url) || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(employee.name) + '&background=6B2FA0&color=fff'}
                          alt={employee.name}
                          style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }}
                          onClick={() => setLightboxPhoto(employee.profile_photo || (checkIn?.photo_url) || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(employee.name) + '&background=6B2FA0&color=fff')}
                        />
                        <button className="btn-secondary" style={{ padding: '0.2rem 0.45rem', fontSize: '0.7rem' }} onClick={() => openEditEmployeeModal(employee)}>
                          Edit
                        </button>
                      </div>
                    </td>
                    <td>{employee.employee_id}</td>
                    <td style={{ fontWeight: 600 }}>{employee.name}</td>
                    <td>{employee.email}</td>
                    <td>{employee.phone || '—'}</td>
                    <td>{employee.department}</td>
                    <td style={{ maxWidth: '220px', color: 'var(--muted)' }}>
                      {editingEmployeeId === employee.id ? (
                        <div style={{ display: 'flex', gap: '0.4rem', flexDirection: 'column' }}>
                          <textarea
                            value={defaultAddressDraft}
                            onChange={(event) => setDefaultAddressDraft(event.target.value)}
                            rows={2}
                            style={{ minWidth: '220px', padding: '0.45rem', borderRadius: '10px', border: '1px solid var(--panel-border)', background: 'var(--panel)', color: 'var(--text)' }}
                          />
                          <div style={{ display: 'grid', gap: '0.65rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                              <input
                                type="number"
                                value={defaultAddressCoordinates.latitude ?? ''}
                                onChange={(event) => setDefaultAddressCoordinates((current) => ({
                                  ...current,
                                  latitude: event.target.value ? Number(event.target.value) : null,
                                }))}
                                placeholder="Latitude"
                                style={{ padding: '0.45rem', borderRadius: '10px', border: '1px solid var(--panel-border)', background: 'var(--panel)', color: 'var(--text)' }}
                              />
                              <input
                                type="number"
                                value={defaultAddressCoordinates.longitude ?? ''}
                                onChange={(event) => setDefaultAddressCoordinates((current) => ({
                                  ...current,
                                  longitude: event.target.value ? Number(event.target.value) : null,
                                }))}
                                placeholder="Longitude"
                                style={{ padding: '0.45rem', borderRadius: '10px', border: '1px solid var(--panel-border)', background: 'var(--panel)', color: 'var(--text)' }}
                              />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={defaultRadiusDraft}
                                onChange={(event) => setDefaultRadiusDraft(event.target.value)}
                                placeholder="Radius (km)"
                                style={{ padding: '0.45rem', borderRadius: '10px', border: '1px solid var(--panel-border)', background: 'var(--panel)', color: 'var(--text)' }}
                              />
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem', borderRadius: '10px', border: '1px solid var(--panel-border)', background: 'var(--panel)', color: 'var(--text)' }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                                  {defaultAddressCoordinates.latitude && defaultAddressCoordinates.longitude
                                    ? `Coords: ${defaultAddressCoordinates.latitude.toFixed(5)}, ${defaultAddressCoordinates.longitude.toFixed(5)}`
                                    : 'Coordinates will auto-update when address is valid.'}
                                </span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button className="btn-secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }} onClick={() => saveAddress(employee)}>
                                Save
                              </button>
                              <button className="btn-secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }} onClick={() => setEditingEmployeeId(null)}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <span>{employee.default_address || '—'}</span>
                          <button className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', width: 'fit-content' }} onClick={() => openAddressEditor(employee)}>
                            Edit Address
                          </button>
                        </div>
                      )}
                    </td>
                    <td>
                      <div>
                        <span style={{ color: active ? '#10B981' : 'var(--muted)', fontWeight: 600, fontSize: '0.85rem' }}>
                          {active ? '🟢 Present' : '🔴 Absent'}
                        </span>
                        <br />
                        <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                          {checkIn ? `Check-in ${new Date(checkIn.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'No check-in yet'}
                        </span>
                      </div>
                    </td>
                    <td>
                      {checkIn ? (
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                            📍 {checkIn.address || `${Number(checkIn.latitude).toFixed(4)}, ${Number(checkIn.longitude).toFixed(4)}`}
                          </span>
                          {checkOut ? (
                            <><br /><span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Checkout {new Date(checkOut.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span></>
                          ) : (
                            <><br /><span style={{ fontSize: '0.75rem', color: '#10B981' }}>Active session in progress</span></>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>No session recorded</span>
                      )}
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

      {isEmployeeModalOpen && (
        <div className="camera-modal-backdrop" onClick={closeEmployeeModal}>
          <div className="camera-modal" style={{ maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={(event) => event.stopPropagation()}>
            <div className="camera-header">
              <h3 style={{ fontSize: '1.1rem' }}>{editingEmployee ? 'Edit employee' : 'Create employee'}</h3>
              <button onClick={closeEmployeeModal} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--muted)' }}>
                &times;
              </button>
            </div>
            <form onSubmit={handleEmployeeSubmit} style={{ padding: '1rem 1.2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {employeeFormError && <div style={{ padding: '0.7rem', background: 'rgba(239,68,68,0.08)', color: 'var(--danger)', borderRadius: '8px' }}>{employeeFormError}</div>}
              <div style={{ display: 'grid', gap: '0.7rem' }}>
                <input value={employeeForm.employee_id} onChange={(event) => setEmployeeForm({ ...employeeForm, employee_id: event.target.value })} placeholder="Employee ID" style={inputStyle} />
                <input value={employeeForm.name} onChange={(event) => setEmployeeForm({ ...employeeForm, name: event.target.value })} placeholder="Name" style={inputStyle} />
                <input value={employeeForm.email} onChange={(event) => setEmployeeForm({ ...employeeForm, email: event.target.value })} placeholder="Email" type="email" style={inputStyle} />
                <input value={employeeForm.phone} onChange={(event) => setEmployeeForm({ ...employeeForm, phone: event.target.value })} placeholder="Phone" style={inputStyle} />
                <input value={employeeForm.department} onChange={(event) => setEmployeeForm({ ...employeeForm, department: event.target.value })} placeholder="Department" style={inputStyle} />
                <input value={employeeForm.designation} onChange={(event) => setEmployeeForm({ ...employeeForm, designation: event.target.value })} placeholder="Designation" style={inputStyle} />
                <textarea value={employeeForm.default_address} onChange={(event) => setEmployeeForm({ ...employeeForm, default_address: event.target.value })} placeholder="Default address" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem' }}>
                  <input value={employeeForm.default_latitude} onChange={(event) => setEmployeeForm({ ...employeeForm, default_latitude: event.target.value })} placeholder="Default latitude" style={inputStyle} />
                  <input value={employeeForm.default_longitude} onChange={(event) => setEmployeeForm({ ...employeeForm, default_longitude: event.target.value })} placeholder="Default longitude" style={inputStyle} />
                </div>
                <input value={employeeForm.default_radius} onChange={(event) => setEmployeeForm({ ...employeeForm, default_radius: event.target.value })} placeholder="Default radius (km)" style={inputStyle} />
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8rem', color: 'var(--muted)' }}>Profile photo</label>
                  <input type="file" accept="image/*" onChange={(event) => {
                    const file = event.target.files?.[0] ?? null
                    setProfilePhotoFile(file)
                    if (file) {
                      setProfilePhotoPreview(URL.createObjectURL(file))
                    } else {
                      setProfilePhotoPreview(editingEmployee?.profile_photo || null)
                    }
                  }} />
                  {(profilePhotoPreview || editingEmployee?.profile_photo) && (
                    <img src={profilePhotoPreview || editingEmployee?.profile_photo || ''} alt="Profile preview" style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', marginTop: '0.6rem' }} />
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.4rem' }}>
                <button type="button" className="btn-secondary" onClick={closeEmployeeModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={createEmployeeMutation.isPending || updateEmployeeMutation.isPending}>
                  {createEmployeeMutation.isPending || updateEmployeeMutation.isPending ? 'Saving…' : editingEmployee ? 'Save changes' : 'Create employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedEmployee && (
        <div className="glass-card card-soft" style={{ padding: '1.5rem' }}>
          <div className="section-header">
            <div>
              <span className="eyebrow">Employee Tracking</span>
              <h4>
                {selectedEmployee.name} ({selectedEmployee.employee_id}) — Today's Route
              </h4>
            </div>
            <button className="ghost-button" onClick={() => setSelectedEmployee(null)} style={{ padding: '0.4rem 0.8rem' }}>
              ✕ Close
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1rem' }}>
            <div style={{ height: '350px', borderRadius: '14px', overflow: 'hidden' }}>
              {routeQuery.isLoading ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--panel)', borderRadius: '14px' }}>
                  Loading route...
                </div>
              ) : (
                <RouteMap points={routeQuery.data?.route || []} lastKnownLocation={routeQuery.data?.last_known_location} />
              )}
            </div>

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
                          style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }}
                          onClick={() => setLightboxPhoto(record.photo_url)}
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

      {lightboxPhoto && (
        <div className="camera-modal-backdrop" onClick={() => setLightboxPhoto(null)}>
          <div className="camera-modal" style={{ maxWidth: '640px', width: 'min(94vw, 640px)' }} onClick={(event) => event.stopPropagation()}>
            <div className="camera-header">
              <h3 style={{ fontSize: '1.1rem' }}>Employee Photo</h3>
              <button onClick={() => setLightboxPhoto(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--muted)' }}>
                &times;
              </button>
            </div>
            <img src={lightboxPhoto} alt="Employee preview" style={{ width: '100%', maxHeight: '74vh', objectFit: 'contain', background: '#000' }} />
          </div>
        </div>
      )}
    </section>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '0.6rem 0.7rem',
  borderRadius: '10px',
  border: '1px solid var(--panel-border)',
  background: 'var(--panel)',
  color: 'var(--text)',
}
