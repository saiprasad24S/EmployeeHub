import { lazy, Suspense, useState, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { SignedIn, SignedOut, SignOutButton, useAuth } from '@clerk/clerk-react'
import { AppShell } from './components/AppShell'
import { authedFetch } from './lib/api'
import { useLocationTracker } from './hooks/useLocationTracker'

const EmployeePortal = lazy(() => import('./pages/EmployeePortal').then((m) => ({ default: m.EmployeePortal })))
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const SignUpPage = lazy(() => import('./pages/SignUpPage').then((m) => ({ default: m.SignUpPage })))
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const EmployeesPage = lazy(() => import('./pages/EmployeesPage').then((m) => ({ default: m.EmployeesPage })))
const AttendancePage = lazy(() => import('./pages/AttendancePage').then((m) => ({ default: m.AttendancePage })))
const AssignmentsPage = lazy(() => import('./pages/AssignmentsPage').then((m) => ({ default: m.AssignmentsPage })))
const TrackingPage = lazy(() => import('./pages/TrackingPage').then((m) => ({ default: m.TrackingPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))

function RouteFallback() {
  return <div className="glass-card route-loading">Loading page...</div>
}

function MainAppSelector() {
  const { getToken } = useAuth()
  const [role, setRole] = useState<'ADMIN' | 'EMPLOYEE' | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    async function determineRole() {
      try {
        const token = await getToken()
        if (!token) {
          setAuthError('Missing Clerk session token.')
          setLoading(false)
          return
        }
        const res = await authedFetch('/api/auth/login', token, { method: 'POST' })
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          setAuthError(errData.detail || 'Access restricted. You are not registered in the system.')
          setLoading(false)
          return
        }
        const data = await res.json()
        setRole(data.role)
        setLoading(false)
      } catch (err: any) {
        setAuthError(err.message || 'Verification failed')
        setLoading(false)
      }
    }
    determineRole()
  }, [getToken])

  if (loading) {
    return (
      <div className="unregistered-container">
        <div className="glass-card route-loading">Verifying credentials...</div>
      </div>
    )
  }

  if (authError || !role) {
    return (
      <div className="unregistered-container">
        <div className="unregistered-card">
          <div className="unregistered-icon">⚠️</div>
          <h2>Access Restricted</h2>
          <p style={{ margin: '1rem 0 2rem 0', lineHeight: 1.6 }}>{authError || 'User profile not found.'}</p>
          <SignOutButton>
            <button className="btn-primary" style={{ background: 'var(--danger)', width: 'auto', padding: '0.8rem 2rem' }}>
              Log Out / Switch Account
            </button>
          </SignOutButton>
        </div>
      </div>
    )
  }

  if (role === 'EMPLOYEE') {
    return (
      <Suspense fallback={<RouteFallback />}>
        <EmployeePortal />
      </Suspense>
    )
  }

  return (
    <AppShell>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/assignments" element={<AssignmentsPage />} />
          <Route path="/tracking" element={<TrackingPage />} />
          <Route path="/tracking/:employeeId" element={<TrackingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  )
}

export default function App() {
  const { getToken } = useAuth()
  useLocationTracker(getToken)

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route
          path="/sign-in/*"
          element={
            <>
              <SignedOut>
                <LoginPage />
              </SignedOut>
              <SignedIn>
                <Navigate to="/" replace />
              </SignedIn>
            </>
          }
        />
        <Route
          path="/sign-up/*"
          element={
            <>
              <SignedOut>
                <SignUpPage />
              </SignedOut>
              <SignedIn>
                <Navigate to="/" replace />
              </SignedIn>
            </>
          }
        />
        <Route
          path="/*"
          element={
            <>
              <SignedIn>
                <MainAppSelector />
              </SignedIn>
              <SignedOut>
                <Navigate to="/sign-in" replace />
              </SignedOut>
            </>
          }
        />
      </Routes>
    </Suspense>
  )
}
