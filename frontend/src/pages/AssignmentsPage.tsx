import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { authedFetch } from '../lib/api'

export function AssignmentsPage() {
  const { getToken } = useAuth()
  const query = useQuery({
    queryKey: ['assignments'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Missing token')
      const response = await authedFetch('/api/assignments/', token)
      if (!response.ok) throw new Error('Unable to load assignments')
      return response.json() as Promise<{ results?: Array<{ patient_name: string; patient_address: string; visit_date: string; status: string; employee_name: string }> }>
    },
  })

  return (
    <section className="glass-card card-soft">
      <span className="eyebrow">Assignments</span>
      <h3>Patient visit schedule</h3>
      <div className="stack">
        {(query.data?.results ?? []).map((assignment, index) => (
          <article className="assignment-row" key={`${assignment.patient_name}-${index}`}>
            <div>
              <strong>{assignment.patient_name}</strong>
              <p>{assignment.patient_address}</p>
            </div>
            <div>
              <span>{assignment.employee_name}</span>
              <p>{assignment.visit_date}</p>
            </div>
            <span className="badge success">{assignment.status}</span>
          </article>
        ))}
      </div>
    </section>
  )
}
