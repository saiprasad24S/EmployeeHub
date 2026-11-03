import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Download,
  FolderDown,
  FileSpreadsheet,
  FileText,
  Calendar,
  Check,
  RefreshCw,
  AlertCircle,
  CheckSquare,
  Square,
} from 'lucide-react'
import { useAuth } from '@clerk/clerk-react'
import { authedFetch } from '../../lib/api'

interface MonthItem {
  year: number
  month: number
  month_key: string
  label: string
  count: number
}

interface DownloadInvoicesModalProps {
  isOpen: boolean
  onClose: () => void
}

export const DownloadInvoicesModal: React.FC<DownloadInvoicesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { getToken } = useAuth()

  const [months, setMonths] = useState<MonthItem[]>([])
  const [selectedMonths, setSelectedMonths] = useState<string[]>([])
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf')
  const [isLoadingMonths, setIsLoadingMonths] = useState<boolean>(false)
  const [isDownloading, setIsDownloading] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Fetch available months whenever modal opens
  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null)
      setSuccessMessage(null)
      return
    }

    let isMounted = true
    const loadMonths = async () => {
      setIsLoadingMonths(true)
      setErrorMessage(null)
      try {
        const token = (await getToken()) || ''
        const res = await authedFetch('/api/invoices/available-months/', token)
        if (!res.ok) {
          throw new Error('Failed to load available invoice months')
        }
        const data: MonthItem[] = await res.json()
        if (isMounted) {
          setMonths(data)
          // Default selection: select the first month that has invoices, or first month
          const firstWithCount = data.find((m) => m.count > 0) || data[0]
          if (firstWithCount && selectedMonths.length === 0) {
            setSelectedMonths([firstWithCount.month_key])
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err.message || 'Error loading months')
        }
      } finally {
        if (isMounted) {
          setIsLoadingMonths(false)
        }
      }
    }

    loadMonths()
    return () => {
      isMounted = false
    }
  }, [isOpen])

  if (!isOpen) return null

  const toggleMonth = (mKey: string) => {
    setErrorMessage(null)
    setSuccessMessage(null)
    setSelectedMonths((prev) =>
      prev.includes(mKey) ? prev.filter((k) => k !== mKey) : [...prev, mKey]
    )
  }

  const selectAll = () => {
    setSelectedMonths(months.map((m) => m.month_key))
  }

  const clearAll = () => {
    setSelectedMonths([])
  }

  // Calculate total invoices represented by selected months
  const totalSelectedInvoices = months
    .filter((m) => selectedMonths.includes(m.month_key))
    .reduce((sum, m) => sum + m.count, 0)

  const handleDownload = async () => {
    if (selectedMonths.length === 0) {
      setErrorMessage('Please select at least one month.')
      return
    }

    setIsDownloading(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const token = (await getToken()) || ''
      const monthsParam = selectedMonths.join(',')
      const downloadUrl = `/api/invoices/bulk-download/?months=${monthsParam}&export_format=${format}`

      const res = await authedFetch(downloadUrl, token)
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Download failed. Please try again.')
      }

      // Read Content-Disposition header if available
      const disposition = res.headers.get('Content-Disposition')
      let filename = ''
      if (disposition && disposition.includes('filename=')) {
        const matches = disposition.match(/filename="?([^";]+)"?/)
        if (matches && matches[1]) {
          filename = matches[1]
        }
      }

      // Fallback filename if not provided by server
      if (!filename) {
        const selectedMonthLabels = months
          .filter((m) => selectedMonths.includes(m.month_key))
          .map((m) => m.label.replace(/\s+/g, '_'))
        const suffix =
          selectedMonthLabels.length <= 2
            ? selectedMonthLabels.join('_')
            : `${selectedMonthLabels.length}_months`
        filename =
          format === 'pdf' ? `Invoices_${suffix}.zip` : `Invoices_${suffix}.xlsx`
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()

      setTimeout(() => {
        if (document.body.contains(a)) {
          document.body.removeChild(a)
        }
        window.URL.revokeObjectURL(url)
      }, 3000)

      setSuccessMessage(
        format === 'pdf'
          ? `Downloaded ${totalSelectedInvoices} invoice(s) as PDF folder archive.`
          : `Downloaded consolidated Excel sheet for ${selectedMonths.length} month(s).`
      )

      setTimeout(() => {
        onClose()
      }, 1800)
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to download invoices.')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDownloading) onClose()
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.2 }}
        style={{
          background: '#FFFFFF',
          borderRadius: 16,
          maxWidth: 580,
          width: '100%',
          boxShadow: '0 20px 40px -10px rgba(11, 44, 140, 0.25)',
          border: '1px solid #D8E3F5',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          fontFamily: "'Poppins', sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #F8FAFC, #EDF2FF)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #0B2C8C, #1A4DD8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 10px rgba(11, 44, 140, 0.25)',
              }}
            >
              <FolderDown style={{ width: 22, height: 22 }} />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: 17,
                  fontWeight: 700,
                  color: '#0B2C8C',
                  letterSpacing: '-0.01em',
                }}
              >
                Download Invoices
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  color: '#6B7280',
                  marginTop: 2,
                }}
              >
                Select month(s) and export format (PDF Folder / Excel)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDownloading}
            style={{
              background: '#F3F4F6',
              border: 'none',
              borderRadius: 8,
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isDownloading ? 'not-allowed' : 'pointer',
              color: '#4B5563',
              transition: 'all 0.15s ease',
            }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {/* Step 1: Select Month(s) */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#1F2937',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Calendar style={{ width: 16, height: 16, color: '#1A4DD8' }} />
                1. Select Month(s)
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: '#6B7280',
                    marginLeft: 4,
                  }}
                >
                  (Choose one or more)
                </span>
              </label>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={selectAll}
                  disabled={isLoadingMonths || isDownloading}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: 11,
                    color: '#1A4DD8',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '2px 6px',
                  }}
                >
                  Select All
                </button>
                <span style={{ color: '#D1D5DB' }}>|</span>
                <button
                  type="button"
                  onClick={clearAll}
                  disabled={isLoadingMonths || isDownloading}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: 11,
                    color: '#6B7280',
                    fontWeight: 500,
                    cursor: 'pointer',
                    padding: '2px 6px',
                  }}
                >
                  Clear
                </button>
              </div>
            </div>

            {isLoadingMonths ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '28px',
                  background: '#F9FAFB',
                  borderRadius: 10,
                  border: '1px dashed #D1D5DB',
                  color: '#6B7280',
                  fontSize: 13,
                }}
              >
                <RefreshCw
                  style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }}
                />
                Loading invoice months...
              </div>
            ) : months.length === 0 ? (
              <div
                style={{
                  padding: 16,
                  background: '#F9FAFB',
                  borderRadius: 10,
                  fontSize: 13,
                  color: '#6B7280',
                  textAlign: 'center',
                }}
              >
                No invoices found in database.
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: 10,
                  maxHeight: 180,
                  overflowY: 'auto',
                  paddingRight: 4,
                }}
              >
                {months.map((m) => {
                  const isSelected = selectedMonths.includes(m.month_key)
                  return (
                    <div
                      key={m.month_key}
                      onClick={() => toggleMonth(m.month_key)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: isSelected ? '1.5px solid #1A4DD8' : '1px solid #E5E7EB',
                        background: isSelected ? '#EDF2FF' : '#F9FAFB',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected
                          ? '0 2px 6px rgba(26, 77, 216, 0.15)'
                          : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isSelected ? (
                          <CheckSquare style={{ width: 16, height: 16, color: '#1A4DD8' }} />
                        ) : (
                          <Square style={{ width: 16, height: 16, color: '#9CA3AF' }} />
                        )}
                        <div>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: isSelected ? 700 : 600,
                              color: isSelected ? '#0B2C8C' : '#374151',
                            }}
                          >
                            {m.label}
                          </div>
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: 12,
                          background: isSelected ? '#1A4DD8' : '#E5E7EB',
                          color: isSelected ? '#FFFFFF' : '#4B5563',
                        }}
                      >
                        {m.count}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Step 2: Choose Format */}
          <div>
            <label
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#1F2937',
                display: 'block',
                marginBottom: 10,
              }}
            >
              2. Choose Format
            </label>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
              }}
            >
              {/* PDF Option */}
              <div
                onClick={() => setFormat('pdf')}
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: format === 'pdf' ? '2px solid #DC2626' : '1px solid #E5E7EB',
                  background: format === 'pdf' ? '#FEF2F2' : '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  transition: 'all 0.15s ease',
                  boxShadow: format === 'pdf' ? '0 4px 12px rgba(220, 38, 38, 0.12)' : 'none',
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: format === 'pdf' ? '#DC2626' : '#FEE2E2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: format === 'pdf' ? '#fff' : '#DC2626',
                    flexShrink: 0,
                  }}
                >
                  <FileText style={{ width: 18, height: 18 }} />
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#111827',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  PDF
                  {format === 'pdf' && (
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 8,
                        background: '#DC2626',
                        color: '#fff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                      }}
                    >
                      ✓
                    </span>
                  )}
                </div>
              </div>

              {/* Excel Option */}
              <div
                onClick={() => setFormat('excel')}
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: format === 'excel' ? '2px solid #059669' : '1px solid #E5E7EB',
                  background: format === 'excel' ? '#ECFDF5' : '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  transition: 'all 0.15s ease',
                  boxShadow: format === 'excel' ? '0 4px 12px rgba(5, 150, 105, 0.12)' : 'none',
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: format === 'excel' ? '#059669' : '#D1FAE5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: format === 'excel' ? '#fff' : '#059669',
                    flexShrink: 0,
                  }}
                >
                  <FileSpreadsheet style={{ width: 18, height: 18 }} />
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#111827',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  Excel
                  {format === 'excel' && (
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 8,
                        background: '#059669',
                        color: '#fff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                      }}
                    >
                      ✓
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Feedback Alerts */}
          {errorMessage && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: 8,
                background: '#FEF2F2',
                border: '1px solid #FCA5A5',
                color: '#991B1B',
                fontSize: 12,
              }}
            >
              <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: 8,
                background: '#ECFDF5',
                border: '1px solid #6EE7B7',
                color: '#065F46',
                fontSize: 12,
              }}
            >
              <Check style={{ width: 16, height: 16, flexShrink: 0 }} />
              <span>{successMessage}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #E5E7EB',
            background: '#F9FAFB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 12, color: '#4B5563' }}>
            {selectedMonths.length > 0 ? (
              <span>
                Selected <b>{selectedMonths.length}</b> month(s) • <b>{totalSelectedInvoices}</b> total invoice(s)
              </span>
            ) : (
              <span style={{ color: '#EF4444' }}>Please select at least 1 month</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isDownloading}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                color: '#4B5563',
                background: '#FFFFFF',
                border: '1px solid #D1D5DB',
                cursor: isDownloading ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>

            <motion.button
              whileHover={{ scale: isDownloading ? 1 : 1.02 }}
              whileTap={{ scale: isDownloading ? 1 : 0.98 }}
              type="button"
              onClick={handleDownload}
              disabled={isDownloading || selectedMonths.length === 0}
              style={{
                padding: '8px 18px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                color: '#FFFFFF',
                background:
                  selectedMonths.length === 0 || isDownloading
                    ? '#9CA3AF'
                    : format === 'pdf'
                    ? 'linear-gradient(135deg, #0B2C8C, #1A4DD8)'
                    : 'linear-gradient(135deg, #059669, #10B981)',
                border: 'none',
                cursor: selectedMonths.length === 0 || isDownloading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow:
                  selectedMonths.length === 0 || isDownloading
                    ? 'none'
                    : '0 2px 8px rgba(11, 44, 140, 0.25)',
              }}
            >
              {isDownloading ? (
                <>
                  <RefreshCw
                    style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }}
                  />
                  {format === 'pdf' ? 'Creating ZIP...' : 'Generating Excel...'}
                </>
              ) : (
                <>
                  <Download style={{ width: 14, height: 14 }} />
                  Download {format === 'pdf' ? 'PDFs (ZIP)' : 'Excel (.xlsx)'}
                </>
              )}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
