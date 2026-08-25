import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Calendar, DollarSign, Calculator, ChevronDown, 
  CreditCard, Briefcase, FileText, CheckCircle2, RefreshCw,
  Percent, AlertCircle
} from 'lucide-react';
import type { PayslipData } from './PayslipLivePreview';
import { computePayslipTotals, formatCurrency } from './PayslipLivePreview';

interface PayslipFormAccordionProps {
  data: PayslipData;
  onChange: (updatedData: PayslipData) => void;
  employees?: any[];
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const PayslipFormAccordion: React.FC<PayslipFormAccordionProps> = ({
  data,
  onChange,
  employees = []
}) => {
  const [openSections, setOpenSections] = useState<{ [key: string]: boolean }>({
    period: false,
    employee: true,
    earnings: false,
    deductions: false,
    summary: true,
  });

  const [grossInput, setGrossInput] = useState<string>('25000');

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleFieldChange = (field: keyof PayslipData, value: any) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  const handleEmployeeSelect = (empId: string) => {
    if (!empId) return;
    const selected = employees.find(
      (e) => String(e.id) === empId || String(e.employee_id) === empId
    );
    if (selected) {
      const createdDate = selected.created_at
        ? new Date(selected.created_at).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          }).replace(/\//g, '-')
        : '29-06-2026';

      // Auto-compute generation date/time to now
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

      // Auto-distribute salary from gross (default 24193.52)
      const gross = parseFloat(grossInput) || 24193.52;
      const basic = Math.round(gross * 0.50 * 100) / 100;
      const conveyance = Math.round(gross * 0.30 * 100) / 100;
      const hra = Math.round(gross * 0.20 * 100) / 100;

      onChange({
        ...data,
        month: currentMonth,
        year: yyyy,
        generationDate: genDate,
        generationTime: genTime,
        employeeId: selected.employee_id || String(selected.id),
        employeeName: selected.name || 'ALWALA MADHURI',
        designation: selected.designation || 'OHC-DOCTOR',
        gradeLevel: selected.grade_level || 'AA / II',
        department: selected.department || 'OPERATIONS',
        location: selected.default_address || 'TELANGANA',
        bankName: selected.bank_name || 'SBI',
        bankAccountNumber: selected.bank_account_number || '39398771652',
        panNumber: selected.pan_number || 'CVRPA6711N',
        pfAccountNumber: selected.pf_account_number || 'NA',
        dateOfJoining: createdDate,
        daysWorked: 30,
        lopDays: 1,
        arrearsDays: 0,
        esicAccountNumber: selected.esic_account_number || 'NA',
        uanNumber: selected.uan_number || 'NA',
        basicSalary: basic,
        conveyanceAllowance: conveyance,
        houseRentAllowance: hra,
        othersAllowance: 0,
        incentives: 0,
        professionalTax: 200.00,
        providentFund: 1452.00,
      });
    }
  };

  // Quick auto-distribution of earnings based on Gross Monthly Salary
  const handleAutoDistributeGross = () => {
    const gross = parseFloat(grossInput) || 0;
    if (gross <= 0) return;

    // Standard formula: 50% Basic, 30% Conveyance, 20% HRA
    const basic = Math.round(gross * 0.50 * 100) / 100;
    const conveyance = Math.round(gross * 0.30 * 100) / 100;
    const hra = Math.round(gross * 0.20 * 100) / 100;

    // Provident Fund: standard 1452 or 12%
    const pf = 1452.00;
    const pt = 200.00;

    onChange({
      ...data,
      basicSalary: basic,
      conveyanceAllowance: conveyance,
      houseRentAllowance: hra,
      othersAllowance: 0,
      incentives: 0,
      professionalTax: pt,
      providentFund: pf,
    });
  };

  const { totalEarnings, totalDeductions, netSalary } = computePayslipTotals(data);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      
      {/* 1. Quick Select Employee - Main Action Banner */}
      <div className="glass-card card-soft" style={{ padding: '1rem 1.25rem', background: 'var(--panel)' }}>
        <div className="stack" style={{ gap: '0.4rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <User size={16} /> Choose Employee to Generate Payslip
          </label>
          <select
            onChange={(e) => handleEmployeeSelect(e.target.value)}
            value={employees.find(e => e.employee_id === data.employeeId || String(e.id) === data.employeeId)?.id || ''}
            style={{
              padding: '0.65rem 0.8rem',
              borderRadius: '10px',
              border: '1.5px solid var(--primary)',
              background: 'var(--panel)',
              color: 'var(--text)',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            <option value="">-- Choose Employee (Auto-fills everything) --</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.employee_id} - {emp.name} ({emp.designation || 'Staff'})
              </option>
            ))}
          </select>
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
            ✓ Selecting an employee automatically loads their details, period, and full salary calculations.
          </span>
        </div>
      </div>

