import { lazy, Suspense, useState, useEffect, useCallback } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthenticateWithRedirectCallback, SignedIn, SignedOut, SignOutButton, useAuth } from '@clerk/clerk-react'
import { AppShell } from './components/AppShell'
import { authedFetch } from './lib/api'
import { useLocationTracker } from './hooks/useLocationTracker'

import { safeStorage } from './lib/storage'

// Preload dashboard chunk for instant render
const dashboardPromise = import('./pages/DashboardPage')
const DashboardPage = lazy(() => dashboardPromise.then((m) => ({ default: m.DashboardPage })))
const EmployeePortal = lazy(() => import('./pages/EmployeePortal').then((m) => ({ default: m.EmployeePortal })))
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const SignUpPage = lazy(() => import('./pages/SignUpPage').then((m) => ({ default: m.SignUpPage })))
const EmployeesPage = lazy(() => import('./pages/EmployeesPage').then((m) => ({ default: m.EmployeesPage })))
const AttendancePage = lazy(() => import('./pages/AttendancePage').then((m) => ({ default: m.AttendancePage })))
const AssignmentsPage = lazy(() => import('./pages/AssignmentsPage').then((m) => ({ default: m.AssignmentsPage })))
const TrackingPage = lazy(() => import('./pages/TrackingPage').then((m) => ({ default: m.TrackingPage })))
const InvoicePage = lazy(() => import('./pages/InvoicePage').then((m) => ({ default: m.InvoicePage })))
const PayslipPage = lazy(() => import('./pages/PayslipPage').then((m) => ({ default: m.PayslipPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))

function RouteFallback() {
  return <div className="glass-card route-loading">Loading page...</div>
}

function MainAppSelector() {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const [role, setRole] = useState<'ADMIN' | 'EMPLOYEE' | null>(() => {
    const cached = safeStorage.getItem('skandan_user_role')
    return (cached === 'ADMIN' || cached === 'EMPLOYEE') ? cached : null
  })
  const [loading, setLoading] = useState(() => {
    const cached = safeStorage.getItem('skandan_user_role')
    return !cached
  })
  const [authError, setAuthError] = useState<string | null>(null)

  const determineRole = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return
    const hasCached = !!safeStorage.getItem('skandan_user_role')
    if (!hasCached) {
      setLoading(true)
    }
    setAuthError(null)
    try {
      const token = await getToken()
      if (!token) {
        setAuthError('Missing authentication session token. Please log in again.')
        safeStorage.removeItem('skandan_user_role')
        setLoading(false)
        return
      }
      const res = await authedFetch('/api/auth/login', token, { method: 'POST' })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        setAuthError(errData.detail || 'Access restricted. Your account is not registered in the system.')
        safeStorage.removeItem('skandan_user_role')
        setLoading(false)
        return
      }
      const data = await res.json()
      const normalizedRole = (String(data.role || '').toUpperCase() as 'ADMIN' | 'EMPLOYEE') || 'ADMIN'
      safeStorage.setItem('skandan_user_role', normalizedRole)
      setRole(normalizedRole)
      setLoading(false)
    } catch (err: any) {
      if (!hasCached) {
        setAuthError(
          err.message === 'Failed to fetch'
            ? 'Unable to connect to the server (Failed to fetch). Please ensure the backend server is running and accessible.'
            : err.message || 'Verification failed'
        )
      }
      setLoading(false)
    }
  }, [getToken, isLoaded, isSignedIn])

  useEffect(() => {
    determineRole()
  }, [determineRole])

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
          <p style={{ margin: '1rem 0 1.5rem 0', lineHeight: 1.6 }}>{authError || 'User profile not found.'}</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn-primary"
              onClick={determineRole}
              style={{ width: 'auto', padding: '0.8rem 1.5rem' }}
            >
              Retry Connection
            </button>
            <SignOutButton>
              <button className="btn-secondary" style={{ width: 'auto', padding: '0.8rem 1.5rem' }}>
                Log Out / Switch Account
              </button>
            </SignOutButton>
          </div>
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
          <Route index element={<DashboardPage />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="assignments" element={<AssignmentsPage />} />
          <Route path="tracking" element={<TrackingPage />} />
          <Route path="tracking/:employeeId" element={<TrackingPage />} />
          <Route path="invoice" element={<InvoicePage />} />
          <Route path="payslip" element={<PayslipPage />} />
          <Route path="settings" element={<SettingsPage />} />
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
          path="/sso-callback/*"
          element={<AuthenticateWithRedirectCallback />}
        />
        <Route
          path="/sso-callback"
          element={<AuthenticateWithRedirectCallback />}
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
