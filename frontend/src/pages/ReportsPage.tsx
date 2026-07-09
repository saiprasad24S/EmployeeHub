export function ReportsPage() {
  return (
    <section className="glass-card">
      <span className="eyebrow">Reports</span>
      <h3>Attendance, movement, and visit exports</h3>
      <div className="report-grid">
        <article className="report-card">
          <strong>Attendance Reports</strong>
          <p>Daily, weekly, and monthly attendance exports.</p>
        </article>
        <article className="report-card">
          <strong>Route Reports</strong>
          <p>Employee GPS trail with distance calculations.</p>
        </article>
        <article className="report-card">
          <strong>Patient Visit Reports</strong>
          <p>Assignment completion, notes, and photo evidence.</p>
        </article>
      </div>
    </section>
  )
}
