import React from 'react'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, FileText, Search, ShieldCheck, Save, Download,
  Printer, RefreshCw, Layers
} from 'lucide-react'

interface InvoiceDashboardHeaderProps {
  activeTab: 'DASHBOARD' | 'EDITOR' | 'SEARCH' | 'VERIFY'
  setActiveTab: (tab: 'DASHBOARD' | 'EDITOR' | 'SEARCH' | 'VERIFY') => void
  isAutoSaving: boolean
  lastSavedTime: string
  onDownloadPDF: () => void
  onSaveDraft: () => void
  onSaveInvoice: () => void
  onVerifyModal: () => void
  onPrint: () => void
  invoiceNumber: string
  templateType: 'REGULAR' | 'SCHOOL' | 'MULTI_SERVICE'
  isSaving: boolean
}

const tabs = [
  { id: 'DASHBOARD' as const, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'EDITOR' as const, label: 'Invoice Editor', icon: FileText },
  { id: 'SEARCH' as const, label: 'Search', icon: Search },
  { id: 'VERIFY' as const, label: 'Verify', icon: ShieldCheck },
]

export const InvoiceDashboardHeader: React.FC<InvoiceDashboardHeaderProps> = ({
  activeTab,
  setActiveTab,
  isAutoSaving,
  lastSavedTime,
  onDownloadPDF,
  onSaveDraft,
  onSaveInvoice,
  onVerifyModal,
  onPrint,
  invoiceNumber,
  templateType,
  isSaving,
}) => {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid #D8E3F5',
        padding: '0 24px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 56,
          maxWidth: 1800,
          margin: '0 auto',
          gap: 16,
        }}
      >
        {/* Left: Branding + Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #0B2C8C, #1A4DD8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(11,44,140,0.25)',
              }}
            >
              <Layers style={{ width: 18, height: 18, color: '#fff' }} />
            </div>
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#0B2C8C',
                  fontFamily: 'Poppins, sans-serif',
                  letterSpacing: '-0.01em',
                }}
              >
                Skandan Invoice Hub
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: '#616161',
                  fontWeight: 500,
                }}
              >
                {invoiceNumber} - {templateType.replace('_', ' ')}
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <nav style={{ display: 'flex', gap: 2 }}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id
              const Icon = tab.icon
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? '#0B2C8C' : '#616161',
                    background: isActive ? '#EDF2FF' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontFamily: 'Poppins, sans-serif',
                  }}
                >
                  <Icon style={{ width: 15, height: 15 }} />
                  {tab.label}
                </motion.button>
              )
            })}
          </nav>
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Auto-save indicator */}
          <div
            style={{
              fontSize: 10,
              color: isAutoSaving ? '#1A4DD8' : '#9CA3AF',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginRight: 8,
            }}
          >
            {isAutoSaving ? (
              <>
                <RefreshCw
                  style={{
                    width: 12,
                    height: 12,
                    animation: 'spin 1s linear infinite',
                  }}
                />
                Saving...
              </>
            ) : (
              <>Saved {lastSavedTime}</>
            )}
          </div>

          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.96 }}
            onClick={onSaveDraft}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '7px 12px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 600,
              color: '#374151',
              background: '#fff',
              border: '1px solid #D8E3F5',
              cursor: 'pointer',
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            <Save style={{ width: 14, height: 14 }} />
            Draft
          </motion.button>

          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.96 }}
            onClick={onSaveInvoice}
            disabled={isSaving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '7px 14px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 600,
              color: '#fff',
              background: isSaving
                ? '#9CA3AF'
                : 'linear-gradient(135deg, #0B2C8C, #1A4DD8)',
              border: 'none',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              fontFamily: 'Poppins, sans-serif',
              boxShadow: '0 2px 8px rgba(11,44,140,0.2)',
            }}
          >
            <FileText style={{ width: 14, height: 14 }} />
            {isSaving ? 'Generating...' : 'Generate Invoice'}
          </motion.button>

          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.96 }}
            onClick={onDownloadPDF}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '7px 12px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 600,
              color: '#0B2C8C',
              background: '#EDF2FF',
              border: '1px solid #DCE7FF',
              cursor: 'pointer',
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            <Download style={{ width: 14, height: 14 }} />
            PDF
          </motion.button>

          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.96 }}
            onClick={onPrint}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '7px 10px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 600,
              color: '#374151',
              background: '#fff',
              border: '1px solid #D8E3F5',
              cursor: 'pointer',
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            <Printer style={{ width: 14, height: 14 }} />
          </motion.button>
        </div>
      </div>
    </div>
  )
}
