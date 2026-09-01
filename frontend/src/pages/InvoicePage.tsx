import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { authedFetch } from '../lib/api'
import { safeStorage } from '../lib/storage'
import { motion, AnimatePresence } from 'framer-motion'
import { InvoiceDashboardHeader } from '../components/invoice/InvoiceDashboardHeader'
import { InvoiceLivePreview, formatDisplayDate, computeInvoiceTotals } from '../components/invoice/InvoiceLivePreview'
import type { InvoicePreviewData, ServiceItem } from '../components/invoice/InvoiceLivePreview'
import { InvoiceFormAccordion } from '../components/invoice/InvoiceFormAccordion'
import {
  FileText, Building, Plus, Search, ShieldCheck, Download, Eye, Trash2, CheckCircle2,
  AlertTriangle, RefreshCw, DollarSign, TrendingUp, Clock, Layers, ArrowRight,
  ZoomIn, ZoomOut, Maximize2, Minimize2
} from 'lucide-react'

export interface Invoice {
  id: number
  invoice_number: string
  invoice_type: 'REGULAR' | 'SCHOOL' | 'MULTI_SERVICE'
  verification_hash?: string
  display_hash?: string
  invoice_date: string
  billing_period_text: string
  start_date: string
  client_name: string
  client_contact: string
  gender?: string
  age?: string
  client_address: string
  client_gst?: string
  patient_name?: string
  patient_age_gender?: string
  service_type?: string
  consultant?: string
  rendered_days?: string
  school_branch?: string
  contact_person?: string
  contact_person_designation?: string
  no_of_nurses?: number
  no_of_students?: number
  per_day_charges: number
  subtotal: number
  gst_rate?: number
  gst: number
  discount: number
  total_after_gst: number
  advance_received: number
  balance_due: number
  grand_total: number
  amount_in_words: string
  payment_status: string
  remarks?: string
  services_data: any[]
  pdf_path?: string
  generated_by: string
  created_at: string
}

const defaultInvoiceData: InvoicePreviewData = {
  invoiceNumber: '1369-0001',
  invoiceType: 'REGULAR',
  invoiceDate: new Date().toISOString().split('T')[0],
  billingPeriodText: '',
  startDateText: '',
  clientName: '',
  clientContact: '',
  gender: '',
  age: '',
  clientAddress: '',
  clientGst: '',
  patientName: '',
  patientAgeGender: '',
  serviceType: '',
  consultant: '',
  renderedDays: '',
  serviceStarted: '',
  serviceEnd: '',
  schoolBranch: '',
  contactPerson: '',
  perDayCharges: 0,
  advanceReceived: 0,
  paymentStatus: 'Pending',
  remarks: '',
  gstRate: 0,
  gstAmount: 0,
  discountAmount: 0,
  services: [
    {
      s_no: 1,
      service_name: '',
      description: '',
      rate: 0,
      days: 0,
      amount: 0,
      other_expenses: 0,
      total: 0,
    },
  ],
}

