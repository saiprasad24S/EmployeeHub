import { useEffect, useRef, useState } from 'react'
import { SignOutButton, useAuth } from '@clerk/clerk-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authedFetch } from '../lib/api'
import { RouteMap } from '../components/RouteMap'

type SessionSummary = {
  active_session?: boolean
  check_in_time?: string | null
  check_out_time?: string | null
  session_duration_seconds?: number | null
  is_present?: boolean
  status?: string
}

type EmployeeData = {
  id: number
  employee_id: string
  name: string
  email: string
  department: string
  designation: string
  profile_photo: string
  default_address?: string
  default_radius?: number
  default_latitude?: number | string | null
  default_longitude?: number | string | null
  active_session?: boolean
}

type ProfileResponse = {
  employee: EmployeeData
  role: 'EMPLOYEE' | 'ADMIN'
  requires_face_registration: boolean
  active_session: boolean
  session_summary?: SessionSummary
}

type AssignmentData = {
  id: number
  patient_name: string
  patient_address: string
  latitude: string
  longitude: string
  radius: number
  status: string
}

export function EmployeePortal() {
  const { getToken, signOut } = useAuth()
  const queryClient = useQueryClient()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [currentTime, setCurrentTime] = useState(new Date())
  const [attendanceError, setAttendanceError] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const profileQuery = useQuery({
    queryKey: ['employee-portal-profile'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Missing token')
      const res = await authedFetch('/api/auth/login', token, { method: 'POST' })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || 'Failed to fetch employee profile')
      }
      return res.json() as Promise<ProfileResponse>
    },
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  })

  const profile = profileQuery.data?.employee ?? null
  const requiresFaceReg = profileQuery.data?.requires_face_registration ?? false
  const sessionActive = Boolean(
    profileQuery.data?.session_summary?.active_session ??
    profileQuery.data?.active_session ??
    profileQuery.data?.session_summary?.is_present,
  )
  const profileIsPresent =
    profileQuery.data?.session_summary?.active_session ??
    profileQuery.data?.active_session ??
    profileQuery.data?.session_summary?.is_present ??
    false

  // Camera capture state
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [cameraMode, setCameraMode] = useState<'register' | 'checkin' | 'checkout'>('checkin')
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]) // base64 strings
  const [tempPhoto, setTempPhoto] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [locationPermGranted, setLocationPermGranted] = useState<boolean | null>(null)
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const updatePermissionState = async () => {
    if (!('permissions' in navigator)) {
      return
    }

    try {
      const status = await navigator.permissions.query({ name: 'geolocation' })
      if (status.state === 'granted') {
        setLocationPermGranted(true)
      } else if (status.state === 'denied') {
        setLocationPermGranted(false)
      } else {
        setLocationPermGranted(null)
      }
      status.onchange = () => {
        if (status.state === 'granted') {
          setLocationPermGranted(true)
        } else if (status.state === 'denied') {
          setLocationPermGranted(false)
        } else {
          setLocationPermGranted(null)
        }
      }
    } catch {
      // Permissions API unsupported or inaccessible; rely on actual position checks.
    }
  }

  const ensureLocationPermission = async () => {
    if (!('geolocation' in navigator)) {
      setLocationPermGranted(false)
      return
    }

    await updatePermissionState()

    try {
      const pos = await requestCurrentPosition()
      setLocationPermGranted(true)
      setCurrentCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy ?? undefined })
    } catch (err: any) {
      if (err?.code === 1 || err?.message?.toLowerCase().includes('permission')) {
        setLocationPermGranted(false)
      } else {
        setLocationPermGranted(null)
      }
    }
  }

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    void ensureLocationPermission()
  }, [])

  // Fetch active assignment
  const assignmentQuery = useQuery({
    queryKey: ['my-assignment'],
    enabled: !!profile,
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('No token')
      const res = await authedFetch('/api/assignments/my-today/', token)
      if (!res.ok) {
        if (res.status === 404) return null
        throw new Error('Failed to load assignment')
      }
      return res.json() as Promise<AssignmentData>
    },
  })

  // Fetch today's routing map points
  const routeQuery = useQuery({
    queryKey: ['my-route', profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const token = await getToken()
      if (!token || !profile) throw new Error('No token')
      const res = await authedFetch(`/api/location/employee/route/${profile.id}`, token)
      if (!res.ok) throw new Error('Failed to load route')
      return res.json() as Promise<{ route: Array<{ latitude: number; longitude: number }> }>
    },
  })

  // Background tracker: fires coordinate posts every 45s when session is active
  useEffect(() => {
    if (!sessionActive || !profile) return

    const logInterval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
          const token = await getToken()
          if (!token) return
          await authedFetch('/api/location/update', token, {
            method: 'POST',
            body: JSON.stringify({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              is_mock: false,
            }),
          })
          // Refresh route query map points
          queryClient.invalidateQueries({ queryKey: ['my-route', profile.id] })
        } catch (e) {
          console.error('Failed to log background location', e)
        }
      })
    }, 45000)

    return () => clearInterval(logInterval)
  }, [profileQuery.data?.active_session, profile, getToken, queryClient])

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream
      videoRef.current.muted = true
      videoRef.current.play().catch(() => {})
      setCameraReady(true)
    }
  }, [stream])

  // Open Camera stream
  const startCamera = async (mode: 'register' | 'checkin' | 'checkout') => {
    setCameraMode(mode)
    setTempPhoto(null)
    setCameraError(null)
    setAttendanceError(null)
    setIsCameraOpen(true)
    setCameraReady(false)
    try {
      const pos = await requestCurrentPosition()
      setLocationPermGranted(true)
      setCurrentCoords({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? undefined,
      })
    } catch (err) {
      setLocationPermGranted(false)
      setAttendanceError('Could not obtain precise location. Please enable GPS and try again.')
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch (err: any) {
      setCameraError('Could not access camera. Please check permissions and browser settings.')
      setIsCameraOpen(false)
      console.error('Camera access failed', err)
    }
  }

  const requestCurrentPosition = async () => {
    return new Promise<GeolocationPosition>((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error('Geolocation is not available.'))
        return
      }
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        { enableHighAccuracy: true, timeout: 15000 }
      )
    })
  }

  // Stop Camera stream
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
    setCameraReady(false)
    setIsCameraOpen(false)
    setTempPhoto(null)
  }

  // Capture image snapshot
  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const photoUrl = canvas.toDataURL('image/jpeg', 0.95)
          setTempPhoto(photoUrl)
        }
      }
    }

    const buildAnnotatedPhoto = async (base64Image: string) => {
      const img = new Image()
      img.src = base64Image
      await new Promise((resolve) => {
        img.onload = resolve
      })

      const canvas = document.createElement('canvas')
      canvas.width = img.width || 1080
      canvas.height = img.height || 1440
      const ctx = canvas.getContext('2d')
      if (!ctx) return null

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      return await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.95)
      })
    }
  // Handle Photo Acceptance
  const acceptPhoto = async () => {
    if (!tempPhoto) return

    if (cameraMode === 'register') {
      const updated = [...capturedPhotos, tempPhoto]
      setCapturedPhotos(updated)
      setTempPhoto(null)

      if (updated.length >= 3) {
        // Submit all 3 faces to register
        setSubmitting(true)
        try {
          const token = await getToken()
          if (!token) return
          const formData = new FormData()
          for (let i = 0; i < updated.length; i++) {
            const annotatedBlob = await buildAnnotatedPhoto(updated[i])
            formData.append('selfies', annotatedBlob || await (await fetch(updated[i])).blob(), `selfie_${i}.jpg`)
          }

          const res = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'}/api/face/register`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          })

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            throw new Error(errData.detail || 'Registration failed')
          }

          // Save first captured photo as profile picture
          if (profile && updated.length > 0) {
            queryClient.setQueryData(['employee-portal-profile'], (oldData: any) => ({
              ...oldData,
              employee: { ...oldData.employee, profile_photo: updated[0] },
              requires_face_registration: false,
            }))
            const profileForm = new FormData()
            const profileBlob = await buildAnnotatedPhoto(updated[0])
            profileForm.append('profile_photo_file', profileBlob || await (await fetch(updated[0])).blob(), 'profile.jpg')
            await fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'}/api/employees/${profile.id}/upload-photo/`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              body: profileForm,
            }).catch(() => {})
          }
          alert('Face verification model profile successfully registered!')
          stopCamera()
        } catch (e: any) {
          alert(`Error: ${e.message}`)
        } finally {
          setSubmitting(false)
          setCapturedPhotos([])
        }
      }
    } else {
      // Check-in or Check-out submission
      setSubmitting(true)
      try {
        const token = await getToken()
        if (!token) return

        let latestCoords = currentCoords
        try {
          const pos = await requestCurrentPosition()
          latestCoords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? undefined,
          }
          setCurrentCoords(latestCoords)
        } catch (err) {
          setAttendanceError('Unable to refresh location. Please ensure GPS is enabled and try again.')
          setSubmitting(false)
          return
        }

        if (!latestCoords) {
          setAttendanceError('Obtaining location coordinates. Please verify GPS is enabled and allow location access.')
          setSubmitting(false)
          return
        }

        const annotatedBlob = await buildAnnotatedPhoto(tempPhoto)
        const formData = new FormData()
        formData.append('selfie', annotatedBlob || await (await fetch(tempPhoto)).blob(), 'selfie.jpg')
        formData.append('latitude', String(latestCoords.latitude))
        formData.append('longitude', String(latestCoords.longitude))
        formData.append('accuracy', String(latestCoords.accuracy ?? 0))
        formData.append('liveness_score', '1.0') // simulated high confidence from camera
        // Include readable coordinates/address when available so backend metadata is useful
        const addressPayload = assignmentQuery.data?.patient_address || profile?.default_address || 'Not Available'
        formData.append('address', addressPayload)

        const endpoint = cameraMode === 'checkin' ? '/api/attendance/checkin' : '/api/attendance/checkout'
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'}${endpoint}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        })

        const responseText = await res.text().catch(() => '')
        let resData: any = {}
        if (responseText) {
          try {
            resData = JSON.parse(responseText)
          } catch {
            resData = { detail: responseText }
          }
        }
        if (!res.ok) {
          throw new Error(resData.detail || resData.error || responseText || 'Attendance request failed')
        }

        setCameraError(null)
        setAttendanceError(null)

        queryClient.invalidateQueries({ queryKey: ['employee-portal-profile'] })
        queryClient.invalidateQueries({ queryKey: ['my-assignment'] })
        queryClient.invalidateQueries({ queryKey: ['my-route', profile?.id] })
        await queryClient.refetchQueries({ queryKey: ['employee-portal-profile'], active: true, type: 'active' })
        stopCamera()
      } catch (e: any) {
        setCameraError(e.message || 'Attendance request failed.')
      } finally {
        setSubmitting(false)
      }
    }
  }

  if (profileQuery.isError) {
    const errorMessage = profileQuery.error instanceof Error ? profileQuery.error.message : 'Verification failed.'
    return (
      <div className="unregistered-container">
        <div className="unregistered-card">
          <div className="unregistered-icon">⚠️</div>
          <h2>Access Restricted</h2>
          <p style={{ margin: '1rem 0 2rem 0', lineHeight: 1.6 }}>{errorMessage}</p>
          <button
            className="btn-primary"
            style={{ background: 'var(--danger)' }}
            onClick={() => {
              void signOut()
            }}
          >
            Log Out / Switch Account
          </button>
        </div>
      </div>
    )
  }

  if (profileQuery.isLoading) {
    return (
      <div className="unregistered-container">
        <div className="glass-card route-loading">Verifying employee credentials...</div>
      </div>
    )
  }

  return (
    <div className="portal-layout">
      <header className="portal-header">
        <div className="portal-logo-area">
          <img
            src="https://skandanhomecarre.com/wp-content/uploads/2025/06/cropped-SKANDA-fav-192x192.png"
            alt="Skandan Logo"
            style={{ height: '42px', objectFit: 'contain' }}
          />
          <div>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)' }}>Skandan Portal</h2>
          </div>
        </div>
        <div>
          <button
            className="ghost-button danger"
            style={{ padding: '0.6rem 1.2rem', borderRadius: '12px' }}
            onClick={() => {
              void signOut()
            }}
          >
            Log Out
          </button>
        </div>
      </header>

      <main className="portal-content">
        {attendanceError && (
          <div
            style={{
              background: 'rgba(239,68,68,0.1)',
              color: 'var(--danger)',
              padding: '1rem',
              borderRadius: '12px',
              marginBottom: '1rem',
              border: '1px solid rgba(239,68,68,0.2)',
            }}
          >
            <strong>⚠️ {attendanceError}</strong>
          </div>
        )}
        {requiresFaceReg ? (
          <div className="glass-card card-soft registration-card">
            <span className="eyebrow">Biometric Enrollment</span>
            <h3>Register Face Recognition Profile</h3>
            <p style={{ margin: '1rem 0 2rem 0', color: 'var(--muted)' }}>
              To ensure secure attendance logs, we need to create your face analysis profile. Please prepare to take 3 selfies.
            </p>
            <button className="btn-primary" onClick={() => startCamera('register')}>
              Start Face Registration
            </button>
          </div>
        ) : (
          <div className="portal-grid">
            {/* Profile and clock */}
            <div className="stack">
              {profile && (
                <div className="glass-card card-soft employee-card">
                  <div className="employee-avatar-wrapper">
                    <img
                      src={profile.profile_photo || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80'}
                      alt={profile.name}
                      className="employee-avatar"
                    />
                  </div>
                  <h3>{profile.name}</h3>
                  <p style={{ fontWeight: 600, color: 'var(--primary)', marginTop: '0.2rem' }}>{profile.designation}</p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>{profile.department} Department</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '0.4rem' }}>{profile.email}</p>
                </div>
              )}

              <div className="glass-card card-soft clock-card">
                <span className="date-display">
                  {currentTime.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
                <span className="digital-clock">
                  {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                {/* Session summary (check-in/out and duration) */}
                {profileQuery.data?.session_summary && (
                  <div style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: 'var(--muted)' }}>
                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                      <strong style={{ color: 'var(--primary)', minWidth: '90px' }}>Session</strong>
                      <div>
                        <div>Check In: {profileQuery.data.session_summary.check_in_time ? new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(new Date(profileQuery.data.session_summary.check_in_time)) : '—'}</div>
                        <div>Check Out: {profileIsPresent ? 'Working' : (profileQuery.data.session_summary.check_out_time ? new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(new Date(profileQuery.data.session_summary.check_out_time)) : '—')}</div>
                        <div>Duration: {profileIsPresent ? (() => {
                          const checkInTime = profileQuery.data.session_summary.check_in_time
                          if (!checkInTime) {
                            return profileQuery.data.session_summary.session_duration_seconds ? `${Math.floor(profileQuery.data.session_summary.session_duration_seconds / 3600)}h ${Math.floor((profileQuery.data.session_summary.session_duration_seconds % 3600) / 60)}m` : '—'
                          }
                          try {
                            const inMs = new Date(checkInTime).getTime()
                            const seconds = Math.max(Math.floor((Date.now() - inMs) / 1000), 0)
                            const h = Math.floor(seconds / 3600)
                            const m = Math.floor((seconds % 3600) / 60)
                            return `${h ? h + 'h ' : ''}${m}m`
                          } catch {
                            return profileQuery.data.session_summary.session_duration_seconds ? `${Math.floor(profileQuery.data.session_summary.session_duration_seconds / 3600)}h ${Math.floor((profileQuery.data.session_summary.session_duration_seconds % 3600) / 60)}m` : '—'
                          }
                        })() : (profileQuery.data.session_summary.session_duration_seconds ? `${Math.floor(profileQuery.data.session_summary.session_duration_seconds / 3600)}h ${Math.floor((profileQuery.data.session_summary.session_duration_seconds % 3600) / 60)}m` : '—')}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Attendance actions */}
            <div className="stack">
              <div className="glass-card card-soft stack" style={{ padding: '1.75rem' }}>
                <span className="eyebrow">Attendance</span>
                {assignmentQuery.isLoading ? (
                  <p>Loading schedule...</p>
                ) : (
                  <div>
                    {assignmentQuery.data && (
                      <div style={{ marginBottom: '1.5rem' }}>
                        <h4 style={{ color: 'var(--text)', fontSize: '1.15rem' }}>Patient: {assignmentQuery.data.patient_name}</h4>
                        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                          📍 {assignmentQuery.data.patient_address}
                        </p>
                        <p style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600, marginTop: '0.5rem' }}>
                          Geofence Boundary: {(assignmentQuery.data.radius / 1000).toFixed(2)} km
                        </p>
                      </div>
                    )}


                    {locationPermGranted === false && (
                      <div
                        style={{
                          background: 'rgba(239, 68, 68, 0.08)',
                          color: 'var(--danger)',
                          padding: '0.8rem',
                          borderRadius: '10px',
                          fontSize: '0.85rem',
                          marginBottom: '1rem',
                          fontWeight: 600,
                        }}
                      >
                        ⚠️ Location permissions are disabled. Please enable GPS and allow location access to continue.
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      {!sessionActive ? (
                        <button
                          className="btn-primary pulse-button"
                          disabled={locationPermGranted === false}
                          onClick={() => startCamera('checkin')}
                          style={{ flex: 1, minWidth: '200px' }}
                        >
                          ✅ Mark Attendance (Check In)
                        </button>
                      ) : (
                        <button
                          className="btn-primary"
                          style={{ background: 'var(--danger)', flex: 1, minWidth: '200px' }}
                          onClick={() => startCamera('checkout')}
                        >
                          🔴 Attendance Logout (Check Out)
                        </button>
                      )}
                    </div>
                    {/* Location tracking banner removed per request */}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Camera Capture Modal */}
      {isCameraOpen && (
        <div className="camera-modal-backdrop">
          <div className="camera-modal">
            <div className="camera-header">
              <h3 style={{ fontSize: '1.1rem' }}>
                {cameraMode === 'register'
                  ? `Face Registration (${capturedPhotos.length + 1}/3)`
                  : cameraMode === 'checkin'
                    ? 'Check-In Verification'
                    : 'Check-Out Verification'}
              </h3>
              <button
                onClick={stopCamera}
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

            <div className="camera-viewport">
              {!tempPhoto ? (
                <>
                  <video ref={videoRef} autoPlay playsInline className="camera-video" />
                  <div className="camera-overlay-indicator" />
                </>
              ) : (
                <img src={tempPhoto} alt="Snapshot" className="camera-snapshot" />
              )}
            </div>

            <canvas ref={canvasRef} className="camera-canvas" />

            <div className="camera-footer">
              {!tempPhoto ? (
                <button className="btn-primary" onClick={capturePhoto}>
                  Capture Photo
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div className="button-group-row">
                    <button
                      className="btn-secondary"
                      onClick={async () => {
                        setTempPhoto(null)
                        setCameraError(null)
                        if (stream) {
                          if (videoRef.current) {
                            videoRef.current.srcObject = stream
                            videoRef.current.muted = true
                            await videoRef.current.play().catch(() => {})
                          }
                        } else {
                          await startCamera(cameraMode)
                        }
                      }}
                      disabled={submitting}
                    >
                      Retake
                    </button>
                    <button className="btn-primary" onClick={acceptPhoto} disabled={submitting}>
                      {submitting ? 'Verifying...' : 'Submit'}
                    </button>
                  </div>
                  {cameraError && (
                    <div style={{ color: 'var(--danger)', fontSize: '0.9rem', textAlign: 'center' }}>
                      {cameraError}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
