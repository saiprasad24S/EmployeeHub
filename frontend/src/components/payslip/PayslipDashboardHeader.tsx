import React from 'react';
import { 
  FileText, Plus, Printer, Download, RefreshCw, 
  DollarSign, Users, Award, TrendingUp, Sparkles, CheckCircle2,
  Cloud, CloudUpload
} from 'lucide-react';

interface PayslipDashboardHeaderProps {
  activeTab: 'GENERATOR' | 'HISTORY';
  onTabChange: (tab: 'GENERATOR' | 'HISTORY') => void;
  onPrint: () => void;
  onDownloadPdf: () => void;
  onReset: () => void;
  onSaveToCloudinary: () => void;
  isSaving?: boolean;
  isDownloading?: boolean;
  totalSaved: number;
  totalPayroll?: number;
  employeeCount?: number;
}

export const PayslipDashboardHeader: React.FC<PayslipDashboardHeaderProps> = ({
  activeTab,
  onTabChange,
  onPrint,
  onDownloadPdf,
  onReset,
  onSaveToCloudinary,
  isSaving = false,
  isDownloading = false,
  totalSaved,
  totalPayroll = 0,
  employeeCount = 0,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Top Banner with Action Buttons */}
      <div
        className="glass-card card-soft"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1.25rem 1.5rem',
        }}
      >
        <div>
          <span className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Sparkles size={14} color="var(--primary)" /> Skandan Payroll Management
          </span>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0.2rem 0 0 0' }}>
            Employee Payslip Studio
          </h2>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'var(--muted)' }}>
            Instant salary slips with Times New Roman typography, Cloudinary archiving, and print generation
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onReset}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.55rem 0.9rem' }}
          >
            <RefreshCw size={15} /> Reset
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={onSaveToCloudinary}
            disabled={isSaving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem',
              padding: '0.55rem 0.9rem',
              borderColor: 'rgba(107, 47, 160, 0.4)',
              color: 'var(--primary)',
              fontWeight: 700,
            }}
          >
            <CloudUpload size={16} /> {isSaving ? 'Saving to Cloudinary...' : 'Save to Cloudinary'}
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={onDownloadPdf}
            disabled={isDownloading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem',
              padding: '0.55rem 0.9rem',
              fontWeight: 700,
            }}
          >
            <Download size={16} /> {isDownloading ? 'Generating PDF...' : 'Download Clean PDF'}
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={onPrint}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem',
              padding: '0.55rem 1.1rem',
              fontWeight: 700,
              boxShadow: '0 4px 15px rgba(107, 47, 160, 0.3)',
            }}
          >
            <Printer size={16} /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* Tabs Navigation & Stats Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '0.4rem',
            background: 'var(--panel)',
            padding: '0.3rem',
            borderRadius: '14px',
            border: '1px solid var(--border)',
          }}
        >
          <button
            type="button"
            onClick={() => onTabChange('GENERATOR')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'GENERATOR' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'GENERATOR' ? '#ffffff' : 'var(--text)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s ease',
            }}
          >
            <FileText size={15} /> Payslip Generator & Live Preview
          </button>

          <button
            type="button"
            onClick={() => onTabChange('HISTORY')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'HISTORY' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'HISTORY' ? '#ffffff' : 'var(--text)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s ease',
            }}
          >
            <Cloud size={15} /> Cloudinary Database Archive ({totalSaved})
          </button>
        </div>

        {/* Small Stats Highlights */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div
            className="glass-card"
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '10px',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontWeight: 600,
            }}
          >
            <Users size={14} color="var(--primary)" />
            <span style={{ color: 'var(--muted)' }}>Registered Employees:</span>
            <span style={{ fontWeight: 800 }}>{employeeCount}</span>
          </div>

          <div
            className="glass-card"
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '10px',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontWeight: 600,
            }}
          >
            <Cloud size={14} color="#16a34a" />
            <span style={{ color: 'var(--muted)' }}>Cloudinary Slips:</span>
            <span style={{ fontWeight: 800 }}>{totalSaved}</span>
          </div>
        </div>
      </div>

    </div>
  );
};
