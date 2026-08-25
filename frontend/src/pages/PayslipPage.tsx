import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import { authedFetch } from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { PayslipDashboardHeader } from '../components/payslip/PayslipDashboardHeader';
import { PayslipLivePreview, computePayslipTotals, formatCurrency } from '../components/payslip/PayslipLivePreview';
import type { PayslipData } from '../components/payslip/PayslipLivePreview';
import { PayslipFormAccordion } from '../components/payslip/PayslipFormAccordion';
import { 
  ZoomIn, ZoomOut, Printer, Download,
  Trash2, Eye, CheckCircle2,
  Cloud, ExternalLink, AlertCircle
} from 'lucide-react';

function getDefaultPayslipData(): PayslipData {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const genDate = `${dd}-${mm}-${yyyy}`;
  const hours = now.getHours();
  const mins = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  const genTime = `${String(h12).padStart(2, '0')}:${mins} ${ampm}`;
  const currentMonth = now.toLocaleString('en-US', { month: 'long' });

  return {
    month: currentMonth,
    year: yyyy,
    generationDate: genDate,
    generationTime: genTime,
    employeeId: '3699-D09600',
    employeeName: 'ALWALA MADHURI',
    designation: 'OHC-DOCTOR',
    gradeLevel: 'AA / II',
    location: 'TELANGANA',
    department: 'OPERATIONS',
    bankName: 'SBI',
    bankAccountNumber: '39398771652',
    panNumber: 'CVRPA6711N',
    pfAccountNumber: 'NA',
    dateOfJoining: '29-06-2026',
    daysWorked: 30,
    lopDays: 1,
    arrearsDays: 0,
    esicAccountNumber: 'NA',
    uanNumber: 'NA',
    basicSalary: 12096.81,
    conveyanceAllowance: 7258.00,
    houseRentAllowance: 4838.71,
    othersAllowance: 0.00,
    incentives: 0.00,
    professionalTax: 200.00,
    providentFund: 1452.00,
  };
}

