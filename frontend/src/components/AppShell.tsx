import { useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { SignOutButton, UserButton } from '@clerk/clerk-react'
import { useSearch } from '../context/SearchContext'

const navItems = [
  { label: 'Dashboard', icon: '📊', to: '/' },
  { label: 'Employees', icon: '👥', to: '/employees' },
  { label: 'Attendance', icon: '📅', to: '/attendance' },
  { label: 'Assignments', icon: '📋', to: '/assignments' },
  { label: 'Live Tracking', icon: '📍', to: '/tracking' },
  { label: 'Settings', icon: '⚙️', to: '/settings' },
]

export function AppShell({ children }: PropsWithChildren) {
  const navigate = useNavigate()
  const location = useLocation()
  const { searchQuery, setSearchQuery } = useSearch()
  const currentDate = useMemo(() => new Intl.DateTimeFormat('en-IN', { dateStyle: 'full' }).format(new Date()), [])
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = window.localStorage.getItem('employeehub-theme')
    if (savedTheme) return savedTheme === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    const theme = isDarkMode ? 'dark' : 'light'
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    window.localStorage.setItem('employeehub-theme', theme)
  }, [isDarkMode])

  const breadcrumb = useMemo(() => {
    const current = navItems.find((item) => location.pathname.startsWith(item.to))
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
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span style={{ marginRight: '0.5rem' }}>{item.icon}</span> {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="ghost-button" onClick={() => navigate('/sign-in')}>
            Switch account
          </button>
          <SignOutButton>
            <button className="ghost-button danger">Logout</button>
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
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
            <span className="mobile-nav-icon">{item.icon}</span>
            <span className="mobile-nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