      {/* 2. Employee Profile & Bank Details Accordion */}
      <div className="glass-card card-soft" style={{ padding: 0, overflow: 'hidden' }}>
        <button
          type="button"
          onClick={() => toggleSection('employee')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.9rem 1.25rem',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Briefcase size={17} color="var(--primary)" />
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Employee Information</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600 }}>{data.employeeName || 'ALWALA MADHURI'}</span>
            <ChevronDown
              size={17}
              style={{
                transform: openSections.employee ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}
            />
          </div>
        </button>

        <AnimatePresence>
          {openSections.employee && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div style={{ padding: '0 1.25rem 1.25rem 1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
                <div className="stack" style={{ gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)' }}>EMPLOYEE CODE</label>
                  <input
                    type="text"
                    value={data.employeeId}
                    onChange={(e) => handleFieldChange('employeeId', e.target.value)}
                    style={{ padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontSize: '0.85rem' }}
                  />
                </div>

                <div className="stack" style={{ gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)' }}>EMPLOYEE NAME</label>
                  <input
                    type="text"
                    value={data.employeeName}
                    onChange={(e) => handleFieldChange('employeeName', e.target.value)}
                    style={{ padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontSize: '0.85rem', fontWeight: 600 }}
                  />
                </div>

                <div className="stack" style={{ gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)' }}>DESIGNATION</label>
                  <input
                    type="text"
                    value={data.designation}
                    onChange={(e) => handleFieldChange('designation', e.target.value)}
                    style={{ padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontSize: '0.85rem' }}
                  />
                </div>

                <div className="stack" style={{ gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)' }}>GRADE / LEVEL</label>
                  <input
                    type="text"
                    value={data.gradeLevel}
                    onChange={(e) => handleFieldChange('gradeLevel', e.target.value)}
                    style={{ padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontSize: '0.85rem' }}
                  />
                </div>

                <div className="stack" style={{ gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)' }}>DEPARTMENT</label>
                  <input
                    type="text"
                    value={data.department}
                    onChange={(e) => handleFieldChange('department', e.target.value)}
                    style={{ padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontSize: '0.85rem' }}
                  />
                </div>

                <div className="stack" style={{ gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)' }}>LOCATION</label>
                  <input
                    type="text"
                    value={data.location}
                    onChange={(e) => handleFieldChange('location', e.target.value)}
                    style={{ padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontSize: '0.85rem' }}
                  />
                </div>

                <div className="stack" style={{ gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)' }}>BANK NAME</label>
                  <input
                    type="text"
                    value={data.bankName}
                    onChange={(e) => handleFieldChange('bankName', e.target.value)}
                    style={{ padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontSize: '0.85rem' }}
                  />
                </div>

                <div className="stack" style={{ gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)' }}>BANK ACCOUNT NUMBER</label>
                  <input
                    type="text"
                    value={data.bankAccountNumber}
                    onChange={(e) => handleFieldChange('bankAccountNumber', e.target.value)}
                    style={{ padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontSize: '0.85rem' }}
                  />
                </div>

                <div className="stack" style={{ gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)' }}>PAN NUMBER</label>
                  <input
                    type="text"
                    value={data.panNumber}
                    onChange={(e) => handleFieldChange('panNumber', e.target.value)}
                    style={{ padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontSize: '0.85rem' }}
                  />
                </div>

                <div className="stack" style={{ gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)' }}>PF ACCOUNT NUMBER</label>
                  <input
                    type="text"
                    value={data.pfAccountNumber}
                    onChange={(e) => handleFieldChange('pfAccountNumber', e.target.value)}
                    style={{ padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontSize: '0.85rem' }}
                  />
                </div>

                <div className="stack" style={{ gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)' }}>DATE OF JOINING</label>
                  <input
                    type="text"
                    value={data.dateOfJoining}
                    onChange={(e) => handleFieldChange('dateOfJoining', e.target.value)}
                    style={{ padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontSize: '0.85rem' }}
                  />
                </div>

                <div className="stack" style={{ gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)' }}>DAYS WORKED</label>
                  <input
                    type="number"
                    value={data.daysWorked}
                    onChange={(e) => handleFieldChange('daysWorked', parseInt(e.target.value) || 0)}
                    style={{ padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontSize: '0.85rem' }}
                  />
                </div>

                <div className="stack" style={{ gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)' }}>LOP (DAYS)</label>
                  <input
                    type="number"
                    value={data.lopDays}
                    onChange={(e) => handleFieldChange('lopDays', parseInt(e.target.value) || 0)}
                    style={{ padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontSize: '0.85rem' }}
                  />
                </div>

                <div className="stack" style={{ gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)' }}>ARREARS DAYS</label>
                  <input
                    type="number"
                    value={data.arrearsDays}
                    onChange={(e) => handleFieldChange('arrearsDays', parseInt(e.target.value) || 0)}
                    style={{ padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontSize: '0.85rem' }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. Period & Generation Info */}
      <div className="glass-card card-soft" style={{ padding: 0, overflow: 'hidden' }}>
        <button
          type="button"
          onClick={() => toggleSection('period')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.9rem 1.25rem',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Calendar size={17} color="var(--primary)" />
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Period & Date</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600 }}>{data.month} {data.year}</span>
            <ChevronDown
              size={17}
              style={{
                transform: openSections.period ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}
            />
          </div>
        </button>

        <AnimatePresence>
          {openSections.period && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div style={{ padding: '0 1.25rem 1.25rem 1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                <div className="stack" style={{ gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)' }}>MONTH</label>
                  <select
                    value={data.month}
                    onChange={(e) => handleFieldChange('month', e.target.value)}
                    style={{ padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontSize: '0.85rem' }}
                  >
                    {MONTHS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div className="stack" style={{ gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)' }}>YEAR</label>
                  <input
                    type="number"
                    value={data.year}
                    onChange={(e) => handleFieldChange('year', parseInt(e.target.value) || 2026)}
                    style={{ padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontSize: '0.85rem' }}
                  />
                </div>

                <div className="stack" style={{ gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)' }}>GEN DATE</label>
                  <input
                    type="text"
                    value={data.generationDate}
                    onChange={(e) => handleFieldChange('generationDate', e.target.value)}
                    style={{ padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontSize: '0.85rem' }}
                  />
                </div>

                <div className="stack" style={{ gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)' }}>GEN TIME</label>
                  <input
                    type="text"
                    value={data.generationTime}
                    onChange={(e) => handleFieldChange('generationTime', e.target.value)}
                    style={{ padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontSize: '0.85rem' }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 4. Earnings & Deductions Accordion */}
      <div className="glass-card card-soft" style={{ padding: 0, overflow: 'hidden' }}>
        <button
          type="button"
          onClick={() => toggleSection('earnings')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.9rem 1.25rem',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <DollarSign size={17} color="#16a34a" />
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Earnings & Deductions</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 700 }}>+₹{formatCurrency(totalEarnings)}</span>
            <span style={{ fontSize: '0.78rem', color: '#ef4444', fontWeight: 700 }}>-₹{formatCurrency(totalDeductions)}</span>
            <ChevronDown
              size={17}
              style={{
                transform: openSections.earnings ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}
            />
          </div>
        </button>

        <AnimatePresence>
          {openSections.earnings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div style={{ padding: '0 1.25rem 1.25rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                
                {/* Auto distribute helper */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(107, 47, 160, 0.06)', padding: '0.6rem 0.8rem', borderRadius: '10px', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)' }}>Auto-split from Gross:</span>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <input
                      type="number"
                      value={grossInput}
                      onChange={(e) => setGrossInput(e.target.value)}
                      style={{ width: '90px', padding: '0.35rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 700 }}
                    />
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleAutoDistributeGross}
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                    >
                      Apply
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="stack" style={{ gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16a34a' }}>BASIC SALARY (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={data.basicSalary}
                      onChange={(e) => handleFieldChange('basicSalary', parseFloat(e.target.value) || 0)}
                      style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div className="stack" style={{ gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ef4444' }}>PROFESSIONAL TAX (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={data.professionalTax}
                      onChange={(e) => handleFieldChange('professionalTax', parseFloat(e.target.value) || 0)}
                      style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div className="stack" style={{ gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16a34a' }}>CONVEYANCE (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={data.conveyanceAllowance}
                      onChange={(e) => handleFieldChange('conveyanceAllowance', parseFloat(e.target.value) || 0)}
                      style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div className="stack" style={{ gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ef4444' }}>PROVIDENT FUND (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={data.providentFund}
                      onChange={(e) => handleFieldChange('providentFund', parseFloat(e.target.value) || 0)}
                      style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div className="stack" style={{ gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16a34a' }}>HRA (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={data.houseRentAllowance}
                      onChange={(e) => handleFieldChange('houseRentAllowance', parseFloat(e.target.value) || 0)}
                      style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div className="stack" style={{ gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)' }}>OTHERS / INCENTIVES (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={data.othersAllowance}
                      onChange={(e) => handleFieldChange('othersAllowance', parseFloat(e.target.value) || 0)}
                      style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 5. Real-Time Net Pay Summary */}
      <div
        className="glass-card card-soft"
        style={{
          padding: '1rem 1.25rem',
          background: 'linear-gradient(135deg, rgba(107, 47, 160, 0.12) 0%, rgba(29, 182, 166, 0.12) 100%)',
          border: '1px solid rgba(107, 47, 160, 0.25)',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '0.8rem', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#16a34a' }}>EARNINGS</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#16a34a', marginTop: '0.15rem' }}>
              ₹{formatCurrency(totalEarnings)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#ef4444' }}>DEDUCTIONS</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ef4444', marginTop: '0.15rem' }}>
              ₹{formatCurrency(totalDeductions)}
            </div>
          </div>
          <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: '0.5rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)' }}>NET SALARY</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--primary)', marginTop: '0.15rem' }}>
              ₹{formatCurrency(netSalary)}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