export function PayslipPage() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'GENERATOR' | 'HISTORY'>('GENERATOR');
  const [payslipData, setPayslipData] = useState<PayslipData>(() => getDefaultPayslipData());
  const [zoom, setZoom] = useState<number>(100);
  const [searchHistoryQuery, setSearchHistoryQuery] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  // 1. Fetch employees list from backend to populate dropdown
  const employeesQuery = useQuery({
    queryKey: ['employees-list-payslip'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return [];
      const res = await authedFetch('/api/employees/', token);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data.results || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const employees = employeesQuery.data || [];

  // When employees query loads, if no employee selected or matches fallback, auto-fill with first DB employee
  useEffect(() => {
    if (employees.length > 0 && (!payslipData.employeeId || payslipData.employeeId === '3699-D09600')) {
      const first = employees[0];
      const createdDate = first.created_at
        ? new Date(first.created_at).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          }).replace(/\//g, '-')
        : '29-06-2026';

      setPayslipData((prev) => ({
        ...prev,
        employeeId: first.employee_id || String(first.id),
        employeeName: first.name || prev.employeeName,
        designation: first.designation || prev.designation,
        gradeLevel: first.grade_level || prev.gradeLevel,
        department: first.department || prev.department,
        location: first.default_address || prev.location,
        bankName: first.bank_name || prev.bankName,
        bankAccountNumber: first.bank_account_number || prev.bankAccountNumber,
        panNumber: first.pan_number || prev.panNumber,
        pfAccountNumber: first.pf_account_number || prev.pfAccountNumber,
        dateOfJoining: createdDate,
      }));
    }
  }, [employees]);

  // 2. Fetch saved payslips from backend Cloudinary database
  const payslipsQuery = useQuery({
    queryKey: ['payslips-database-list'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return [];
      const res = await authedFetch('/api/payslips/', token);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60 * 1000,
  });

  const savedPayslips = payslipsQuery.data || [];

  // 3. Save / Upload to Cloudinary & Database Mutation
  const saveMutation = useMutation({
    mutationFn: async (dataToSave: PayslipData) => {
      const token = await getToken();
      if (!token) throw new Error('Authentication token missing');

      const payload = {
        month: dataToSave.month,
        year: dataToSave.year,
        generation_date: dataToSave.generationDate,
        generation_time: dataToSave.generationTime,
        employee_code: dataToSave.employeeId,
        employee_name: dataToSave.employeeName,
        designation: dataToSave.designation,
        grade_level: dataToSave.gradeLevel,
        location: dataToSave.location,
        department: dataToSave.department,
        bank_name: dataToSave.bankName,
        bank_account_number: dataToSave.bankAccountNumber,
        pan_number: dataToSave.panNumber,
        pf_account_number: dataToSave.pfAccountNumber,
        date_of_joining: dataToSave.dateOfJoining,
        days_worked: dataToSave.daysWorked,
        lop_days: dataToSave.lopDays,
        arrears_days: dataToSave.arrearsDays,
        esic_account_number: dataToSave.esicAccountNumber,
        uan_number: dataToSave.uanNumber,
        basic_salary: dataToSave.basicSalary,
        conveyance_allowance: dataToSave.conveyanceAllowance,
        house_rent_allowance: dataToSave.houseRentAllowance,
        others_allowance: dataToSave.othersAllowance,
        incentives: dataToSave.incentives,
        professional_tax: dataToSave.professionalTax,
        provident_fund: dataToSave.providentFund,
        esic_deduction: dataToSave.esicDeduction || 0,
        tds_deduction: dataToSave.tdsDeduction || 0,
        other_deductions: dataToSave.otherDeductions || 0,
      };

      const res = await authedFetch('/api/payslips/', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to save payslip');
      }

      return await res.json();
    },
    onSuccess: (savedData) => {
      setSaveErrorMsg(null);
      setSaveSuccessMsg(`Payslip saved and uploaded to Cloudinary! PDF URL: ${savedData.cloudinary_pdf_url || 'Stored'}`);
      setPayslipData((prev) => ({
        ...prev,
        cloudinary_pdf_url: savedData.cloudinary_pdf_url,
      }));
      queryClient.invalidateQueries({ queryKey: ['payslips-database-list'] });
      setTimeout(() => setSaveSuccessMsg(null), 5000);
    },
    onError: (err: any) => {
      setSaveErrorMsg(err.message || 'Failed to save payslip to Cloudinary.');
      setTimeout(() => setSaveErrorMsg(null), 5000);
    },
  });

  // 4. Delete Payslip Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number | string) => {
      const token = await getToken();
      if (!token) throw new Error('Authentication token missing');
      const res = await authedFetch(`/api/payslips/${id}/`, token, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete payslip');
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payslips-database-list'] });
    },
  });

  const handleSaveToCloudinary = () => {
    saveMutation.mutate(payslipData);
  };

  const handleLoadSaved = (saved: any) => {
    setPayslipData({
      id: saved.id,
      payslipNumber: saved.payslip_number,
      month: saved.month,
      year: saved.year,
      generationDate: saved.generation_date,
      generationTime: saved.generation_time,
      employeeId: saved.employee_code,
      employeeName: saved.employee_name,
      designation: saved.designation,
      gradeLevel: saved.grade_level,
      location: saved.location,
      department: saved.department,
      bankName: saved.bank_name,
      bankAccountNumber: saved.bank_account_number,
      panNumber: saved.pan_number,
      pfAccountNumber: saved.pf_account_number,
      dateOfJoining: saved.date_of_joining,
      daysWorked: saved.days_worked,
      lopDays: saved.lop_days,
      arrearsDays: saved.arrears_days,
      esicAccountNumber: saved.esic_account_number,
      uanNumber: saved.uan_number,
      basicSalary: parseFloat(saved.basic_salary) || 0,
      conveyanceAllowance: parseFloat(saved.conveyance_allowance) || 0,
      houseRentAllowance: parseFloat(saved.house_rent_allowance) || 0,
      othersAllowance: parseFloat(saved.others_allowance) || 0,
      incentives: parseFloat(saved.incentives) || 0,
      professionalTax: parseFloat(saved.professional_tax) || 0,
      providentFund: parseFloat(saved.provident_fund) || 0,
      esicDeduction: parseFloat(saved.esic_deduction) || 0,
      tdsDeduction: parseFloat(saved.tds_deduction) || 0,
      otherDeductions: parseFloat(saved.other_deductions) || 0,
      cloudinary_pdf_url: saved.cloudinary_pdf_url,
    });
    setActiveTab('GENERATOR');
  };

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handleDirectDownloadPdf = async () => {
    try {
      setIsDownloadingPdf(true);
      const token = await getToken();
      if (!token) throw new Error('Authentication token missing');

      const payload = {
        month: payslipData.month,
        year: payslipData.year,
        generation_date: payslipData.generationDate,
        generation_time: payslipData.generationTime,
        employee_code: payslipData.employeeId,
        employee_name: payslipData.employeeName,
        designation: payslipData.designation,
        grade_level: payslipData.gradeLevel,
        location: payslipData.location,
        department: payslipData.department,
        bank_name: payslipData.bankName,
        bank_account_number: payslipData.bankAccountNumber,
        pan_number: payslipData.panNumber,
        pf_account_number: payslipData.pfAccountNumber,
        date_of_joining: payslipData.dateOfJoining,
        days_worked: payslipData.daysWorked,
        lop_days: payslipData.lopDays,
        arrears_days: payslipData.arrearsDays,
        esic_account_number: payslipData.esicAccountNumber,
        uan_number: payslipData.uanNumber,
        basic_salary: payslipData.basicSalary,
        conveyance_allowance: payslipData.conveyanceAllowance,
        house_rent_allowance: payslipData.houseRentAllowance,
        others_allowance: payslipData.othersAllowance,
        incentives: payslipData.incentives,
        professional_tax: payslipData.professionalTax,
        provident_fund: payslipData.providentFund,
        esic_deduction: payslipData.esicDeduction || 0,
        tds_deduction: payslipData.tdsDeduction || 0,
        other_deductions: payslipData.otherDeductions || 0,
      };

      const res = await authedFetch('/api/payslips/generate-pdf/', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Failed to generate clean PDF');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fileName = `Payslip_${payslipData.employeeId || 'EMP'}_${payslipData.month}_${payslipData.year}.pdf`;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setSaveErrorMsg(err.message || 'Failed to download PDF.');
      setTimeout(() => setSaveErrorMsg(null), 5000);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleReset = () => {
    setPayslipData(getDefaultPayslipData());
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredHistory = savedPayslips.filter((p: any) => {
    const q = searchHistoryQuery.toLowerCase();
    return (
      (p.employee_name || '').toLowerCase().includes(q) ||
      (p.employee_code || '').toLowerCase().includes(q) ||
      (p.designation || '').toLowerCase().includes(q) ||
      (p.month || '').toLowerCase().includes(q) ||
      String(p.year || '').includes(q) ||
      (p.payslip_number || '').toLowerCase().includes(q)
    );
  });

  const totalPayroll = savedPayslips.reduce((acc: number, p: any) => acc + (parseFloat(p.net_salary) || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '3rem' }}>
      
      {/* Header (Hidden in Print) */}
      <div className="no-print">
        <PayslipDashboardHeader
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onPrint={handlePrint}
          onDownloadPdf={handleDirectDownloadPdf}
          onReset={handleReset}
          onSaveToCloudinary={handleSaveToCloudinary}
          isSaving={saveMutation.isPending}
          isDownloading={isDownloadingPdf}
          totalSaved={savedPayslips.length}
          totalPayroll={totalPayroll}
          employeeCount={employees.length}
        />
      </div>

      {/* Success Banner (Hidden in Print) */}
      <div className="no-print">
        <AnimatePresence>
          {saveSuccessMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                padding: '0.75rem 1.25rem',
                borderRadius: '12px',
                background: 'rgba(22, 163, 74, 0.12)',
                border: '1px solid #16a34a',
                color: '#16a34a',
                fontWeight: 700,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={18} />
                <span>{saveSuccessMsg}</span>
              </div>
              {payslipData.cloudinary_pdf_url && (
                <a
                  href={payslipData.cloudinary_pdf_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    color: '#16a34a',
                    textDecoration: 'underline',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                  }}
                >
                  <ExternalLink size={14} /> Open Cloudinary PDF
                </a>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error Banner (Hidden in Print) */}
      <div className="no-print">
        <AnimatePresence>
          {saveErrorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                padding: '0.75rem 1.25rem',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid #ef4444',
                color: '#ef4444',
                fontWeight: 700,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <AlertCircle size={18} /> {saveErrorMsg}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* TAB 1: GENERATOR (Split Screen Form + Live Preview) */}
      {activeTab === 'GENERATOR' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(350px, 440px) 1fr',
            gap: '1.25rem',
            alignItems: 'start',
          }}
          className="payslip-split-layout"
        >
          {/* Left Panel: Accordion Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }} className="no-print">
            <PayslipFormAccordion
              data={payslipData}
              onChange={setPayslipData}
              employees={employees}
            />
          </div>

          {/* Right Panel: Live Preview with Zoom Controls */}
          <div
            style={{
              position: 'sticky',
              top: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              alignItems: 'center',
            }}
          >
            {/* Toolbar for Zoom & Actions */}
            <div
              className="glass-card card-soft no-print"
              style={{
                width: '100%',
                maxWidth: '794px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.6rem 1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text)' }}>LIVE PREVIEW</span>
                <span className="badge" style={{ fontSize: '0.72rem', background: 'rgba(22, 163, 74, 0.1)', color: '#16a34a', fontWeight: 700 }}>
                  Times New Roman Content
                </span>
                {payslipData.cloudinary_pdf_url && (
                  <a
                    href={payslipData.cloudinary_pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      fontSize: '0.72rem',
                      color: 'var(--primary)',
                      fontWeight: 700,
                      textDecoration: 'none',
                    }}
                  >
                    <Cloud size={13} /> Cloudinary PDF
                  </a>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setZoom((z) => Math.max(50, z - 10))}
                  style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem' }}
                  title="Zoom Out"
                >
                  <ZoomOut size={13} />
                </button>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, minWidth: '38px', textAlign: 'center' }}>
                  {zoom}%
                </span>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setZoom((z) => Math.min(130, z + 10))}
                  style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem' }}
                  title="Zoom In"
                >
                  <ZoomIn size={13} />
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setZoom(100)}
                  style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem' }}
                  title="Reset Zoom"
                >
                  100%
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleDirectDownloadPdf}
                  disabled={isDownloadingPdf}
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700 }}
                  title="Download clean PDF with no browser watermarks"
                >
                  <Download size={13} /> {isDownloadingPdf ? 'Downloading...' : 'Download PDF'}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handlePrint}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <Printer size={13} /> Print
                </button>
              </div>
            </div>

            {/* Container for Preview */}
            <div
              style={{
                width: '100%',
                overflowX: 'auto',
                paddingBottom: '1.5rem',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <div id="payslip-printable-area" className="payslip-print-container">
                <PayslipLivePreview data={payslipData} zoom={zoom} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CLOUDINARY DATABASE ARCHIVE */}
      {activeTab === 'HISTORY' && (
        <div className="glass-card card-soft" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Cloud size={18} color="var(--primary)" /> Cloudinary Database Archive
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>
                View, re-open, print, or download permanent PDFs stored in Cloudinary
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div className="search-shell" style={{ width: '260px' }}>
                <input
                  type="search"
                  placeholder="Search name, code, month..."
                  value={searchHistoryQuery}
                  onChange={(e) => setSearchHistoryQuery(e.target.value)}
                  style={{ padding: '0.5rem 0.8rem', fontSize: '0.85rem' }}
                />
              </div>
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--muted)' }}>
              <Cloud size={36} color="var(--muted)" style={{ margin: '0 auto 0.5rem auto', opacity: 0.5 }} />
              <p style={{ fontSize: '1rem', fontWeight: 700 }}>No payslips found in Cloudinary database.</p>
              <p style={{ fontSize: '0.82rem' }}>Generate a payslip and click "Save to Cloudinary" to store it permanently.</p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setActiveTab('GENERATOR')}
                style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}
              >
                Go to Generator
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--panel)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Employee</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Designation</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Month / Year</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total Earnings</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total Deductions</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Net Salary</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Cloudinary PDF</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((item: any) => (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text)' }}>{item.employee_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{item.employee_code}</div>
                      </td>
                      <td style={{ padding: '0.75rem', color: 'var(--muted)' }}>
                        {item.designation || 'Staff'}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600 }}>
                        {item.month} {item.year}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>
                        ₹ {formatCurrency(item.total_earnings)}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600, color: '#ef4444' }}>
                        ₹ {formatCurrency(item.total_deductions)}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 800, color: 'var(--primary)', fontSize: '0.95rem' }}>
                        ₹ {formatCurrency(item.net_salary)}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        {item.cloudinary_pdf_url ? (
                          <a
                            href={item.cloudinary_pdf_url}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '0.3rem 0.6rem',
                              borderRadius: '8px',
                              background: 'rgba(107, 47, 160, 0.1)',
                              color: 'var(--primary)',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              textDecoration: 'none',
                            }}
                          >
                            <Cloud size={13} /> View PDF
                          </a>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Stored</span>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => handleLoadSaved(item)}
                            style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                            title="Edit / View in Generator"
                          >
                            <Eye size={13} /> Open
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => deleteMutation.mutate(item.id)}
                            style={{ padding: '0.35rem 0.5rem', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.2)' }}
                            title="Delete from Cloudinary DB"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Embedded High-Fidelity Print Styling */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0mm !important;
          }
          *, *::before, *::after {
            box-sizing: border-box !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            background: #ffffff !important;
            color: #111827 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden;
          }
          .payslip-print-container,
          .payslip-print-container *,
          #payslip-printable-area,
          #payslip-printable-area * {
            visibility: visible !important;
          }
          #payslip-printable-area,
          .payslip-print-container {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            max-width: 210mm !important;
            margin: 0 auto !important;
            padding: 8mm 12mm 0 12mm !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: flex-start !important;
            z-index: 999999 !important;
            background: #ffffff !important;
          }
          .payslip-preview-card {
            box-shadow: none !important;
            border: none !important;
            transform: none !important;
            width: 100% !important;
            max-width: 186mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            border-radius: 0 !important;
          }
          .no-print, header, nav, aside, footer,
          .sidebar, .topbar, .mobile-header-bar, .mobile-bottom-nav, .theme-toggle {
            display: none !important;
          }
        }

        @media (max-width: 1024px) {
          .payslip-split-layout {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

    </div>
  );
}

