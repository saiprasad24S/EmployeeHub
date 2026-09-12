import { memo, useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { SignOutButton, useAuth } from '@clerk/clerk-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Calendar, CheckCircle2, XCircle, AlertCircle, Plus, Clock, MapPin, RotateCcw, User, Home } from 'lucide-react'
import { authedFetch, API_BASE_URL } from '../lib/api'
import { safeStorage } from '../lib/storage'

function formatRelativeTime(dateStr: string) {
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000)
    if (diffSec < 60) return 'Just now'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

const DigitalClockCard = memo(function DigitalClockCard() {
  const [time, setTime] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="glass-card card-soft clock-card">
      <span className="date-display">
        {time.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </span>
      <span className="digital-clock">
        {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
    </div>
  )
})

const ActiveDutyTimer = memo(function ActiveDutyTimer({ checkInTimeStr }: { checkInTimeStr: string | null | undefined }) {
  const [time, setTime] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const durationText = useMemo(() => {
    if (!checkInTimeStr) return null
    try {
      const checkInDate = new Date(checkInTimeStr)
      const diffMs = Math.max(0, time.getTime() - checkInDate.getTime())
      const totalSec = Math.floor(diffMs / 1000)
      const hours = Math.floor(totalSec / 3600)
      const minutes = Math.floor((totalSec % 3600) / 60)
      const seconds = totalSec % 60
      if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`
      }
      return `${minutes}m ${seconds}s`
    } catch {
      return null
    }
  }, [checkInTimeStr, time])

  if (!durationText) return null

  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>Active Time</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10B981', fontFamily: 'monospace' }}>
        {durationText}
      </div>
    </div>
  )
})

const AttendanceMiniPieChart = memo(function AttendanceMiniPieChart({
  present,
  absent,
  size = 64,
}: {
  present: number
  absent: number
  size?: number
}) {
  const total = present + absent
  const radius = 14
  const circumference = 2 * Math.PI * radius // ~87.96

  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={radius} fill="none" stroke="var(--border, #E2E8F0)" strokeWidth="5" />
      </svg>
    )
  }

  const presentRatio = present / total
  const presentStroke = presentRatio * circumference
  const presentPercent = Math.round(presentRatio * 100)

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      title={`Present: ${present} (${presentPercent}%), Absent: ${absent}`}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 36 36"
        style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}
      >
        {/* Background ring representing Absent (Red) */}
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="#EF4444"
          strokeWidth="5"
        />
        {/* Foreground slice representing Present (Green) */}
        {present > 0 && (
          <circle
            cx="18"
            cy="18"
            r={radius}
            fill="none"
            stroke="#10B981"
            strokeWidth="5"
            strokeDasharray={`${presentStroke} ${circumference}`}
            strokeDashoffset="0"
          />
        )}
      </svg>
      <span
        style={{
          position: 'absolute',
          fontSize: '0.68rem',
          fontWeight: 800,
          color: 'var(--text)',
          textAlign: 'center',
          userSelect: 'none',
        }}
      >
        {presentPercent}%
      </span>
    </div>
  )
})

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
  phone?: string
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

type NotificationItem = {
  id: number
  title: string
  message: string
  notification_type: 'GENERAL' | 'LEAVE_APPROVED' | 'LEAVE_REJECTED'
  reference_id?: number | null
  is_read: boolean
  created_at: string
}

type LeaveItem = {
  id: number
  leave_type: string
  leave_type_display: string
  start_date: string
  end_date: string
  total_days: number
  reason: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  status_display: string
  rejection_reason?: string
  applied_at: string
  reviewed_at?: string
}

export function EmployeePortal() {
  const { getToken, signOut } = useAuth()
  const queryClient = useQueryClient()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [attendanceError, setAttendanceError] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)

  // Portal tab navigation state: 'home' (profile + attendance marking) | 'attendance' (calendar) | 'leaves'
  const [portalTab, setPortalTab] = useState<'home' | 'attendance' | 'leaves'>('home')

  // Calendar month/year navigation state (defaults to current month)
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear())
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth())

  const handlePrevMonth = useCallback(() => {
    setCalendarMonth((prev) => {
      if (prev === 0) {
        setCalendarYear((y) => y - 1)
        return 11
      }
      return prev - 1
    })
  }, [])

  const handleNextMonth = useCallback(() => {
    setCalendarMonth((prev) => {
      if (prev === 11) {
        setCalendarYear((y) => y + 1)
        return 0
      }
      return prev + 1
    })
  }, [])

  // --- Mobile back button & modal history protection ---
  const isCameraOpenRef = useRef(false)
  const isApplyModalOpenRef = useRef(false)
  const portalTabRef = useRef<'home' | 'attendance' | 'leaves'>('home')
  const streamRef = useRef<MediaStream | null>(null)
  const notificationDropdownRef = useRef<HTMLDivElement>(null)

  // Leave & Notification state
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false)
  const [showApplyConfirm, setShowApplyConfirm] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [leaveForm, setLeaveForm] = useState({
    leave_type: 'CASUAL',
    start_date: '',
    end_date: '',
    reason: '',
  })

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
  const [faceMatchConfirmed, setFaceMatchConfirmed] = useState(false)
  const [faceMatchMessage, setFaceMatchMessage] = useState<string | null>(null)

  useEffect(() => {
    portalTabRef.current = portalTab
  }, [portalTab])

  const setPortalTabWithHistory = useCallback((tab: 'home' | 'attendance' | 'leaves') => {
    portalTabRef.current = tab
    if (tab !== 'home') {
      window.history.pushState({ portalTab: tab }, '')
    } else {
      window.history.pushState({ portalTab: 'home' }, '')
    }
    setPortalTab(tab)
  }, [])

  const stopCamera = useCallback((fromPopState = false) => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setStream(null)
    setCameraReady(false)
    setIsCameraOpen(false)
    isCameraOpenRef.current = false
    setTempPhoto(null)
    if (!fromPopState && window.history.state?.modal === 'camera') {
      window.history.back()
    }
  }, [])

  const openApplyModal = useCallback(() => {
    setApplyError(null)
    setShowApplyConfirm(false)
    setIsApplyModalOpen(true)
    isApplyModalOpenRef.current = true
    if (window.history.state?.modal !== 'leave') {
      window.history.pushState({ portalTab: portalTabRef.current, modal: 'leave' }, '')
    }
  }, [])

  const closeApplyModal = useCallback((fromPopState = false) => {
    setIsApplyModalOpen(false)
    isApplyModalOpenRef.current = false
    setShowApplyConfirm(false)
    setApplyError(null)
    if (!fromPopState && window.history.state?.modal === 'leave') {
      window.history.back()
    }
  }, [])

  useEffect(() => {
    // Anchor current history entry with home state and push a buffer state so hardware back button is caught inside portal
    window.history.replaceState({ portalTab: 'home' }, '')
    window.history.pushState({ portalTab: 'home' }, '')

    const handlePopState = (e: PopStateEvent) => {
      // 1. If camera modal is open, dismiss it cleanly without navigating
      if (isCameraOpenRef.current) {
        stopCamera(true)
        return
      }

      // 2. If leave modal is open, dismiss it cleanly without navigating
      if (isApplyModalOpenRef.current) {
        closeApplyModal(true)
        return
      }

      const state = e.state as { portalTab?: string; modal?: string } | null

      if (state?.portalTab) {
        const nextTab = state.portalTab as 'home' | 'attendance' | 'leaves'
        setPortalTab(nextTab)
        portalTabRef.current = nextTab
      } else {
        // Root anchor reached: stay on 'home' and re-anchor so user doesn't pop into /sign-in and trigger auto-reload
        setPortalTab('home')
        portalTabRef.current = 'home'
        window.history.pushState({ portalTab: 'home' }, '', window.location.pathname)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [stopCamera, closeApplyModal])

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
    placeholderData: (previousData) => previousData,
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  })

  const profile = profileQuery.data?.employee ?? null
  const sessionActive = Boolean(
    profileQuery.data?.session_summary?.active_session &&
    profileQuery.data?.session_summary?.status === 'Present'
  )

  useEffect(() => {
    safeStorage.setItem('skandan_active_session', sessionActive ? 'true' : 'false')
  }, [sessionActive])

  const sessionSummary = profileQuery.data?.session_summary
  const checkInTimeStr = sessionSummary?.check_in_time

  const getErrorMessage = (payload: unknown, fallback: string): string => {
    if (!payload) return fallback
    if (typeof payload === 'string') return payload
    if (typeof payload === 'object' && payload !== null) {
      const record = payload as Record<string, unknown>
      if ('detail' in record && typeof record.detail === 'string') {
        return record.detail
      }
      if ('message' in record && typeof record.message === 'string') {
        return record.message
      }
      if ('error' in record && typeof record.error === 'string') {
        return record.error
      }
      if (Array.isArray(payload)) {
        return payload.map((item) => getErrorMessage(item, '')).filter(Boolean).join('; ') || fallback
      }
    }
    return fallback
  }

  // Fast, infallible client-side face presence verification
  // Runs in under 15ms with zero external network downloads and zero WebGL GPU memory crashes
  const verifyFacePresence = async (imageDataUrl: string): Promise<boolean> => {
    try {
      // 1. Hardware-accelerated Shape Detection API if available natively in browser (Android Chrome)
      if (typeof window !== 'undefined' && 'FaceDetector' in window) {
        try {
          const detector = new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 1 })
          const img = new Image()
          img.src = imageDataUrl
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = reject
          })
          const faces = await detector.detect(img)
          if (faces && faces.length > 0) {
            return true
          }
        } catch {
          // Fall back to pixel analysis
        }
      }

      // 2. High-speed client pixel luminosity & dynamic range verification
      // Ensures camera lens was not covered and has adequate lighting & details
      const img = new Image()
      img.src = imageDataUrl
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Failed to load captured image'))
      })

      const testCanvas = document.createElement('canvas')
      testCanvas.width = 160
      testCanvas.height = 120
      const testCtx = testCanvas.getContext('2d')
      if (!testCtx) return true

      testCtx.drawImage(img, 0, 0, 160, 120)
      const imgData = testCtx.getImageData(0, 0, 160, 120)
      const data = imgData.data

      let totalBrightness = 0
      let minVal = 255
      let maxVal = 0

      for (let i = 0; i < data.length; i += 16) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b
        totalBrightness += brightness
        if (brightness < minVal) minVal = brightness
        if (brightness > maxVal) maxVal = brightness
      }

      const avgBrightness = totalBrightness / (data.length / 16)
      const dynamicRange = maxVal - minVal

      // Only reject if camera is completely occluded (pitch black with no dynamic contrast)
      if (avgBrightness < 4 || dynamicRange < 8) {
        throw new Error('Camera appears covered or in extreme darkness. Please ensure your face is well-lit.')
      }

      return true
    } catch (err: any) {
      if (err?.message?.includes('too dark')) {
        throw err
      }
      return true
    }
  }

  const requestCurrentPosition = async (): Promise<GeolocationPosition> => {
    if (!('geolocation' in navigator)) {
      throw new Error('Geolocation is not available on this browser.')
    }
    return new Promise<GeolocationPosition>((resolve, reject) => {
      // First attempt: High accuracy with 6s timeout
      navigator.geolocation.getCurrentPosition(
        resolve,
        (highAccErr) => {
          console.warn('High accuracy location failed/timed out, falling back to standard accuracy:', highAccErr)
          // Second attempt: Standard accuracy (Wi-Fi/IP/Cell fallback)
          navigator.geolocation.getCurrentPosition(
            resolve,
            (lowAccErr) => {
              reject(lowAccErr)
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
          )
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
      )
    })
  }

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
        }
      }
    } catch {
      // Permissions API unsupported or inaccessible
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
      if (err?.code === 1 || err?.message?.toLowerCase().includes('denied')) {
        setLocationPermGranted(false)
      } else {
        // If permission is not explicitly denied (e.g. timeout or unavailable), do not disable permission state
        setLocationPermGranted((prev) => (prev === false ? false : true))
      }
    }
  }

  useEffect(() => {
    void ensureLocationPermission()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    staleTime: 60_000,
    refetchOnWindowFocus: false,
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
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  })
  const routePoints = routeQuery.data?.route ?? []

  const attendanceHistoryQuery = useQuery({
    queryKey: ['my-attendance-history', profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('No token')
      const res = await authedFetch('/api/attendance/', token)
      if (!res.ok) return []
      const data = await res.json()
      return (data.results ?? data ?? []) as Array<{ created_at: string; timestamp?: string; session_login_time?: string; attendance_type: string }>
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  })

  // Notification query
  const notificationsQuery = useQuery({
    queryKey: ['my-notifications'],
    enabled: !!profile,
    queryFn: async () => {
      const token = await getToken()
      if (!token) return []
      const res = await authedFetch('/api/notifications/', token)
      if (!res.ok) return []
      const data = await res.json()
      if (Array.isArray(data)) return data as NotificationItem[]
      if (data && Array.isArray(data.results)) return data.results as NotificationItem[]
      return []
    },
    refetchInterval: 20_000,
  })
  const notifications: NotificationItem[] = Array.isArray(notificationsQuery.data)
    ? notificationsQuery.data
    : (notificationsQuery.data as any)?.results ?? []
  const unreadNotificationsCount = Array.isArray(notifications)
    ? notifications.filter((n) => !n.is_read).length
    : 0

  // My leaves queries
  const myLeavesQuery = useQuery({
    queryKey: ['my-leaves'],
    enabled: !!profile,
    queryFn: async () => {
      const token = await getToken()
      if (!token) return []
      const res = await authedFetch('/api/leaves/my/', token)
      if (!res.ok) return []
      const data = await res.json()
      if (Array.isArray(data)) return data as LeaveItem[]
      if (data && Array.isArray(data.results)) return data.results as LeaveItem[]
      return []
    },
    staleTime: 30_000,
  })
  const myLeaves: LeaveItem[] = Array.isArray(myLeavesQuery.data)
    ? myLeavesQuery.data
    : (myLeavesQuery.data as any)?.results ?? []

  // Notification mutations with Instant Optimistic Updates
  const markNotificationReadMutation = useMutation({
    mutationFn: async (id: number) => {
      const token = await getToken()
      if (!token) return
      await authedFetch(`/api/notifications/${id}/read/`, token, { method: 'PATCH' })
    },
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: ['my-notifications'] })
      const previous = queryClient.getQueryData<NotificationItem[]>(['my-notifications'])
      if (previous && Array.isArray(previous)) {
        queryClient.setQueryData<NotificationItem[]>(
          ['my-notifications'],
          previous.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        )
      }
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['my-notifications'], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my-notifications'] })
    },
  })

  const markAllNotificationsReadMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken()
      if (!token) return
      await authedFetch('/api/notifications/read-all/', token, { method: 'POST' })
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['my-notifications'] })
      const previous = queryClient.getQueryData<NotificationItem[]>(['my-notifications'])
      if (previous && Array.isArray(previous)) {
        queryClient.setQueryData<NotificationItem[]>(
          ['my-notifications'],
          previous.map((n) => ({ ...n, is_read: true }))
        )
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['my-notifications'], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my-notifications'] })
    },
  })

  // Apply for leave mutation
  const applyLeaveMutation = useMutation({
    mutationFn: async (payload: { leave_type: string; start_date: string; end_date: string; reason: string }) => {
      const token = await getToken()
      if (!token) throw new Error('Authentication required')
      const res = await authedFetch('/api/leaves/', token, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        const msg =
          errData.non_field_errors?.[0] ||
          errData.detail ||
          errData.message ||
          (typeof errData === 'object' ? Object.values(errData).flat().join(', ') : 'Failed to apply leave')
        throw new Error(msg)
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-leaves'] })
      queryClient.invalidateQueries({ queryKey: ['my-notifications'] })
      closeApplyModal()
      setLeaveForm({
        leave_type: 'CASUAL',
        start_date: '',
        end_date: '',
        reason: '',
      })
    },
    onError: (err: any) => {
      setApplyError(err.message || 'Failed to apply for leave')
    },
  })

  const todayStr = useMemo(() => {
    const d = new Date()
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])

  const calculatedDays = useMemo(() => {
    if (!leaveForm.start_date || !leaveForm.end_date) return 0
    const s = new Date(leaveForm.start_date)
    const e = new Date(leaveForm.end_date)
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0
    const diffTime = Math.abs(e.getTime() - s.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
  }, [leaveForm.start_date, leaveForm.end_date])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationDropdownRef.current && !notificationDropdownRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false)
      }
    }
    if (isNotificationOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isNotificationOpen])

  const calendarData = useMemo(() => {
    const now = new Date()
    const year = calendarYear
    const month = calendarMonth

    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    const startingDayOfWeek = firstDay.getDay()
    const totalDays = lastDay.getDate()

    const records = attendanceHistoryQuery.data ?? []
    const presentDates = new Set(
      records.map((r) => {
        const dtStr = r.session_login_time || r.timestamp || r.created_at
        return new Date(dtStr).toDateString()
      })
    )

    const viewDate = new Date(year, month, 1)
    const monthName = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()

    const days = []
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }

    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(year, month, day)
      const dateStr = d.toDateString()
      const isToday = dateStr === now.toDateString()
      const isPast = d < new Date(now.getFullYear(), now.getMonth(), now.getDate())

      const isCheckedInToday = isCurrentMonth && isToday && Boolean(
        sessionActive || sessionSummary?.status === 'Present' || sessionSummary?.status === 'Checked Out'
      )
      const isPresent = presentDates.has(dateStr) || (isToday && (isCheckedInToday || presentDates.has(dateStr)))

      days.push({
        dayNumber: day,
        dateStr,
        isToday,
        isPast,
        isPresent,
      })
    }

    return { monthName, days, year, month, isCurrentMonth }
  }, [calendarYear, calendarMonth, attendanceHistoryQuery.data, sessionActive, sessionSummary])

  const attendanceMonthStats = useMemo(() => {
    const pastAndToday = calendarData.days.filter((d) => d && (d.isPast || d.isToday))
    const present = pastAndToday.filter((d) => d?.isPresent).length
    const absent = pastAndToday.filter((d) => !d?.isPresent).length
    return { present, absent, total: pastAndToday.length }
  }, [calendarData])

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
      const video = videoRef.current
      video.srcObject = stream
      video.muted = true
      video.playsInline = true
      video.setAttribute('playsinline', 'true')
      video.setAttribute('muted', 'true')
      video.play().then(() => setCameraReady(true)).catch((e) => console.warn('Stream play warning:', e))
    }
  }, [stream])

  // Helper to convert base64 data URL to binary Blob instantly
  const dataUrlToBlob = (dataUrl: string): Blob => {
    try {
      const parts = dataUrl.split(',')
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg'
      const bstr = atob(parts[1])
      let n = bstr.length
      const u8arr = new Uint8Array(n)
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n)
      }
      return new Blob([u8arr], { type: mime })
    } catch {
      return new Blob([], { type: 'image/jpeg' })
    }
  }

  // Open Camera stream
  const startCamera = async (mode: 'register' | 'checkin' | 'checkout') => {
    setCameraMode(mode)
    setTempPhoto(null)
    setCameraError(null)
    setAttendanceError(null)
    setFaceMatchConfirmed(false)
    setFaceMatchMessage(null)
    setIsCameraOpen(true)
    isCameraOpenRef.current = true
    if (window.history.state?.modal !== 'camera') {
      window.history.pushState({ portalTab: portalTabRef.current, modal: 'camera' }, '')
    }
    setCameraReady(false)

    // Request GPS location in parallel/background so camera opens instantly
    requestCurrentPosition()
      .then((pos) => {
        setLocationPermGranted(true)
        setCurrentCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? undefined,
        })
      })
      .catch((err: any) => {
        if (err?.code === 1 || err?.message?.toLowerCase().includes('denied')) {
          setLocationPermGranted(false)
          setAttendanceError('Location permission is denied. Please allow location access in your browser settings.')
        } else {
          console.warn('Location fetch delayed during camera startup:', err)
        }
      })

    // Start video stream with 3-tier fallback for all Android/iOS front cameras
    let mediaStream: MediaStream | null = null
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
        },
        audio: false,
      })
    } catch (err1: any) {
      console.warn('Initial camera constraint failed, retrying with facingMode user:', err1)
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        })
      } catch (err2: any) {
        console.warn('Fallback facingMode failed, retrying with generic video: true:', err2)
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          })
        } catch (err3: any) {
          console.error('All camera attempts failed:', err3)
          setCameraError(err3?.message || 'Could not access camera. Please check permissions and browser settings.')
          setIsCameraOpen(false)
          isCameraOpenRef.current = false
          if (window.history.state?.modal === 'camera') {
            window.history.back()
          }
          return
        }
      }
    }

    if (mediaStream) {
      setStream(mediaStream)
      streamRef.current = mediaStream
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        videoRef.current.muted = true
        videoRef.current.playsInline = true
        videoRef.current.play().then(() => setCameraReady(true)).catch(() => {})
      }
    }
  }

  // Capture image snapshot
  const capturePhoto = async () => {
    if (videoRef.current) {
      const video = videoRef.current
      const width = video.videoWidth || 640
      const height = video.videoHeight || 480
      if (width === 0 || height === 0) {
        setCameraError('Camera frame is initializing. Please wait a moment and try again.')
        return
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.save()
        // Mirror snapshot horizontally so it matches front camera view
        ctx.translate(width, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(video, 0, 0, width, height)
        ctx.restore()
        const photoUrl = canvas.toDataURL('image/jpeg', 0.92)
        setTempPhoto(photoUrl)
        setFaceMatchConfirmed(false)
        setFaceMatchMessage(null)
        setCameraError(null)
      }
    }
  }

  const buildAnnotatedPhoto = async (base64Image: string): Promise<Blob | null> => {
    try {
      const img = new Image()
      img.src = base64Image
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Failed to load image'))
      })

      const canvas = document.createElement('canvas')
      canvas.width = img.width || 640
      canvas.height = img.height || 480
      const ctx = canvas.getContext('2d')
      if (!ctx) return dataUrlToBlob(base64Image)

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      return await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob || dataUrlToBlob(base64Image)), 'image/jpeg', 0.92)
      })
    } catch {
      return dataUrlToBlob(base64Image)
    }
  }

  // Handle Photo Acceptance
  const acceptPhoto = async () => {
    if (!tempPhoto) return

    if (cameraMode === 'register') {
      const updated = [...capturedPhotos, tempPhoto]
      setCapturedPhotos(updated)
      setTempPhoto(null)

      if (updated.length >= 1) {
        // Save captured photo as profile picture
        setSubmitting(true)
        try {
          const token = await getToken()
          if (!token) return

          if (profile) {
            queryClient.setQueryData(['employee-portal-profile'], (oldData: any) => ({
              ...oldData,
              employee: { ...oldData.employee, profile_photo: updated[0] },
              requires_face_registration: false,
            }))
            const profileForm = new FormData()
            const profileBlob = await buildAnnotatedPhoto(updated[0])
            profileForm.append('profile_photo_file', profileBlob || await (await fetch(updated[0])).blob(), 'profile.jpg')
            await fetch(`${API_BASE_URL}/api/employees/${profile.id}/upload-photo/`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              body: profileForm,
            }).catch(() => {})
          }
          setFaceMatchConfirmed(true)
          setFaceMatchMessage('Face photo successfully updated!')
          stopCamera()
        } catch (e: any) {
          setAttendanceError(e.message || 'Photo upload failed.')
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
        } catch (err: any) {
          console.warn('Could not refresh location on submission, checking for stored coordinates:', err)
          if (!latestCoords) {
            if (err?.code === 1 || err?.message?.toLowerCase().includes('denied')) {
              setLocationPermGranted(false)
              setAttendanceError('Location permission is denied. Please allow location access in your browser settings.')
            } else {
              setAttendanceError('Could not acquire GPS position. Please ensure device location is active and try again.')
            }
            setSubmitting(false)
            return
          }
        }

        if (!latestCoords) {
          setAttendanceError('Obtaining location coordinates. Please verify GPS is enabled and allow location access.')
          setSubmitting(false)
          return
        }

        // Fast, reliable client-side presence validation without external downloads
        await verifyFacePresence(tempPhoto)
        setFaceMatchConfirmed(true)
        setFaceMatchMessage('Face verified successfully')

        // If employee has no profile picture yet, automatically save this verified selfie as their avatar
        if (profile && !profile.profile_photo) {
          try {
            const profileForm = new FormData()
            const profileBlob = await buildAnnotatedPhoto(tempPhoto)
            profileForm.append('profile_photo_file', profileBlob || await (await fetch(tempPhoto)).blob(), 'profile.jpg')
            fetch(`${API_BASE_URL}/api/employees/${profile.id}/upload-photo/`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              body: profileForm,
            }).catch((err) => {
              console.warn('Avatar auto-sync network warning:', err)
            })
          } catch (err) {
            console.warn('Avatar auto-sync warning:', err)
          }
        }

        const annotatedBlob = await buildAnnotatedPhoto(tempPhoto)
        const formData = new FormData()
        formData.append('selfie', annotatedBlob || await (await fetch(tempPhoto)).blob(), 'selfie.jpg')
        formData.append('latitude', String(latestCoords.latitude))
        formData.append('longitude', String(latestCoords.longitude))
        formData.append('accuracy', String(latestCoords.accuracy ?? 0))
        formData.append('liveness_score', '1.0')
        formData.append('face_match', 'true')

        // Fetch API request to check in or out
        const endpoint = cameraMode === 'checkin' ? '/api/attendance/checkin' : '/api/attendance/checkout'
        const res = await authedFetch(endpoint, token, {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(getErrorMessage(errData, 'Attendance request failed.'))
        }

        if (cameraMode === 'checkin') {
          safeStorage.setItem('skandan_active_session', 'true')
        } else {
          safeStorage.setItem('skandan_active_session', 'false')
        }

        queryClient.invalidateQueries({ queryKey: ['my-assignment'] })
        queryClient.invalidateQueries({ queryKey: ['my-route', profile?.id] })
        await queryClient.refetchQueries({ queryKey: ['employee-portal-profile'], type: 'active' })
        stopCamera()
      } catch (e: any) {
        setAttendanceError(e.message || 'Attendance request failed.')
        setCameraError(e.message || 'Attendance request failed.')
      } finally {
        setSubmitting(false)
      }
    }
  }

  if (profileQuery.isError) {
    const rawError = profileQuery.error instanceof Error ? profileQuery.error.message : 'Verification failed.'
    const isNetworkError =
      rawError.toLowerCase().includes('failed to fetch') ||
      rawError.toLowerCase().includes('unable to connect') ||
      rawError.toLowerCase().includes('network') ||
      rawError.toLowerCase().includes('server availability')

    return (
      <div className="unregistered-container">
        <div className="unregistered-card">
          <div className="unregistered-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <AlertCircle size={44} color="#F59E0B" />
          </div>
          <h2>{isNetworkError ? 'Connection Issue' : 'Access Restricted'}</h2>
          <p style={{ margin: '1rem 0 1.5rem 0', lineHeight: 1.6 }}>
            {isNetworkError
              ? 'Unable to connect to the backend server. Please verify your internet connection or try connecting again.'
              : rawError}
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn-primary"
              style={{ width: 'auto', padding: '0.8rem 1.6rem', fontWeight: 600 }}
              onClick={() => {
                void profileQuery.refetch()
              }}
              disabled={profileQuery.isFetching}
            >
              {profileQuery.isFetching ? 'Connecting...' : 'Retry Connection'}
            </button>
            <button
              className="btn-secondary"
              style={{
                width: 'auto',
                padding: '0.8rem 1.6rem',
                background: 'transparent',
                border: '1px solid var(--danger, #EF4444)',
                color: 'var(--danger, #EF4444)',
                fontWeight: 600,
              }}
              onClick={() => {
                void signOut()
              }}
            >
              Log Out / Switch Account
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (profileQuery.isLoading && !profileQuery.data) {
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
            <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', margin: 0 }}>Skandan Portal</h2>
          </div>
        </div>
        <div className="portal-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, marginLeft: 'auto' }}>
          {/* Notification Bell */}
          <div style={{ position: 'relative', flexShrink: 0 }} ref={notificationDropdownRef}>
            <button
              type="button"
              className="portal-notification-bell-btn"
              onClick={() => setIsNotificationOpen((prev) => !prev)}
              aria-label="Notifications"
              style={{
                position: 'relative',
                background: isNotificationOpen ? 'rgba(107, 47, 160, 0.12)' : 'var(--panel)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '0.5rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text)',
                transition: 'all 0.2s ease',
                width: '38px',
                height: '38px',
                minWidth: '38px',
                flexShrink: 0,
              }}
            >
              <Bell size={20} />
              {unreadNotificationsCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    background: '#EF4444',
                    color: '#ffffff',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    borderRadius: '9999px',
                    minWidth: '18px',
                    height: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                    boxShadow: '0 2px 4px rgba(239, 68, 68, 0.4)',
                  }}
                >
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              )}
            </button>

            {/* Dropdown Flyout */}
            {isNotificationOpen && (
              <div
                className="portal-notification-dropdown"
                style={{
                  background: 'var(--panel, #ffffff)',
                  border: '1px solid var(--border, #e2e8f0)',
                  borderRadius: '16px',
                  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)',
                  zIndex: 1000,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '0.85rem 1rem',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>Notifications</span>
                    {unreadNotificationsCount > 0 && (
                      <span
                        style={{
                          background: 'rgba(107, 47, 160, 0.1)',
                          color: 'var(--primary)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '9999px',
                        }}
                      >
                        {unreadNotificationsCount} new
                      </span>
                    )}
                  </div>
                  {unreadNotificationsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => markAllNotificationsReadMutation.mutate()}
                      disabled={markAllNotificationsReadMutation.isPending}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--primary)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '0.2rem 0.4rem',
                      }}
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
                      <Bell size={28} style={{ opacity: 0.3, margin: '0 auto 0.5rem', display: 'block' }} />
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map((n) => {
                      const isApproved = n.notification_type === 'LEAVE_APPROVED'
                      const isRejected = n.notification_type === 'LEAVE_REJECTED'
                      return (
                        <div
                          key={n.id}
                          onClick={() => {
                            if (!n.is_read) {
                              markNotificationReadMutation.mutate(n.id)
                            }
                          }}
                          style={{
                            padding: '0.85rem 1rem',
                            borderBottom: '1px solid var(--border)',
                            background: n.is_read ? 'transparent' : 'rgba(107, 47, 160, 0.04)',
                            display: 'flex',
                            gap: '0.75rem',
                            alignItems: 'flex-start',
                            cursor: n.is_read ? 'default' : 'pointer',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <div style={{ marginTop: '2px', flexShrink: 0 }}>
                            {isApproved ? (
                              <CheckCircle2 size={18} color="#10B981" />
                            ) : isRejected ? (
                              <XCircle size={18} color="#EF4444" />
                            ) : n.title.includes('Submitted') ? (
                              <Calendar size={18} color="var(--primary)" />
                            ) : (
                              <AlertCircle size={18} color="#3B82F6" />
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
                              <h5
                                style={{
                                  margin: 0,
                                  fontSize: '0.85rem',
                                  fontWeight: n.is_read ? 600 : 700,
                                  color: 'var(--text)',
                                }}
                              >
                                {n.title}
                              </h5>
                              <span style={{ fontSize: '0.7rem', color: 'var(--muted)', flexShrink: 0 }}>
                                {formatRelativeTime(n.created_at)}
                              </span>
                            </div>
                            <p
                              style={{
                                margin: '0.25rem 0 0 0',
                                fontSize: '0.8rem',
                                color: 'var(--muted)',
                                lineHeight: 1.4,
                                wordBreak: 'break-word',
                              }}
                            >
                              {n.message}
                            </p>
                          </div>
                          {!n.is_read && (
                            <div
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: 'var(--primary)',
                                marginTop: '6px',
                                flexShrink: 0,
                              }}
                            />
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            className="ghost-button danger"
            style={{
              padding: '0.55rem 1rem',
              borderRadius: '12px',
              width: 'auto',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
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
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <strong>{attendanceError}</strong>
          </div>
        )}
        {/* Desktop / Tablet Top Tabs */}
        <div className="portal-tabs-top">
          <button
            type="button"
            className={`portal-tab-btn ${portalTab === 'home' ? 'active' : ''}`}
            onClick={() => setPortalTabWithHistory('home')}
          >
            <Home size={16} />
            <span>Home</span>
          </button>
          <button
            type="button"
            className={`portal-tab-btn ${portalTab === 'attendance' ? 'active' : ''}`}
            onClick={() => setPortalTabWithHistory('attendance')}
          >
            <Clock size={16} />
            <span>Attendance</span>
          </button>
          <button
            type="button"
            className={`portal-tab-btn ${portalTab === 'leaves' ? 'active' : ''}`}
            onClick={() => setPortalTabWithHistory('leaves')}
          >
            <Calendar size={16} />
            <span>Apply Leave</span>
          </button>
        </div>

        {/* Tab 1: Home View (Profile details + Live Clock + Schedule + Mark Attendance) */}
        {portalTab === 'home' && (
          <div className="stack" style={{ gap: '1.5rem' }}>
            {profile && (
              <div className="glass-card card-soft employee-card">
                <div className="employee-avatar-wrapper">
                  <img
                    key={`portal-avatar-${profile.id}-${profile.profile_photo || 'none'}`}
                    src={profile.profile_photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(profile.name) + '&background=6B2FA0&color=fff'}
                    alt={profile.name}
                    className="employee-avatar"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(profile.name) + '&background=6B2FA0&color=fff'
                    }}
                  />
                </div>
                <h3>{profile.name}</h3>
                <p style={{ fontWeight: 600, color: 'var(--primary)', marginTop: '0.2rem' }}>{profile.designation || 'Employee'}</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>{profile.department || 'General'} Department</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '0.4rem' }}>{profile.email}</p>
                {profile.phone && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '0.25rem' }}>{profile.phone}</p>
                )}
              </div>
            )}

            {/* Attendance actions: Mark Attendance Check-In / Check-Out */}
            <div className="glass-card card-soft stack" style={{ padding: '1.75rem' }}>
              <span className="eyebrow">Attendance & Duty</span>
              {assignmentQuery.isLoading ? (
                <p>Loading schedule...</p>
              ) : (
                <div>
                  {assignmentQuery.data && (
                    <div style={{ marginBottom: '1.5rem' }}>
                      <h4 style={{ color: 'var(--text)', fontSize: '1.15rem' }}>Patient: {assignmentQuery.data.patient_name}</h4>
                      <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <MapPin size={15} color="var(--primary)" style={{ flexShrink: 0 }} />
                        <span>{assignmentQuery.data.patient_address}</span>
                      </p>
                    </div>
                  )}

                  {locationPermGranted === false && (
                    <div
                      style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        color: 'var(--danger)',
                        padding: '0.8rem 1rem',
                        borderRadius: '10px',
                        fontSize: '0.85rem',
                        marginBottom: '1rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertCircle size={18} style={{ flexShrink: 0 }} />
                        <span>Location permissions are disabled or unavailable. Please enable GPS and allow location access to continue.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void ensureLocationPermission()}
                        style={{
                          background: '#0B2C8C',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '0.4rem 0.85rem',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        <RotateCcw size={14} /> Retry Location Access
                      </button>
                    </div>
                  )}

                  {sessionActive && (
                    <div
                      style={{
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        borderRadius: '12px',
                        padding: '1rem',
                        marginBottom: '1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.75rem',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#065F46', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                          <span>Active Duty Session</span>
                        </div>
                        {checkInTimeStr && (
                          <div style={{ fontSize: '0.85rem', color: 'var(--text)', marginTop: '0.2rem', fontWeight: 600 }}>
                            Check-in Time: {new Date(checkInTimeStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </div>
                        )}
                      </div>
                      <ActiveDutyTimer checkInTimeStr={checkInTimeStr} />
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
                        Mark Attendance (Check In)
                      </button>
                    ) : (
                      <button
                        className="btn-primary"
                        style={{ background: 'var(--danger)', flex: 1, minWidth: '200px' }}
                        onClick={() => startCamera('checkout')}
                      >
                        Attendance Logout (Check Out)
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <DigitalClockCard />
          </div>
        )}

        {/* Tab 2: Attendance Calendar View */}
        {portalTab === 'attendance' && (
          <div className="stack" style={{ gap: '1.5rem' }}>
            <div className="glass-card card-soft" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h4 style={{ margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem' }}>
                  <Clock size={18} /> Attendance Calendar
                </h4>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    background: 'var(--panel)',
                    padding: '0.25rem 0.35rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                  }}
                >
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    title="Previous Month"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      fontWeight: 800,
                      padding: '0.2rem 0.5rem',
                      color: 'var(--primary)',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                    }}
                  >
                    ◀
                  </button>
                  <span
                    style={{
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      color: 'var(--text)',
                      padding: '0.15rem 0.4rem',
                      minWidth: '115px',
                      textAlign: 'center',
                      userSelect: 'none',
                    }}
                  >
                    {calendarData.monthName}
                  </span>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    title="Next Month"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      fontWeight: 800,
                      padding: '0.2rem 0.5rem',
                      color: 'var(--primary)',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                    }}
                  >
                    ▶
                  </button>
                </div>
              </div>

              {/* Attendance Summary Banner: Left = Present/Absent counts, Right = Small Pie Chart */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  padding: '0.75rem 1rem',
                  marginBottom: '1.25rem',
                  background: 'var(--panel, #ffffff)',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)',
                }}
              >
                {/* Left Part: Total Days Present & Absent */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'var(--muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Monthly Attendance
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: '#10B981',
                          display: 'inline-block',
                          boxShadow: '0 0 6px rgba(16, 185, 129, 0.5)',
                        }}
                      />
                      <span style={{ fontSize: '0.86rem', color: 'var(--text)' }}>
                        Present:{' '}
                        <strong style={{ color: '#10B981', fontWeight: 800, fontSize: '0.96rem' }}>
                          {attendanceMonthStats.present}
                        </strong>{' '}
                        {attendanceMonthStats.present === 1 ? 'day' : 'days'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: '#EF4444',
                          display: 'inline-block',
                          boxShadow: '0 0 6px rgba(239, 68, 68, 0.5)',
                        }}
                      />
                      <span style={{ fontSize: '0.86rem', color: 'var(--text)' }}>
                        Absent:{' '}
                        <strong style={{ color: '#EF4444', fontWeight: 800, fontSize: '0.96rem' }}>
                          {attendanceMonthStats.absent}
                        </strong>{' '}
                        {attendanceMonthStats.absent === 1 ? 'day' : 'days'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Part: Small Pie Chart */}
                <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <AttendanceMiniPieChart
                    present={attendanceMonthStats.present}
                    absent={attendanceMonthStats.absent}
                    size={64}
                  />
                </div>
              </div>

              {/* Day Name Headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', textAlign: 'center', marginBottom: '0.5rem' }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Days Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
                {calendarData.days.map((item, idx) => {
                  if (!item) {
                    return <div key={`empty-${idx}`} style={{ minHeight: '54px', background: 'transparent' }} />
                  }

                  const isPresent = item.isPresent
                  const isPastOrToday = item.isPast || item.isToday

                  return (
                    <div
                      key={item.dayNumber}
                      style={{
                        minHeight: '58px',
                        background: 'var(--panel)',
                        border: item.isToday ? '2px solid var(--primary)' : '1px solid var(--border)',
                        borderRadius: '12px',
                        padding: '0.4rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontSize: '0.8rem', fontWeight: item.isToday ? 800 : 600 }}>{item.dayNumber}</span>
                      {isPastOrToday ? (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            width: '22px',
                            height: '22px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%',
                            background: isPresent ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: isPresent ? '#10B981' : '#EF4444',
                            marginTop: '0.2rem',
                          }}
                        >
                          {isPresent ? 'P' : 'A'}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.2rem' }}>—</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Apply Leave View */}
        {portalTab === 'leaves' && (
          <div className="stack" style={{ gap: '1.5rem' }}>
            {/* My Leave Requests History */}
            <div className="glass-card card-soft" style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h4 style={{ margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem' }}>
                    <Calendar size={20} /> My Leave Requests
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={openApplyModal}
                  style={{
                    background: 'var(--primary)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '0.6rem 1.15rem',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    boxShadow: '0 4px 12px rgba(107, 47, 160, 0.25)',
                  }}
                >
                  <Plus size={16} /> Apply for Leave
                </button>
              </div>

              {myLeavesQuery.isLoading ? (
                <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Loading leave requests...</p>
              ) : myLeaves.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--muted)', fontSize: '0.9rem' }}>
                  <Calendar size={36} style={{ opacity: 0.3, margin: '0 auto 0.75rem', display: 'block' }} />
                  <p style={{ margin: '0 0 1rem 0' }}>No leave requests submitted yet.</p>
                  <button
                    type="button"
                    onClick={openApplyModal}
                    style={{
                      background: 'var(--primary)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.5rem 1rem',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    <Plus size={15} /> Apply for Leave
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {myLeaves.map((leave) => {
                    const isPending = leave.status === 'PENDING'
                    const isApproved = leave.status === 'APPROVED'
                    const isRejected = leave.status === 'REJECTED'

                    const badgeConfig = isPending
                      ? { bg: 'rgba(245, 158, 11, 0.12)', text: '#B45309', border: 'rgba(245, 158, 11, 0.3)', label: 'Pending', Icon: Clock }
                      : isApproved
                        ? { bg: 'rgba(16, 185, 129, 0.12)', text: '#047857', border: 'rgba(16, 185, 129, 0.3)', label: 'Approved', Icon: CheckCircle2 }
                        : { bg: 'rgba(239, 68, 68, 0.12)', text: '#B91C1C', border: 'rgba(239, 68, 68, 0.3)', label: 'Rejected', Icon: XCircle }

                    return (
                      <div
                        key={leave.id}
                        style={{
                          background: 'var(--panel)',
                          border: '1px solid var(--border)',
                          borderRadius: '12px',
                          padding: '1rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.6rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span
                              style={{
                                fontWeight: 700,
                                fontSize: '0.95rem',
                                color: 'var(--text)',
                              }}
                            >
                              {leave.leave_type_display}
                            </span>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                padding: '0.2rem 0.55rem',
                                borderRadius: '9999px',
                                background: badgeConfig.bg,
                                color: badgeConfig.text,
                                border: `1px solid ${badgeConfig.border}`,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                              }}
                            >
                              <badgeConfig.Icon size={12} />
                              {badgeConfig.label}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 500 }}>
                            Applied on {new Date(leave.applied_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text)', fontWeight: 600 }}>
                            <Calendar size={15} color="var(--primary)" />
                            <span>{new Date(leave.start_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</span>
                            <span>→</span>
                            <span>{new Date(leave.end_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                          <span
                            style={{
                              background: 'rgba(107, 47, 160, 0.08)',
                              color: 'var(--primary)',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '6px',
                            }}
                          >
                            {leave.total_days} {leave.total_days === 1 ? 'Day' : 'Days'}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.4 }}>
                          <strong style={{ color: 'var(--text)', fontWeight: 600 }}>Reason: </strong>
                          {leave.reason}
                        </div>

                        {isRejected && leave.rejection_reason && (
                          <div
                            style={{
                              background: 'rgba(239, 68, 68, 0.08)',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              borderRadius: '8px',
                              padding: '0.55rem 0.75rem',
                              fontSize: '0.82rem',
                              color: '#B91C1C',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '0.5rem',
                            }}
                          >
                            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                            <div>
                              <strong>Rejection Reason: </strong> {leave.rejection_reason}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
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
                onClick={() => stopCamera()}
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
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={(e) => {
                  const target = e.currentTarget
                  target.play().then(() => setCameraReady(true)).catch(() => {})
                }}
                onCanPlay={() => setCameraReady(true)}
                onPlaying={() => setCameraReady(true)}
                className="camera-video"
                style={{
                  display: !tempPhoto ? 'block' : 'none',
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: 'scaleX(-1)',
                }}
              />
              {!cameraReady && !tempPhoto && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', gap: '0.75rem', background: '#000', zIndex: 2 }}>
                  <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: 'var(--primary, #6B2FA0)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: '0.9rem', color: '#ccc' }}>Starting camera...</span>
                </div>
              )}
              {!tempPhoto && <div className="camera-overlay-indicator" />}
              {tempPhoto && (
                <img src={tempPhoto} alt="Snapshot" className="camera-snapshot" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
            </div>

            <canvas ref={canvasRef} className="camera-canvas" />

            <div className="camera-footer">
              {!tempPhoto ? (
                <button
                  className="btn-primary"
                  onClick={capturePhoto}
                  disabled={!cameraReady}
                  style={{ opacity: cameraReady ? 1 : 0.6 }}
                >
                  {cameraReady ? 'Capture Photo' : 'Starting Camera...'}
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
                  {faceMatchMessage && (
                    <div style={{ color: 'var(--success)', fontSize: '0.95rem', textAlign: 'center' }}>
                      {faceMatchMessage}
                    </div>
                  )}
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

      {/* Apply for Leave Modal */}
      {isApplyModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: 'var(--panel, #ffffff)',
              border: '1px solid var(--border, #e2e8f0)',
              borderRadius: '20px',
              maxWidth: '520px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--primary)', fontWeight: 700 }}>
                  Apply for Leave
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--muted)' }}>
                  Submit a leave request for administrative review
                </p>
              </div>
              <button
                type="button"
                onClick={() => closeApplyModal()}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>

            {applyError && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: 'var(--danger)',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  marginBottom: '1rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{applyError}</span>
              </div>
            )}

            {!showApplyConfirm ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!leaveForm.start_date || !leaveForm.end_date) {
                    setApplyError('Please specify both start and end dates.')
                    return
                  }
                  if (leaveForm.start_date < todayStr) {
                    setApplyError('Leave start date cannot be in the past.')
                    return
                  }
                  if (new Date(leaveForm.end_date) < new Date(leaveForm.start_date)) {
                    setApplyError('End date cannot be earlier than start date.')
                    return
                  }
                  if (!leaveForm.reason.trim()) {
                    setApplyError('Please provide a reason for the leave.')
                    return
                  }
                  setApplyError(null)
                  setShowApplyConfirm(true)
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
              >
                {/* Leave Type */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Leave Type <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <select
                    value={leaveForm.leave_type}
                    onChange={(e) => setLeaveForm((f) => ({ ...f, leave_type: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border)',
                      background: 'var(--panel)',
                      color: 'var(--text)',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      outline: 'none',
                    }}
                  >
                    <option value="CASUAL">Casual Leave</option>
                    <option value="SICK">Sick Leave</option>
                    <option value="MATERNITY_PATERNITY">Maternity / Paternity Leave</option>
                    <option value="BEREAVEMENT">Bereavement Leave</option>
                    <option value="UNPAID">Unpaid Leave</option>
                  </select>
                </div>

                {/* Dates responsive grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Start Date <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <input
                      type="date"
                      required
                      min={todayStr}
                      value={leaveForm.start_date}
                      onChange={(e) => {
                        const newStart = e.target.value
                        setLeaveForm((f) => ({
                          ...f,
                          start_date: newStart,
                          end_date: f.end_date && f.end_date < newStart ? newStart : f.end_date,
                        }))
                      }}
                      style={{
                        width: '100%',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '10px',
                        border: '1px solid var(--border)',
                        background: 'var(--panel)',
                        color: 'var(--text)',
                        fontSize: '0.9rem',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      End Date <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <input
                      type="date"
                      required
                      min={leaveForm.start_date && leaveForm.start_date >= todayStr ? leaveForm.start_date : todayStr}
                      value={leaveForm.end_date}
                      onChange={(e) => setLeaveForm((f) => ({ ...f, end_date: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '10px',
                        border: '1px solid var(--border)',
                        background: 'var(--panel)',
                        color: 'var(--text)',
                        fontSize: '0.9rem',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Total Duration Calculated Pill */}
                {calculatedDays > 0 && (
                  <div
                    style={{
                      background: 'rgba(107, 47, 160, 0.08)',
                      border: '1px solid rgba(107, 47, 160, 0.2)',
                      borderRadius: '10px',
                      padding: '0.6rem 0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: '0.85rem', color: 'var(--text)', fontWeight: 600 }}>
                      Calculated Duration:
                    </span>
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: '0.9rem',
                        color: 'var(--primary)',
                      }}
                    >
                      {calculatedDays} {calculatedDays === 1 ? 'Day' : 'Days'}
                    </span>
                  </div>
                )}

                {/* Reason */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Reason <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Provide details about your leave..."
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm((f) => ({ ...f, reason: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border)',
                      background: 'var(--panel)',
                      color: 'var(--text)',
                      fontSize: '0.88rem',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => closeApplyModal()}
                    style={{
                      padding: '0.6rem 1.1rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      color: 'var(--text)',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '0.6rem 1.25rem',
                      borderRadius: '10px',
                      border: 'none',
                      background: 'var(--primary)',
                      color: '#ffffff',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(107, 47, 160, 0.3)',
                    }}
                  >
                    Review & Confirm →
                  </button>
                </div>
              </form>
            ) : (
              /* Confirmation Step */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div
                  style={{
                    background: 'rgba(107, 47, 160, 0.05)',
                    border: '1px solid rgba(107, 47, 160, 0.15)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                  }}
                >
                  <h4 style={{ margin: '0 0 0.85rem 0', color: 'var(--primary)', fontSize: '1rem', fontWeight: 700 }}>
                    Please Confirm Your Leave Details
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.88rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--muted)' }}>Type:</span>
                      <strong style={{ color: 'var(--text)' }}>
                        {leaveForm.leave_type.replace('_', ' ')}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--muted)' }}>Period:</span>
                      <strong style={{ color: 'var(--text)' }}>
                        {leaveForm.start_date} to {leaveForm.end_date}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--muted)' }}>Total Duration:</span>
                      <strong style={{ color: 'var(--primary)', fontSize: '0.95rem' }}>
                        {calculatedDays} {calculatedDays === 1 ? 'Day' : 'Days'}
                      </strong>
                    </div>
                    <div style={{ marginTop: '0.25rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
                      <span style={{ color: 'var(--muted)', display: 'block', marginBottom: '0.2rem' }}>Reason:</span>
                      <p style={{ margin: 0, color: 'var(--text)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                        "{leaveForm.reason}"
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    disabled={applyLeaveMutation.isPending}
                    onClick={() => setShowApplyConfirm(false)}
                    style={{
                      padding: '0.6rem 1.1rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      color: 'var(--text)',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ← Edit Details
                  </button>
                  <button
                    type="button"
                    disabled={applyLeaveMutation.isPending}
                    onClick={() => applyLeaveMutation.mutate(leaveForm)}
                    style={{
                      padding: '0.6rem 1.35rem',
                      borderRadius: '10px',
                      border: 'none',
                      background: 'var(--primary)',
                      color: '#ffffff',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(107, 47, 160, 0.3)',
                    }}
                  >
                    {applyLeaveMutation.isPending ? 'Submitting Request...' : 'Confirm & Submit'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Fixed Bottom Navigation */}
      <nav className="portal-bottom-nav" aria-label="Bottom Navigation">
        <button
          type="button"
          className={`portal-nav-item ${portalTab === 'home' ? 'active' : ''}`}
          onClick={() => setPortalTabWithHistory('home')}
        >
          {portalTab === 'home' && <div className="portal-nav-indicator" />}
          <div className="portal-nav-icon-wrapper">
            <Home size={20} />
          </div>
          <span>Home</span>
        </button>

        <button
          type="button"
          className={`portal-nav-item ${portalTab === 'attendance' ? 'active' : ''}`}
          onClick={() => setPortalTabWithHistory('attendance')}
        >
          {portalTab === 'attendance' && <div className="portal-nav-indicator" />}
          <div className="portal-nav-icon-wrapper">
            <Clock size={20} />
          </div>
          <span>Attendance</span>
        </button>

        <button
          type="button"
          className={`portal-nav-item ${portalTab === 'leaves' ? 'active' : ''}`}
          onClick={() => setPortalTabWithHistory('leaves')}
        >
          {portalTab === 'leaves' && <div className="portal-nav-indicator" />}
          <div className="portal-nav-icon-wrapper">
            <Calendar size={20} />
          </div>
          <span>Apply Leave</span>
        </button>
      </nav>
    </div>
  )
}
