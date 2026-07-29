import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { authedFetch } from '../lib/api'

export type ServiceItem = {
  s_no: number
  service_name: string
  description: string
  rate: number
  days: number
  amount: number
  other_expenses: number
  total: number
}

export type Invoice = {
  id: number
  invoice_number: string
  invoice_type: 'REGULAR' | 'SCHOOL' | 'MULTI_SERVICE'
  barcode_value: string
  invoice_date: string
  billing_period_text: string
  start_date: string | null
  client_name: string
  client_contact: string
  client_address: string
  client_gst: string
  patient_name: string
  patient_age_gender: string
  service_type: string
  consultant: string
  rendered_days: string
  school_branch: string
  contact_person: string
  contact_person_designation: string
  no_of_nurses: number
  no_of_students: number
  per_day_charges: number
  subtotal: number
  gst: number
  discount: number
  total_after_gst: number
  advance_received: number
  balance_due: number
  grand_total: number
  amount_in_words: string
  payment_status: string
  remarks: string
  services_data: ServiceItem[]
  pdf_path: string
  generated_by: string
  created_at: string
}

// Number to Words converter for Indian Rupee format
const UNITS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function numToWords(n: number): string {
  if (n === 0) return 'Zero'
  if (n < 0) return 'Minus ' + numToWords(Math.abs(n))
  let words = ''
  if (n >= 10000000) {
    words += numToWords(Math.floor(n / 10000000)) + ' Crore '
    n %= 10000000
  }
  if (n >= 100000) {
    words += numToWords(Math.floor(n / 100000)) + ' Lakh '
    n %= 100000
  }
  if (n >= 1000) {
    words += numToWords(Math.floor(n / 1000)) + ' Thousand '
    n %= 1000
  }
  if (n >= 100) {
    words += numToWords(Math.floor(n / 100)) + ' Hundred '
    n %= 100
  }
  if (n > 0) {
    if (n < 20) words += UNITS[n] + ' '
    else words += TENS[Math.floor(n / 10)] + ' ' + UNITS[n % 10] + ' '
  }
  return words.trim()
}

function getAmountInWords(num: number): string {
  const val = Math.round(num)
  if (val <= 0) return 'Zero Rupees Only'
  return `${numToWords(val)} Rupees Only`
}

