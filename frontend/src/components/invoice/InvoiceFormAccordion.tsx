import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';
import {
  FileText, Calendar, Layers, Building, User, Phone, MapPin,
  Briefcase, UserCheck, Clock, Heart, DollarSign, CreditCard,
  Plus, Trash2, ChevronDown, MessageSquare, Percent, Sparkles,
  Search, Check, X, RotateCcw
} from 'lucide-react';
import { authedFetch } from '../../lib/api';
import { computeInvoiceTotals } from './InvoiceLivePreview';
import type { InvoicePreviewData, ServiceItem } from './InvoiceLivePreview';

export interface ClientProfile {
  client_name: string;
  client_contact?: string;
  client_address?: string;
  client_gst?: string;
  contact_person?: string;
  contact_person_designation?: string;
  school_branch?: string;
  service_type?: string;
  consultant?: string;
  patient_name?: string;
  patient_age_gender?: string;
  per_day_charges?: number;
  invoice_type?: 'REGULAR' | 'SCHOOL' | 'MULTI_SERVICE';
  total_invoices?: number;
  last_invoice_number?: string;
  last_invoice_date?: string;
}

export interface InvoiceFormAccordionProps {
  data: InvoicePreviewData;
  onChange: (data: InvoicePreviewData) => void;
  existingInvoices?: any[];
  clientsList?: ClientProfile[];
}