export function InvoicePage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'EDITOR' | 'SEARCH' | 'VERIFY'>('DASHBOARD')
  const [searchQuery, setSearchQuery] = useState('')
  const [verifyInput, setVerifyInput] = useState('')
  const [verifyResult, setVerifyResult] = useState<{
    found: boolean
    verified?: boolean
    status_text?: string
    invoice?: Invoice
    recalculated_hash?: string
    stored_hash?: string
    message?: string
  } | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  // Auto-save state
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  const [lastSavedTime, setLastSavedTime] = useState('Just now')

  // Zoom
  const [zoom, setZoom] = useState(80)
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false)

  // Invoice Data
  const [invoiceData, setInvoiceData] = useState<InvoicePreviewData>(defaultInvoiceData)

  // Queries
  const nextNumQuery = useQuery({
    queryKey: ['invoice-next-number'],
    queryFn: async () => {
      const token = (await getToken()) || ''
      const res = await authedFetch('/api/invoices/next-number', token)
      if (!res.ok) return { next_invoice_number: '1369-0001' }
      return res.json()
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  // Set initial invoice number when nextNumQuery finishes
  useEffect(() => {
    if (nextNumQuery.data?.next_invoice_number && invoiceData.invoiceNumber === '1369-0001') {
      setInvoiceData((prev) => ({ ...prev, invoiceNumber: nextNumQuery.data.next_invoice_number }))
    }
  }, [nextNumQuery.data])

  const invoicesQuery = useQuery({
    queryKey: ['invoices-list', searchQuery],
    queryFn: async () => {
      const token = (await getToken()) || ''
      const url = searchQuery
        ? `/api/invoices/?search=${encodeURIComponent(searchQuery)}`
        : '/api/invoices/'
      const res = await authedFetch(url, token)
      if (!res.ok) return []
      return (await res.json()) as Invoice[]
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  })

  // Known Clients Query for Autocomplete & Auto-Fill
  const clientsQuery = useQuery({
    queryKey: ['invoice-clients'],
    queryFn: async () => {
      const token = (await getToken()) || ''
      const res = await authedFetch('/api/invoices/clients/', token)
      if (!res.ok) return []
      return (await res.json())
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  // Analytics
  const statsMetrics = useMemo(() => {
    const list = invoicesQuery.data || []
    const totalRev = list.reduce((acc, inv) => acc + (inv.grand_total || 0), 0)
    const paidCount = list.filter((i) => i.payment_status === 'Paid').length
    const pendingCount = list.filter((i) => i.payment_status === 'Pending').length
    return { totalInvoices: list.length, totalRevenue: totalRev, paidCount, pendingCount }
  }, [invoicesQuery.data])

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const token = (await getToken()) || ''
      const res = await authedFetch('/api/invoices/', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        let msg = err.detail
        if (!msg && typeof err === 'object' && Object.keys(err).length > 0) {
          const fieldErrs = Object.entries(err)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
            .join('; ')
          if (fieldErrs) msg = fieldErrs
        }
        throw new Error(msg || 'Failed to save invoice.')
      }
      return res.json() as Promise<Invoice>
    },
    onSuccess: async (savedInvoice) => {
      setSelectedInvoice(savedInvoice)
      queryClient.invalidateQueries({ queryKey: ['invoices-list'] })
      queryClient.invalidateQueries({ queryKey: ['invoice-clients'] })
      const updatedNext = await queryClient.fetchQuery({
        queryKey: ['invoice-next-number'],
        queryFn: async () => {
          const token = (await getToken()) || ''
          const res = await authedFetch('/api/invoices/next-number', token)
          if (!res.ok) return { next_invoice_number: '1369-0001' }
          return res.json()
        },
      })
      
      if (updatedNext?.next_invoice_number) {
        setInvoiceData((prev) => ({ ...prev, invoiceNumber: updatedNext.next_invoice_number }))
      }

      // Automatically offer instant PDF download
      const shouldDownload = window.confirm(`Invoice ${savedInvoice.invoice_number} generated & saved successfully!\n\nClick OK to download the PDF now.`)
      if (shouldDownload) {
        handleDownloadPDF(savedInvoice)
      }
    },
    onError: (err: any) => {
      alert(`Error saving invoice: ${err.message}`)
    },
  })

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const token = (await getToken()) || ''
      const res = await authedFetch(`/api/invoices/${id}`, token, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete invoice.')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices-list'] })
      queryClient.invalidateQueries({ queryKey: ['invoice-clients'] })
    },
  })

  // Auto-Save Draft (stable interval — uses ref to avoid re-creating timer on every keystroke)
  const invoiceDataRef = useRef(invoiceData)
  invoiceDataRef.current = invoiceData

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAutoSaving(true)
      safeStorage.setItem('skandan_direct_invoice_draft', JSON.stringify(invoiceDataRef.current))
      setTimeout(() => {
        setIsAutoSaving(false)
        setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
      }, 600)
    }, 15000)
    return () => clearInterval(interval)
  }, [])

  const handleOpenEditor = (type: 'REGULAR' | 'SCHOOL' | 'MULTI_SERVICE') => {
    const nextNum = nextNumQuery.data?.next_invoice_number || '1369-0001'
    setInvoiceData({
      ...defaultInvoiceData,
      invoiceNumber: nextNum,
      invoiceType: type,
      invoiceDate: new Date().toISOString().split('T')[0],
    })
    setSelectedInvoice(null)
    setActiveTab('EDITOR')
  }

  // Print Handlers
  const handlePrint = () => {
    window.print()
  }

  const handleSaveInvoice = async (): Promise<Invoice | null> => {
    const { subtotal, gstRate, gstAmount: computedGstAmount, discountAmount, totalAfterGst, balanceDue, grandTotal } = computeInvoiceTotals(invoiceData)

    const payload = {
      invoice_number: invoiceData.invoiceNumber,
      invoice_type: invoiceData.invoiceType,
      invoice_date: invoiceData.invoiceDate,
      billing_period_text: invoiceData.billingPeriodText,
      start_date: invoiceData.startDateText,
      client_name: invoiceData.clientName,
      client_contact: invoiceData.clientContact,
      gender: invoiceData.gender || '',
      age: invoiceData.age || '',
      client_address: invoiceData.clientAddress,
      client_gst: invoiceData.clientGst,
      patient_name: invoiceData.patientName,
      patient_age_gender: invoiceData.patientAgeGender,
      service_type: invoiceData.serviceType,
      consultant: invoiceData.consultant,
      service_start_date: invoiceData.serviceStarted || invoiceData.startDateText || '',
      service_end_date: invoiceData.serviceEnd || '',
      rendered_days: invoiceData.renderedDays,
      school_branch: invoiceData.schoolBranch,
      contact_person: invoiceData.contactPerson,
      per_day_charges: invoiceData.perDayCharges,
      subtotal,
      gst_rate: gstRate,
      gst: computedGstAmount,
      discount: discountAmount,
      total_after_gst: totalAfterGst,
      advance_received: invoiceData.advanceReceived,
      balance_due: balanceDue,
      grand_total: grandTotal,
      payment_status: invoiceData.paymentStatus,
      remarks: invoiceData.remarks,
      services_data: invoiceData.services,
    }
    try {
      const saved = await saveMutation.mutateAsync(payload)
      if (saved) {
        setSelectedInvoice(saved)
      }
      return saved
    } catch (err: any) {
      alert(`Save Error: ${err.message || 'Failed to save invoice.'}`)
      return null
    }
  }

  const handleDownloadPDF = async (inv?: Invoice) => {
    let target = inv || selectedInvoice
    try {
      const token = (await getToken()) || ''

      let res: Response | null = null

      // 1. If target exists with an ID, try fetching its PDF directly
      if (target && (target.id || target.invoice_number)) {
        const fetchId = target.id || target.invoice_number
        res = await authedFetch(`/api/invoices/${fetchId}/pdf/`, token)
      }

      // 2. If no target or GET failed, generate directly on-the-fly via POST
      if (!res || !res.ok) {
        const { subtotal, gstRate, gstAmount: computedGst, discountAmount, totalAfterGst, balanceDue, grandTotal } = computeInvoiceTotals(invoiceData)
        const payload = {
          invoice_number: target?.invoice_number || invoiceData.invoiceNumber,
          invoice_type: target?.invoice_type || invoiceData.invoiceType,
          invoice_date: target?.invoice_date || invoiceData.invoiceDate,
          billing_period_text: target?.billing_period_text || invoiceData.billingPeriodText,
          start_date: target?.start_date || invoiceData.startDateText,
          client_name: target?.client_name || invoiceData.clientName,
          client_contact: target?.client_contact || invoiceData.clientContact,
          gender: target?.gender || invoiceData.gender || '',
          age: target?.age || invoiceData.age || '',
          client_address: target?.client_address || invoiceData.clientAddress,
          client_gst: target?.client_gst || invoiceData.clientGst,
          patient_name: target?.patient_name || invoiceData.patientName,
          patient_age_gender: target?.patient_age_gender || invoiceData.patientAgeGender,
          service_type: target?.service_type || invoiceData.serviceType,
          consultant: target?.consultant || invoiceData.consultant,
          service_start_date: invoiceData.serviceStarted || invoiceData.startDateText || '',
          service_end_date: invoiceData.serviceEnd || '',
          rendered_days: target?.rendered_days || invoiceData.renderedDays,
          school_branch: target?.school_branch || invoiceData.schoolBranch,
          contact_person: target?.contact_person || invoiceData.contactPerson,
          per_day_charges: target?.per_day_charges ?? invoiceData.perDayCharges,
          subtotal,
          gst_rate: gstRate,
          gst: computedGst,
          discount: discountAmount,
          total_after_gst: totalAfterGst,
          advance_received: target?.advance_received ?? invoiceData.advanceReceived,
          balance_due: balanceDue,
          grand_total: grandTotal,
          payment_status: target?.payment_status || invoiceData.paymentStatus,
          remarks: target?.remarks || invoiceData.remarks,
          services_data: target?.services_data || invoiceData.services,
        }
        res = await authedFetch('/api/invoices/download-pdf/', token, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || 'PDF download failed.')
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      const invNum = (target?.invoice_number || invoiceData.invoiceNumber || '1369-0001').replace(/\s+/g, '_')
      a.download = `Invoice_${invNum}.pdf`
      document.body.appendChild(a)
      a.click()

      setTimeout(() => {
        if (document.body.contains(a)) {
          document.body.removeChild(a)
        }
        window.URL.revokeObjectURL(url)
      }, 1500)
    } catch (err: any) {
      alert(`Download Error: ${err.message || 'Failed to download PDF'}`)
    }
  }

  const handleVerify = async () => {
    if (!verifyInput.trim()) return
    try {
      const token = (await getToken()) || ''
      const res = await authedFetch(
        `/api/invoices/verify/?q=${encodeURIComponent(verifyInput.trim())}`,
        token
      )
      const data = await res.json()
      setVerifyResult(data)
    } catch (e: any) {
      setVerifyResult({ found: false, message: e.message || 'Verification error.' })
    }
  }

  const handleLoadInvoice = (inv: Invoice) => {
    setSelectedInvoice(inv)
    setInvoiceData({
      invoiceNumber: inv.invoice_number,
      invoiceType: inv.invoice_type,
      invoiceDate: inv.invoice_date,
      billingPeriodText: inv.billing_period_text,
      startDateText: inv.start_date,
      clientName: inv.client_name,
      clientContact: inv.client_contact,
      gender: inv.gender || '',
      age: inv.age || '',
      clientAddress: inv.client_address,
      clientGst: inv.client_gst,
      patientName: inv.patient_name,
      patientAgeGender: inv.patient_age_gender,
      serviceType: inv.service_type,
      consultant: inv.consultant,
      renderedDays: inv.rendered_days,
      schoolBranch: inv.school_branch,
      contactPerson: inv.contact_person,
      perDayCharges: inv.per_day_charges,
      gstRate: inv.gst_rate ?? (inv.subtotal > 0 && inv.gst ? (inv.gst / inv.subtotal) * 100 : 0),
      gstAmount: inv.gst,
      discountAmount: inv.discount,
      advanceReceived: inv.advance_received,
      paymentStatus: inv.payment_status,
      remarks: inv.remarks || '',
      services: inv.services_data || defaultInvoiceData.services,
    })
    setActiveTab('EDITOR')
  }

  // ---- RENDER ----
  const containerStyle: React.CSSProperties = {
    fontFamily: "'Poppins', 'Inter', sans-serif",
    background: 'var(--inv-bg)',
    color: 'var(--inv-text)',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  }

  return (
    <div style={containerStyle} className="no-print-container">
      {/* Sticky Header Toolbar */}
      <InvoiceDashboardHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isAutoSaving={isAutoSaving}
        lastSavedTime={lastSavedTime}
        onDownloadPDF={() => handleDownloadPDF()}
        onSaveDraft={() => {
          safeStorage.setItem('skandan_direct_invoice_draft', JSON.stringify(invoiceData))
          alert('Draft saved successfully!')
        }}
        onSaveInvoice={handleSaveInvoice}
        onVerifyModal={() => setActiveTab('VERIFY')}
        onPrint={handlePrint}
        invoiceNumber={invoiceData.invoiceNumber}
        templateType={invoiceData.invoiceType}
        isSaving={saveMutation.isPending}
      />

      {/* Main Content */}
      <main style={{ flex: 1 }}>
        <AnimatePresence mode="wait">
          {/* ===== DASHBOARD TAB ===== */}
          {activeTab === 'DASHBOARD' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              style={{ padding: 24, maxWidth: 1600, margin: '0 auto' }}
            >
              {/* Stats Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                {[
                  {
                    label: 'Total Invoices',
                    value: statsMetrics.totalInvoices,
                    icon: FileText,
                    color: '#0B2C8C',
                    bg: '#EDF2FF',
                    sub: 'All generated invoices',
                  },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08, duration: 0.35 }}
                    whileHover={{ y: -4, boxShadow: '0 8px 30px rgba(11,44,140,0.12)' }}
                    style={{
                      background: 'var(--inv-card)',
                      borderRadius: 14,
                      padding: 20,
                      border: '1px solid var(--inv-border)',
                      boxShadow: 'var(--inv-shadow-sm)',
                      position: 'relative',
                      overflow: 'hidden',
                      cursor: 'default',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: -10,
                        right: -10,
                        width: 60,
                        height: 60,
                        borderRadius: '50%',
                        background: stat.bg,
                        opacity: 0.5,
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#616161',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}
                        >
                          {stat.label}
                        </div>
                        <div
                          style={{
                            fontSize: 22,
                            fontWeight: 700,
                            color: stat.color,
                            marginTop: 4,
                            fontFamily: 'Poppins, sans-serif',
                          }}
                        >
                          {stat.value}
                        </div>
                      </div>
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          background: stat.bg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <stat.icon style={{ width: 18, height: 18, color: stat.color }} />
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 10, fontWeight: 500 }}>
                      {stat.sub}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Quick Actions */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                {[
                  {
                    type: 'REGULAR' as const,
                    title: 'Regular Invoice',
                    desc: 'Standard patient / caretaker healthcare services',
                    icon: FileText,
                    color: '#0B2C8C',
                    bg: '#EDF2FF',
                  },
                  {
                    type: 'SCHOOL' as const,
                    title: 'School / College Invoice',
                    desc: 'Institutional healthcare, nursing & campus wellness',
                    icon: Building,
                    color: '#6B2FA0',
                    bg: '#F3E8FF',
                  },
                  {
                    type: 'MULTI_SERVICE' as const,
                    title: 'Multi-Service Invoice',
                    desc: 'Multiple line items with automatic multi-page overflow',
                    icon: Layers,
                    color: '#1A4DD8',
                    bg: '#EDF2FF',
                  },
                ].map((action, i) => (
                  <motion.div
                    key={action.type}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.08, duration: 0.35 }}
                    whileHover={{ y: -3, boxShadow: '0 8px 30px rgba(11,44,140,0.10)' }}
                    onClick={() => handleOpenEditor(action.type)}
                    style={{
                      background: 'var(--inv-card)',
                      borderRadius: 14,
                      padding: 22,
                      border: '1px solid var(--inv-border)',
                      boxShadow: 'var(--inv-shadow-sm)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 14,
                    }}
                  >
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        background: action.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <action.icon style={{ width: 20, height: 20, color: action.color }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--inv-text)' }}>{action.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--inv-text-secondary)', marginTop: 3 }}>{action.desc}</div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: action.color,
                          marginTop: 10,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        Create Invoice <ArrowRight style={{ width: 13, height: 13 }} />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Recent Invoices */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.35 }}
                style={{
                  background: 'var(--inv-card)',
                  borderRadius: 14,
                  border: '1px solid var(--inv-border)',
                  boxShadow: 'var(--inv-shadow-sm)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #F0F4FA',
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0B2C8C' }}>Recent Invoices</div>
                  <button
                    onClick={() => setActiveTab('SEARCH')}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#1A4DD8',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    View All
                  </button>
                </div>

                {invoicesQuery.isLoading ? (
                  <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>
                    Loading invoices...
                  </div>
                ) : (invoicesQuery.data || []).length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>
                    No invoices created yet. Click a template above to get started.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr
                          style={{
                            background: '#0B2C8C',
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          <th style={{ padding: '10px 16px', textAlign: 'left' }}>Invoice No</th>
                          <th style={{ padding: '10px 16px', textAlign: 'left' }}>Client</th>
                          <th style={{ padding: '10px 16px', textAlign: 'left' }}>Type</th>
                          <th style={{ padding: '10px 16px', textAlign: 'left' }}>Hash</th>
                          <th style={{ padding: '10px 16px', textAlign: 'right' }}>Amount</th>
                          <th style={{ padding: '10px 16px', textAlign: 'left' }}>Date</th>
                          <th style={{ padding: '10px 16px', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(invoicesQuery.data || []).slice(0, 10).map((inv) => (
                          <tr
                            key={inv.id}
                            style={{
                              borderBottom: '1px solid #F0F4FA',
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFBFE')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                          >
                            <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0B2C8C' }}>
                              {inv.invoice_number}
                            </td>
                            <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1A1A1A' }}>
                              {inv.client_name}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                  fontSize: 10,
                                  fontWeight: 600,
                                  background: '#EDF2FF',
                                  color: '#0B2C8C',
                                  border: '1px solid #DCE7FF',
                                }}
                              >
                                {inv.invoice_type}
                              </span>
                            </td>
                            <td
                              style={{
                                padding: '12px 16px',
                                fontFamily: 'monospace',
                                fontSize: 11,
                                fontWeight: 600,
                                color: '#616161',
                              }}
                            >
                              {inv.display_hash || inv.verification_hash?.slice(0, 16) || '-'}
                            </td>
                            <td
                              style={{
                                padding: '12px 16px',
                                textAlign: 'right',
                                fontWeight: 700,
                                color: '#1A1A1A',
                              }}
                            >
                              Rs. {inv.grand_total.toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '12px 16px', color: '#616161' }}>{formatDisplayDate(inv.invoice_date)}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                <button
                                  onClick={() => handleLoadInvoice(inv)}
                                  title="Edit"
                                  style={{
                                    padding: 6,
                                    borderRadius: 6,
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    color: '#1A4DD8',
                                  }}
                                >
                                  <Eye style={{ width: 15, height: 15 }} />
                                </button>
                                <button
                                  onClick={() => handleDownloadPDF(inv)}
                                  title="Download PDF"
                                  style={{
                                    padding: 6,
                                    borderRadius: 6,
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    color: '#2E7D32',
                                  }}
                                >
                                  <Download style={{ width: 15, height: 15 }} />
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`Delete invoice ${inv.invoice_number}?`))
                                      deleteMutation.mutate(inv.id)
                                  }}
                                  title="Delete"
                                  style={{
                                    padding: 6,
                                    borderRadius: 6,
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    color: '#D32F2F',
                                  }}
                                >
                                  <Trash2 style={{ width: 15, height: 15 }} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}

          {/* ===== EDITOR TAB - SPLIT SCREEN ===== */}
          {activeTab === 'EDITOR' && (
            <motion.div
              key="editor"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                display: 'grid',
                gridTemplateColumns: isPreviewFullscreen ? '0px 1fr' : '380px 1fr',
                height: 'calc(100vh - 56px)',
                overflow: 'hidden',
                transition: 'grid-template-columns 0.3s ease',
              }}
            >
              {/* LEFT PANEL: Form */}
              <div
                style={{
                  borderRight: '1px solid var(--inv-border)',
                  background: 'var(--inv-bg)',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  padding: isPreviewFullscreen ? 0 : '16px',
                  display: isPreviewFullscreen ? 'none' : 'block',
                }}
              >
                <InvoiceFormAccordion
                  data={invoiceData}
                  onChange={setInvoiceData}
                  existingInvoices={invoicesQuery.data || []}
                  clientsList={clientsQuery.data || []}
                />
              </div>

              {/* RIGHT PANEL: Live Preview */}
              <div
                style={{
                  background: 'var(--inv-bg)',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                }}
              >
                {/* Preview Toolbar */}
                <div
                  style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 20,
                    background: 'var(--inv-card)',
                    backdropFilter: 'blur(8px)',
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid var(--inv-border)',
                    color: 'var(--inv-text)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#616161',
                        fontFamily: 'Poppins, sans-serif',
                      }}
                    >
                      Live Preview
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: '#0B2C8C',
                        background: '#EDF2FF',
                        padding: '2px 8px',
                        borderRadius: 4,
                      }}
                    >
                      {zoom}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      onClick={() => setZoom(Math.max(40, zoom - 10))}
                      style={{
                        padding: 5,
                        borderRadius: 6,
                        border: '1px solid #D8E3F5',
                        background: '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                      }}
                    >
                      <ZoomOut style={{ width: 14, height: 14, color: '#616161' }} />
                    </button>
                    {[50, 75, 100].map((z) => (
                      <button
                        key={z}
                        onClick={() => setZoom(z)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: '1px solid #D8E3F5',
                          background: zoom === z ? '#0B2C8C' : '#fff',
                          color: zoom === z ? '#fff' : '#616161',
                          cursor: 'pointer',
                          fontSize: 10,
                          fontWeight: 600,
                        }}
                      >
                        {z}%
                      </button>
                    ))}
                    <button
                      onClick={() => setZoom(Math.min(150, zoom + 10))}
                      style={{
                        padding: 5,
                        borderRadius: 6,
                        border: '1px solid #D8E3F5',
                        background: '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                      }}
                    >
                      <ZoomIn style={{ width: 14, height: 14, color: '#616161' }} />
                    </button>
                    <button
                      onClick={() => setIsPreviewFullscreen(!isPreviewFullscreen)}
                      style={{
                        padding: 5,
                        borderRadius: 6,
                        border: '1px solid #D8E3F5',
                        background: '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        marginLeft: 4,
                      }}
                      title={isPreviewFullscreen ? "Exit Fullscreen" : "Fullscreen Preview"}
                    >
                      {isPreviewFullscreen ? (
                        <Minimize2 style={{ width: 14, height: 14, color: '#616161' }} />
                      ) : (
                        <Maximize2 style={{ width: 14, height: 14, color: '#616161' }} />
                      )}
                    </button>

                    <button
                      onClick={() => handleDownloadPDF()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: '1px solid #DCE7FF',
                        background: '#EDF2FF',
                        color: '#0B2C8C',
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 600,
                        marginLeft: 8,
                        fontFamily: 'Poppins, sans-serif',
                      }}
                      title="Download PDF Document"
                    >
                      <Download style={{ width: 13, height: 13 }} />
                      Download PDF
                    </button>
                  </div>
                </div>

                {/* Preview Content */}
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    justifyContent: 'center',
                    padding: '20px 16px',
                  }}
                >
                  <InvoiceLivePreview data={invoiceData} zoom={zoom} />
                </div>
              </div>
            </motion.div>
          )}

          {/* ===== SEARCH TAB ===== */}
          {activeTab === 'SEARCH' && (
            <motion.div
              key="search"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}
            >
              <div
                style={{
                  background: 'var(--inv-card)',
                  borderRadius: 14,
                  border: '1px solid var(--inv-border)',
                  boxShadow: 'var(--inv-shadow-sm)',
                  overflow: 'hidden',
                  color: 'var(--inv-text)',
                }}
              >
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--inv-border)' }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--inv-primary)',
                      marginBottom: 12,
                    }}
                  >
                    Search Invoices
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Search
                      style={{
                        position: 'absolute',
                        left: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 16,
                        height: 16,
                        color: 'var(--inv-text-secondary)',
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Search by Invoice Number, Organization, Patient, or Hash..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px 10px 38px',
                        borderRadius: 10,
                        border: '1px solid var(--inv-border)',
                        background: 'var(--inv-bg)',
                        color: 'var(--inv-text)',
                        fontSize: 12,
                        fontFamily: 'Poppins, sans-serif',
                        outline: 'none',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'var(--inv-primary)'
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(11,44,140,0.15)'
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'var(--inv-border)'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    />
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr
                        style={{
                          background: '#0B2C8C',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                        }}
                      >
                        <th style={{ padding: '10px 16px', textAlign: 'left' }}>Invoice No</th>
                        <th style={{ padding: '10px 16px', textAlign: 'left' }}>Client</th>
                        <th style={{ padding: '10px 16px', textAlign: 'left' }}>Type</th>
                        <th style={{ padding: '10px 16px', textAlign: 'left' }}>Hash</th>
                        <th style={{ padding: '10px 16px', textAlign: 'right' }}>Amount</th>
                        <th style={{ padding: '10px 16px', textAlign: 'left' }}>Date</th>
                        <th style={{ padding: '10px 16px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(invoicesQuery.data || []).map((inv) => (
                        <tr
                          key={inv.id}
                          style={{ borderBottom: '1px solid #F0F4FA' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFBFE')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                        >
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0B2C8C' }}>
                            {inv.invoice_number}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{inv.client_name}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span
                              style={{
                                padding: '3px 8px',
                                borderRadius: 6,
                                fontSize: 10,
                                fontWeight: 600,
                                background: '#EDF2FF',
                                color: '#0B2C8C',
                              }}
                            >
                              {inv.invoice_type}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: '12px 16px',
                              fontFamily: 'monospace',
                              fontSize: 11,
                              fontWeight: 600,
                              color: '#616161',
                            }}
                          >
                            {inv.display_hash || '-'}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>
                            Rs. {inv.grand_total.toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '12px 16px', color: '#616161' }}>{formatDisplayDate(inv.invoice_date)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => handleLoadInvoice(inv)}
                                style={{
                                  padding: 6,
                                  borderRadius: 6,
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  color: '#1A4DD8',
                                }}
                              >
                                <Eye style={{ width: 15, height: 15 }} />
                              </button>
                              <button
                                onClick={() => handleDownloadPDF(inv)}
                                style={{
                                  padding: 6,
                                  borderRadius: 6,
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  color: '#2E7D32',
                                }}
                              >
                                <Download style={{ width: 15, height: 15 }} />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Delete invoice ${inv.invoice_number}?`))
                                    deleteMutation.mutate(inv.id)
                                }}
                                style={{
                                  padding: 6,
                                  borderRadius: 6,
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  color: '#D32F2F',
                                }}
                              >
                                <Trash2 style={{ width: 15, height: 15 }} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* ===== VERIFY TAB ===== */}
          {activeTab === 'VERIFY' && (
            <motion.div
              key="verify"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}
            >
              <div
                style={{
                  background: 'var(--inv-card)',
                  borderRadius: 14,
                  border: '1px solid var(--inv-border)',
                  boxShadow: 'var(--inv-shadow-sm)',
                  padding: 24,
                  color: 'var(--inv-text)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: '#E8F5E9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ShieldCheck style={{ width: 20, height: 20, color: '#2E7D32' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--inv-primary)' }}>
                      Verify Invoice Authenticity
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--inv-text-secondary)' }}>
                      Enter an Invoice Number or SHA-256 Hash to verify.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                  <input
                    type="text"
                    placeholder="Enter Invoice Number or Verification Hash..."
                    value={verifyInput}
                    onChange={(e) => setVerifyInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: '1px solid var(--inv-border)',
                      background: 'var(--inv-bg)',
                      color: 'var(--inv-text)',
                      fontSize: 12,
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleVerify}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 10,
                      border: 'none',
                      background: 'linear-gradient(135deg, #2E7D32, #43A047)',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontFamily: 'Poppins, sans-serif',
                      boxShadow: '0 2px 8px rgba(46,125,50,0.25)',
                    }}
                  >
                    <ShieldCheck style={{ width: 14, height: 14 }} />
                    Verify
                  </button>
                </div>

                {verifyResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ marginTop: 20 }}
                  >
                    {!verifyResult.found ? (
                      <div
                        style={{
                          padding: 16,
                          borderRadius: 10,
                          background: '#FFF3F3',
                          border: '1px solid #FFCDD2',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          color: '#D32F2F',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        <AlertTriangle style={{ width: 18, height: 18 }} />
                        {verifyResult.message || 'Invoice not found in database.'}
                      </div>
                    ) : (
                      <div>
                        <div
                          style={{
                            padding: 16,
                            borderRadius: 10,
                            background: '#E8F5E9',
                            border: '1px solid #A5D6A7',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            color: '#2E7D32',
                            fontSize: 13,
                            fontWeight: 700,
                            marginBottom: 14,
                          }}
                        >
                          <CheckCircle2 style={{ width: 20, height: 20 }} />
                          Invoice Verified - Cryptographic Hash Match Confirmed
                        </div>

                        {verifyResult.invoice && (
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              gap: 10,
                              padding: 16,
                              borderRadius: 10,
                              background: '#FAFBFE',
                              border: '1px solid #D8E3F5',
                              fontSize: 12,
                            }}
                          >
                            {[
                              ['Invoice Number', verifyResult.invoice.invoice_number, '#0B2C8C'],
                              ['Client', verifyResult.invoice.client_name, '#1A1A1A'],
                              ['Invoice Date', verifyResult.invoice.invoice_date, '#1A1A1A'],
                              ['Generated By', verifyResult.invoice.generated_by, '#1A1A1A'],
                              [
                                'Stored Hash',
                                verifyResult.stored_hash || verifyResult.invoice.display_hash || '-',
                                '#2E7D32',
                              ],
                              [
                                'Grand Total',
                                `Rs. ${verifyResult.invoice.grand_total.toLocaleString('en-IN')}`,
                                '#0B2C8C',
                              ],
                            ].map(([label, val, color]) => (
                              <div key={label as string}>
                                <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, marginBottom: 2 }}>
                                  {label}
                                </div>
                                <div style={{ fontWeight: 700, color: color as string, fontFamily: label === 'Stored Hash' ? 'monospace' : 'Poppins, sans-serif' }}>
                                  {val}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
