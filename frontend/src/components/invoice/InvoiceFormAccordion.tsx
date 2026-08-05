import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Calendar, Layers, Building, User, Phone, MapPin,
  Briefcase, UserCheck, Clock, Heart, DollarSign, CreditCard,
  Plus, Trash2, ChevronDown, MessageSquare, Percent
} from 'lucide-react';
import { computeInvoiceTotals } from './InvoiceLivePreview';
import type { InvoicePreviewData, ServiceItem } from './InvoiceLivePreview';

export interface InvoiceFormAccordionProps {
  data: InvoicePreviewData;
  onChange: (data: InvoicePreviewData) => void;
}

/* ── Accordion Shell ─────────────────────────────────── */
const AccordionSection: React.FC<{
  id: string; title: string; icon: React.ReactNode;
  isOpen: boolean; onToggle: (id: string) => void;
  children: React.ReactNode;
}> = ({ id, title, icon, isOpen, onToggle, children }) => (
  <div style={{
    background: 'var(--inv-card)', borderRadius: 12, border: '1px solid var(--inv-border)',
    boxShadow: 'var(--inv-shadow-sm)', marginBottom: 12, overflow: 'hidden',
  }}>
    <button
      onClick={() => onToggle(id)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', background: 'var(--inv-card)', border: 'none', cursor: 'pointer',
        borderLeft: '4px solid var(--inv-primary)', transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--inv-bg)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--inv-card)')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%', background: 'var(--inv-light-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--inv-royal)',
        }}>{icon}</div>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--inv-text)', fontFamily: 'Poppins, sans-serif' }}>{title}</span>
      </div>
      <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
        <ChevronDown style={{ width: 16, height: 16, color: 'var(--inv-text-secondary)' }} />
      </motion.div>
    </button>
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          style={{ overflow: 'hidden' }}
        >
          <div style={{ padding: '14px 16px', borderTop: '1px solid var(--inv-border)', background: 'var(--inv-bg)' }}>
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

/* ── Input ────────────────────────────────────────────── */
const InputField: React.FC<{
  label: string; icon: React.ReactNode; type?: string;
  value: string | number; onChange: (v: string) => void;
  options?: { label: string; value: string }[];
  isTextarea?: boolean; readOnly?: boolean; placeholder?: string;
}> = ({ label, icon, type = 'text', value, onChange, options, isTextarea, readOnly, placeholder }) => {
  const baseInputStyle: React.CSSProperties = {
    width: '100%', paddingLeft: 34, paddingRight: 10, paddingTop: 8, paddingBottom: 8,
    border: '1px solid var(--inv-border)', borderRadius: 8, fontSize: 12, fontFamily: 'Poppins, sans-serif',
    outline: 'none', background: readOnly ? 'var(--inv-light-border)' : 'var(--inv-card)', color: 'var(--inv-text)',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  };
  const handleFocus = (e: React.FocusEvent<HTMLElement>) => {
    if (!readOnly) {
      (e.currentTarget as HTMLElement).style.borderColor = 'var(--inv-primary)';
      (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(11,44,140,0.15)';
    }
  };
  const handleBlur = (e: React.FocusEvent<HTMLElement>) => {
    (e.currentTarget as HTMLElement).style.borderColor = 'var(--inv-border)';
    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
  };

  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 10, fontWeight: 600, color: '#616161', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', display: 'flex' }}>
          {icon}
        </div>
        {isTextarea ? (
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            readOnly={readOnly}
            onFocus={handleFocus}
            onBlur={handleBlur}
            style={{ ...baseInputStyle, minHeight: 70, resize: 'vertical', paddingTop: 10 }}
          />
        ) : options ? (
          <select
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={readOnly}
            onFocus={handleFocus as any}
            onBlur={handleBlur as any}
            style={{ ...baseInputStyle, appearance: 'auto' }}
          >
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <input
            type={type}
            value={value}
            placeholder={placeholder}
            onChange={e => onChange(e.target.value)}
            readOnly={readOnly}
            onFocus={handleFocus as any}
            onBlur={handleBlur as any}
            style={baseInputStyle}
          />
        )}
      </div>
    </div>
  );
};

