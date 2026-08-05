import React from 'react';
import { 
  MapPin, Phone, Mail, Globe, User, Settings, Info, 
  Table, MessageSquare, Activity, Stethoscope, 
  HeartPulse, UserCheck, Accessibility, TestTube, 
  Truck, Pill, PlusSquare 
} from 'lucide-react';

export interface ServiceItem {
  s_no: number;
  service_name: string;
  description?: string;
  rate: number;
  days: number;
  amount: number;
  other_expenses: number;
  total: number;
}

export interface InvoicePreviewData {
  invoiceNumber: string;
  invoiceType: 'REGULAR' | 'SCHOOL' | 'MULTI_SERVICE';
  invoiceDate: string;
  billingPeriodText: string;
  startDateText: string;
  clientName: string;
  clientContact: string;
  clientAddress: string;
  clientGst?: string;
  patientName?: string;
  patientAgeGender?: string;
  serviceType?: string;
  consultant?: string;
  renderedDays?: string;
  serviceStarted?: string;
  serviceEnd?: string;
  schoolBranch?: string;
  contactPerson?: string;
  perDayCharges: number;
  advanceReceived: number;
  paymentStatus: string;
  services: ServiceItem[];
  remarks: string;
  gstRate?: number;
  gstAmount: number;
  discountAmount: number;
  displayHash?: string;
}

/** Single source of truth for all invoice billing calculations */
export function computeInvoiceTotals(data: InvoicePreviewData) {
  const subtotal = data.services.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
  const gstRate = Number(data.gstRate) || 0;
  const gstAmount = gstRate > 0
    ? (subtotal * gstRate) / 100
    : (Number(data.gstAmount) || 0);
  const discountAmount = Number(data.discountAmount) || 0;
  const totalAfterGst = subtotal + (gstAmount > 0 ? gstAmount : 0) - discountAmount;
  const grandTotal = Math.max(0, totalAfterGst);
  const advanceReceived = Number(data.advanceReceived) || 0;
  const balanceDue = grandTotal - advanceReceived;
  return { subtotal, gstRate, gstAmount: gstAmount > 0 ? gstAmount : 0, discountAmount, totalAfterGst, advanceReceived, balanceDue, grandTotal };
}

interface InvoiceLivePreviewProps {
  data: InvoicePreviewData;
  zoom: number;
}

function numToWords(amount: number): string {
  if (amount === 0) return 'Zero';
  
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty ', 'Thirty ', 'Forty ', 'Fifty ', 'Sixty ', 'Seventy ', 'Eighty ', 'Ninety '];

  const inWords = (num: number): string => {
    let str = '';
    if (num > 99) {
      str += a[Math.floor(num / 100)] + 'Hundred ';
      num %= 100;
    }
    if (num > 19) {
      str += b[Math.floor(num / 10)];
      num %= 10;
    }
    if (num > 0) {
      str += a[num];
    }
    return str;
  };

  let num = Math.floor(amount);
  let str = '';

  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;

  if (crore > 0) str += inWords(crore) + 'Crore ';
  if (lakh > 0) str += inWords(lakh) + 'Lakh ';
  if (thousand > 0) str += inWords(thousand) + 'Thousand ';
  if (num > 0) str += inWords(num);

  return str.trim() + ' Rupees Only';
}

export const formatDisplayDate = (dateStr: string | null | undefined): string => {
  if (!dateStr || !dateStr.trim()) return '';
  const str = dateStr.trim();
  
  if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(str)) {
    return str.replace(/-/g, '/');
  }
  
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const [, yyyy, mm, dd] = ymdMatch;
    return `${dd.padStart(2, '0')}/${mm.padStart(2, '0')}/${yyyy}`;
  }

  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
  } catch {
    // Ignore fallback errors
  }

  return str;
};

const ROWS_PER_PAGE = 3;

