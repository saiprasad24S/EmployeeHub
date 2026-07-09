import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { authedFetch } from '../lib/api'

export function TrackingPage() {
  const { employeeId } = useParams()
  const { getToken } = useAuth()

  const routeQuery = useQuery({
    queryKey: ['route', employeeId],
    enabled: Boolean(employeeId),
    queryFn: async () => {
      const token = await getToken()
      if (!token || !employeeId) throw new Error('Missing token or employee id')
      const response = await authedFetch(`/api/location/employee/route/${employeeId}/`, token)
      if (!response.ok) throw new Error('Unable to load route')
      return response.json() as Promise<{ route: Array<{ latitude: number; longitude: number; timestamp: string }> }>
    },
  })

  return (
    <section className="glass-card card-soft">
      <span className="eyebrow">Tracking</span>
      <h3>Employee route history</h3>
      <pre className="code-block light-block">{JSON.stringify(routeQuery.data, null, 2)}</pre>
    </section>
  )
}
