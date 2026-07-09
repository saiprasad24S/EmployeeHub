export function SettingsPage() {
  return (
    <section className="glass-card">
      <span className="eyebrow">Settings</span>
      <h3>Application and access configuration</h3>
      <div className="report-grid">
        <article className="report-card">
          <strong>Authentication</strong>
          <p>Clerk Google sign-in, role-based access, and session verification.</p>
        </article>
        <article className="report-card">
          <strong>Storage</strong>
          <p>Cloudinary media folders for attendance, employees, and patient visits.</p>
        </article>
        <article className="report-card">
          <strong>Tracking</strong>
          <p>Geofence defaults, GPS interval policy, and audit logging.</p>
        </article>
      </div>
    </section>
  )
}
