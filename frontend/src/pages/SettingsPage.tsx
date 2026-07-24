import { useState } from 'react'

export function SettingsPage() {
  const [defaultRadius, setDefaultRadius] = useState(100)
  const [allowNoAssignment, setAllowNoAssignment] = useState(true)
  const [livenessStrictness, setLivenessStrictness] = useState('Normal')
  const [saveSuccess, setSaveSuccess] = useState(false)

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 3000)
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '900px' }}>
      <div className="glass-card card-soft" style={{ padding: '2rem' }}>
        <div className="section-header" style={{ marginBottom: '1.5rem' }}>
          <div>
            <span className="eyebrow">SYSTEM CONFIGURATION</span>
            <h3>Platform & Workforce Settings</h3>
            <p>Manage geofencing rules, media storage status, database connections, and platform policies.</p>
          </div>
        </div>

        {saveSuccess && (
          <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10B981', borderRadius: '12px', fontWeight: 600, marginBottom: '1.5rem' }}>
            ✅ System settings successfully updated!
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Section 1: Geofencing & Attendance Policies */}
          <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📍 Geofencing & Attendance Controls
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="stack" style={{ gap: '0.5rem' }}>
                <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Default Geofence Radius (meters)</label>
                <input
                  type="number"
                  value={defaultRadius}
                  onChange={(e) => setDefaultRadius(Number(e.target.value))}
                  style={{
                    padding: '0.65rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    background: 'var(--panel)',
                    color: 'var(--text)',
                  }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                  Distance tolerance around employee default address for marking attendance.
                </span>
              </div>

              <div className="stack" style={{ gap: '0.5rem' }}>
                <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Face Liveness Verification Threshold</label>
                <select
                  value={livenessStrictness}
                  onChange={(e) => setLivenessStrictness(e.target.value)}
                  style={{
                    padding: '0.65rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    background: 'var(--panel)',
                    color: 'var(--text)',
                  }}
                >
                  <option value="Normal">Normal (Recommended)</option>
                  <option value="Strict">Strict (High Confidence)</option>
                  <option value="Relaxed">Relaxed (Low Lighting)</option>
                </select>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                  Controls client-side face embedding matching strictness during selfie capture.
                </span>
              </div>
            </div>

            <div className="stack" style={{ gap: '0.5rem', marginTop: '1rem', flexDirection: 'row', alignItems: 'center' }}>
              <input
                type="checkbox"
                id="noAssignmentCheck"
                checked={allowNoAssignment}
                onChange={(e) => setAllowNoAssignment(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="noAssignmentCheck" style={{ cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
                Allow check-in at employee default address when no patient assignment is scheduled
              </label>
            </div>
          </div>

          {/* Section 2: Cloudinary Storage Integration */}
          <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ☁️ Cloudinary Media Cloud Storage
            </h4>
            <div style={{ background: 'var(--panel)', padding: '1rem', borderRadius: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block' }}>STORAGE ENGINE</span>
                <strong style={{ fontSize: '0.9rem' }}>django-cloudinary-storage</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block' }}>CLOUD NAME</span>
                <strong style={{ fontSize: '0.9rem' }}>p3wngo6o</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block' }}>CONNECTION STATUS</span>
                <span style={{ color: '#10B981', fontWeight: 600, fontSize: '0.9rem' }}>🟢 Connected & Active</span>
              </div>
            </div>
          </div>

          {/* Section 3: Database & Hosting Environment */}
          <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🗄️ Database & Environment Specs
            </h4>
            <div style={{ background: 'var(--panel)', padding: '1rem', borderRadius: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block' }}>DATABASE ENGINE</span>
                <strong style={{ fontSize: '0.9rem' }}>MySQL (Aiven Cloud Services)</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block' }}>HOST DOMAIN</span>
                <strong style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>mysql-3cbf880b-skandanclinic.j.aivencloud.com</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block' }}>PLATFORM TIMEZONE</span>
                <strong style={{ fontSize: '0.9rem' }}>Asia/Kolkata (IST)</strong>
              </div>
            </div>
          </div>

          {/* Section 4: Organization Info */}
          <div>
            <h4 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🏢 Organization Information
            </h4>
            <p style={{ margin: '0.2rem 0', fontSize: '0.9rem' }}><strong>Company Name:</strong> Skandan Home Carre Clinic LLP</p>
            <p style={{ margin: '0.2rem 0', fontSize: '0.9rem' }}><strong>Platform Version:</strong> EmployeeHub v2.4.0 (Enterprise Edition)</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="submit" className="btn-primary" style={{ padding: '0.75rem 2rem' }}>
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}
