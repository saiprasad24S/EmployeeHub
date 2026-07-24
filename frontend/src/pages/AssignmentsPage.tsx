import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { authedFetch } from '../lib/api'

type Employee = {
  id: number
  employee_id: string
  name: string
  email: string
  department: string
  designation: string
}

type Assignment = {
  id: number
  employee: number
  employee_name: string
  employee_employee_id: string
  patient_name: string
  patient_address: string
  latitude: string
  longitude: string
  radius: number
  visit_date: string
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  created_at: string
}

export function AssignmentsPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)

  // Form states
  const [employeeId, setEmployeeId] = useState<string>('')
  const [patientName, setPatientName] = useState('')
  const [patientAddress, setPatientAddress] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [radius, setRadius] = useState('100')
  const [visitDate, setVisitDate] = useState('')
  const [statusVal, setStatusVal] = useState<'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'>('PENDING')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Query employees for form dropdown selection
  const employeesQuery = useQuery({
    queryKey: ['employees-dropdown'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Missing token')
      const response = await authedFetch('/api/employees/', token)
      if (!response.ok) throw new Error('Unable to load employees')
      const data = await response.json()
      return (Array.isArray(data) ? data : (data.results ?? [])) as Employee[]
    },
  })

  // Query assignments list
  const assignmentsQuery = useQuery({
    queryKey: ['assignments-list'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Missing token')
      const response = await authedFetch('/api/assignments/', token)
      if (!response.ok) throw new Error('Unable to load assignments')
      const data = await response.json()
      return (data.results ?? []) as Assignment[]
    },
  })

  const assignments = assignmentsQuery.data ?? []
  const employees = employeesQuery.data ?? []

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: Omit<Assignment, 'id' | 'employee_name' | 'employee_employee_id' | 'created_at'>) => {
      const token = await getToken()
      if (!token) throw new Error('No auth token')
      const res = await authedFetch('/api/assignments/', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || JSON.stringify(errData) || 'Failed to create assignment')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments-list'] })
      closeForm()
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Operation failed')
    },
  })

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: async (payload: Assignment) => {
      const token = await getToken()
      if (!token) throw new Error('No auth token')
      const res = await authedFetch(`/api/assignments/${payload.id}/`, token, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || JSON.stringify(errData) || 'Failed to update assignment')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments-list'] })
      closeForm()
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Operation failed')
    },
  })

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const token = await getToken()
      if (!token) throw new Error('No auth token')
      const res = await authedFetch(`/api/assignments/${id}/`, token, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete assignment')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments-list'] })
    },
  })

  const openCreateForm = () => {
    setEditingAssignment(null)
    setEmployeeId(employees[0]?.id.toString() || '')
    setPatientName('')
    setPatientAddress('')
    setLatitude('12.9716') // default Bangalore coords
    setLongitude('77.5946')
    setRadius('0.1') // default to 0.1 km (100 meters)
    setVisitDate(new Date().toISOString().slice(0, 10))
    setStatusVal('PENDING')
    setErrorMsg(null)
    setIsFormOpen(true)
  }

  const openEditForm = (assignment: Assignment) => {
    setEditingAssignment(assignment)
    setEmployeeId(assignment.employee.toString())
    setPatientName(assignment.patient_name)
    setPatientAddress(assignment.patient_address)
    setLatitude(assignment.latitude)
    setLongitude(assignment.longitude)
    setRadius((assignment.radius / 1000).toString()) // convert stored meters back to km for form editing
    setVisitDate(assignment.visit_date)
    setStatusVal(assignment.status)
    setErrorMsg(null)
    setIsFormOpen(true)
  }

  const [isGeocoding, setIsGeocoding] = useState(false)

  const handleGeocode = async () => {
    if (!patientAddress.trim()) {
      setErrorMsg('Please enter an address first to auto-detect coordinates.')
      return
    }
    setIsGeocoding(true)
    setErrorMsg(null)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(patientAddress)}&limit=1`
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

  const closeForm = () => {
    setIsFormOpen(false)
    setEditingAssignment(null)
    setErrorMsg(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!employeeId || !patientName || !patientAddress || !latitude || !longitude || !radius || !visitDate) {
      setErrorMsg('Please fill in all fields.')
      return
    }

    const payload = {
      employee: parseInt(employeeId),
      patient_name: patientName,
      patient_address: patientAddress,
      latitude: latitude,
      longitude: longitude,
      radius: Math.round(parseFloat(radius) * 1000), // convert km input back to meters for database storage
      visit_date: visitDate,
      status: statusVal,
    }

    if (editingAssignment) {
      updateMutation.mutate({ ...editingAssignment, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this scheduled assignment?')) {
      deleteMutation.mutate(id)
    }
  }

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'badge success'
      case 'COMPLETED': return 'badge primary'
      case 'CANCELLED': return 'badge danger'
      default: return 'badge secondary'
    }
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="glass-card card-soft">
        <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="eyebrow">Scheduling</span>
            <h3>Patient Visit Assignments</h3>
            <p>Manage and assign visits, coordinates, and geofences for employees.</p>
          </div>
          <button className="btn-primary" onClick={openCreateForm}>
            ➕ Schedule New Visit
          </button>
        </div>

        {assignmentsQuery.isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>Loading assignments...</div>
        ) : (
          <div className="table-wrap data-table-shell">
            <table>
              <thead>
                <tr>
                  <th>Patient Name</th>
                  <th>Patient Address</th>
                  <th>Employee Assigned</th>
                  <th>Scheduled Date</th>
                  <th>Geofence Coordinates</th>
                  <th>Geofence Radius</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>
                      No visit assignments scheduled. Click "Schedule New Visit" to create one.
                    </td>
                  </tr>
                ) : (
                  assignments.map((assignment) => (
                    <tr key={assignment.id}>
                      <td style={{ fontWeight: 600 }}>{assignment.patient_name}</td>
                      <td>{assignment.patient_address}</td>
                      <td>
                        <span style={{ fontWeight: 500 }}>{assignment.employee_name}</span>
                        <br />
                        <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>ID: {assignment.employee_employee_id}</span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {new Date(assignment.visit_date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                        {parseFloat(assignment.latitude).toFixed(5)}, {parseFloat(assignment.longitude).toFixed(5)}
                      </td>
                      <td>{(assignment.radius / 1000).toFixed(2)} km</td>
                      <td>
                        <span className={getStatusClass(assignment.status)}>
                          {assignment.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="btn-secondary"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                            onClick={() => openEditForm(assignment)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn-secondary"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.08)', color: 'var(--danger)' }}
                            onClick={() => handleDelete(assignment.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Schedule Form Modal */}
      {isFormOpen && (
        <div className="camera-modal-backdrop">
          <div className="camera-modal" style={{ maxWidth: '500px', width: '100%', height: 'auto', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="camera-header">
              <h3 style={{ fontSize: '1.25rem' }}>
                {editingAssignment ? '✏️ Edit Visit Assignment' : '📅 Schedule Patient Visit'}
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

              <div className="stack" style={{ gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Select Employee</label>
                <select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  style={{
                    padding: '0.6rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    background: 'var(--panel)',
                    color: 'var(--text)',
                  }}
                >
                  <option value="" disabled>-- Select Employee --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.employee_id} - {emp.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div className="stack" style={{ gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Patient Name</label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
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
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Patient Address</label>
                <textarea
                  value={patientAddress}
                  onChange={(e) => setPatientAddress(e.target.value)}
                  placeholder="e.g. 5th Cross Road, Indiranagar, Bengaluru"
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
                  {isGeocoding ? '🔄 Locating...' : '📍 Auto-detect Latitude/Longitude'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="stack" style={{ gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Latitude</label>
                  <input
                    type="number"
                    step="0.0000001"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="e.g. 12.97159"
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
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Longitude</label>
                  <input
                    type="number"
                    step="0.0000001"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="e.g. 77.59456"
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
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Geofence Radius (km)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={radius}
                    onChange={(e) => setRadius(e.target.value)}
                    placeholder="e.g. 0.1"
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
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Visit Date</label>
                  <input
                    type="date"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
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

              {editingAssignment && (
                <div className="stack" style={{ gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Status</label>
                  <select
                    value={statusVal}
                    onChange={(e) => setStatusVal(e.target.value as any)}
                    style={{
                      padding: '0.6rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border)',
                      background: 'var(--panel)',
                      color: 'var(--text)',
                    }}
                  >
                    <option value="PENDING">Pending</option>
                    <option value="ACTIVE">Active</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              )}

              <div className="button-group-row" style={{ marginTop: '1rem' }}>
                <button type="button" className="btn-secondary" onClick={closeForm} disabled={createMutation.isPending || updateMutation.isPending}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
