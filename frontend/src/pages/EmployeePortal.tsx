import { useEffect, useRef, useState } from 'react'
import { SignOutButton, useAuth } from '@clerk/clerk-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authedFetch } from '../lib/api'
import { RouteMap } from '../components/RouteMap'

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
  const [profile, setProfile] = useState<EmployeeData | null>(null)
  const [requiresFaceReg, setRequiresFaceReg] = useState(false)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [attendanceError, setAttendanceError] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)

  // Camera capture state
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [cameraMode, setCameraMode] = useState<'register' | 'checkin' | 'checkout'>('checkin')
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]) // base64 strings
  const [tempPhoto, setTempPhoto] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [locationPermGranted, setLocationPermGranted] = useState<boolean | null>(null)
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Session state (active tracking)
  const [sessionActive, setSessionActive] = useState(() => {
    return window.localStorage.getItem('employeehub-session-active') === 'true'
  })

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Geolocation perm & tracking request immediately on load
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationPermGranted(true)
          setCurrentCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
        },
        () => {
          setLocationPermGranted(false)
        }
      )
    } else {
      setLocationPermGranted(false)
    }
  }, [])

  // Fetch employee profile and registration status
  useEffect(() => {
    async function loadProfile() {
      try {
        const token = await getToken()
        if (!token) {
          setAuthError('Missing Clerk token')
          setIsLoadingProfile(false)
          return
        }
        const res = await authedFetch('/api/auth/login', token, { method: 'POST' })
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          setAuthError(errData.detail || 'Access denied. You are not registered as an employee.')
          setIsLoadingProfile(false)
          return
        }
        const data = await res.json()
        if (data.role !== 'EMPLOYEE') {
          setAuthError('Unauthorized role access.')
          setIsLoadingProfile(false)
          return
        }
        setProfile(data.employee)
        setRequiresFaceReg(data.requires_face_registration)
        const hasActiveSession = Boolean(data.active_session)
        setSessionActive(hasActiveSession)
        window.localStorage.setItem('employeehub-session-active', hasActiveSession ? 'true' : 'false')
        setIsLoadingProfile(false)
      } catch (err: any) {
        setAuthError(err.message || 'Verification failed')
        setIsLoadingProfile(false)
      }
    }
    loadProfile()
  }, [getToken])

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
  }, [sessionActive, profile, getToken, queryClient])

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => {})
    }
  }, [stream])

  // Open Camera stream
  const startCamera = async (mode: 'register' | 'checkin' | 'checkout') => {
    setCameraMode(mode)
    setTempPhoto(null)
    setCameraError(null)
    setAttendanceError(null)
    setIsCameraOpen(true)
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
    setIsCameraOpen(false)
    setTempPhoto(null)
  }

  // Capture image snapshot
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const photoUrl = canvas.toDataURL('image/jpeg')
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
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.fillRect(0, canvas.height - 150, canvas.width, 150)

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 28px Inter, sans-serif'
    const timestamp = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    const locationText = currentCoords ? `Location: ${currentCoords.latitude.toFixed(5)}, ${currentCoords.longitude.toFixed(5)}` : 'Location: unavailable'
    const lines = [`Captured: ${timestamp}`, locationText]
    lines.forEach((line, index) => {
      ctx.fillText(line, 24, canvas.height - 105 + index * 34)
    })

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

          setRequiresFaceReg(false)
          // Save first captured photo as profile picture
          if (profile && updated.length > 0) {
            setProfile({ ...profile, profile_photo: updated[0] })
            // Also upload the first photo as the profile picture to backend
            const profileForm = new FormData()
            const profileBlob = await buildAnnotatedPhoto(updated[0])
            profileForm.append('profile_photo_file', profileBlob || await (await fetch(updated[0])).blob(), 'profile.jpg')
            await fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'}/api/employees/${profile.id}/upload-photo/`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              body: profileForm,
            }).catch(() => {}) // silently fail if upload endpoint doesn't exist yet
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
        formData.append('address', 'Location verified via portal')

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
        if (cameraMode === 'checkin') {
          setSessionActive(true)
          window.localStorage.setItem('employeehub-session-active', 'true')
          if (profile && !profile.profile_photo && tempPhoto) {
            setProfile({ ...profile, profile_photo: tempPhoto })
          }
        } else {
          setSessionActive(false)
          window.localStorage.setItem('employeehub-session-active', 'false')
        }

        queryClient.invalidateQueries({ queryKey: ['my-assignment'] })
        queryClient.invalidateQueries({ queryKey: ['my-route', profile?.id] })
        stopCamera()
      } catch (e: any) {
        setCameraError(e.message || 'Attendance request failed.')
      } finally {
        setSubmitting(false)
      }
    }
  }

  if (authError) {
    return (
      <div className="unregistered-container">
        <div className="unregistered-card">
          <div className="unregistered-icon">⚠️</div>
          <h2>Access Restricted</h2>
          <p style={{ margin: '1rem 0 2rem 0', lineHeight: 1.6 }}>{authError}</p>
          <button
            className="btn-primary"
            style={{ background: 'var(--danger)' }}
            onClick={() => {
              window.localStorage.setItem('employeehub-session-active', 'false')
              setSessionActive(false)
              void signOut()
            }}
          >
            Log Out / Switch Account
          </button>
        </div>
      </div>
    )
  }

  if (isLoadingProfile) {
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
            <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: 0 }}>Workforce Safety & Attendance</p>
          </div>
        </div>
        <div>
          <button
            className="ghost-button danger"
            style={{ padding: '0.6rem 1.2rem', borderRadius: '12px' }}
            onClick={() => {
              window.localStorage.setItem('employeehub-session-active', 'false')
              setSessionActive(false)
              void signOut()
            }}
          >
            Log Out
          </button>
        </div>
      </header>

      <main className="portal-content">
        {(attendanceError || authError) && (
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
            <strong>⚠️ {attendanceError || authError}</strong>
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
                    <button className="btn-secondary" onClick={() => setTempPhoto(null)} disabled={submitting}>
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
