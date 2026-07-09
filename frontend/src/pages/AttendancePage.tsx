export function AttendancePage() {
  return (
    <section className="glass-card">
      <span className="eyebrow">Attendance</span>
      <h3>Large check-in workflow</h3>
      <div className="info-panel-grid">
        <article className="workflow-card accent-card">
          <h4>Mark Attendance</h4>
          <p>Verify GPS, capture selfie, upload to Cloudinary, and confirm face match in one flow.</p>
        </article>
        <article className="workflow-card">
          <h4>Current Location</h4>
          <p>Show assignment location, time, distance from site, and liveness status.</p>
        </article>
        <article className="workflow-card">
          <h4>Success State</h4>
          <p>Trigger a soft confirmation animation and keep the working session active until checkout.</p>
        </article>
      </div>
    </section>
  )
}