export function InvoicePage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'FORM' | 'PREVIEW' | 'HISTORY' | 'SEARCH' | 'VERIFY'>('DASHBOARD')
  const [formType, setFormType] = useState<'REGULAR' | 'SCHOOL' | 'MULTI_SERVICE'>('REGULAR')
  
  // Search & Verification state
  const [searchQuery, setSearchQuery] = useState('')
  const [verifyInput, setVerifyInput] = useState('')
  const [verifyResult, setVerifyResult] = useState<{ found: boolean; invoice?: Invoice; message?: string } | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  // Form State
  const [invoiceNumber, setInvoiceNumber] = useState('1370 - 0001')
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0])
  const [billingPeriodText, setBillingPeriodText] = useState('01-June-2026 to 30-June-2026')
  const [startDateText, setStartDateText] = useState('22-Sep-2025')
  
  // Client & Service Profile
  const [clientName, setClientName] = useState('Aravind Krishna Garu')
  const [clientContact, setClientContact] = useState('9999689454')
  const [clientAddress, setClientAddress] = useState('Flat 101, Dhooravani Enclave, Road No-1, Telephone Colony, Kothapet, Hyderabad - 500035')
  const [clientGst, setClientGst] = useState('')

  const [patientName, setPatientName] = useState('Mr. P.K.K Nair')
  const [patientAgeGender, setPatientAgeGender] = useState('87+ Years / Male')
  const [serviceType, setServiceType] = useState('Caretaker Services (12 Hours)')
  const [consultant, setConsultant] = useState('Dr. Sandesh Nanashetty')
  const [renderedDays, setRenderedDays] = useState('30 Days (0 Missed)')

  // School Specific
  const [schoolBranch, setSchoolBranch] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [contactPersonDesignation, setContactPersonDesignation] = useState('')
  const [noOfNurses, setNoOfNurses] = useState(1)
  const [noOfStudents, setNoOfStudents] = useState(500)

  // Financials
  const [perDayCharges, setPerDayCharges] = useState(32000)
  const [gstAmount, setGstAmount] = useState(1600)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [advanceReceived, setAdvanceReceived] = useState(0)
  const [paymentStatus, setPaymentStatus] = useState('Not Paid')
  const [remarks, setRemarks] = useState('Invoice for the month of June 2026\nKindly process the due amount at the earliest to ensure uninterrupted healthcare services.')

  // Dynamic Service Table Rows
  const [services, setServices] = useState<ServiceItem[]>([
    {
      s_no: 1,
      service_name: '12 Hours Caretaker Services',
      description: 'Dedicated bedside assistance, monitoring, personal care & mobility support.',
      rate: 32000,
      days: 30,
      amount: 32000,
      other_expenses: 0,
      total: 32000,
    },
    {
      s_no: 2,
      service_name: 'Physiotherapy (Home Visit)',
      description: 'Basic physiotherapy sessions for mobility & recovery support.',
      rate: 2000,
      days: 10,
      amount: 20000,
      other_expenses: 0,
      total: 20000,
    },
    {
      s_no: 3,
      service_name: 'Nursing Care (Home Visit)',
      description: 'Skilled nursing care including vitals monitoring & medication support.',
      rate: 2000,
      days: 15,
      amount: 30000,
      other_expenses: 0,
      total: 30000,
    },
  ])

  // Computed Totals
  const subtotal = useMemo(() => services.reduce((acc, s) => acc + (s.total || 0), 0), [services])
  const totalAfterGst = useMemo(() => subtotal + Number(gstAmount) - Number(discountAmount), [subtotal, gstAmount, discountAmount])
  const balanceDue = useMemo(() => totalAfterGst - Number(advanceReceived), [totalAfterGst, advanceReceived])
  const grandTotal = useMemo(() => Math.max(0, balanceDue), [balanceDue])
  const amountInWords = useMemo(() => getAmountInWords(grandTotal), [grandTotal])

  // Queries
  const nextNumQuery = useQuery({
    queryKey: ['invoice-next-number'],
    queryFn: async () => {
      const token = (await getToken()) || ''
      const res = await authedFetch('/api/invoices/next-number', token)
      if (!res.ok) return { next_invoice_number: '1370 - 0001' }
      return res.json()
    },
  })

  const historyQuery = useQuery({
    queryKey: ['invoices-list', searchQuery],
    queryFn: async () => {
      const token = (await getToken()) || ''
      const url = searchQuery ? `/api/invoices/?search=${encodeURIComponent(searchQuery)}` : '/api/invoices/'
      const res = await authedFetch(url, token)
      if (!res.ok) return []
      return (await res.json()) as Invoice[]
    },
  })

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async (invoicePayload: any) => {
      const token = (await getToken()) || ''
      const res = await authedFetch('/api/invoices/', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoicePayload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Failed to save invoice.')
      }
      return res.json() as Promise<Invoice>
    },
    onSuccess: (savedInvoice) => {
      setSelectedInvoice(savedInvoice)
      queryClient.invalidateQueries({ queryKey: ['invoices-list'] })
      queryClient.invalidateQueries({ queryKey: ['invoice-next-number'] })
      alert(`Invoice ${savedInvoice.invoice_number} saved & generated successfully!`)
    },
    onError: (err: any) => {
      alert(`Error saving invoice: ${err.message}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const token = (await getToken()) || ''
      const res = await authedFetch(`/api/invoices/${id}`, token, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete invoice.')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices-list'] })
    },
  })

  // Open creation flow
  const openForm = (type: 'REGULAR' | 'SCHOOL' | 'MULTI_SERVICE') => {
    setFormType(type)
    if (nextNumQuery.data?.next_invoice_number) {
      setInvoiceNumber(nextNumQuery.data.next_invoice_number)
    }

    if (type === 'SCHOOL') {
      setServices([
        {
          s_no: 1,
          service_name: 'School Medical Coverage & Nursing Services',
          description: 'Comprehensive health monitoring, emergency first aid, & nursing care.',
          rate: 45000,
          days: 30,
          amount: 45000,
          other_expenses: 0,
          total: 45000,
        },
      ])
    } else if (type === 'MULTI_SERVICE') {
      setServices([
        { s_no: 1, service_name: '12 Hours Caretaker Service', description: 'Bedside assistance & care.', rate: 32000, days: 30, amount: 32000, other_expenses: 0, total: 32000 },
        { s_no: 2, service_name: 'Nursing Care (Home Visit)', description: 'Skilled nursing & medication.', rate: 2000, days: 30, amount: 60000, other_expenses: 0, total: 60000 },
        { s_no: 3, service_name: 'Physiotherapy (Home Visit)', description: 'Physiotherapy sessions.', rate: 2000, days: 20, amount: 40000, other_expenses: 0, total: 40000 },
        { s_no: 4, service_name: 'Doctor Visit (Home Visit)', description: 'Doctor consultation & follow-up.', rate: 1500, days: 6, amount: 9000, other_expenses: 0, total: 9000 },
        { s_no: 5, service_name: 'Medication Support', description: 'Medication management.', rate: 1000, days: 30, amount: 30000, other_expenses: 0, total: 30000 },
        { s_no: 6, service_name: 'Bedside Monitoring', description: 'Vitals & health parameters.', rate: 800, days: 30, amount: 24000, other_expenses: 0, total: 24000 },
        { s_no: 7, service_name: 'Dressing Care', description: 'Wound dressing & care.', rate: 800, days: 12, amount: 9600, other_expenses: 0, total: 9600 },
        { s_no: 8, service_name: 'Oxygen Monitoring', description: 'Oxygen level monitoring.', rate: 800, days: 15, amount: 12000, other_expenses: 0, total: 12000 },
        { s_no: 9, service_name: 'Equipment Rental', description: 'Bed & oxygen concentrator.', rate: 500, days: 30, amount: 15000, other_expenses: 0, total: 15000 },
        { s_no: 10, service_name: 'Post-Operative Care', description: 'Post-surgery wound care & pain mgmt.', rate: 2500, days: 7, amount: 17500, other_expenses: 0, total: 17500 },
      ])
    }

    setActiveTab('FORM')
  }

  // Add / Delete dynamic service rows
  const addServiceRow = () => {
    setServices((prev) => [
      ...prev,
      {
        s_no: prev.length + 1,
        service_name: 'Additional Health Service',
        description: 'Healthcare consultation and care support.',
        rate: 1500,
        days: 1,
        amount: 1500,
        other_expenses: 0,
        total: 1500,
      },
    ])
  }

  const deleteServiceRow = (index: number) => {
    setServices((prev) => prev.filter((_, i) => i !== index).map((s, idx) => ({ ...s, s_no: idx + 1 })))
  }

  const updateServiceRow = (index: number, key: keyof ServiceItem, value: any) => {
    setServices((prev) => {
      const updated = [...prev]
      const item = { ...updated[index], [key]: value }
      if (key === 'rate' || key === 'days' || key === 'other_expenses') {
        const r = Number(item.rate || 0)
        const d = Number(item.days || 0)
        const o = Number(item.other_expenses || 0)
        item.amount = r * d
        item.total = item.amount + o
      }
      updated[index] = item
      return updated
    })
  }

  // Handle Save
  const handleSaveInvoice = () => {
    const payload = {
      invoice_number: invoiceNumber,
      invoice_type: formType,
      invoice_date: invoiceDate,
      billing_period_text: billingPeriodText,
      start_date: startDateText ? '2025-09-22' : null,
      client_name: clientName,
      client_contact: clientContact,
      client_address: clientAddress,
      client_gst: clientGst,
      patient_name: patientName,
      patient_age_gender: patientAgeGender,
      service_type: serviceType,
      consultant: consultant,
      rendered_days: renderedDays,
      school_branch: schoolBranch,
      contact_person: contactPerson,
      contact_person_designation: contactPersonDesignation,
      no_of_nurses: noOfNurses,
      no_of_students: noOfStudents,
      per_day_charges: perDayCharges,
      subtotal: subtotal,
      gst: gstAmount,
      discount: discountAmount,
      total_after_gst: totalAfterGst,
      advance_received: advanceReceived,
      balance_due: balanceDue,
      grand_total: grandTotal,
      amount_in_words: amountInWords,
      payment_status: paymentStatus,
      remarks: remarks,
      services_data: services,
    }
    saveMutation.mutate(payload)
  }

  // Download PDF API helper
  const handleDownloadPdf = async (inv: Invoice | null) => {
    const invId = inv?.id || selectedInvoice?.id || invoiceNumber
    const token = (await getToken()) || ''
    const res = await authedFetch(`/api/invoices/${invId}/download`, token)
    if (!res.ok) {
      alert('Failed to download PDF.')
      return
    }
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Invoice_${inv?.invoice_number || invoiceNumber}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  }

  // Verification Search
  const handleVerify = async () => {
    if (!verifyInput.trim()) return
    const token = (await getToken()) || ''
    const res = await authedFetch(`/api/invoices/verify?number=${encodeURIComponent(verifyInput)}`, token)
    if (!res.ok) {
      setVerifyResult({ found: false, message: 'Invoice Not Found' })
      return
    }
    const data = await res.json()
    setVerifyResult(data)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
      
      {/* Top Header Navigation Tabs */}
      <div className="glass-card card-soft" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span className="eyebrow">Finance & Billing Management</span>
          <h3 style={{ margin: '0.2rem 0' }}>Skandan Invoice Portal</h3>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            className={`btn-secondary ${activeTab === 'DASHBOARD' ? 'active-tab-btn' : ''}`}
            onClick={() => setActiveTab('DASHBOARD')}
            style={{ fontWeight: 600, padding: '0.5rem 1rem' }}
          >
            Dashboard
          </button>
          <button
            className={`btn-secondary ${activeTab === 'HISTORY' ? 'active-tab-btn' : ''}`}
            onClick={() => setActiveTab('HISTORY')}
            style={{ fontWeight: 600, padding: '0.5rem 1rem' }}
          >
            Invoice History
          </button>
          <button
            className={`btn-secondary ${activeTab === 'SEARCH' ? 'active-tab-btn' : ''}`}
            onClick={() => setActiveTab('SEARCH')}
            style={{ fontWeight: 600, padding: '0.5rem 1rem' }}
          >
            Search Invoice
          </button>
          <button
            className={`btn-secondary ${activeTab === 'VERIFY' ? 'active-tab-btn' : ''}`}
            onClick={() => setActiveTab('VERIFY')}
            style={{ fontWeight: 600, padding: '0.5rem 1rem' }}
          >
            Verify Invoice
          </button>
        </div>
      </div>

      {/* DASHBOARD TAB - 6 CARDS */}
      {activeTab === 'DASHBOARD' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          
          {/* Card 1: Generate Invoice Regular */}
          <div
            className="glass-card invoice-dash-card"
            onClick={() => openForm('REGULAR')}
            style={{ cursor: 'pointer', padding: '1.5rem', borderLeft: '5px solid #6B2FA0', transition: 'transform 0.2s ease' }}
          >
            <div style={{ fontSize: '2.2rem', marginBottom: '0.75rem' }}>🏥</div>
            <h4 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem 0', color: 'var(--text)' }}>Generate Invoice (Regular)</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
              Standard healthcare invoice for patient caretaker, nursing, doctor visits, and home services.
            </p>
            <div style={{ marginTop: '1rem', color: '#6B2FA0', fontWeight: 700, fontSize: '0.85rem' }}>Create Invoice &rarr;</div>
          </div>

          {/* Card 2: Generate Invoice School / College */}
          <div
            className="glass-card invoice-dash-card"
            onClick={() => openForm('SCHOOL')}
            style={{ cursor: 'pointer', padding: '1.5rem', borderLeft: '5px solid #10B981', transition: 'transform 0.2s ease' }}
          >
            <div style={{ fontSize: '2.2rem', marginBottom: '0.75rem' }}>🏫</div>
            <h4 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem 0', color: 'var(--text)' }}>Generate Invoice (School / College)</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
              Specialized billing template for educational institutions, school nurses, and campus health.
            </p>
            <div style={{ marginTop: '1rem', color: '#10B981', fontWeight: 700, fontSize: '0.85rem' }}>Create Invoice &rarr;</div>
          </div>

          {/* Card 3: Generate Invoice Multi-Service */}
          <div
            className="glass-card invoice-dash-card"
            onClick={() => openForm('MULTI_SERVICE')}
            style={{ cursor: 'pointer', padding: '1.5rem', borderLeft: '5px solid #3B82F6', transition: 'transform 0.2s ease' }}
          >
            <div style={{ fontSize: '2.2rem', marginBottom: '0.75rem' }}>📄</div>
            <h4 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem 0', color: 'var(--text)' }}>Generate Invoice (Multi-Service)</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
              Two-page template for multi-service medical care with auto-pagination and total summary.
            </p>
            <div style={{ marginTop: '1rem', color: '#3B82F6', fontWeight: 700, fontSize: '0.85rem' }}>Create Invoice &rarr;</div>
          </div>

          {/* Card 4: Search Invoice */}
          <div
            className="glass-card invoice-dash-card"
            onClick={() => setActiveTab('SEARCH')}
            style={{ cursor: 'pointer', padding: '1.5rem', borderLeft: '5px solid #F59E0B', transition: 'transform 0.2s ease' }}
          >
            <div style={{ fontSize: '2.2rem', marginBottom: '0.75rem' }}>🔍</div>
            <h4 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem 0', color: 'var(--text)' }}>Search Invoice</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
              Find invoices by Invoice Number, Client Name, Patient Name, Date, or Billing Period.
            </p>
            <div style={{ marginTop: '1rem', color: '#F59E0B', fontWeight: 700, fontSize: '0.85rem' }}>Search Now &rarr;</div>
          </div>

          {/* Card 5: Verify Invoice */}
          <div
            className="glass-card invoice-dash-card"
            onClick={() => setActiveTab('VERIFY')}
            style={{ cursor: 'pointer', padding: '1.5rem', borderLeft: '5px solid #8B5CF6', transition: 'transform 0.2s ease' }}
          >
            <div style={{ fontSize: '2.2rem', marginBottom: '0.75rem' }}>🛡️</div>
            <h4 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem 0', color: 'var(--text)' }}>Verify Invoice</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
              Verify invoice authenticity by barcode scanning or entering invoice serial number.
            </p>
            <div style={{ marginTop: '1rem', color: '#8B5CF6', fontWeight: 700, fontSize: '0.85rem' }}>Verify Authenticity &rarr;</div>
          </div>

          {/* Card 6: Invoice History */}
          <div
            className="glass-card invoice-dash-card"
            onClick={() => setActiveTab('HISTORY')}
            style={{ cursor: 'pointer', padding: '1.5rem', borderLeft: '5px solid #EC4899', transition: 'transform 0.2s ease' }}
          >
            <div style={{ fontSize: '2.2rem', marginBottom: '0.75rem' }}>📊</div>
            <h4 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem 0', color: 'var(--text)' }}>Invoice History</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
              View, print, download, or manage all generated invoices stored in database.
            </p>
            <div style={{ marginTop: '1rem', color: '#EC4899', fontWeight: 700, fontSize: '0.85rem' }}>View History &rarr;</div>
          </div>

        </div>
      )}

      {/* FORM TAB - INVOICE GENERATOR FORM */}
      {activeTab === 'FORM' && (
        <div className="glass-card card-soft" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, color: 'var(--primary)' }}>
              Generate {formType === 'REGULAR' ? 'Regular Invoice' : formType === 'SCHOOL' ? 'School / College Invoice' : 'Multi-Service Invoice'}
            </h3>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-secondary" onClick={() => setActiveTab('DASHBOARD')}>Back</button>
              <button className="btn-primary" onClick={() => setActiveTab('PREVIEW')}>Preview Invoice</button>
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); setActiveTab('PREVIEW'); }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Section 1: Header / Invoice Information */}
            <div style={{ background: 'var(--panel)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--primary)', fontSize: '0.95rem' }}>Invoice Information</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.9rem' }}>
                <div className="stack" style={{ gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Invoice Number (Auto Sequence)</label>
                  <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontWeight: 700 }} />
                </div>
                <div className="stack" style={{ gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Invoice Date</label>
                  <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }} />
                </div>
                <div className="stack" style={{ gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Billing Period Text</label>
                  <input type="text" value={billingPeriodText} onChange={(e) => setBillingPeriodText(e.target.value)} placeholder="01-June-2026 to 30-June-2026" style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }} />
                </div>
                <div className="stack" style={{ gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Service Start Date</label>
                  <input type="text" value={startDateText} onChange={(e) => setStartDateText(e.target.value)} placeholder="22-Sep-2025" style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }} />
                </div>
              </div>
            </div>

            {/* Section 2: Client & Service Profile */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
              
              {/* Billed To (Client) */}
              <div style={{ background: 'var(--panel)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h4 style={{ margin: 0, color: 'var(--primary)', fontSize: '0.95rem' }}>Billed To (Client Information)</h4>
                <div className="stack" style={{ gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Client Name</label>
                  <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Aravind Krishna Garu" style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }} />
                </div>
                <div className="stack" style={{ gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Contact Number</label>
                  <input type="text" value={clientContact} onChange={(e) => setClientContact(e.target.value)} placeholder="9999689454" style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }} />
                </div>
                <div className="stack" style={{ gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Client Address</label>
                  <textarea value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} rows={2} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }} />
                </div>
                <div className="stack" style={{ gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>GST Number (Optional)</label>
                  <input type="text" value={clientGst} onChange={(e) => setClientGst(e.target.value)} placeholder="e.g. 36AAACS1234F1Z5" style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }} />
                </div>
              </div>

              {/* Service Profile or School Profile */}
              {formType === 'SCHOOL' ? (
                <div style={{ background: 'var(--panel)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <h4 style={{ margin: 0, color: 'var(--primary)', fontSize: '0.95rem' }}>School / College Details</h4>
                  <div className="stack" style={{ gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>School / College Name & Branch</label>
                    <input type="text" value={schoolBranch} onChange={(e) => setSchoolBranch(e.target.value)} placeholder="Delhi Public School, Gachibowli Branch" style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }} />
                  </div>
                  <div className="stack" style={{ gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Contact Person</label>
                    <input type="text" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Mr. Rajesh Varma" style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }} />
                  </div>
                  <div className="stack" style={{ gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Designation</label>
                    <input type="text" value={contactPersonDesignation} onChange={(e) => setContactPersonDesignation(e.target.value)} placeholder="Principal / Administrator" style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div className="stack" style={{ gap: '0.3rem' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>No. of Nurses</label>
                      <input type="number" value={noOfNurses} onChange={(e) => setNoOfNurses(Number(e.target.value))} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }} />
                    </div>
                    <div className="stack" style={{ gap: '0.3rem' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>No. of Students</label>
                      <input type="number" value={noOfStudents} onChange={(e) => setNoOfStudents(Number(e.target.value))} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }} />
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ background: 'var(--panel)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <h4 style={{ margin: 0, color: 'var(--primary)', fontSize: '0.95rem' }}>Patient Service Profile</h4>
                  <div className="stack" style={{ gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Patient Name</label>
                    <input type="text" value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Mr. P.K.K Nair" style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }} />
                  </div>
                  <div className="stack" style={{ gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Age / Gender</label>
                    <input type="text" value={patientAgeGender} onChange={(e) => setPatientAgeGender(e.target.value)} placeholder="87+ Years / Male" style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }} />
                  </div>
                  <div className="stack" style={{ gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Service Type</label>
                    <input type="text" value={serviceType} onChange={(e) => setServiceType(e.target.value)} placeholder="Caretaker Services (12 Hours)" style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }} />
                  </div>
                  <div className="stack" style={{ gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Consultant</label>
                    <input type="text" value={consultant} onChange={(e) => setConsultant(e.target.value)} placeholder="Dr. Sandesh Nanashetty" style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }} />
                  </div>
                  <div className="stack" style={{ gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Rendered Days</label>
                    <input type="text" value={renderedDays} onChange={(e) => setRenderedDays(e.target.value)} placeholder="30 Days (0 Missed)" style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }} />
                  </div>
                </div>
              )}

            </div>

            {/* Section 3: Dynamic Service Table Rows */}
            <div style={{ background: 'var(--panel)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h4 style={{ margin: 0, color: 'var(--primary)', fontSize: '0.95rem' }}>Service Details (Dynamic Rows)</h4>
                <button type="button" className="btn-primary" onClick={addServiceRow} style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem' }}>
                  + Add Service Row
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: '#102A71', color: '#fff', textTransform: 'uppercase' }}>
                      <th style={{ padding: '0.6rem', textAlign: 'center' }}>S.No</th>
                      <th style={{ padding: '0.6rem', textAlign: 'left' }}>Particulars / Service Details</th>
                      <th style={{ padding: '0.6rem', textAlign: 'right' }}>Per Day Rate (₹)</th>
                      <th style={{ padding: '0.6rem', textAlign: 'center' }}>No. of Days</th>
                      <th style={{ padding: '0.6rem', textAlign: 'right' }}>Amount (₹)</th>
                      <th style={{ padding: '0.6rem', textAlign: 'right' }}>Other Expenses (₹)</th>
                      <th style={{ padding: '0.6rem', textAlign: 'right' }}>Total (₹)</th>
                      <th style={{ padding: '0.6rem', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 700 }}>{idx + 1}</td>
                        <td style={{ padding: '0.5rem' }}>
                          <input
                            type="text"
                            value={item.service_name}
                            onChange={(e) => updateServiceRow(idx, 'service_name', e.target.value)}
                            placeholder="Service Name"
                            style={{ width: '100%', padding: '0.3rem', borderRadius: '4px', border: '1px solid var(--border)', marginBottom: '0.2rem', fontWeight: 600 }}
                          />
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateServiceRow(idx, 'description', e.target.value)}
                            placeholder="Detailed description..."
                            style={{ width: '100%', padding: '0.25rem', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--muted)' }}
                          />
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          <input
                            type="number"
                            value={item.rate}
                            onChange={(e) => updateServiceRow(idx, 'rate', e.target.value)}
                            style={{ width: '90px', padding: '0.3rem', textAlign: 'right', borderRadius: '4px', border: '1px solid var(--border)' }}
                          />
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          <input
                            type="number"
                            value={item.days}
                            onChange={(e) => updateServiceRow(idx, 'days', e.target.value)}
                            style={{ width: '60px', padding: '0.3rem', textAlign: 'center', borderRadius: '4px', border: '1px solid var(--border)' }}
                          />
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>
                          ₹ {item.amount.toLocaleString()}
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          <input
                            type="number"
                            value={item.other_expenses}
                            onChange={(e) => updateServiceRow(idx, 'other_expenses', e.target.value)}
                            style={{ width: '90px', padding: '0.3rem', textAlign: 'right', borderRadius: '4px', border: '1px solid var(--border)' }}
                          />
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                          ₹ {item.total.toLocaleString()}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => deleteServiceRow(idx)}
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: 'none', borderRadius: '4px', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 4: Financial Adjustments & Remarks */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div style={{ background: 'var(--panel)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h4 style={{ margin: 0, color: 'var(--primary)', fontSize: '0.95rem' }}>Financial Calculations & Adjustments</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  <div className="stack" style={{ gap: '0.2rem' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Per Day Charges (₹)</label>
                    <input type="number" value={perDayCharges} onChange={(e) => setPerDayCharges(Number(e.target.value))} style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border)' }} />
                  </div>
                  <div className="stack" style={{ gap: '0.2rem' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>GST (₹)</label>
                    <input type="number" value={gstAmount} onChange={(e) => setGstAmount(Number(e.target.value))} style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border)' }} />
                  </div>
                  <div className="stack" style={{ gap: '0.2rem' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Discount (₹)</label>
                    <input type="number" value={discountAmount} onChange={(e) => setDiscountAmount(Number(e.target.value))} style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border)' }} />
                  </div>
                  <div className="stack" style={{ gap: '0.2rem' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Advance Received (₹)</label>
                    <input type="number" value={advanceReceived} onChange={(e) => setAdvanceReceived(Number(e.target.value))} style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border)' }} />
                  </div>
                </div>
                <div className="stack" style={{ gap: '0.2rem' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Payment Status</label>
                  <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }}>
                    <option value="Not Paid">Not Paid</option>
                    <option value="Paid">Paid</option>
                    <option value="Partial">Partial / Advance Received</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
              </div>

              <div style={{ background: 'var(--panel)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h4 style={{ margin: 0, color: 'var(--primary)', fontSize: '0.95rem' }}>Remarks & Notes</h4>
                <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={4} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }} />
                
                {/* Auto Calculated Summary Box */}
                <div style={{ background: '#102A71', color: '#fff', padding: '0.8rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>Subtotal:</span>
                    <span>₹ {subtotal.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 800 }}>
                    <span>GRAND TOTAL:</span>
                    <span>₹ {grandTotal.toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.9, marginTop: '0.2rem', fontStyle: 'italic' }}>
                    Words: {amountInWords}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
              <button type="button" className="btn-secondary" onClick={() => setActiveTab('DASHBOARD')}>Cancel</button>
              <button type="submit" className="btn-primary" style={{ padding: '0.7rem 2rem', fontSize: '1rem' }}>Preview Invoice &rarr;</button>
            </div>

          </form>
        </div>
      )}

      {/* PREVIEW TAB - PIXEL PERFECT INVOICE PREVIEW MATCHING TEMPLATE */}
      {activeTab === 'PREVIEW' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Action Bar */}
          <div className="glass-card card-soft no-print" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="eyebrow">Template Document Preview</span>
              <h4 style={{ margin: 0 }}>Invoice #{invoiceNumber} Preview</h4>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-secondary" onClick={() => setActiveTab('FORM')}>Edit Details</button>
              <button className="btn-secondary" onClick={() => window.print()}>Print Invoice</button>
              <button className="btn-primary" onClick={handleSaveInvoice} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : 'Save Invoice'}
              </button>
              <button className="btn-primary" style={{ background: '#10B981' }} onClick={() => handleDownloadPdf(null)}>
                Download PDF
              </button>
            </div>
          </div>

          {/* Printable Invoice Page Container */}
          <div className="invoice-print-container" style={{ background: '#ffffff', color: '#1A1A1A', padding: '2.5rem', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', maxWidth: '900px', margin: '0 auto', fontFamily: 'Arial, sans-serif', width: '100%' }}>
            
            {/* Header Block */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #CBD5E1', paddingBottom: '1.25rem', marginBottom: '1.25rem' }}>
              <div>
                <img src="/assets/invoice/skandan_logo.png" alt="Skandan Logo" style={{ height: '55px', objectFit: 'contain', marginBottom: '0.4rem' }} />
                <div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.5 }}>
                  <strong>Plot No 13, SY NO 3,4, RR Plaza,</strong><br />
                  Madhapur, Hyderabad, Telangana – 500081<br />
                  <strong>Tel:</strong> +91 96609 66369 | <strong>Email:</strong> info@skandanhomecarre.com
                </div>
              </div>
              
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                <h1 style={{ fontSize: '2rem', margin: 0, color: '#102A71', letterSpacing: '0.05em' }}>INVOICE</h1>
                
                {/* Code-128 Barcode Simulation */}
                <div style={{ background: '#000', color: '#fff', padding: '4px 12px', fontFamily: 'monospace', letterSpacing: '4px', fontSize: '1rem', fontWeight: 'bold' }}>
                  |||||| ||| |||| || |||||||| ||||
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '-0.3rem' }}>{invoiceNumber.replace(/\s+/g, '')}</div>

                <div style={{ fontSize: '0.82rem', color: '#1E293B', textAlign: 'right', lineHeight: 1.6, marginTop: '0.4rem' }}>
                  <div><strong>Invoice No. :</strong> {invoiceNumber}</div>
                  <div><strong>Invoice Date :</strong> {invoiceDate}</div>
                  <div><strong>Billing Period :</strong> {billingPeriodText}</div>
                  <div><strong>Start Date :</strong> {startDateText}</div>
                </div>
              </div>
            </div>

            {/* Profile Grid (Billed To, Service Profile, Other Info) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              
              {/* Billed To */}
              <div style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '0.75rem', fontSize: '0.78rem' }}>
                <div style={{ color: '#102A71', fontWeight: 800, marginBottom: '0.5rem', fontSize: '0.85rem' }}>👤 BILLED TO (CLIENT)</div>
                <div><strong>Client Name :</strong> {clientName}</div>
                <div><strong>Contact No. :</strong> {clientContact}</div>
                <div style={{ marginTop: '0.3rem' }}><strong>Address :</strong> {clientAddress}</div>
                {clientGst && <div style={{ marginTop: '0.3rem' }}><strong>GST No. :</strong> {clientGst}</div>}
              </div>

              {/* Service Profile */}
              {formType === 'SCHOOL' ? (
                <div style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '0.75rem', fontSize: '0.78rem' }}>
                  <div style={{ color: '#102A71', fontWeight: 800, marginBottom: '0.5rem', fontSize: '0.85rem' }}>🏫 INSTITUTION DETAILS</div>
                  <div><strong>School/Branch :</strong> {schoolBranch || clientName}</div>
                  <div><strong>Contact Person :</strong> {contactPerson}</div>
                  <div><strong>Designation :</strong> {contactPersonDesignation}</div>
                  <div><strong>Nurses/Students :</strong> {noOfNurses} Nurses / {noOfStudents} Students</div>
                </div>
              ) : (
                <div style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '0.75rem', fontSize: '0.78rem' }}>
                  <div style={{ color: '#102A71', fontWeight: 800, marginBottom: '0.5rem', fontSize: '0.85rem' }}>⚕️ SERVICE PROFILE</div>
                  <div><strong>Patient :</strong> {patientName}</div>
                  <div><strong>Age / Gender :</strong> {patientAgeGender}</div>
                  <div><strong>Service Type :</strong> {serviceType}</div>
                  <div><strong>Consultant :</strong> {consultant}</div>
                </div>
              )}

              {/* Other Info */}
              <div style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '0.75rem', fontSize: '0.78rem' }}>
                <div style={{ color: '#102A71', fontWeight: 800, marginBottom: '0.5rem', fontSize: '0.85rem' }}>ℹ️ OTHER INFORMATION</div>
                <div><strong>Per Day Charges :</strong> ₹ {perDayCharges.toLocaleString()}</div>
                <div><strong>Advance Amount :</strong> ₹ {advanceReceived.toLocaleString()}</div>
                <div style={{ marginTop: '0.3rem' }}><strong>Payment Status :</strong> <span style={{ color: '#102A71', fontWeight: 700 }}>{paymentStatus}</span></div>
                <div><strong>Rendered Days :</strong> {renderedDays}</div>
              </div>

            </div>

            {/* Service Details Table */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ color: '#102A71', fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.5rem' }}>📋 SERVICE DETAILS</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ background: '#102A71', color: '#ffffff' }}>
                    <th style={{ padding: '0.6rem', textAlign: 'center', border: '1px solid #102A71' }}>S.No.</th>
                    <th style={{ padding: '0.6rem', textAlign: 'left', border: '1px solid #102A71' }}>Particulars / Service Details</th>
                    <th style={{ padding: '0.6rem', textAlign: 'center', border: '1px solid #102A71' }}>Per Day Rate (₹)</th>
                    <th style={{ padding: '0.6rem', textAlign: 'center', border: '1px solid #102A71' }}>No. of Days</th>
                    <th style={{ padding: '0.6rem', textAlign: 'center', border: '1px solid #102A71' }}>Amount (₹)</th>
                    <th style={{ padding: '0.6rem', textAlign: 'center', border: '1px solid #102A71' }}>Other Expenses (₹)</th>
                    <th style={{ padding: '0.6rem', textAlign: 'center', border: '1px solid #102A71' }}>Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '0.55rem', textAlign: 'center', fontWeight: 700, border: '1px solid #CBD5E1' }}>{idx + 1}</td>
                      <td style={{ padding: '0.55rem', border: '1px solid #CBD5E1' }}>
                        <div style={{ fontWeight: 700 }}>{item.service_name}</div>
                        <div style={{ color: '#64748B', fontSize: '0.72rem' }}>{item.description}</div>
                      </td>
                      <td style={{ padding: '0.55rem', textAlign: 'center', border: '1px solid #CBD5E1' }}>{item.rate.toLocaleString()}</td>
                      <td style={{ padding: '0.55rem', textAlign: 'center', border: '1px solid #CBD5E1' }}>{item.days}</td>
                      <td style={{ padding: '0.55rem', textAlign: 'center', border: '1px solid #CBD5E1' }}>{item.amount.toLocaleString()}</td>
                      <td style={{ padding: '0.55rem', textAlign: 'center', border: '1px solid #CBD5E1' }}>
                        {item.other_expenses > 0 ? item.other_expenses.toLocaleString() : 'Not Applicable (Zero)'}
                      </td>
                      <td style={{ padding: '0.55rem', textAlign: 'center', fontWeight: 700, border: '1px solid #CBD5E1' }}>{item.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Remarks & Financial Totals Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              
              {/* Remarks */}
              <div style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '0.75rem', fontSize: '0.78rem' }}>
                <div style={{ color: '#102A71', fontWeight: 800, marginBottom: '0.5rem' }}>💬 REMARKS</div>
                <div style={{ color: '#475569', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{remarks}</div>
              </div>

              {/* Totals Table */}
              <div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '0.35rem', color: '#475569' }}>Subtotal</td>
                      <td style={{ padding: '0.35rem', textAlign: 'right', fontWeight: 600 }}>₹ {subtotal.toLocaleString('.2f')}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.35rem', color: '#475569' }}>GST</td>
                      <td style={{ padding: '0.35rem', textAlign: 'right' }}>₹ {gstAmount.toLocaleString('.2f')}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.35rem', color: '#475569' }}>Discount</td>
                      <td style={{ padding: '0.35rem', textAlign: 'right' }}>₹ {discountAmount.toLocaleString('.2f')}</td>
                    </tr>
                    <tr style={{ borderTop: '1px solid #CBD5E1', fontWeight: 700 }}>
                      <td style={{ padding: '0.4rem', color: '#102A71' }}>Total After GST</td>
                      <td style={{ padding: '0.4rem', textAlign: 'right' }}>₹ {totalAfterGst.toLocaleString('.2f')}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.35rem', color: '#475569' }}>Advance Received</td>
                      <td style={{ padding: '0.35rem', textAlign: 'right' }}>₹ {advanceReceived.toLocaleString('.2f')}</td>
                    </tr>
                    <tr style={{ borderTop: '1px solid #CBD5E1', fontWeight: 700 }}>
                      <td style={{ padding: '0.4rem', color: '#102A71' }}>Balance Due</td>
                      <td style={{ padding: '0.4rem', textAlign: 'right' }}>₹ {balanceDue.toLocaleString('.2f')}</td>
                    </tr>
                    <tr style={{ background: '#102A71', color: '#ffffff', fontWeight: 800, fontSize: '0.95rem' }}>
                      <td style={{ padding: '0.6rem' }}>GRAND TOTAL</td>
                      <td style={{ padding: '0.6rem', textAlign: 'right' }}>₹ {grandTotal.toLocaleString('.2f')}</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#102A71' }}>
                  Amount In Words: <span style={{ color: '#334155', fontWeight: 600 }}>{amountInWords}</span>
                </div>
              </div>

            </div>

            {/* Bank Transfer & UPI Payment Block */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr', gap: '1rem', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '0.85rem', background: '#F8FAFC', marginBottom: '1.25rem' }}>
              
              {/* Bank Details */}
              <div style={{ fontSize: '0.75rem', lineHeight: 1.6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <img src="/assets/invoice/hdfc_logo.png" alt="HDFC Bank" style={{ height: '22px', objectFit: 'contain' }} />
                  <span style={{ fontWeight: 800, color: '#102A71' }}>BANK TRANSFER (NEFT / RTGS)</span>
                </div>
                <div><strong>Beneficiary Name :</strong> SKANDAN HOME CARE & CCLINIC LLP</div>
                <div><strong>Account Number :</strong> 50200090644327</div>
                <div><strong>Account Type :</strong> Current Account</div>
                <div><strong>IFSC Code :</strong> HDFC0004277</div>
                <div><strong>MICR Code :</strong> 500240078</div>
              </div>

              {/* UPI Payment */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '1px dashed #CBD5E1', paddingLeft: '1rem' }}>
                <div style={{ flex: 1, fontSize: '0.75rem', lineHeight: 1.6 }}>
                  <div style={{ fontWeight: 800, color: '#102A71', marginBottom: '0.2rem' }}>💳 UPI PAYMENT</div>
                  <div><strong>UPI ID:</strong> 9866613699@hdfcbank</div>
                  <div style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <img src="/assets/invoice/payment_methods.png" alt="Payment Apps" style={{ height: '22px', objectFit: 'contain' }} />
                  </div>
                </div>
                
                {/* QR Code */}
                <div style={{ textAlign: 'center' }}>
                  <img src="/assets/invoice/payment_qr_clean.png" alt="Payment QR" style={{ width: '75px', height: '75px', border: '1px solid #CBD5E1', padding: '2px', background: '#fff' }} />
                  <div style={{ fontSize: '0.65rem', color: '#64748B', marginTop: '2px' }}>Scan & Pay</div>
                </div>

                {/* Verified Seal */}
                <div>
                  <img src="/assets/invoice/skandan_verified_seal.png" alt="Verified Seal" style={{ width: '75px', height: '75px', objectFit: 'contain' }} />
                </div>
              </div>

            </div>

            {/* Optional Signatures Block (From Image 4) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginTop: '1.25rem', marginBottom: '1.25rem', textAlign: 'center', borderTop: '1px solid #E2E8F0', paddingTop: '1rem', fontSize: '0.78rem', fontWeight: 700, color: '#102A71' }}>
              <div>
                <div style={{ height: '35px' }}></div>
                <div style={{ borderTop: '1px solid #CBD5E1', paddingTop: '4px' }}>Principal Signature</div>
              </div>
              <div>
                <div style={{ height: '35px' }}></div>
                <div style={{ borderTop: '1px solid #CBD5E1', paddingTop: '4px' }}>AO Signature</div>
              </div>
              <div>
                <div style={{ height: '35px' }}></div>
                <div style={{ borderTop: '1px solid #CBD5E1', paddingTop: '4px' }}>AGM Signature</div>
              </div>
            </div>

            {/* Footer Notice */}
            <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#64748B', borderTop: '1px solid #E2E8F0', paddingTop: '0.5rem', marginBottom: '1rem' }}>
              This invoice is system generated. No signature is required.
            </div>

            {/* OUR SERVICES Footer Bar (From Image 1/4) */}
            <div style={{ borderTop: '2px solid #102A71', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
              <div style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 800, color: '#102A71', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                OUR SERVICES
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', color: '#334155', fontWeight: 600, flexWrap: 'wrap', gap: '0.3rem' }}>
                <div>🛌 ICU Care at Home</div>
                <div>👨‍⚕️ Doctor Visits</div>
                <div>🩺 Nursing Care</div>
                <div>🧑‍🦯 Caretaker Services</div>
                <div>🏃 Physiotherapy</div>
                <div>🔬 Lab Tests at Home</div>
                <div>🩼 Medical Equipment Rental</div>
                <div>💊 Medicine Delivery</div>
                <div>🩹 Post-Operative Care</div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* HISTORY TAB - INVOICE LIST TABLE */}
      {activeTab === 'HISTORY' && (
        <div className="glass-card card-soft" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ margin: 0, color: 'var(--primary)' }}>Generated Invoices History</h3>
            
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search invoice number, client, date..."
                style={{ padding: '0.5rem 0.8rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', minWidth: '240px' }}
              />
            </div>
          </div>

          {historyQuery.isLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>Loading invoice history...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--panel)', borderBottom: '2px solid var(--border)', textTransform: 'uppercase', fontSize: '0.75rem', color: 'var(--muted)' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Invoice No</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Date</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Client / Patient</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Type</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Grand Total</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(historyQuery.data || []).length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
                        No invoices found. Click <strong>Generate Invoice</strong> to create your first invoice!
                      </td>
                    </tr>
                  ) : (
                    (historyQuery.data || []).map((inv) => (
                      <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>{inv.invoice_number}</td>
                        <td style={{ padding: '0.75rem' }}>{inv.invoice_date}</td>
                        <td style={{ padding: '0.75rem' }}>
                          <div style={{ fontWeight: 600 }}>{inv.client_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{inv.patient_name || inv.school_branch}</div>
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.75rem', background: 'rgba(107,47,160,0.1)', color: 'var(--primary)', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: 600 }}>
                            {inv.invoice_type}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700 }}>
                          ₹ {Number(inv.grand_total).toLocaleString()}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.75rem', background: inv.payment_status === 'Paid' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: inv.payment_status === 'Paid' ? '#10B981' : '#EF4444', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 700 }}>
                            {inv.payment_status}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                            <button
                              className="btn-secondary"
                              onClick={() => { setSelectedInvoice(inv); setActiveTab('PREVIEW'); }}
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                            >
                              View
                            </button>
                            <button
                              className="btn-secondary"
                              onClick={() => handleDownloadPdf(inv)}
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: 'rgba(16,185,129,0.1)', color: '#10B981' }}
                            >
                              Download
                            </button>
                            <button
                              className="btn-secondary"
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete invoice ${inv.invoice_number}? Numbering will not be reset.`)) {
                                  deleteMutation.mutate(inv.id)
                                }
                              }}
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SEARCH TAB */}
      {activeTab === 'SEARCH' && (
        <div className="glass-card card-soft" style={{ padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: 'var(--primary)' }}>Search Invoice Database</h3>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Invoice # (e.g. 1370), Client Name, Patient Name, or Date..."
              style={{ flex: 1, padding: '0.7rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
            />
            <button className="btn-primary" onClick={() => historyQuery.refetch()}>Search</button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--panel)', borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Invoice Number</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Client Name</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Patient / School</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Grand Total</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(historyQuery.data || []).map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>{inv.invoice_number}</td>
                    <td style={{ padding: '0.75rem' }}>{inv.client_name}</td>
                    <td style={{ padding: '0.75rem' }}>{inv.patient_name || inv.school_branch}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700 }}>₹ {Number(inv.grand_total).toLocaleString()}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <button className="btn-primary" onClick={() => { setSelectedInvoice(inv); setActiveTab('PREVIEW'); }} style={{ padding: '0.3rem 0.8rem', fontSize: '0.78rem' }}>
                        View Invoice
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VERIFY TAB */}
      {activeTab === 'VERIFY' && (
        <div className="glass-card card-soft" style={{ padding: '1.5rem', maxWidth: '650px', margin: '0 auto', width: '100%' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary)' }}>Verify Invoice Authenticity</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Scan Code-128 barcode or enter full invoice serial number (e.g. <code>1370 - 0001</code>) to verify authenticity against Skandan database records.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <input
              type="text"
              value={verifyInput}
              onChange={(e) => setVerifyInput(e.target.value)}
              placeholder="Enter Invoice Number or scan Barcode (e.g. 1370-0001)..."
              style={{ flex: 1, padding: '0.7rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontWeight: 600 }}
            />
            <button className="btn-primary" onClick={handleVerify}>Verify</button>
          </div>

          {verifyResult && (
            <div style={{ marginTop: '1rem' }}>
              {verifyResult.found && verifyResult.invoice ? (
                <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid #10B981', borderRadius: '12px', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10B981', fontWeight: 800, fontSize: '1.1rem', marginBottom: '0.75rem' }}>
                    ✅ Authentic Invoice Verified
                  </div>
                  <div style={{ fontSize: '0.85rem', lineHeight: 1.6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div><strong>Invoice No:</strong> {verifyResult.invoice.invoice_number}</div>
                    <div><strong>Invoice Date:</strong> {verifyResult.invoice.invoice_date}</div>
                    <div><strong>Client:</strong> {verifyResult.invoice.client_name}</div>
                    <div><strong>Grand Total:</strong> ₹ {Number(verifyResult.invoice.grand_total).toLocaleString()}</div>
                    <div><strong>Status:</strong> {verifyResult.invoice.payment_status}</div>
                    <div><strong>Generated By:</strong> {verifyResult.invoice.generated_by}</div>
                  </div>
                  <button
                    className="btn-primary"
                    style={{ marginTop: '1rem', width: '100%' }}
                    onClick={() => { setSelectedInvoice(verifyResult.invoice!); setActiveTab('PREVIEW'); }}
                  >
                    View Verified Original Document &rarr;
                  </button>
                </div>
              ) : (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid #EF4444', borderRadius: '12px', padding: '1.25rem', textAlign: 'center', color: '#EF4444' }}>
                  <div style={{ fontWeight: 800, fontSize: '1.2rem', marginBottom: '0.3rem' }}>❌ Invoice Not Found</div>
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>No invoice matches the provided number or barcode in our database.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