/* ── Accordion Shell ─────────────────────────────────── */
const AccordionSection: React.FC<{
  id: string; title: string; icon: React.ReactNode;
  isOpen: boolean; onToggle: (id: string) => void;
  badge?: React.ReactNode;
  children: React.ReactNode;
}> = ({ id, title, icon, isOpen, onToggle, badge, children }) => (
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
        {badge}
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

/* ── Standard Input ───────────────────────────────────── */
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
        <div
          style={{
            position: 'absolute',
            left: 10,
            top: isTextarea ? 10 : '50%',
            transform: isTextarea ? 'none' : 'translateY(-50%)',
            color: '#9CA3AF',
            display: 'flex',
            alignItems: 'center',
            pointerEvents: 'none',
          }}
        >
          {icon}
        </div>
        {isTextarea ? (
          <textarea
            value={value}
            placeholder={placeholder}
            onChange={e => onChange(e.target.value)}
            readOnly={readOnly}
            onFocus={handleFocus}
            onBlur={handleBlur}
            rows={3}
            style={{
              ...baseInputStyle,
              minHeight: 68,
              resize: 'vertical',
              paddingTop: 8,
              lineHeight: '1.45',
            }}
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

/* ── Smart Client Autocomplete Input ─────────────────── */
const ClientAutocompleteField: React.FC<{
  label: string;
  icon: React.ReactNode;
  value: string;
  clients: ClientProfile[];
  placeholder?: string;
  onSelectClient: (client: ClientProfile) => void;
  onChange: (value: string) => void;
}> = ({ label, icon, value, clients, placeholder, onSelectClient, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter clients based on user typing
  const matchingClients = useMemo(() => {
    if (!value || !value.trim()) {
      return clients.slice(0, 6);
    }
    const q = value.trim().toLowerCase();
    return clients
      .filter(c => c.client_name.toLowerCase().includes(q) || (c.contact_person && c.contact_person.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [clients, value]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < matchingClients.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : matchingClients.length - 1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < matchingClients.length) {
        e.preventDefault();
        onSelectClient(matchingClients[selectedIndex]);
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleBlur = () => {
    // Check for exact match on blur so even without clicking, all details fill automatically
    if (value && value.trim()) {
      const exactMatch = clients.find(c => c.client_name.trim().toLowerCase() === value.trim().toLowerCase());
      if (exactMatch) {
        onSelectClient(exactMatch);
      }
    }
  };

  return (
    <div style={{ marginBottom: 10, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <label style={{ fontSize: 10, fontWeight: 600, color: '#616161', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </label>
        {clients.length > 0 && (
          <span style={{ fontSize: 9.5, color: '#1A4DD8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
            <Sparkles style={{ width: 10, height: 10 }} />
            {clients.length} Previous {clients.length === 1 ? 'Client' : 'Clients'}
          </span>
        )}
      </div>

      <div style={{ position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#9CA3AF',
            display: 'flex',
            alignItems: 'center',
            pointerEvents: 'none',
          }}
        >
          {icon}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={value}
          placeholder={placeholder || 'Type or select an existing client...'}
          onChange={e => {
            onChange(e.target.value);
            setIsOpen(true);
            setSelectedIndex(-1);
            // Instant exact match while typing
            const exact = clients.find(c => c.client_name.trim().toLowerCase() === e.target.value.trim().toLowerCase());
            if (exact) {
              onSelectClient(exact);
            }
          }}
          onFocus={() => {
            if (clients.length > 0) setIsOpen(true);
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          style={{
            width: '100%',
            paddingLeft: 34,
            paddingRight: 28,
            paddingTop: 8,
            paddingBottom: 8,
            border: '1px solid var(--inv-border)',
            borderRadius: 8,
            fontSize: 12,
            fontFamily: 'Poppins, sans-serif',
            outline: 'none',
            background: 'var(--inv-card)',
            color: 'var(--inv-text)',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
        />

        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              inputRef.current?.focus();
            }}
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              border: 'none',
              background: 'transparent',
              color: '#9CA3AF',
              cursor: 'pointer',
              display: 'flex',
              padding: 2,
            }}
          >
            <X style={{ width: 13, height: 13 }} />
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown List */}
      <AnimatePresence>
        {isOpen && matchingClients.length > 0 && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: 4,
              background: '#FFFFFF',
              border: '1px solid #C7D8F8',
              borderRadius: 10,
              boxShadow: '0 10px 25px -5px rgba(11, 44, 140, 0.18), 0 4px 10px -2px rgba(0, 0, 0, 0.05)',
              zIndex: 100,
              maxHeight: 240,
              overflowY: 'auto',
              padding: 4,
            }}
          >
            <div style={{ padding: '6px 10px 4px 10px', fontSize: 10, fontWeight: 700, color: '#0B2C8C', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #EEF3FD', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Previously Generated Clients</span>
              <span style={{ fontSize: 9, color: '#6B7280', fontWeight: 500 }}>Click to auto-fill</span>
            </div>

            {matchingClients.map((client, idx) => {
              const isSelected = idx === selectedIndex;
              const isCurrent = value && client.client_name.toLowerCase() === value.toLowerCase();

              return (
                <div
                  key={`${client.client_name}-${idx}`}
                  onMouseDown={e => {
                    // prevent blur from stealing event before click registers
                    e.preventDefault();
                    onSelectClient(client);
                    setIsOpen(false);
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: isSelected ? '#EDF2FF' : isCurrent ? '#F3F4F6' : 'transparent',
                    borderLeft: isSelected ? '3px solid #0B2C8C' : '3px solid transparent',
                    transition: 'all 0.12s',
                    marginBottom: 2,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: '#0B2C8C' }}>
                      {client.client_name}
                    </div>
                    {client.total_invoices && client.total_invoices > 1 ? (
                      <span style={{ fontSize: 9.5, background: '#DCFCE7', color: '#15803D', fontWeight: 700, padding: '2px 6px', borderRadius: 10 }}>
                        {client.total_invoices} Invoices
                      </span>
                    ) : (
                      <span style={{ fontSize: 9.5, background: '#EDF2FF', color: '#1A4DD8', fontWeight: 600, padding: '2px 6px', borderRadius: 10 }}>
                        Past Client
                      </span>
                    )}
                  </div>

                  {/* Subtitle with contact person & phone */}
                  <div style={{ fontSize: 11, color: '#4B5563', marginTop: 2, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {client.contact_person && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <User style={{ width: 10, height: 10, color: '#9CA3AF' }} />
                        {client.contact_person}
                      </span>
                    )}
                    {client.client_contact && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Phone style={{ width: 10, height: 10, color: '#9CA3AF' }} />
                        {client.client_contact}
                      </span>
                    )}
                  </div>

                  {/* Address Snippet */}
                  {client.client_address && (
                    <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {client.client_address}
                    </div>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── Main Component ──────────────────────────────────── */
export const InvoiceFormAccordion: React.FC<InvoiceFormAccordionProps> = ({
  data,
  onChange,
  existingInvoices = [],
  clientsList = [],
}) => {
  const { getToken } = useAuth();

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    invoice: true, client: true, profile: false, other: false,
    table: true, financial: false, remarks: false, school: false,
  });

  // Track if details were auto-filled to display confirmation banner
  const [autoFilledClientName, setAutoFilledClientName] = useState<string | null>(null);

  // Backup store to allow "Undo Auto-Fill"
  const [previousDataBeforeAutofill, setPreviousDataBeforeAutofill] = useState<InvoicePreviewData | null>(null);

  // Internal fetched clients if clientsList wasn't passed or to ensure freshest data
  const [fetchedClients, setFetchedClients] = useState<ClientProfile[]>([]);

  useEffect(() => {
    let isMounted = true;
    const loadClients = async () => {
      try {
        const token = (await getToken()) || '';
        const res = await authedFetch('/api/invoices/clients/', token);
        if (res.ok && isMounted) {
          const list = await res.json();
          setFetchedClients(list);
        }
      } catch (err) {
        // silent fallback to prop data
      }
    };
    loadClients();
    return () => {
      isMounted = false;
    };
  }, [getToken]);

  // Merge clients from props, API, and existing invoices
  const allKnownClients = useMemo(() => {
    const map = new Map<string, ClientProfile>();

    // 1. From API fetched clients
    fetchedClients.forEach(c => {
      if (c.client_name) {
        map.set(c.client_name.trim().toLowerCase(), c);
      }
    });

    // 2. From clientsList prop
    clientsList.forEach(c => {
      if (c.client_name) {
        const key = c.client_name.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, c);
        }
      }
    });

    // 3. From existing invoices prop
    existingInvoices.forEach(inv => {
      const name = (inv.client_name || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          client_name: name,
          client_contact: inv.client_contact || '',
          client_address: inv.client_address || '',
          client_gst: inv.client_gst || '',
          contact_person: inv.contact_person || '',
          contact_person_designation: inv.contact_person_designation || '',
          school_branch: inv.school_branch || '',
          service_type: inv.service_type || '',
          consultant: inv.consultant || '',
          patient_name: inv.patient_name || '',
          patient_age_gender: inv.patient_age_gender || '',
          per_day_charges: Number(inv.per_day_charges || 0),
          invoice_type: inv.invoice_type || 'REGULAR',
          total_invoices: 1,
          last_invoice_number: inv.invoice_number,
          last_invoice_date: inv.invoice_date,
        });
      } else {
        const existing = map.get(key)!;
        existing.total_invoices = (existing.total_invoices || 1) + 1;
      }
    });

    return Array.from(map.values()).sort((a, b) => (b.total_invoices || 1) - (a.total_invoices || 1));
  }, [fetchedClients, clientsList, existingInvoices]);

  const toggleSection = (id: string) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const updateField = (field: keyof InvoicePreviewData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  // Handler to auto-populate all client details from previous record
  const handleAutoFillClient = (client: ClientProfile) => {
    // Save previous snapshot for undo
    setPreviousDataBeforeAutofill({ ...data });

    const updated: InvoicePreviewData = {
      ...data,
      clientName: client.client_name,
      clientContact: client.client_contact || data.clientContact || '',
      clientAddress: client.client_address || data.clientAddress || '',
      clientGst: client.client_gst || data.clientGst || '',
      contactPerson: client.contact_person || data.contactPerson || '',
      schoolBranch: client.school_branch || data.schoolBranch || '',
      serviceType: client.service_type || data.serviceType || '',
      consultant: client.consultant || data.consultant || '',
      patientName: client.patient_name || data.patientName || '',
      patientAgeGender: client.patient_age_gender || data.patientAgeGender || '',
      perDayCharges: client.per_day_charges ? Number(client.per_day_charges) : data.perDayCharges,
    };

    onChange(updated);
    setAutoFilledClientName(client.client_name);

    // Automatically expand sections that received populated info
    setOpenSections(prev => ({
      ...prev,
      client: true,
      profile: Boolean(client.service_type || client.consultant || client.patient_name),
      other: Boolean(client.per_day_charges),
      school: Boolean(client.school_branch),
    }));
  };

  const handleUndoAutoFill = () => {
    if (previousDataBeforeAutofill) {
      onChange(previousDataBeforeAutofill);
      setAutoFilledClientName(null);
      setPreviousDataBeforeAutofill(null);
    } else {
      // Clear fields
      onChange({
        ...data,
        clientContact: '',
        clientAddress: '',
        clientGst: '',
        contactPerson: '',
      });
      setAutoFilledClientName(null);
    }
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

      {/* 2. Client / Billing Information with Smart Autocomplete & Auto-fill */}
      <AccordionSection
        id="client"
        title="Client / Billing Information"
        icon={<Building style={iconSize} />}
        isOpen={!!openSections.client}
        onToggle={toggleSection}
        badge={
          autoFilledClientName ? (
            <span style={{ fontSize: 10, background: '#DCFCE7', color: '#166534', fontWeight: 700, padding: '2px 8px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 3 }}>
              <Check style={{ width: 11, height: 11 }} /> Auto-filled
            </span>
          ) : null
        }
      >
        {/* Auto-filled Confirmation Banner */}
        {autoFilledClientName && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: 8,
              padding: '8px 12px',
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 11,
              color: '#166534',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles style={{ width: 14, height: 14, color: '#16A34A', flexShrink: 0 }} />
              <span>
                Auto-filled details for <strong>{autoFilledClientName}</strong> from previous invoice.
              </span>
            </div>
            <button
              type="button"
              onClick={handleUndoAutoFill}
              style={{
                background: '#DCFCE7',
                border: '1px solid #86EFAC',
                borderRadius: 4,
                padding: '2px 8px',
                color: '#166534',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <RotateCcw style={{ width: 10, height: 10 }} />
              Undo
            </button>
          </motion.div>
        )}

        {data.invoiceType === 'REGULAR' ? (
          <>
            <ClientAutocompleteField
              label="Organization / Client Name"
              icon={<Building style={iconSize} />}
              value={data.clientName}
              clients={allKnownClients}
              placeholder="e.g. Apollo Hospital / Client Name"
              onChange={v => updateField('clientName', v)}
              onSelectClient={handleAutoFillClient}
            />
            <InputField label="Contact Person" icon={<User style={iconSize} />} value={data.contactPerson || ''} onChange={v => updateField('contactPerson', v)} />
            <InputField label="Contact No." icon={<Phone style={iconSize} />} value={data.clientContact} onChange={v => updateField('clientContact', v)} />
            <InputField label="GST No. (Optional)" icon={<Building style={iconSize} />} value={data.clientGst || ''} onChange={v => updateField('clientGst', v)} />
            <InputField label="Address" icon={<MapPin style={iconSize} />} value={data.clientAddress} onChange={v => updateField('clientAddress', v)} isTextarea />
          </>
        ) : (
          <>
            <ClientAutocompleteField
              label="Client Name"
              icon={<User style={iconSize} />}
              value={data.clientName}
              clients={allKnownClients}
              placeholder="e.g. John Doe / School Name"
              onChange={v => updateField('clientName', v)}
              onSelectClient={handleAutoFillClient}
            />
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
