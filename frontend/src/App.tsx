import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { SignedIn, SignedOut } from '@clerk/clerk-react'
import { AppShell } from './components/AppShell'

const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })))
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const EmployeesPage = lazy(() => import('./pages/EmployeesPage').then((module) => ({ default: module.EmployeesPage })))
const AttendancePage = lazy(() => import('./pages/AttendancePage').then((module) => ({ default: module.AttendancePage })))
const AssignmentsPage = lazy(() => import('./pages/AssignmentsPage').then((module) => ({ default: module.AssignmentsPage })))
const TrackingPage = lazy(() => import('./pages/TrackingPage').then((module) => ({ default: module.TrackingPage })))
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((module) => ({ default: module.ReportsPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))

function RouteFallback() {
  return <div className="glass-card route-loading">Loading page...</div>
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route
          path="/sign-in"
          element={
            <SignedOut>
              <LoginPage />
            </SignedOut>
          }
        />
        <Route
          path="/*"
          element={
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
          }
        />
      </Routes>
    </Suspense>
  )
}