function generatePreviewHash(data: InvoicePreviewData): string {
  if (data.displayHash) return data.displayHash;
  const str = `${data.invoiceNumber}-${data.clientName}-${data.invoiceDate}-${data.services.length}-${data.perDayCharges}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
  const invClean = (data.invoiceNumber || '1370').replace(/[^0-9]/g, '').slice(-4);
  return (hex + invClean + '91C2').slice(0, 16);
}

export const InvoiceLivePreview: React.FC<InvoiceLivePreviewProps> = ({ data, zoom }) => {
  const { subtotal, gstRate, gstAmount, discountAmount, totalAfterGst, advanceReceived, balanceDue, grandTotal } = computeInvoiceTotals(data);
  const amountInWords = numToWords(grandTotal);
  const currentDisplayHash = generatePreviewHash(data);

  const isMultiPage = data.invoiceType === 'MULTI_SERVICE' || data.services.length > 3;
  const pages: ServiceItem[][] = [];

  if (!isMultiPage) {
    pages.push(data.services);
  } else {
    // On Page 1 of multi-page, Bank & Totals move to Page 2, so Page 1 table can fill up to 10 rows
    pages.push(data.services.slice(0, 10));
    let remaining = data.services.slice(10);
    while (remaining.length > 0) {
      pages.push(remaining.slice(0, 8));
      remaining = remaining.slice(8);
    }
    // Force Page 2 so Remarks, Financial Summary, Bank Details & Stamp move to Page 2 when 4th row is created
    if (pages.length === 1) {
      pages.push([]);
    }
  }
  const totalPages = pages.length;

  const PageTemplate = ({ pageServices, pageNumber, isLastPage }: { pageServices: ServiceItem[], pageNumber: number, isLastPage: boolean }) => (
    <div 
      style={{ 
        width: '794px', 
        minHeight: '1123px', 
        backgroundColor: '#fff',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        margin: '0 auto 20px',
        padding: '30px',
        position: 'relative',
        boxSizing: 'border-box',
        fontFamily: '"Times New Roman", Times, serif',
        color: '#333',
        transform: `scale(${zoom / 100})`,
        transformOrigin: 'top center'
      }}
    >
      {/* Header */}
      {pageNumber === 1 ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div style={{ flex: 1.2 }}>
            <img src="/assets/invoice/skandan_logo.png" alt="Skandan Logo" style={{ height: '90px', maxWidth: '360px', objectFit: 'contain', display: 'block' }} />
            <div style={{ marginTop: '2px', color: '#0B2C8C', fontSize: '10px', fontStyle: 'italic', display: 'flex', alignItems: 'center', maxWidth: '250px' }}>
              <span style={{ flex: 1, height: '1px', backgroundColor: '#0B2C8C', marginRight: '6px' }}></span>
              Strive for service.
              <span style={{ flex: 1, height: '1px', backgroundColor: '#0B2C8C', marginLeft: '6px' }}></span>
            </div>
          </div>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <h1 style={{ color: '#0B2C8C', fontSize: '32px', margin: 0, fontStyle: 'italic', fontWeight: 'bold' }}>INVOICE</h1>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#0B2C8C', marginTop: '4px', letterSpacing: '0.5px' }}>
              Verification ID : {currentDisplayHash}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #0B2C8C', paddingBottom: '10px' }}>
          <img src="/assets/invoice/skandan_logo.png" alt="Skandan Logo" style={{ height: '40px' }} />
          <div style={{ textAlign: 'right' }}>
            <h2 style={{ color: '#0B2C8C', margin: 0, fontStyle: 'italic' }}>INVOICE</h2>
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#0B2C8C' }}>
              Verification ID : {currentDisplayHash}
            </div>
          </div>
        </div>
      )}

      {/* Contact Bar (Page 1) */}
      {pageNumber === 1 && (
        <div style={{ 
          border: '1px solid #DCE7FF', 
          borderRadius: '8px', 
          display: 'flex', 
          padding: '10px',
          marginBottom: '20px',
          backgroundColor: '#F7F9FC',
          fontSize: '11px'
        }}>
          <div style={{ flex: 1, display: 'flex', paddingRight: '10px', borderRight: '1px solid #DCE7FF' }}>
            <MapPin size={16} color="#0B2C8C" style={{ marginRight: '8px', marginTop: '2px', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', lineHeight: '1.3' }}>
              <span>Plot No 13, SY NO 3,4, RR Plaza,</span>
              <span>Madhapur, Hyderabad, Telangana -</span>
              <span>500081</span>
            </div>
          </div>
          <div style={{ flex: 1, padding: '0 10px', borderRight: '1px solid #DCE7FF', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}><Phone size={14} color="#0B2C8C" style={{ marginRight: '8px' }} /> +91 96609 66369</div>
            <div style={{ display: 'flex', alignItems: 'center' }}><Mail size={14} color="#0B2C8C" style={{ marginRight: '8px' }} /> skandanhomecarre@gmail.com</div>
            <div style={{ display: 'flex', alignItems: 'center' }}><Globe size={14} color="#0B2C8C" style={{ marginRight: '8px' }} /> www.skandanhomecarre.com</div>
          </div>
          <div style={{ flex: 1, paddingLeft: '10px', display: 'flex', flexDirection: 'column', gap: '4px', fontWeight: '500' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Invoice No.</span> <span>: {data.invoiceNumber}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Invoice Date</span> <span>: {formatDisplayDate(data.invoiceDate)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Billing Period</span> <span>: {data.billingPeriodText}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Start Date</span> <span>: {formatDisplayDate(data.startDateText)}</span></div>
          </div>
        </div>
      )}

      {/* Info Bar (Page > 1) */}
      {pageNumber > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '20px', fontWeight: '500' }}>
          <span>Invoice No: {data.invoiceNumber}</span>
          <span>Client: {data.clientName}</span>
          <span>Period: {data.billingPeriodText}</span>
          <span>Page {pageNumber} of {totalPages}</span>
        </div>
      )}

      {/* Profile Cards (Page 1) */}
      {pageNumber === 1 && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          {/* Billed To */}
          <div style={{ flex: 1, border: '1px solid #DCE7FF', borderTop: '3px solid #0B2C8C', borderRadius: '4px', padding: '10px', fontSize: '11px' }}>
            <div style={{ display: 'flex', alignItems: 'center', color: '#0B2C8C', fontWeight: 'bold', marginBottom: '8px' }}>
              <User size={16} style={{ marginRight: '5px' }} /> BILLED TO
            </div>
            {data.invoiceType === 'SCHOOL' ? (
               <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                 <div style={{ display: 'flex' }}><span style={{ width: '80px', color: '#666' }}>School:</span> <strong>{data.clientName}</strong></div>
                 <div style={{ display: 'flex' }}><span style={{ width: '80px', color: '#666' }}>Branch:</span> <span>{data.schoolBranch}</span></div>
                 <div style={{ display: 'flex' }}><span style={{ width: '80px', color: '#666' }}>Contact:</span> <span>{data.clientContact}</span></div>
                 <div style={{ display: 'flex' }}><span style={{ width: '80px', color: '#666' }}>Address:</span> <span>{data.clientAddress}</span></div>
               </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex' }}><span style={{ width: '80px', color: '#666' }}>Name:</span> <strong>{data.clientName}</strong></div>
                {data.contactPerson && <div style={{ display: 'flex' }}><span style={{ width: '80px', color: '#666' }}>Contact Person:</span> <span>{data.contactPerson}</span></div>}
                <div style={{ display: 'flex' }}><span style={{ width: '80px', color: '#666' }}>Contact No:</span> <span>{data.clientContact}</span></div>
                <div style={{ display: 'flex' }}><span style={{ width: '80px', color: '#666' }}>Address:</span> <span>{data.clientAddress}</span></div>
                {data.clientGst && <div style={{ display: 'flex' }}><span style={{ width: '80px', color: '#666' }}>GST No:</span> <span>{data.clientGst}</span></div>}
              </div>
            )}
          </div>

          {/* Service Profile */}
          <div style={{ flex: 1, border: '1px solid #DCE7FF', borderTop: '3px solid #0B2C8C', borderRadius: '4px', padding: '10px', fontSize: '11px' }}>
            <div style={{ display: 'flex', alignItems: 'center', color: '#0B2C8C', fontWeight: 'bold', marginBottom: '8px' }}>
              <Settings size={16} style={{ marginRight: '5px' }} /> SERVICE PROFILE
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {(data.invoiceType === 'MULTI_SERVICE' || data.invoiceType === 'REGULAR') && data.patientName && (
                <>
                  <div style={{ display: 'flex' }}><span style={{ width: '80px', color: '#666' }}>Patient:</span> <strong>{data.patientName}</strong></div>
                  {data.patientAgeGender && <div style={{ display: 'flex' }}><span style={{ width: '80px', color: '#666' }}>Age/Gender:</span> <span>{data.patientAgeGender}</span></div>}
                </>
              )}
              {data.serviceType && <div style={{ display: 'flex' }}><span style={{ width: '80px', color: '#666' }}>Service Type:</span> <span>{data.serviceType}</span></div>}
              {data.consultant && <div style={{ display: 'flex' }}><span style={{ width: '80px', color: '#666' }}>Consultant:</span> <span>{data.consultant}</span></div>}
              {data.serviceStarted && <div style={{ display: 'flex' }}><span style={{ width: '80px', color: '#666' }}>Started On:</span> <span>{formatDisplayDate(data.serviceStarted)}</span></div>}
              {data.renderedDays && <div style={{ display: 'flex' }}><span style={{ width: '80px', color: '#666' }}>Rendered:</span> <span>{data.renderedDays}</span></div>}
            </div>
          </div>

          {/* Other Information */}
          <div style={{ flex: 1, border: '1px solid #DCE7FF', borderTop: '3px solid #0B2C8C', borderRadius: '4px', padding: '10px', fontSize: '11px' }}>
            <div style={{ display: 'flex', alignItems: 'center', color: '#0B2C8C', fontWeight: 'bold', marginBottom: '8px' }}>
              <Info size={16} style={{ marginRight: '5px' }} /> OTHER INFORMATION
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex' }}><span style={{ width: '100px', color: '#666' }}>Per Day Chg:</span> <strong>₹ {data.perDayCharges}</strong></div>
              <div style={{ display: 'flex' }}><span style={{ width: '100px', color: '#666' }}>Adv. Amount:</span> <span>₹ {data.advanceReceived}</span></div>
              <div style={{ display: 'flex' }}><span style={{ width: '100px', color: '#666' }}>Payment Status:</span> <span style={{ color: '#0B2C8C', fontWeight: 'bold' }}>{data.paymentStatus}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Services Table */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', color: '#0B2C8C', fontWeight: 'bold', marginBottom: '10px', fontSize: '14px' }}>
          <Table size={18} style={{ marginRight: '8px' }} /> 
          {pageNumber > 1 ? "SERVICE DETAILS (CONTINUED)" : "SERVICE DETAILS"}
          {pageNumber > 1 && <div style={{ flex: 1, height: '1px', borderBottom: '1px dashed #0B2C8C', marginLeft: '10px' }}></div>}
        </div>
        
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr style={{ backgroundColor: '#0B2C8C', color: 'white' }}>
              <th style={{ padding: '8px', border: '1px solid #061A63', textAlign: 'center', width: '6%' }}>S.No</th>
              <th style={{ padding: '8px', border: '1px solid #061A63', textAlign: 'left', width: '54%' }}>Service Details</th>
              <th style={{ padding: '8px', border: '1px solid #061A63', textAlign: 'right', width: '13%' }}>Amount (₹)</th>
              <th style={{ padding: '8px', border: '1px solid #061A63', textAlign: 'right', width: '13%' }}>Other Expenses (₹)</th>
              <th style={{ padding: '8px', border: '1px solid #061A63', textAlign: 'right', width: '14%' }}>Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            {pageServices.map((service, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #D8E3F5' }}>
                <td style={{ padding: '8px', borderLeft: '1px solid #D8E3F5', borderRight: '1px solid #D8E3F5', textAlign: 'center' }}>{service.s_no}</td>
                <td style={{ padding: '8px', borderRight: '1px solid #D8E3F5' }}>
                  <div style={{ fontWeight: '500' }}>{service.service_name}</div>
                  {service.description && <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>{service.description}</div>}
                </td>
                <td style={{ padding: '8px', borderRight: '1px solid #D8E3F5', textAlign: 'right' }}>{service.amount.toFixed(2)}</td>
                <td style={{ padding: '8px', borderRight: '1px solid #D8E3F5', textAlign: 'right' }}>{service.other_expenses.toFixed(2)}</td>
                <td style={{ padding: '8px', borderRight: '1px solid #D8E3F5', textAlign: 'right', fontWeight: '500' }}>{service.total.toFixed(2)}</td>
              </tr>
            ))}
            {/* Render actual service rows only */}
          </tbody>
        </table>
        
        {!isLastPage && (
          <div style={{ textAlign: 'right', padding: '10px', fontStyle: 'italic', color: '#666', fontSize: '11px', border: '1px solid #D8E3F5', borderTop: 'none' }}>
            Continued on Next Page &rarr;
          </div>
        )}
      </div>

      {/* Financials & Remarks (Only on last page) */}
      {isLastPage && (
        <div style={{ display: 'flex', gap: '20px', marginBottom: '10px' }}>
          {/* Remarks */}
          <div style={{ flex: 1.5 }}>
            <div style={{ border: '1px solid #DCE7FF', borderRadius: '4px', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ backgroundColor: '#F7F9FC', padding: '8px', borderBottom: '1px solid #DCE7FF', display: 'flex', alignItems: 'center', color: '#0B2C8C', fontWeight: 'bold', fontSize: '12px' }}>
                <MessageSquare size={14} style={{ marginRight: '6px' }} /> REMARKS / NOTES
              </div>
              <div style={{ padding: '10px', fontSize: '11px', flex: 1, whiteSpace: 'pre-wrap', color: '#444' }}>
                {data.remarks || 'Thank you for choosing Skandan Home Carre & Cclinic LLP.'}
              </div>
            </div>
          </div>

          {/* Financial Summary */}
          <div style={{ flex: 1 }}>
            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '6px', borderBottom: '1px solid #eee', color: '#666' }}>Sub Total</td>
                  <td style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: '500' }}>₹ {subtotal.toFixed(2)}</td>
                </tr>
                {gstAmount > 0 && (
                  <tr>
                    <td style={{ padding: '6px', borderBottom: '1px solid #eee', color: '#666' }}>GST {gstRate > 0 ? `(${gstRate}%)` : ''}</td>
                    <td style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: 'right' }}>₹ {gstAmount.toFixed(2)}</td>
                  </tr>
                )}
                {discountAmount > 0 && (
                  <tr>
                    <td style={{ padding: '6px', borderBottom: '1px solid #eee', color: '#666' }}>Discount</td>
                    <td style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: 'right' }}>- ₹ {discountAmount.toFixed(2)}</td>
                  </tr>
                )}
                {gstAmount > 0 && (
                  <tr style={{ backgroundColor: '#F7F9FC' }}>
                    <td style={{ padding: '8px 6px', borderBottom: '1px solid #DCE7FF', fontWeight: 'bold', color: '#0B2C8C' }}>Total After GST</td>
                    <td style={{ padding: '8px 6px', borderBottom: '1px solid #DCE7FF', textAlign: 'right', fontWeight: 'bold', color: '#0B2C8C' }}>₹ {totalAfterGst.toFixed(2)}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ padding: '6px', borderBottom: '1px solid #eee', color: '#666' }}>Advance Received</td>
                  <td style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: 'right' }}>₹ {(advanceReceived || 0).toFixed(2)}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 6px', fontWeight: 'bold', color: '#0B2C8C' }}>Balance Due</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 'bold', color: '#0B2C8C' }}>₹ {balanceDue.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
            <div style={{ backgroundColor: '#0B2C8C', color: 'white', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '4px', marginTop: '10px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '14px' }}>GRAND TOTAL</span>
              <span style={{ fontWeight: 'bold', fontSize: '18px' }}>₹ {grandTotal.toFixed(2)}</span>
            </div>
            <div style={{ fontSize: '10px', marginTop: '8px', color: '#555', fontStyle: 'italic', textAlign: 'right' }}>
              Amount in words: {amountInWords}
            </div>
          </div>
        </div>
      )}

      {/* Payment Info / Signatures (Only on last page) */}
      {isLastPage && (
        <div style={{ marginTop: '5px', paddingTop: '0px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {/* Bank Details, UPI & Seal (Always present for all templates) */}
            <div style={{ display: 'flex', gap: '15px', border: '1px solid #DCE7FF', borderRadius: '6px', padding: '15px', backgroundColor: '#F7F9FC' }}>
              {/* Bank Details */}
              <div style={{ flex: 1.5, borderRight: '1px solid #DCE7FF', paddingRight: '15px' }}>
                <div style={{ fontWeight: 'bold', color: '#0B2C8C', fontSize: '12px', marginBottom: '10px', display: 'flex', alignItems: 'center' }}>
                  BANK TRANSFER (NEFT/RTGS)
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div>
                    <img src="/assets/invoice/hdfc_logo.png" alt="HDFC Bank" style={{ height: '30px', marginBottom: '5px' }} />
                  </div>
                  <div style={{ fontSize: '10px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div><span style={{ color: '#666', width: '60px', display: 'inline-block' }}>Beneficiary:</span> <strong>SKANDAN HOME CARRE CCLINIC LLP</strong></div>
                    <div><span style={{ color: '#666', width: '60px', display: 'inline-block' }}>Account:</span> <strong>50200090644327</strong></div>
                    <div><span style={{ color: '#666', width: '60px', display: 'inline-block' }}>Type:</span> <span>Current Account</span></div>
                    <div><span style={{ color: '#666', width: '60px', display: 'inline-block' }}>IFSC:</span> <strong>HDFC0004211</strong></div>
                    <div><span style={{ color: '#666', width: '60px', display: 'inline-block' }}>MICR:</span> <span>500240078</span></div>
                  </div>
                </div>
              </div>

              {/* UPI */}
              <div style={{ flex: 1, borderRight: '1px solid #DCE7FF', paddingRight: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontWeight: 'bold', color: '#0B2C8C', fontSize: '12px', marginBottom: '5px' }}>UPI PAYMENT</div>
                <img src="/assets/invoice/payment_qr_clean.png" alt="UPI QR" style={{ height: '80px', width: '80px', objectFit: 'contain' }} />
                <div style={{ fontSize: '10px', marginTop: '5px' }}><strong>UPI ID:</strong> 9866613699@hdfcbank</div>
              </div>

              {/* Seal */}
              <div style={{ flex: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/assets/invoice/skandan_verified_seal.png" alt="Verified Seal" style={{ height: '100px', objectFit: 'contain' }} />
              </div>
            </div>

            {/* Additional 3 Signatures Block for SCHOOL / College Invoice */}
            {data.invoiceType === 'SCHOOL' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', marginBottom: '15px', padding: '0 40px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ borderBottom: '1px solid #0B2C8C', width: '130px', marginBottom: '4px' }}></div>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#0B2C8C' }}>Principal Signature</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ borderBottom: '1px solid #0B2C8C', width: '130px', marginBottom: '4px' }}></div>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#0B2C8C' }}>AO Signature</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ borderBottom: '1px solid #0B2C8C', width: '130px', marginBottom: '4px' }}></div>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#0B2C8C' }}>AGM Signature</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer (Always at bottom) */}
      <div style={{ position: 'absolute', bottom: '20px', left: '30px', right: '30px' }}>
        {isLastPage && (
          <div style={{ textAlign: 'center', color: '#0B2C8C', fontSize: '11px', fontWeight: '600', fontStyle: 'italic', marginBottom: '10px' }}>
            This invoice is system generated. No signature is required.
          </div>
        )}
        
        <div style={{ paddingTop: '8px' }}>
          <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: 'bold', color: '#0B2C8C', marginBottom: '8px', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ flex: 1, height: '1px', backgroundColor: '#0B2C8C', marginRight: '15px' }}></span>
            OUR SERVICES
            <span style={{ flex: 1, height: '1px', backgroundColor: '#0B2C8C', marginLeft: '15px' }}></span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#0B2C8C', fontWeight: '500' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}><Activity size={14} color="#0B2C8C" /><span style={{ textAlign: 'center' }}>ICU Care<br/>at Home</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}><Stethoscope size={14} color="#0B2C8C" /><span style={{ textAlign: 'center' }}>Doctor<br/>Visits</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}><HeartPulse size={14} color="#0B2C8C" /><span style={{ textAlign: 'center' }}>Nursing<br/>Care</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}><UserCheck size={14} color="#0B2C8C" /><span style={{ textAlign: 'center' }}>Caretaker<br/>Services</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}><Accessibility size={14} color="#0B2C8C" /><span style={{ textAlign: 'center' }}>Physiotherapy</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}><TestTube size={14} color="#0B2C8C" /><span style={{ textAlign: 'center' }}>Lab Tests<br/>at Home</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}><PlusSquare size={14} color="#0B2C8C" /><span style={{ textAlign: 'center' }}>Medical<br/>Equipment Rental</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}><Pill size={14} color="#0B2C8C" /><span style={{ textAlign: 'center' }}>Medicine<br/>Delivery</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}><Truck size={14} color="#0B2C8C" /><span style={{ textAlign: 'center' }}>Post-Operative<br/>Care</span></div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      {pages.map((pageServices, index) => (
        <PageTemplate 
          key={index} 
          pageServices={pageServices} 
          pageNumber={index + 1} 
          isLastPage={index === totalPages - 1} 
        />
      ))}
    </div>
  );
};
