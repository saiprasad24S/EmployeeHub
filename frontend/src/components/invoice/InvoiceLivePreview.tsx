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
  gstAmount: number;
  discountAmount: number;
  displayHash?: string;
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

const ROWS_PER_PAGE = 8;

export const InvoiceLivePreview: React.FC<InvoiceLivePreviewProps> = ({ data, zoom }) => {
  const subtotal = data.services.reduce((acc, curr) => acc + curr.total, 0);
  const totalAfterGst = subtotal + (data.gstAmount || 0) - (data.discountAmount || 0);
  const balanceDue = totalAfterGst - data.advanceReceived;
  const grandTotal = totalAfterGst;
  const amountInWords = numToWords(grandTotal);

  const pages = [];
  const totalPages = Math.ceil(data.services.length / ROWS_PER_PAGE) || 1;

  for (let i = 0; i < totalPages; i++) {
    pages.push(data.services.slice(i * ROWS_PER_PAGE, (i + 1) * ROWS_PER_PAGE));
  }

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
        fontFamily: "'Poppins', sans-serif",
        color: '#333',
        transform: `scale(${zoom / 100})`,
        transformOrigin: 'top center'
      }}
    >
      {/* Header */}
      {pageNumber === 1 ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div style={{ flex: 1 }}>
            <img src="/assets/invoice/skandan_logo.png" alt="Skandan Logo" style={{ height: '70px', objectFit: 'contain' }} />
            <div style={{ marginTop: '5px', color: '#0B2C8C', fontSize: '10px', fontStyle: 'italic', display: 'flex', alignItems: 'center' }}>
              <span style={{ flex: 1, height: '1px', backgroundColor: '#0B2C8C', marginRight: '5px' }}></span>
              Strive for service.
              <span style={{ flex: 1, height: '1px', backgroundColor: '#0B2C8C', marginLeft: '5px' }}></span>
            </div>
          </div>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <h1 style={{ color: '#0B2C8C', fontSize: '32px', margin: 0, fontStyle: 'italic', fontWeight: 'bold' }}>INVOICE</h1>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#0B2C8C', marginTop: '4px', letterSpacing: '0.5px' }}>
              Verification ID : {data.displayHash || '8A0D4C6E6E7F91C2'}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #0B2C8C', paddingBottom: '10px' }}>
          <img src="/assets/invoice/skandan_logo.png" alt="Skandan Logo" style={{ height: '40px' }} />
          <div style={{ textAlign: 'right' }}>
            <h2 style={{ color: '#0B2C8C', margin: 0, fontStyle: 'italic' }}>INVOICE</h2>
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#0B2C8C' }}>
              Verification ID : {data.displayHash || '8A0D4C6E6E7F91C2'}
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
            <MapPin size={16} color="#0B2C8C" style={{ marginRight: '8px', flexShrink: 0 }} />
            <span>Plot No 13, SY NO 3,4, RR Plaza, Madhapur, Hyderabad, Telangana - 500081</span>
          </div>
          <div style={{ flex: 1, padding: '0 10px', borderRight: '1px solid #DCE7FF', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}><Phone size={14} color="#0B2C8C" style={{ marginRight: '8px' }} /> +91 96609 66369</div>
            <div style={{ display: 'flex', alignItems: 'center' }}><Mail size={14} color="#0B2C8C" style={{ marginRight: '8px' }} /> info@skandanhomecarre.com</div>
            <div style={{ display: 'flex', alignItems: 'center' }}><Globe size={14} color="#0B2C8C" style={{ marginRight: '8px' }} /> www.skandanhomecarre.com</div>
          </div>
          <div style={{ flex: 1, paddingLeft: '10px', display: 'flex', flexDirection: 'column', gap: '4px', fontWeight: '500' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Invoice No.</span> <span>: {data.invoiceNumber}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Invoice Date</span> <span>: {data.invoiceDate}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Billing Period</span> <span>: {data.billingPeriodText}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Start Date</span> <span>: {data.startDateText}</span></div>
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
              {data.serviceStarted && <div style={{ display: 'flex' }}><span style={{ width: '80px', color: '#666' }}>Started On:</span> <span>{data.serviceStarted}</span></div>}
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
              <div style={{ display: 'flex' }}><span style={{ width: '100px', color: '#666' }}>Payment Status:</span> <span style={{ color: data.paymentStatus === 'PAID' ? 'green' : data.paymentStatus === 'PARTIAL' ? 'orange' : 'red', fontWeight: 'bold' }}>{data.paymentStatus}</span></div>
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
              <th style={{ padding: '8px', border: '1px solid #061A63', textAlign: 'center', width: '5%' }}>S.No</th>
              <th style={{ padding: '8px', border: '1px solid #061A63', textAlign: 'left', width: '40%' }}>Particulars / Service Details</th>
              <th style={{ padding: '8px', border: '1px solid #061A63', textAlign: 'right', width: '12%' }}>Rate (₹)</th>
              <th style={{ padding: '8px', border: '1px solid #061A63', textAlign: 'center', width: '10%' }}>Days</th>
              <th style={{ padding: '8px', border: '1px solid #061A63', textAlign: 'right', width: '12%' }}>Amount (₹)</th>
              <th style={{ padding: '8px', border: '1px solid #061A63', textAlign: 'right', width: '9%' }}>Other (₹)</th>
              <th style={{ padding: '8px', border: '1px solid #061A63', textAlign: 'right', width: '12%' }}>Total (₹)</th>
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
                <td style={{ padding: '8px', borderRight: '1px solid #D8E3F5', textAlign: 'right' }}>{service.rate.toFixed(2)}</td>
                <td style={{ padding: '8px', borderRight: '1px solid #D8E3F5', textAlign: 'center' }}>{service.days}</td>
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
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
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
                {data.gstAmount > 0 && (
                  <tr>
                    <td style={{ padding: '6px', borderBottom: '1px solid #eee', color: '#666' }}>GST</td>
                    <td style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: 'right' }}>₹ {data.gstAmount.toFixed(2)}</td>
                  </tr>
                )}
                {data.discountAmount > 0 && (
                  <tr>
                    <td style={{ padding: '6px', borderBottom: '1px solid #eee', color: '#666' }}>Discount</td>
                    <td style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: 'right', color: 'green' }}>- ₹ {data.discountAmount.toFixed(2)}</td>
                  </tr>
                )}
                <tr style={{ backgroundColor: '#F7F9FC' }}>
                  <td style={{ padding: '8px 6px', borderBottom: '1px solid #DCE7FF', fontWeight: 'bold', color: '#0B2C8C' }}>Total After GST</td>
                  <td style={{ padding: '8px 6px', borderBottom: '1px solid #DCE7FF', textAlign: 'right', fontWeight: 'bold', color: '#0B2C8C' }}>₹ {totalAfterGst.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style={{ padding: '6px', borderBottom: '1px solid #eee', color: '#666' }}>Advance Received</td>
                  <td style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: 'right' }}>₹ {data.advanceReceived.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 6px', fontWeight: 'bold', color: balanceDue > 0 ? '#d32f2f' : 'green' }}>Balance Due</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 'bold', color: balanceDue > 0 ? '#d32f2f' : 'green' }}>₹ {balanceDue.toFixed(2)}</td>
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
        <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
          {data.invoiceType === 'SCHOOL' ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', padding: '0 40px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ borderBottom: '1px solid #000', width: '150px', marginBottom: '8px' }}></div>
                <div style={{ fontSize: '12px', fontWeight: 'bold' }}>Principal Signature</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ borderBottom: '1px solid #000', width: '150px', marginBottom: '8px' }}></div>
                <div style={{ fontSize: '12px', fontWeight: 'bold' }}>AO Signature</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ borderBottom: '1px solid #000', width: '150px', marginBottom: '8px' }}></div>
                <div style={{ fontSize: '12px', fontWeight: 'bold' }}>AGM Signature</div>
              </div>
            </div>
          ) : (
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
                <img src="/assets/invoice/payment_methods.png" alt="Payment Methods" style={{ height: '15px', marginTop: '5px', objectFit: 'contain' }} />
              </div>

              {/* Seal */}
              <div style={{ flex: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/assets/invoice/skandan_verified_seal.png" alt="Verified Seal" style={{ height: '100px', objectFit: 'contain' }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer (Always at bottom) */}
      <div style={{ position: 'absolute', bottom: '20px', left: '30px', right: '30px' }}>
        <div style={{ textAlign: 'center', color: '#d32f2f', fontSize: '10px', fontStyle: 'italic', marginBottom: '10px' }}>
          This invoice is system generated. No signature is required.
        </div>
        
        <div style={{ borderTop: '2px solid #0B2C8C', paddingTop: '10px' }}>
          <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: 'bold', color: '#0B2C8C', marginBottom: '8px', letterSpacing: '1px' }}>
            OUR SERVICES
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#555' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}><Activity size={14} color="#1A4DD8" /><span>ICU Care at Home</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}><Stethoscope size={14} color="#1A4DD8" /><span>Doctor Visits</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}><HeartPulse size={14} color="#1A4DD8" /><span>Nursing Care</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}><UserCheck size={14} color="#1A4DD8" /><span>Caretaker Services</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}><Accessibility size={14} color="#1A4DD8" /><span>Physiotherapy</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}><TestTube size={14} color="#1A4DD8" /><span>Lab Tests at Home</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}><PlusSquare size={14} color="#1A4DD8" /><span>Medical Equipment Rental</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}><Pill size={14} color="#1A4DD8" /><span>Medicine Delivery</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}><Truck size={14} color="#1A4DD8" /><span>Post-Operative Care</span></div>
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
