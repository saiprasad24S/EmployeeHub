import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { SignedIn, SignedOut } from '@clerk/clerk-react'
import { AppShell } from './components/AppShell'

const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const SignUpPage = lazy(() => import('./pages/SignUpPage').then((m) => ({ default: m.SignUpPage })))
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const EmployeesPage = lazy(() => import('./pages/EmployeesPage').then((m) => ({ default: m.EmployeesPage })))
const AttendancePage = lazy(() => import('./pages/AttendancePage').then((m) => ({ default: m.AttendancePage })))
const AssignmentsPage = lazy(() => import('./pages/AssignmentsPage').then((m) => ({ default: m.AssignmentsPage })))
const TrackingPage = lazy(() => import('./pages/TrackingPage').then((m) => ({ default: m.TrackingPage })))
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))

function RouteFallback() {
  return <div className="glass-card route-loading">Loading page...</div>
}

export default function App() {
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
                <AppShell>
                  <Suspense fallback={<RouteFallback />}>
                    <Routes>
                      <Route path="/" element={<DashboardPage />} />
                      <Route path="/employees" element={<EmployeesPage />} />
                      <Route path="/attendance" element={<AttendancePage />} />
                      <Route path="/assignments" element={<AssignmentsPage />} />
                      <Route path="/tracking/:employeeId" element={<TrackingPage />} />
                      <Route path="/reports" element={<ReportsPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Suspense>
                </AppShell>
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
