import { useEffect, useMemo, useState, useRef, type PropsWithChildren } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { SignOutButton, UserButton } from '@clerk/clerk-react'
import { ChevronDown } from 'lucide-react'
import { useSearch } from '../context/SearchContext'

const navItems = [
  { label: 'Dashboard', to: '/' },
  { label: 'Employees', to: '/employees' },
  { label: 'Attendance', to: '/attendance' },
  { label: 'Leaves', to: '/leaves' },
  { label: 'Salary Check', to: '/salary-check' },
  { label: 'Invoice', to: '/invoice' },
  { label: 'Payslip', to: '/payslip' },
]

import { safeStorage } from '../lib/storage'

export function AppShell({ children }: PropsWithChildren) {
  const navigate = useNavigate()
  const location = useLocation()
  const { searchQuery, setSearchQuery } = useSearch()
  const currentDate = useMemo(() => new Intl.DateTimeFormat('en-IN', { dateStyle: 'full' }).format(new Date()), [])
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = safeStorage.getItem('employeehub-theme')
    if (savedTheme) return savedTheme === 'dark'
    return typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : false
  })

  // Employees dropdown state (supports both click and hover)
  const [isEmpDropdownOpen, setIsEmpDropdownOpen] = useState(false)
  const [isMobileEmpMenuOpen, setIsMobileEmpMenuOpen] = useState(false)
  const dropdownCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isEmpRoute = location.pathname === '/employees' || location.pathname === '/all-employees'

  const handleMouseEnter = () => {
    if (dropdownCloseTimeoutRef.current) {
      clearTimeout(dropdownCloseTimeoutRef.current)
      dropdownCloseTimeoutRef.current = null
    }
    setIsEmpDropdownOpen(true)
  }

  const handleMouseLeave = () => {
    dropdownCloseTimeoutRef.current = setTimeout(() => {
      setIsEmpDropdownOpen(false)
    }, 250)
  }

  useEffect(() => {
    // Auto-close dropdowns on navigation change
    setIsEmpDropdownOpen(false)
    setIsMobileEmpMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const theme = isDarkMode ? 'dark' : 'light'
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    safeStorage.setItem('employeehub-theme', theme)
  }, [isDarkMode])

  const breadcrumb = useMemo(() => {
    if (location.pathname === '/all-employees') return 'All Employees'
    if (location.pathname === '/employees') return 'Employees'
    const current = navItems.find((item) =>
      item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
    )
    return current?.label ?? 'Dashboard'
  }, [location.pathname])

  const hideSearchOn = ['/attendance', '/assignments', '/settings']
  const shouldShowSearch = !hideSearchOn.some((path) => location.pathname.startsWith(path))

  return (
    <div className="shell">
      {/* Desktop Sidebar */}
      <aside className="sidebar desktop-only-sidebar">
        <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img
            src="https://skandanhomecarre.com/wp-content/uploads/2025/06/cropped-SKANDA-fav-192x192.png"
            alt="Skandan Home Carre Clinic"
            className="brand-logo"
            style={{ width: '44px', height: '44px', objectFit: 'contain', flexShrink: 0 }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h1 style={{ fontSize: '1.2rem', lineHeight: '1.2', margin: 0, fontWeight: 700 }}>Skandan</h1>
            <p style={{ fontSize: '0.8rem', margin: '0.1rem 0 0 0', color: 'var(--muted)', whiteSpace: 'nowrap' }}>Home Carre Clinic LLP</p>
          </div>
        </div>
        <div className="sidebar-chip">Healthcare field workforce platform</div>
        <nav>
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Dashboard
          </NavLink>

          {/* Employees with Dropdown */}
          <div
            className="nav-item-dropdown"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{ position: 'relative' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', position: 'relative' }}>
              <NavLink
                to="/employees"
                end
                className={() => `nav-link ${isEmpRoute ? 'active' : ''}`}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '2.5rem' }}
              >
                <span>Employees</span>
              </NavLink>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsEmpDropdownOpen((prev) => !prev)
                }}
                aria-label="Toggle Employees Menu"
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.3rem',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isEmpRoute ? 'var(--primary)' : 'var(--muted)',
                  transition: 'transform 0.2s ease',
                }}
              >
                <ChevronDown
                  size={16}
                  style={{
                    transform: isEmpDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }}
                />
              </button>
            </div>

            {/* Dropdown Menu */}
            {isEmpDropdownOpen && (
              <div
                className="nav-dropdown-menu"
                style={{
                  marginTop: '0.35rem',
                  marginLeft: '0.75rem',
                  padding: '0.35rem',
                  background: 'var(--panel)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.2rem',
                }}
              >
                <NavLink
                  to="/employees"
                  end
                  className={({ isActive }) =>
                    `nav-link ${isActive ? 'active' : ''}`
                  }
                  style={{
                    padding: '0.55rem 0.85rem',
                    fontSize: '0.88rem',
                    borderRadius: '8px',
                  }}
                  onClick={() => setIsEmpDropdownOpen(false)}
                >
                  Employees (Active)
                </NavLink>
                <NavLink
                  to="/all-employees"
                  end
                  className={({ isActive }) =>
                    `nav-link ${isActive ? 'active' : ''}`
                  }
                  style={{
                    padding: '0.55rem 0.85rem',
                    fontSize: '0.88rem',
                    borderRadius: '8px',
                  }}
                  onClick={() => setIsEmpDropdownOpen(false)}
                >
                  All Employees
                </NavLink>
              </div>
            )}
          </div>

          <NavLink to="/attendance" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Attendance
          </NavLink>
          <NavLink to="/leaves" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Leaves
          </NavLink>
          <NavLink to="/salary-check" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Salary Check
          </NavLink>
          <NavLink to="/invoice" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Invoice
          </NavLink>
          <NavLink to="/payslip" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Payslip
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <button className="ghost-button" onClick={() => { safeStorage.removeItem('skandan_user_role'); navigate('/sign-in') }}>
            Switch account
          </button>
          <SignOutButton>
            <button className="ghost-button danger" onClick={() => safeStorage.removeItem('skandan_user_role')}>Logout</button>
          </SignOutButton>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main className="content">
        {/* Mobile Header Bar */}
        <div className="mobile-header-bar">
          <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <img
              src="https://skandanhomecarre.com/wp-content/uploads/2025/06/cropped-SKANDA-fav-192x192.png"
              alt="Skandan"
              style={{ width: '32px', height: '32px', objectFit: 'contain' }}
            />
            <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>Skandan</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              className="theme-toggle-icon-btn"
              type="button"
              onClick={() => setIsDarkMode((value) => !value)}
              aria-label="Toggle Theme"
              style={{
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              {isDarkMode ? '🌙' : '☀️'}
            </button>
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </div>

        {/* Desktop Topbar */}
        <header className="topbar">
          <div className="topbar-copy">
            <span className="eyebrow">Employee Management System</span>
            <h2>{breadcrumb}</h2>
            <p>{currentDate}</p>
          </div>
          <div className="topbar-actions">
            {shouldShowSearch && (
              <label className="search-shell">
                <span>Search</span>
                <input
                  type="search"
                  placeholder="Search mail, ID, location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </label>
            )}
            <button
              className="theme-toggle"
              type="button"
              onClick={() => setIsDarkMode((value) => !value)}
              aria-pressed={isDarkMode}
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <span className="theme-toggle-copy">
                <span className="theme-toggle-label">Dark mode</span>
                <span className="theme-toggle-state">{isDarkMode ? 'On' : 'Off'}</span>
              </span>
              <span className={`theme-toggle-track ${isDarkMode ? 'on' : ''}`}>
                <span className="theme-toggle-knob" />
              </span>
            </button>
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </header>

        {children}
      </main>

      {/* Fixed Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav">
        <NavLink to="/" end className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
          <span className="mobile-nav-label">Dashboard</span>
        </NavLink>

        {/* Mobile Employees with Menu */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setIsMobileEmpMenuOpen((prev) => !prev)}
            className={`mobile-nav-link ${isEmpRoute ? 'active' : ''}`}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', width: '100%', padding: '0.25rem' }}
          >
            <span className="mobile-nav-label" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              Employees <ChevronDown size={11} style={{ transform: isMobileEmpMenuOpen ? 'rotate(180deg)' : 'none' }} />
            </span>
          </button>
          {isMobileEmpMenuOpen && (
            <div
              style={{
                position: 'absolute',
                bottom: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginBottom: '8px',
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '4px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
                zIndex: 1000,
                minWidth: '135px',
              }}
            >
              <NavLink
                to="/employees"
                end
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                style={{ padding: '6px 10px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                onClick={() => setIsMobileEmpMenuOpen(false)}
              >
                Employees (Active)
              </NavLink>
              <NavLink
                to="/all-employees"
                end
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                style={{ padding: '6px 10px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                onClick={() => setIsMobileEmpMenuOpen(false)}
              >
                All Employees
              </NavLink>
            </div>
          )}
        </div>

        <NavLink to="/attendance" end className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
          <span className="mobile-nav-label">Attendance</span>
        </NavLink>
        <NavLink to="/leaves" end className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
          <span className="mobile-nav-label">Leaves</span>
        </NavLink>
        <NavLink to="/salary-check" end className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
          <span className="mobile-nav-label">Salary Check</span>
        </NavLink>
        <NavLink to="/invoice" end className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
          <span className="mobile-nav-label">Invoice</span>
        </NavLink>
        <NavLink to="/payslip" end className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
          <span className="mobile-nav-label">Payslip</span>
        </NavLink>
      </nav>
    </div>
  )
}
