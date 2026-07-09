import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { authedFetch } from '../lib/api'

export function EmployeesPage() {
  const { getToken } = useAuth()
  const employeesQuery = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Missing token')
      const response = await authedFetch('/api/employees/', token)
      if (!response.ok) throw new Error('Unable to load employees')
      return response.json() as Promise<{ results?: Array<{ employee_id: string; name: string; email: string; department: string; designation: string; is_active: boolean }> }>
    },
  })

  const employees = employeesQuery.data?.results ?? []

  return (
    <section className="glass-card card-soft">
      <div className="section-header">
        <div>
          <span className="eyebrow">Employees</span>
          <h3>Registered workforce</h3>
          <p>Search and review employee records, roles, and active status.</p>
        </div>
      </div>
      <div className="table-wrap data-table-shell">
        <table>
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Department</th>
              <th>Designation</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.employee_id}>
                <td>{employee.employee_id}</td>
                <td>{employee.name}</td>
                <td>{employee.email}</td>
                <td>{employee.department}</td>
                <td>{employee.designation}</td>
                <td>
                  <span className={`status-pill ${employee.is_active ? 'active' : 'inactive'}`}>
                    {employee.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