/* ── Main Component ──────────────────────────────────── */
export const InvoiceFormAccordion: React.FC<InvoiceFormAccordionProps> = ({ data, onChange }) => {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    invoice: true, client: false, profile: false, other: false,
    table: true, financial: false, remarks: false, school: false,
  });

  const toggleSection = (id: string) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const updateField = (field: keyof InvoicePreviewData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const updateService = (index: number, field: keyof ServiceItem, value: any) => {
    const updated = [...data.services];
    const row = { ...updated[index], [field]: value };

    const rate = Number(row.rate) || 0;
    const days = Number(row.days) || 0;
    if (field === 'rate' || field === 'days') {
      if (rate > 0 && days > 0) {
        row.amount = rate * days;
      }
    } else if (field === 'amount') {
      row.amount = Number(value) || 0;
    }

    const amount = Number(row.amount) || 0;
    const otherExp = Number(row.other_expenses) || 0;
    row.total = amount + otherExp;
    updated[index] = row;

    // Recalculate GST amount based on new subtotal
    const newSubtotal = updated.reduce((a, s) => a + (s.total || 0), 0);
    const rateGst = Number(data.gstRate) || 0;
    const computedGst = rateGst > 0 ? (newSubtotal * rateGst) / 100 : (Number(data.gstAmount) || 0);
    onChange({ ...data, services: updated, gstAmount: computedGst });
  };

  const addServiceRow = () => {
    const newRow: ServiceItem = {
      s_no: data.services.length + 1,
      service_name: '', description: '', rate: 0, days: 0, amount: 0, other_expenses: 0, total: 0,
    };
    onChange({ ...data, services: [...data.services, newRow] });
  };

  const deleteServiceRow = (index: number) => {
    if (data.services.length <= 1) return;
    const filtered = data.services.filter((_, i) => i !== index).map((s, i) => ({ ...s, s_no: i + 1 }));
    onChange({ ...data, services: filtered });
  };

  // Use single source of truth for all billing calculations
  const { subtotal, gstRate, gstAmount: calculatedGstAmount, discountAmount, totalAfterGst, advanceReceived, balanceDue, grandTotal } = computeInvoiceTotals(data);

  const iconSize = { width: 14, height: 14 };

  return (
    <div style={{ fontFamily: 'Poppins, sans-serif' }}>
      {/* 1. Invoice Information */}
      <AccordionSection id="invoice" title="Invoice Information" icon={<FileText style={iconSize} />} isOpen={!!openSections.invoice} onToggle={toggleSection}>
        <InputField label="Invoice Number (Auto-Generated)" icon={<FileText style={iconSize} />} value={data.invoiceNumber} onChange={v => updateField('invoiceNumber', v)} readOnly={true} />
        <InputField label="Invoice Date" icon={<Calendar style={iconSize} />} type="date" value={data.invoiceDate} onChange={v => updateField('invoiceDate', v)} />
        <InputField label="Billing Period" icon={<Calendar style={iconSize} />} value={data.billingPeriodText} onChange={v => updateField('billingPeriodText', v)} />
        <InputField label="Start Date" icon={<Calendar style={iconSize} />} type="date" value={data.startDateText} onChange={v => updateField('startDateText', v)} />
        <InputField
          label="Template Type" icon={<Layers style={iconSize} />} value={data.invoiceType}
          onChange={v => updateField('invoiceType', v as any)}
          options={[
            { label: 'Regular Template', value: 'REGULAR' },
            { label: 'School Template', value: 'SCHOOL' },
            { label: 'Multi-Service Template', value: 'MULTI_SERVICE' },
          ]}
        />
      </AccordionSection>

      {/* 2. Client / Billing Information */}
      <AccordionSection id="client" title="Client / Billing Information" icon={<Building style={iconSize} />} isOpen={!!openSections.client} onToggle={toggleSection}>
        {data.invoiceType === 'REGULAR' ? (
          <>
            <InputField label="Organization Name" icon={<Building style={iconSize} />} value={data.clientName} onChange={v => updateField('clientName', v)} />
            <InputField label="Contact Person" icon={<User style={iconSize} />} value={data.contactPerson || ''} onChange={v => updateField('contactPerson', v)} />
            <InputField label="Contact No." icon={<Phone style={iconSize} />} value={data.clientContact} onChange={v => updateField('clientContact', v)} />
            <InputField label="GST No. (Optional)" icon={<Building style={iconSize} />} value={data.clientGst || ''} onChange={v => updateField('clientGst', v)} />
            <InputField label="Address" icon={<MapPin style={iconSize} />} value={data.clientAddress} onChange={v => updateField('clientAddress', v)} isTextarea />
          </>
        ) : (
          <>
            <InputField label="Client Name" icon={<User style={iconSize} />} value={data.clientName} onChange={v => updateField('clientName', v)} />
            <InputField label="Contact No." icon={<Phone style={iconSize} />} value={data.clientContact} onChange={v => updateField('clientContact', v)} />
            <InputField label="GST No. (Optional)" icon={<Building style={iconSize} />} value={data.clientGst || ''} onChange={v => updateField('clientGst', v)} />
            <InputField label="Address" icon={<MapPin style={iconSize} />} value={data.clientAddress} onChange={v => updateField('clientAddress', v)} isTextarea />
          </>
        )}
      </AccordionSection>

      {/* 3. Service Profile */}
      <AccordionSection id="profile" title="Service Profile" icon={<Briefcase style={iconSize} />} isOpen={!!openSections.profile} onToggle={toggleSection}>
        {data.invoiceType === 'MULTI_SERVICE' && (
          <>
            <InputField label="Patient Name" icon={<Heart style={iconSize} />} value={data.patientName || ''} onChange={v => updateField('patientName', v)} />
            <InputField label="Age / Gender" icon={<User style={iconSize} />} value={data.patientAgeGender || ''} onChange={v => updateField('patientAgeGender', v)} />
          </>
        )}
        <InputField label="Service Type" icon={<Briefcase style={iconSize} />} value={data.serviceType || ''} onChange={v => updateField('serviceType', v)} />
        <InputField label="Consultant" icon={<UserCheck style={iconSize} />} value={data.consultant || ''} onChange={v => updateField('consultant', v)} />
        <InputField label="Service Started" icon={<Calendar style={iconSize} />} type="date" value={data.serviceStarted || ''} onChange={v => updateField('serviceStarted', v)} />
        <InputField label="Service End" icon={<Calendar style={iconSize} />} type="date" value={data.serviceEnd || ''} onChange={v => updateField('serviceEnd', v)} />
        <InputField label="Rendered Days" icon={<Clock style={iconSize} />} value={data.renderedDays || ''} onChange={v => updateField('renderedDays', v)} />
      </AccordionSection>

      {/* 4. Other Information */}
      <AccordionSection id="other" title="Other Information" icon={<DollarSign style={iconSize} />} isOpen={!!openSections.other} onToggle={toggleSection}>
        <InputField label="Per Day Charges (Rs.)" icon={<DollarSign style={iconSize} />} type="number" value={data.perDayCharges} onChange={v => updateField('perDayCharges', Number(v))} />
        <InputField label="Advance Amount (Rs.)" icon={<DollarSign style={iconSize} />} type="number" value={data.advanceReceived} onChange={v => updateField('advanceReceived', Number(v))} />
        <InputField
          label="Payment Status" icon={<CreditCard style={iconSize} />} value={data.paymentStatus}
          onChange={v => updateField('paymentStatus', v)}
          options={[
            { label: 'Pending', value: 'Pending' },
            { label: 'Paid', value: 'Paid' },
            { label: 'Unpaid', value: 'Unpaid' },
            { label: 'Partial', value: 'Partial' },
          ]}
        />
      </AccordionSection>

      {/* 5. Service Details Table */}
      <AccordionSection id="table" title="Service Details" icon={<FileText style={iconSize} />} isOpen={!!openSections.table} onToggle={toggleSection}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#0B2C8C', color: '#fff', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>
                <th style={{ padding: '8px 6px', textAlign: 'center', width: 30 }}>S.No</th>
                <th style={{ padding: '8px 6px', textAlign: 'left' }}>Service Details</th>
                <th style={{ padding: '8px 4px', textAlign: 'right', width: 65 }}>Rate (₹)</th>
                <th style={{ padding: '8px 4px', textAlign: 'right', width: 45 }}>Days</th>
                <th style={{ padding: '8px 4px', textAlign: 'right', width: 75 }}>Amount (₹)</th>
                <th style={{ padding: '8px 4px', textAlign: 'right', width: 75 }}>Other Exp (₹)</th>
                <th style={{ padding: '8px 6px', textAlign: 'right', width: 75 }}>Total (₹)</th>
                <th style={{ padding: '8px 4px', width: 28 }}></th>
              </tr>
            </thead>
            <tbody>
              {data.services.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #E8ECF4' }}>
                  <td style={{ padding: '6px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#616161' }}>{row.s_no}</td>
                  <td style={{ padding: '4px 4px' }}>
                    <input
                      placeholder="Service details..."
                      value={row.service_name}
                      onChange={e => updateService(idx, 'service_name', e.target.value)}
                      style={{ width: '100%', border: '1px solid #E8ECF4', borderRadius: 6, padding: '5px 6px', fontSize: 11, outline: 'none', background: '#fff' }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#0B2C8C'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#E8ECF4'; }}
                    />
                  </td>
                  <td style={{ padding: '4px 4px' }}>
                    <input type="number" value={row.rate || ''} placeholder="0" onChange={e => updateService(idx, 'rate', Number(e.target.value))}
                      style={{ width: '100%', border: '1px solid #E8ECF4', borderRadius: 6, padding: '5px 4px', fontSize: 11, textAlign: 'right', outline: 'none', background: '#fff' }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#0B2C8C'; }} onBlur={e => { e.currentTarget.style.borderColor = '#E8ECF4'; }} />
                  </td>
                  <td style={{ padding: '4px 4px' }}>
                    <input type="number" value={row.days || ''} placeholder="0" onChange={e => updateService(idx, 'days', Number(e.target.value))}
                      style={{ width: '100%', border: '1px solid #E8ECF4', borderRadius: 6, padding: '5px 4px', fontSize: 11, textAlign: 'right', outline: 'none', background: '#fff' }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#0B2C8C'; }} onBlur={e => { e.currentTarget.style.borderColor = '#E8ECF4'; }} />
                  </td>
                  <td style={{ padding: '4px 4px' }}>
                    <input type="number" value={row.amount} onChange={e => updateService(idx, 'amount', Number(e.target.value))}
                      style={{ width: '100%', border: '1px solid #E8ECF4', borderRadius: 6, padding: '5px 4px', fontSize: 11, textAlign: 'right', outline: 'none', background: '#fff' }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#0B2C8C'; }} onBlur={e => { e.currentTarget.style.borderColor = '#E8ECF4'; }} />
                  </td>
                  <td style={{ padding: '4px 4px' }}>
                    <input type="number" value={row.other_expenses} onChange={e => updateService(idx, 'other_expenses', Number(e.target.value))}
                      style={{ width: '100%', border: '1px solid #E8ECF4', borderRadius: 6, padding: '5px 4px', fontSize: 11, textAlign: 'right', outline: 'none', background: '#fff' }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#0B2C8C'; }} onBlur={e => { e.currentTarget.style.borderColor = '#E8ECF4'; }} />
                  </td>
                  <td style={{ padding: '6px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#0B2C8C' }}>{(row.total || 0).toLocaleString('en-IN')}</td>
                  <td style={{ padding: '4px' }}>
                    <button onClick={() => deleteServiceRow(idx)} disabled={data.services.length <= 1}
                      style={{ padding: 4, borderRadius: 6, border: 'none', background: 'transparent', cursor: data.services.length <= 1 ? 'not-allowed' : 'pointer', color: data.services.length <= 1 ? '#D8E3F5' : '#D32F2F', display: 'flex' }}>
                      <Trash2 style={{ width: 13, height: 13 }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.97 }}
          onClick={addServiceRow}
          style={{
            marginTop: 10, display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 14px', borderRadius: 8, border: '1px dashed #0B2C8C',
            background: '#EDF2FF', color: '#0B2C8C', fontSize: 11, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'Poppins, sans-serif',
          }}
        >
          <Plus style={{ width: 14, height: 14 }} /> Add Service Row
        </motion.button>
      </AccordionSection>

      {/* 6. Financial Summary */}
      <AccordionSection id="financial" title="Financial Summary" icon={<DollarSign style={iconSize} />} isOpen={!!openSections.financial} onToggle={toggleSection}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <InputField
            label="GST Rate (%)"
            icon={<Percent style={iconSize} />}
            type="number"
            placeholder="e.g. 18"
            value={gstRate || ''}
            onChange={v => {
              const rate = Number(v) || 0;
              const computedGst = (subtotal * rate) / 100;
              onChange({ ...data, gstRate: rate, gstAmount: computedGst });
            }}
          />
          <InputField
            label="GST Amount (₹)"
            icon={<DollarSign style={iconSize} />}
            type="number"
            placeholder="e.g. 1800"
            value={calculatedGstAmount || ''}
            onChange={v => {
              const amt = Number(v) || 0;
              const computedRate = subtotal > 0 ? (amt / subtotal) * 100 : 0;
              onChange({ ...data, gstAmount: amt, gstRate: computedRate });
            }}
          />
        </div>
        <InputField label="Discount Amount (₹)" icon={<DollarSign style={iconSize} />} type="number" value={data.discountAmount} onChange={v => updateField('discountAmount', Number(v))} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
          {[
            ['Subtotal', subtotal, '#1A1A1A', true],
            ['GST Amount (+)', calculatedGstAmount, '#2E7D32', calculatedGstAmount > 0],
            ['Discount (-)', discountAmount, '#ED6C02', discountAmount > 0],
            ['Total After GST', totalAfterGst, '#0B2C8C', calculatedGstAmount > 0],
            ['Grand Total', grandTotal, '#0B2C8C', true],
            ['Advance Received (-)', advanceReceived, '#616161', true],
            ['Balance Due', balanceDue, '#D32F2F', true],
          ]
            .filter(([, , , show]) => show)
            .map(([label, val, color]) => (
              <React.Fragment key={label as string}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#616161', padding: '6px 0', borderBottom: '1px solid #E8ECF4' }}>{label as string}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: color as string, textAlign: 'right', padding: '6px 0', borderBottom: '1px solid #E8ECF4' }}>₹ {(val as number).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </React.Fragment>
            ))}
        </div>
      </AccordionSection>

      {/* 7. Remarks */}
      <AccordionSection id="remarks" title="Remarks" icon={<MessageSquare style={iconSize} />} isOpen={!!openSections.remarks} onToggle={toggleSection}>
        <InputField label="Remarks / Notes" icon={<MessageSquare style={iconSize} />} value={data.remarks} onChange={v => updateField('remarks', v)} isTextarea />
      </AccordionSection>

      {/* 8. School Details (only for SCHOOL type) */}
      {data.invoiceType === 'SCHOOL' && (
        <AccordionSection id="school" title="School Details" icon={<Building style={iconSize} />} isOpen={!!openSections.school} onToggle={toggleSection}>
          <InputField label="School / College Branch" icon={<Building style={iconSize} />} value={data.schoolBranch || ''} onChange={v => updateField('schoolBranch', v)} />
          <InputField label="Contact Person" icon={<User style={iconSize} />} value={data.contactPerson || ''} onChange={v => updateField('contactPerson', v)} />
        </AccordionSection>
      )}
    </div>
  );
};
