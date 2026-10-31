import { useState, useMemo } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  RotateCcw,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Users,
  DollarSign,
  AlertCircle,
  Phone,
  Check,
  X,
  Trash2,
  Building2,
  UserCheck,
  Clock,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react'
import { authedFetch } from '../lib/api'

export interface SalaryCheckItem {
  id: number
  employee: number | null
  is_custom: boolean
  custom_emp_id: string
  custom_name: string
  custom_phone: string
  custom_pic: string
  emp_id: string
  name: string
  contact_no: string
  pic: string
  present_days?: number
  total_days?: number
  fixed_salary: number | string
  salary: number | string
  is_paid: boolean
  paid_at: string | null
  paid_months?: Record<string, boolean>
  is_hidden?: boolean
  created_at: string
  updated_at: string
}

export function SalaryCheckPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const queryClient = useQueryClient()

  // Selected Month and Year State (defaults to current month)
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  })

  const selectedMonthName = useMemo(() => {
    return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(
      new Date(selectedDate.year, selectedDate.month - 1, 1)
    )
  }, [selectedDate])

  const handlePrevMonth = () => {
    setSelectedDate((prev) => {
      if (prev.month === 1) {
        return { year: prev.year - 1, month: 12 }
      }
      return { year: prev.year, month: prev.month - 1 }
    })
  }

  const handleNextMonth = () => {
    setSelectedDate((prev) => {
      if (prev.month === 12) {
        return { year: prev.year + 1, month: 1 }
      }
      return { year: prev.year, month: prev.month + 1 }
    })
  }

  const [searchQuery, setSearchQuery] = useState('')
  const [filterTab, setFilterTab] = useState<'ALL' | 'PAID' | 'UNPAID' | 'VENDORS'>('ALL')
  const [isResetModalOpen, setIsResetModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [itemToRemove, setItemToRemove] = useState<SalaryCheckItem | null>(null)

  // Create Custom Vendor / Staff Form State
  const [newEmpName, setNewEmpName] = useState('')
  const [newEmpId, setNewEmpId] = useState('')
  const [newEmpPhone, setNewEmpPhone] = useState('')
  const [newEmpFixedSalary, setNewEmpFixedSalary] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  // Local editing states for fixed salaries: { [id]: string }
  const [editingFixedSalaries, setEditingFixedSalaries] = useState<Record<number, string>>({})
  const [savingSalaryId, setSavingSalaryId] = useState<number | null>(null)
  const [savedSuccessId, setSavedSuccessId] = useState<number | null>(null)

  // Query salary items for selected month & year
  const { data: salaryItems = [], isLoading, error, refetch } = useQuery<SalaryCheckItem[]>({
    queryKey: ['salary-check', selectedDate.year, selectedDate.month],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Authentication required')
      const res = await authedFetch(`/api/salary-check/?year=${selectedDate.year}&month=${selectedDate.month}`, token)
      if (!res.ok) throw new Error('Failed to load salary check records')
      const data = await res.json()
      return (Array.isArray(data) ? data : data?.results ?? []) as SalaryCheckItem[]
    },
    enabled: !!isLoaded && !!isSignedIn,
    retry: 2,
    placeholderData: (previousData) => previousData,
  })

  // Mutation to toggle is_paid for current month
  const togglePaidMutation = useMutation({
    mutationFn: async ({ id, is_paid }: { id: number; is_paid: boolean }) => {
      const token = await getToken()
      if (!token) throw new Error('Authentication required')
      const res = await authedFetch(`/api/salary-check/${id}/`, token, {
        method: 'PATCH',
        body: JSON.stringify({
          is_paid,
          year: selectedDate.year,
          month: selectedDate.month,
        }),
      })
      if (!res.ok) throw new Error('Failed to update payment status')
      return res.json()
    },
    onMutate: async ({ id, is_paid }) => {
      await queryClient.cancelQueries({ queryKey: ['salary-check', selectedDate.year, selectedDate.month] })
      const previous = queryClient.getQueryData<SalaryCheckItem[]>(['salary-check', selectedDate.year, selectedDate.month])
      if (previous) {
        queryClient.setQueryData<SalaryCheckItem[]>(
          ['salary-check', selectedDate.year, selectedDate.month],
          previous.map((item) =>
            item.id === id ? { ...item, is_paid, paid_at: is_paid ? new Date().toISOString() : null } : item
          )
        )
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['salary-check', selectedDate.year, selectedDate.month], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-check', selectedDate.year, selectedDate.month] })
    },
  })

  // Mutation to update fixed salary amount
  const updateFixedSalaryMutation = useMutation({
    mutationFn: async ({ id, fixed_salary }: { id: number; fixed_salary: number }) => {
      const token = await getToken()
      if (!token) throw new Error('Authentication required')
      const res = await authedFetch(`/api/salary-check/${id}/`, token, {
        method: 'PATCH',
        body: JSON.stringify({
          fixed_salary,
          salary: fixed_salary,
        }),
      })
      if (!res.ok) throw new Error('Failed to update fixed salary')
      return res.json()
    },
    onSuccess: (updatedItem) => {
      setSavingSalaryId(null)
      setSavedSuccessId(updatedItem.id)
      setTimeout(() => setSavedSuccessId(null), 2000)
      queryClient.invalidateQueries({ queryKey: ['salary-check', selectedDate.year, selectedDate.month] })
    },
    onError: () => {
      setSavingSalaryId(null)
    },
  })

  // Mutation to reset all statuses for selected month
  const resetMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Authentication required')
      const res = await authedFetch('/api/salary-check/reset/', token, {
        method: 'POST',
        body: JSON.stringify({
          year: selectedDate.year,
          month: selectedDate.month,
        }),
      })
      if (!res.ok) throw new Error('Failed to reset salary statuses')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-check', selectedDate.year, selectedDate.month] })
      setIsResetModalOpen(false)
    },
  })

  // Mutation to create new custom employee / vendor
  const createVendorMutation = useMutation({
    mutationFn: async (payload: { name: string; emp_id: string; contact_no: string; fixed_salary: number }) => {
      const token = await getToken()
      if (!token) throw new Error('Authentication required')
      const res = await authedFetch('/api/salary-check/', token, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Failed to create entry')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-check', selectedDate.year, selectedDate.month] })
      setIsCreateModalOpen(false)
      setNewEmpName('')
      setNewEmpId('')
      setNewEmpPhone('')
      setNewEmpFixedSalary('')
      setCreateError(null)
    },
    onError: (err: any) => {
      setCreateError(err.message || 'Failed to create entry')
    },
  })

  // Mutation to remove employee/vendor from Salary Check
  const removeItemMutation = useMutation({
    mutationFn: async (id: number) => {
      const token = await getToken()
      if (!token) throw new Error('Authentication required')
      const res = await authedFetch(`/api/salary-check/${id}/`, token, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const patchRes = await authedFetch(`/api/salary-check/${id}/`, token, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_hidden: true }),
        })
        if (!patchRes.ok) throw new Error('Failed to remove from Salary Check')
      }
      return true
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-check', selectedDate.year, selectedDate.month] })
      setItemToRemove(null)
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to remove from Salary Check')
    },
  })

  // Save fixed salary on blur or enter key
  const handleFixedSalaryBlurOrSubmit = (item: SalaryCheckItem) => {
    const rawVal = editingFixedSalaries[item.id]
    if (rawVal === undefined) return
    const num = parseFloat(rawVal)
    if (isNaN(num) || num < 0) {
      setEditingFixedSalaries((prev) => ({ ...prev, [item.id]: String(item.fixed_salary || 0) }))
      return
    }
    if (num !== Number(item.fixed_salary)) {
      setSavingSalaryId(item.id)
      updateFixedSalaryMutation.mutate({ id: item.id, fixed_salary: num })
    }
  }

  // Summary Metrics
  const metrics = useMemo(() => {
    const list = Array.isArray(salaryItems) ? salaryItems : []
    const totalCount = list.length
    const paidItems = list.filter((i) => i.is_paid)
    const unpaidItems = list.filter((i) => !i.is_paid)

    const totalSalaryBudget = list.reduce((acc, curr) => acc + (Number(curr.salary) || 0), 0)
    const totalPaidAmount = paidItems.reduce((acc, curr) => acc + (Number(curr.salary) || 0), 0)
    const totalPendingAmount = unpaidItems.reduce((acc, curr) => acc + (Number(curr.salary) || 0), 0)

    const paidPercentage = totalSalaryBudget > 0 ? Math.round((totalPaidAmount / totalSalaryBudget) * 100) : 0

    return {
      totalCount,
      paidCount: paidItems.length,
      unpaidCount: unpaidItems.length,
      totalSalaryBudget,
      totalPaidAmount,
      totalPendingAmount,
      paidPercentage,
    }
  }, [salaryItems])

  // Filtered Items
  const filteredItems = useMemo(() => {
    const list = Array.isArray(salaryItems) ? salaryItems : []
    return list.filter((item) => {
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        (item.name || '').toLowerCase().includes(q) ||
        (item.emp_id || '').toLowerCase().includes(q) ||
        (item.contact_no || '').toLowerCase().includes(q)

      if (!matchesSearch) return false

      if (filterTab === 'PAID') return item.is_paid
      if (filterTab === 'UNPAID') return !item.is_paid
      if (filterTab === 'VENDORS') return item.is_custom
      return true
    })
  }, [salaryItems, searchQuery, filterTab])

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val)
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner Card */}
      <div className="glass-card card-soft" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <span className="eyebrow" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', fontSize: '0.75rem' }}>
              FINANCIAL DISBURSEMENT
            </span>
            <h3 style={{ fontSize: '1.6rem', fontWeight: 700, margin: '0.2rem 0', color: 'var(--text)' }}>
              Salary Check
            </h3>
          </div>

          {/* Top Right Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Month with Side Arrows Button */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '0.2rem 0.35rem',
                gap: '0.25rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              <button
                type="button"
                onClick={handlePrevMonth}
                title="Previous month"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  padding: '0.35rem 0.5rem',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.06)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
              >
                <ChevronLeft size={18} />
              </button>

              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.35rem 0.65rem',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  color: 'var(--text)',
                  minWidth: '140px',
                  justifyContent: 'center',
                  userSelect: 'none',
                }}
              >
                <Calendar size={14} style={{ color: 'var(--primary)' }} />
                <span>{selectedMonthName}</span>
              </span>

              <button
                type="button"
                onClick={handleNextMonth}
                title="Next month"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  padding: '0.35rem 0.5rem',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.06)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Reset Button */}
            <button
              onClick={() => setIsResetModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.65rem 1.1rem',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.08)',
                color: '#EF4444',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                fontWeight: 600,
                fontSize: '0.88rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              title="Reset salary payment statuses for this month to default Unpaid"
            >
              <RotateCcw size={15} />
              <span>Reset</span>
            </button>

            {/* + Create New Emp Button */}
            <button
              onClick={() => {
                setCreateError(null)
                setIsCreateModalOpen(true)
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.65rem 1.25rem',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6B2FA0 0%, #4D1975 100%)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.88rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(107, 47, 160, 0.25)',
                transition: 'transform 0.15s ease',
              }}
            >
              <Plus size={16} />
              <span>+ Create New Emp</span>
            </button>
          </div>
        </div>

        {/* Interactive KPI Metrics Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '1.25rem' }}>
          {/* Total Staff */}
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(107, 47, 160, 0.12)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Users size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em', fontWeight: 600 }}>Total Staff</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', marginTop: '0.15rem' }}>{metrics.totalCount}</div>
            </div>
          </div>

          {/* Disbursed (Paid) */}
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.12)', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CheckCircle2 size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em', fontWeight: 600 }}>Disbursed (Paid)</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#10B981', marginTop: '0.15rem' }}>{formatCurrency(metrics.totalPaidAmount)}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{metrics.paidCount} staff paid ({metrics.paidPercentage}%)</div>
            </div>
          </div>

          {/* Pending (Unpaid) */}
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.12)', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <XCircle size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em', fontWeight: 600 }}>Pending (Unpaid)</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#EF4444', marginTop: '0.15rem' }}>{formatCurrency(metrics.totalPendingAmount)}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{metrics.unpaidCount} staff pending</div>
            </div>
          </div>

          {/* Calculated Budget for Month */}
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.12)', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <DollarSign size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em', fontWeight: 600 }}>
                {selectedMonthName.split(' ')[0]} Payout
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text)', marginTop: '0.15rem' }}>{formatCurrency(metrics.totalSalaryBudget)}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Based on attendance</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="glass-card card-soft" style={{ padding: '1.5rem' }}>
        {/* Filter Controls and Search */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--panel)', padding: '0.25rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
            {(['ALL', 'PAID', 'UNPAID', 'VENDORS'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                style={{
                  padding: '0.45rem 0.95rem',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: filterTab === tab ? 'var(--primary)' : 'transparent',
                  color: filterTab === tab ? '#ffffff' : 'var(--muted)',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab === 'ALL' && `All (${metrics.totalCount})`}
                {tab === 'PAID' && `Paid (${metrics.paidCount})`}
                {tab === 'UNPAID' && `Unpaid (${metrics.unpaidCount})`}
                {tab === 'VENDORS' && 'Vendors/Staff'}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input
              type="text"
              placeholder="Search by name, ID, contact..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem 0.5rem 2.2rem',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--panel)',
                color: 'var(--text)',
                fontSize: '0.85rem',
              }}
            />
          </div>
        </div>

        {/* Loading / Error States */}
        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
            Loading salary disbursement records for {selectedMonthName}...
          </div>
        ) : error ? (
          <div style={{ padding: '2rem', background: 'rgba(239, 68, 68, 0.08)', color: '#EF4444', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={18} />
              <span>{(error as any).message || 'Failed to load salary check records'}</span>
            </div>
            <button
              onClick={() => refetch()}
              className="btn-secondary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              Retry
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
            No salary records match the selected filter or search query.
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div style={{ overflowX: 'auto' }} className="desktop-table-container">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '0.75rem 0.5rem', width: '50px', textAlign: 'center' }}>Pic</th>
                    <th style={{ padding: '0.75rem 0.75rem' }}>Emp ID</th>
                    <th style={{ padding: '0.75rem 0.75rem' }}>Name</th>
                    <th style={{ padding: '0.75rem 0.75rem' }}>Contact No</th>
                    <th style={{ padding: '0.75rem 0.75rem', textAlign: 'center' }}>Present Days</th>
                    <th style={{ padding: '0.75rem 0.75rem', minWidth: '150px' }}>Fixed Salary (₹)</th>
                    <th style={{ padding: '0.75rem 0.75rem', minWidth: '140px' }}>Salary (₹)</th>
                    <th style={{ padding: '0.75rem 0.75rem', textAlign: 'center', width: '150px' }}>Salary Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const currentFixedSalaryVal =
                      editingFixedSalaries[item.id] !== undefined
                        ? editingFixedSalaries[item.id]
                        : String(Number(item.fixed_salary) || '')

                    return (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          transition: 'background 0.15s',
                          background: item.is_paid ? 'rgba(16, 185, 129, 0.02)' : 'transparent',
                        }}
                      >
                        {/* PIC */}
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', verticalAlign: 'middle' }}>
                          <div
                            onClick={() => setItemToRemove(item)}
                            title={`Click on photo to remove ${item.name} from Salary Check`}
                            style={{
                              display: 'inline-block',
                              cursor: 'pointer',
                              borderRadius: '50%',
                              transition: 'transform 0.15s ease',
                            }}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.transform = 'scale(1.08)')}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.transform = 'scale(1)')}
                          >
                            {item.pic ? (
                              <img
                                src={item.pic}
                                alt={item.name}
                                onError={(e) => {
                                  ;(e.target as HTMLElement).style.display = 'none'
                                }}
                                style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', display: 'inline-block', border: '1px solid var(--border)' }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: '38px',
                                  height: '38px',
                                  borderRadius: '50%',
                                  background: item.is_custom ? 'rgba(59, 130, 246, 0.15)' : 'rgba(107, 47, 160, 0.12)',
                                  color: item.is_custom ? '#2563EB' : 'var(--primary)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                  fontSize: '0.85rem',
                                }}
                              >
                                {(item.name || 'E').slice(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* EMP ID */}
                        <td style={{ padding: '0.75rem', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text)' }}>
                              {item.emp_id || '—'}
                            </span>
                            {item.is_custom && (
                              <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.12)', color: '#2563EB', fontWeight: 600 }}>
                                Custom
                              </span>
                            )}
                          </div>
                        </td>

                        {/* NAME */}
                        <td style={{ padding: '0.75rem', verticalAlign: 'middle' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text)' }}>
                            {item.name}
                          </span>
                        </td>

                        {/* CONTACT NO */}
                        <td style={{ padding: '0.75rem', verticalAlign: 'middle' }}>
                          {item.contact_no ? (
                            <a
                              href={`tel:${item.contact_no}`}
                              style={{ color: 'var(--text)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }}
                            >
                              <Phone size={13} style={{ color: 'var(--muted)' }} />
                              <span>{item.contact_no}</span>
                            </a>
                          ) : (
                            <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>—</span>
                          )}
                        </td>

                        {/* PRESENT DAYS (From Attendance Module) */}
                        <td style={{ padding: '0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                          {item.is_custom ? (
                            <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontStyle: 'italic' }}>Vendor</span>
                          ) : (
                            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                              <span
                                style={{
                                  fontWeight: 700,
                                  fontSize: '0.88rem',
                                  color: (item.present_days || 0) > 0 ? '#10B981' : 'var(--muted)',
                                  background: (item.present_days || 0) > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0, 0, 0, 0.04)',
                                  padding: '0.2rem 0.6rem',
                                  borderRadius: '6px',
                                }}
                              >
                                {item.present_days ?? 0} {item.present_days === 1 ? 'day' : 'days'}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '2px' }}>
                                of {item.total_days ?? 31} days
                              </span>
                            </div>
                          )}
                        </td>

                        {/* FIXED SALARY (EDITABLE) */}
                        <td style={{ padding: '0.75rem', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <div style={{ position: 'relative', width: '130px' }}>
                              <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: '0.85rem', fontWeight: 600 }}>
                                ₹
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="100"
                                placeholder="0"
                                value={currentFixedSalaryVal}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setEditingFixedSalaries((prev) => ({ ...prev, [item.id]: val }))
                                }}
                                onBlur={() => handleFixedSalaryBlurOrSubmit(item)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleFixedSalaryBlurOrSubmit(item)
                                    ;(e.target as HTMLInputElement).blur()
                                  }
                                }}
                                style={{
                                  width: '100%',
                                  padding: '0.45rem 0.5rem 0.45rem 1.45rem',
                                  borderRadius: '8px',
                                  border: savedSuccessId === item.id ? '1px solid #10B981' : '1px solid var(--border)',
                                  background: 'var(--panel)',
                                  color: 'var(--text)',
                                  fontSize: '0.88rem',
                                  fontWeight: 600,
                                }}
                                title="Edit employee base/fixed actual salary"
                              />
                            </div>
                            {savingSalaryId === item.id && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>...</span>
                            )}
                            {savedSuccessId === item.id && (
                              <Check size={16} style={{ color: '#10B981' }} />
                            )}
                          </div>
                        </td>

                        {/* SALARY (Calculated from Attendance & Fixed Salary) */}
                        <td style={{ padding: '0.75rem', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--text)' }}>
                              {formatCurrency(Number(item.salary) || 0)}
                            </span>
                            {!item.is_custom && (item.present_days || 0) > 0 && Number(item.fixed_salary || 0) > 0 && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '2px' }}>
                                ₹{((Number(item.fixed_salary) / (item.total_days || 31))).toFixed(0)}/day × {item.present_days}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* SALARY PAID (YES / NO BUTTONS) */}
                        <td style={{ padding: '0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                          <div style={{ display: 'inline-flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--panel)' }}>
                            {/* YES BUTTON */}
                            <button
                              type="button"
                              onClick={() => {
                                if (!item.is_paid) {
                                  togglePaidMutation.mutate({ id: item.id, is_paid: true })
                                }
                              }}
                              style={{
                                padding: '0.4rem 0.85rem',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                background: item.is_paid ? '#10B981' : 'transparent',
                                color: item.is_paid ? '#ffffff' : 'var(--muted)',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <Check size={13} strokeWidth={2.5} />
                              <span>Yes</span>
                            </button>

                            {/* NO BUTTON */}
                            <button
                              type="button"
                              onClick={() => {
                                if (item.is_paid) {
                                  togglePaidMutation.mutate({ id: item.id, is_paid: false })
                                }
                              }}
                              style={{
                                padding: '0.4rem 0.85rem',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                background: !item.is_paid ? '#EF4444' : 'transparent',
                                color: !item.is_paid ? '#ffffff' : 'var(--muted)',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <X size={13} strokeWidth={2.5} />
                              <span>No</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Responsive Cards View */}
            <div className="mobile-cards-container" style={{ display: 'none', flexDirection: 'column', gap: '0.9rem', marginTop: '1rem' }}>
              {filteredItems.map((item) => {
                const currentFixedSalaryVal =
                  editingFixedSalaries[item.id] !== undefined
                    ? editingFixedSalaries[item.id]
                    : String(Number(item.fixed_salary) || '')

                return (
                  <div
                    key={item.id}
                    style={{
                      background: 'var(--panel)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div
                        onClick={() => setItemToRemove(item)}
                        title={`Click on photo to remove ${item.name} from Salary Check`}
                        style={{
                          display: 'inline-block',
                          cursor: 'pointer',
                          borderRadius: '50%',
                          flexShrink: 0,
                          transition: 'transform 0.15s ease',
                        }}
                      >
                        {item.pic ? (
                          <img
                            src={item.pic}
                            alt={item.name}
                            style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: '50%',
                              background: item.is_custom ? 'rgba(59, 130, 246, 0.15)' : 'rgba(107, 47, 160, 0.12)',
                              color: item.is_custom ? '#2563EB' : 'var(--primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                            }}
                          >
                            {(item.name || 'E').slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>{item.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                          {item.emp_id} {item.is_custom ? '· Vendor/Custom' : ''}
                        </div>
                      </div>
                    </div>

                    {item.contact_no && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Phone size={13} />
                        <a href={`tel:${item.contact_no}`} style={{ color: 'var(--text)', textDecoration: 'none' }}>
                          {item.contact_no}
                        </a>
                      </div>
                    )}

                    {/* Present Days & Monthly Salary Details */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', background: 'rgba(0,0,0,0.03)', padding: '0.6rem', borderRadius: '8px' }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Present</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10B981', marginTop: '2px' }}>
                          {item.is_custom ? '—' : `${item.present_days ?? 0} d`}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Fixed Base</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginTop: '2px' }}>
                          {formatCurrency(Number(item.fixed_salary) || 0)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Payable</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', marginTop: '2px' }}>
                          {formatCurrency(Number(item.salary) || 0)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Edit Fixed (₹)</div>
                        <div style={{ position: 'relative', width: '120px', marginTop: '0.2rem' }}>
                          <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: '0.85rem' }}>₹</span>
                          <input
                            type="number"
                            value={currentFixedSalaryVal}
                            onChange={(e) => setEditingFixedSalaries((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            onBlur={() => handleFixedSalaryBlurOrSubmit(item)}
                            style={{
                              width: '100%',
                              padding: '0.35rem 0.4rem 0.35rem 1.4rem',
                              borderRadius: '8px',
                              border: '1px solid var(--border)',
                              background: 'var(--panel)',
                              color: 'var(--text)',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.2rem' }}>Salary Paid</div>
                        <div style={{ display: 'inline-flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                          <button
                            type="button"
                            onClick={() => togglePaidMutation.mutate({ id: item.id, is_paid: true })}
                            style={{
                              padding: '0.4rem 0.75rem',
                              border: 'none',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              background: item.is_paid ? '#10B981' : 'var(--panel)',
                              color: item.is_paid ? '#ffffff' : 'var(--muted)',
                            }}
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => togglePaidMutation.mutate({ id: item.id, is_paid: false })}
                            style={{
                              padding: '0.4rem 0.75rem',
                              border: 'none',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              background: !item.is_paid ? '#EF4444' : 'var(--panel)',
                              color: !item.is_paid ? '#ffffff' : 'var(--muted)',
                            }}
                          >
                            No
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Confirmation Modal: Reset Statuses */}
      {isResetModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            className="glass-card"
            style={{
              width: '420px',
              maxWidth: '100%',
              background: 'var(--panel)',
              borderRadius: '16px',
              padding: '1.75rem',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#EF4444', marginBottom: '1rem' }}>
              <RotateCcw size={24} />
              <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Reset Salary Paid Status?</h4>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', lineHeight: '1.5', margin: '0 0 1.5rem 0' }}>
              This will reset the <strong>Salary Paid</strong> toggle for all active employees and vendors back to the default <strong>No (Unpaid)</strong> status for <strong>{selectedMonthName}</strong>.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsResetModalOpen(false)}
                disabled={resetMutation.isPending}
                style={{ padding: '0.55rem 1rem', borderRadius: '8px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => resetMutation.mutate()}
                disabled={resetMutation.isPending}
                style={{
                  padding: '0.55rem 1.25rem',
                  borderRadius: '8px',
                  background: '#EF4444',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {resetMutation.isPending ? 'Resetting...' : 'Yes, Reset All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: + Create New Emp / Vendor in Salary Paid Section Only */}
      {isCreateModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            className="glass-card"
            style={{
              width: '460px',
              maxWidth: '100%',
              background: 'var(--panel)',
              borderRadius: '16px',
              padding: '1.75rem',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Add Vendor / External Staff</h4>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>
                  This creates an entry only in Salary Check without modifying the Employees directory.
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                style={{ border: 'none', background: 'transparent', fontSize: '1.25rem', color: 'var(--muted)', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            {createError && (
              <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.08)', color: '#EF4444', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {createError}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!newEmpName.trim()) {
                  setCreateError('Name is required.')
                  return
                }
                const fixedSalaryNum = parseFloat(newEmpFixedSalary) || 0
                createVendorMutation.mutate({
                  name: newEmpName.trim(),
                  emp_id: newEmpId.trim(),
                  contact_no: newEmpPhone.trim(),
                  fixed_salary: fixedSalaryNum,
                })
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text)' }}>
                  Full Name <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text)' }}>
                  Identifier / Emp ID (optional)
                </label>
                <input
                  type="text"
                  placeholder="Leave empty for auto-generated VEND-XXX"
                  value={newEmpId}
                  onChange={(e) => setNewEmpId(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text)' }}>
                  Contact Phone No
                </label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210"
                  value={newEmpPhone}
                  onChange={(e) => setNewEmpPhone(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text)' }}>
                  Fixed Monthly Salary (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  placeholder="e.g. 15000"
                  value={newEmpFixedSalary}
                  onChange={(e) => setNewEmpFixedSalary(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={createVendorMutation.isPending}
                  style={{ padding: '0.55rem 1rem', borderRadius: '8px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createVendorMutation.isPending}
                  style={{
                    padding: '0.55rem 1.25rem',
                    borderRadius: '8px',
                    background: 'var(--primary)',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {createVendorMutation.isPending ? 'Adding...' : 'Add to Salary Check'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Remove from Salary Check */}
      {itemToRemove && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !removeItemMutation.isPending) {
              setItemToRemove(null)
            }
          }}
        >
          <div
            className="glass-card"
            style={{
              maxWidth: '460px',
              width: '100%',
              padding: '1.75rem',
              borderRadius: '16px',
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#EF4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Trash2 style={{ width: '22px', height: '22px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text)' }}>
                  Remove from Salary Check
                </h4>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'var(--muted)' }}>
                  {itemToRemove.is_custom ? 'Custom vendor / staff' : 'Organization employee'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setItemToRemove(null)}
                disabled={removeItemMutation.isPending}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  padding: '0.25rem',
                }}
              >
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.85rem 1rem',
                background: 'rgba(0, 0, 0, 0.04)',
                borderRadius: '10px',
                border: '1px solid var(--border)',
              }}
            >
              {itemToRemove.pic ? (
                <img
                  src={itemToRemove.pic}
                  alt={itemToRemove.name}
                  style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: itemToRemove.is_custom ? 'rgba(59, 130, 246, 0.15)' : 'rgba(107, 47, 160, 0.12)',
                    color: itemToRemove.is_custom ? '#2563EB' : 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                  }}
                >
                  {(itemToRemove.name || 'E').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>
                  {itemToRemove.name}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                  ID: {itemToRemove.emp_id} {itemToRemove.contact_no ? `· ${itemToRemove.contact_no}` : ''}
                </div>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text)', lineHeight: 1.5 }}>
              Are you sure you want to remove <strong>{itemToRemove.name}</strong> from the Salary Check table?
            </p>
            {!itemToRemove.is_custom && (
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.4 }}>
                <em>Note: This employee's master profile in the Employees / All Employees section will remain active and intact.</em>
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setItemToRemove(null)}
                disabled={removeItemMutation.isPending}
                style={{ padding: '0.55rem 1rem', borderRadius: '8px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => removeItemMutation.mutate(itemToRemove.id)}
                disabled={removeItemMutation.isPending}
                style={{
                  padding: '0.55rem 1.25rem',
                  borderRadius: '8px',
                  background: '#EF4444',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <Trash2 style={{ width: '15px', height: '15px' }} />
                {removeItemMutation.isPending ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
