import React from 'react';
import { Phone, Mail, Globe } from 'lucide-react';

export interface PayslipData {
  id?: string | number;
  payslipNumber?: string;
  month: string;
  year: number;
  generationDate: string;
  generationTime: string;

  // Employee details
  employeeId: string;
  employeeName: string;
  designation: string;
  gradeLevel: string;
  location: string;
  department: string;
  bankName: string;
  bankAccountNumber: string;
  panNumber: string;
  pfAccountNumber: string;
  dateOfJoining: string;
  daysWorked: number;
  lopDays: number;
  arrearsDays: number;
  esicAccountNumber: string;
  uanNumber: string;

  // Earnings
  basicSalary: number;
  conveyanceAllowance: number;
  houseRentAllowance: number;
  othersAllowance: number;
  incentives: number;

  // Deductions
  professionalTax: number;
  providentFund: number;
  esicDeduction?: number;
  tdsDeduction?: number;
  otherDeductions?: number;

  // Custom remarks / notes
  notes?: string;
  cloudinary_pdf_url?: string;
}

export function computePayslipTotals(data: PayslipData) {
  const totalEarnings =
    (Number(data.basicSalary) || 0) +
    (Number(data.conveyanceAllowance) || 0) +
    (Number(data.houseRentAllowance) || 0) +
    (Number(data.othersAllowance) || 0) +
    (Number(data.incentives) || 0);

  const totalDeductions =
    (Number(data.professionalTax) || 0) +
    (Number(data.providentFund) || 0) +
    (Number(data.esicDeduction) || 0) +
    (Number(data.tdsDeduction) || 0) +
    (Number(data.otherDeductions) || 0);

  const netSalary = Math.max(0, totalEarnings - totalDeductions);

  return {
    totalEarnings,
    totalDeductions,
    netSalary,
  };
}

export function formatCurrency(amount: number | string | undefined): string {
  const num = Number(amount) || 0;
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function numToWordsUpper(amount: number): string {
  if (!amount || amount === 0) return 'ZERO RUPEES ONLY';

  const a = ['', 'ONE ', 'TWO ', 'THREE ', 'FOUR ', 'FIVE ', 'SIX ', 'SEVEN ', 'EIGHT ', 'NINE ', 'TEN ', 'ELEVEN ', 'TWELVE ', 'THIRTEEN ', 'FOURTEEN ', 'FIFTEEN ', 'SIXTEEN ', 'SEVENTEEN ', 'EIGHTEEN ', 'NINETEEN '];
  const b = ['', '', 'TWENTY ', 'THIRTY ', 'FORTY ', 'FIFTY ', 'SIXTY ', 'SEVENTY ', 'EIGHTY ', 'NINETY '];

  const inWords = (num: number): string => {
    let str = '';
    if (num > 99) {
      str += a[Math.floor(num / 100)] + 'HUNDRED ';
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

  let num = Math.round(amount);
  let str = '';

  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;

  if (crore > 0) str += inWords(crore) + 'CRORE ';
  if (lakh > 0) str += inWords(lakh) + 'LAKH ';
  if (thousand > 0) str += inWords(thousand) + 'THOUSAND ';
  if (num > 0) str += inWords(num);

  const words = str.trim();
  return words ? `${words} RUPEES ONLY` : 'ZERO RUPEES ONLY';
}

interface PayslipLivePreviewProps {
  data: PayslipData;
  zoom?: number;
}

export const PayslipLivePreview: React.FC<PayslipLivePreviewProps> = ({ data, zoom = 100 }) => {
  const { totalEarnings, totalDeductions, netSalary } = computePayslipTotals(data);
  const amountInWords = numToWordsUpper(netSalary);

  const monthUpper = (data.month || 'JULY').toUpperCase();
  const yearStr = String(data.year || 2026);
  const genDateStr = data.generationDate || '07-08-2026';
  const genTimeStr = data.generationTime || '05:15 PM';

  const fontTimes = '"Times New Roman", Times, "Liberation Serif", serif';
  const fontHeader = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  return (
    <div
      className="payslip-preview-card"
      style={{
        width: '794px',
        backgroundColor: '#ffffff',
        boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
        margin: '0 auto',
        padding: '30px 35px 25px 35px',
        boxSizing: 'border-box',
        color: '#111827',
        transform: `scale(${zoom / 100})`,
        transformOrigin: 'top center',
        position: 'relative',
        borderRadius: '2px',
      }}
    >
      {/* Outer Border Box - hugs content naturally so no large awkward empty bottom gap */}
      <div
        style={{
          border: '1px solid #111827',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          backgroundColor: '#fff',
        }}
      >
        {/* Top Header - Sans-Serif */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px 10px 16px',
            borderBottom: '1px solid #111827',
            fontFamily: fontHeader,
          }}
        >
          {/* Logo */}
          <div style={{ flex: '0 0 auto' }}>
            <img
              src="/assets/payslip/skandan_payslip_logo.png"
              alt="Skandan Logo"
              style={{
                height: '48px',
                maxWidth: '190px',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>

          {/* Company Title - Strictly one line */}
          <div style={{ flex: '1 1 auto', textAlign: 'center', padding: '0 8px', minWidth: 0 }}>
            <h2
              style={{
                margin: 0,
                fontSize: '15.5px',
                fontWeight: 800,
                color: '#0B2C8C',
                letterSpacing: '0.02em',
                fontFamily: fontHeader,
                whiteSpace: 'nowrap',
              }}
            >
              SKANDAN HOME CARRE CCLINIC LLP
            </h2>
          </div>

          {/* Contact Details */}
          <div
            style={{
              flex: '0 0 auto',
              textAlign: 'right',
              fontSize: '9.5px',
              fontWeight: 600,
              lineHeight: 1.4,
              color: '#1f2937',
              fontFamily: fontHeader,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
              <span>+91 96609 66369</span>
              <Phone size={11} color="#b91c1c" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
              <span>skandanhomecarre.com</span>
              <Globe size={11} color="#b91c1c" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
              <span>admin@skandanhomecarre.com</span>
              <Mail size={11} color="#b91c1c" />
            </div>
          </div>
        </div>

        {/* Payslip Month Banner - Times New Roman */}
        <div
          style={{
            textAlign: 'center',
            padding: '7px 0',
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: '#111827',
            borderBottom: '1px solid #111827',
            backgroundColor: '#ffffff',
            fontFamily: fontTimes,
          }}
        >
          PAYSLIP FOR THE MONTH OF {monthUpper} {yearStr}
        </div>

        {/* Employee Details 2-Column Grid - Laser-Straight 50/50 Split */}
        <div style={{ borderBottom: '1px solid #111827', fontSize: '11px', fontFamily: fontTimes }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontFamily: fontTimes }}>
            <colgroup>
              <col style={{ width: '22%' }} />
              <col style={{ width: '28%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '28%' }} />
            </colgroup>
            <tbody>
              {/* Row 1 */}
              <tr>
                <td style={{ padding: '3.5px 8px', color: '#4b5563', fontFamily: fontTimes }}>Employee Code</td>
                <td style={{ padding: '3.5px 8px', fontWeight: 700, borderRight: '1px solid #111827', fontFamily: fontTimes }}>
                  {data.employeeId || '—'}
                </td>
                <td style={{ padding: '3.5px 8px', color: '#4b5563', fontFamily: fontTimes }}>Employee Name</td>
                <td style={{ padding: '3.5px 8px', fontWeight: 700, fontFamily: fontTimes }}>
                  {data.employeeName || '—'}
                </td>
              </tr>
              {/* Row 2 */}
              <tr>
                <td style={{ padding: '3.5px 8px', color: '#4b5563', fontFamily: fontTimes }}>Designation</td>
                <td style={{ padding: '3.5px 8px', fontWeight: 700, borderRight: '1px solid #111827', fontFamily: fontTimes }}>
                  {data.designation || '—'}
                </td>
                <td style={{ padding: '3.5px 8px', color: '#4b5563', fontFamily: fontTimes }}>Grade / Level</td>
                <td style={{ padding: '3.5px 8px', fontWeight: 700, fontFamily: fontTimes }}>
                  {data.gradeLevel || 'AA / II'}
                </td>
              </tr>
              {/* Row 3 */}
              <tr>
                <td style={{ padding: '3.5px 8px', color: '#4b5563', fontFamily: fontTimes }}>Location</td>
                <td style={{ padding: '3.5px 8px', fontWeight: 700, borderRight: '1px solid #111827', fontFamily: fontTimes }}>
                  {data.location || 'TELANGANA'}
                </td>
                <td style={{ padding: '3.5px 8px', color: '#4b5563', fontFamily: fontTimes }}>Department</td>
                <td style={{ padding: '3.5px 8px', fontWeight: 700, fontFamily: fontTimes }}>
                  {data.department || 'OPERATIONS'}
                </td>
              </tr>
              {/* Row 4 */}
              <tr>
                <td style={{ padding: '3.5px 8px', color: '#4b5563', fontFamily: fontTimes }}>Bank Name</td>
                <td style={{ padding: '3.5px 8px', fontWeight: 700, borderRight: '1px solid #111827', fontFamily: fontTimes }}>
                  {data.bankName || 'SBI'}
                </td>
                <td style={{ padding: '3.5px 8px', color: '#4b5563', fontFamily: fontTimes }}>Bank Account Number</td>
                <td style={{ padding: '3.5px 8px', fontWeight: 700, fontFamily: fontTimes }}>
                  {data.bankAccountNumber || '—'}
                </td>
              </tr>
              {/* Row 5 */}
              <tr>
                <td style={{ padding: '3.5px 8px', color: '#4b5563', fontFamily: fontTimes }}>PAN Number</td>
                <td style={{ padding: '3.5px 8px', fontWeight: 700, borderRight: '1px solid #111827', fontFamily: fontTimes }}>
                  {data.panNumber || 'NA'}
                </td>
                <td style={{ padding: '3.5px 8px', color: '#4b5563', fontFamily: fontTimes }}>PF Account Number</td>
                <td style={{ padding: '3.5px 8px', fontWeight: 700, fontFamily: fontTimes }}>
                  {data.pfAccountNumber || 'NA'}
                </td>
              </tr>
              {/* Row 6 */}
              <tr>
                <td style={{ padding: '3.5px 8px', color: '#4b5563', fontFamily: fontTimes }}>Date of Joining</td>
                <td style={{ padding: '3.5px 8px', fontWeight: 700, borderRight: '1px solid #111827', fontFamily: fontTimes }}>
                  {data.dateOfJoining || '—'}
                </td>
                <td style={{ padding: '3.5px 8px', color: '#4b5563', fontFamily: fontTimes }}>Days Worked</td>
                <td style={{ padding: '3.5px 8px', fontWeight: 700, fontFamily: fontTimes }}>
                  {data.daysWorked ?? 30}
                </td>
              </tr>
              {/* Row 7 */}
              <tr>
                <td style={{ padding: '3.5px 8px', color: '#4b5563', fontFamily: fontTimes }}>LOP</td>
                <td style={{ padding: '3.5px 8px', fontWeight: 700, borderRight: '1px solid #111827', fontFamily: fontTimes }}>
                  {String(data.lopDays ?? 0).padStart(2, '0')}
                </td>
                <td style={{ padding: '3.5px 8px', color: '#4b5563', fontFamily: fontTimes }}>ESIC Account Number</td>
                <td style={{ padding: '3.5px 8px', fontWeight: 700, fontFamily: fontTimes }}>
                  {data.esicAccountNumber || 'NA'}
                </td>
              </tr>
              {/* Row 8 */}
              <tr>
                <td style={{ padding: '3.5px 8px', color: '#4b5563', fontFamily: fontTimes }}>Arrears Days</td>
                <td style={{ padding: '3.5px 8px', fontWeight: 700, borderRight: '1px solid #111827', fontFamily: fontTimes }}>
                  {data.arrearsDays ?? 0}
                </td>
                <td style={{ padding: '3.5px 8px', color: '#4b5563', fontFamily: fontTimes }}>UAN Number</td>
                <td style={{ padding: '3.5px 8px', fontWeight: 700, fontFamily: fontTimes }}>
                  {data.uanNumber || 'NA'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Earnings & Deductions Table Header - Laser-Straight 50/50 Split */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #111827',
            fontSize: '12px',
            fontWeight: 800,
            color: '#16a34a',
            letterSpacing: '0.05em',
            fontFamily: fontTimes,
          }}
        >
          <div
            style={{
              width: '50%',
              flex: '0 0 50%',
              boxSizing: 'border-box',
              textAlign: 'center',
              padding: '6px 0',
              borderRight: '1px solid #111827',
              fontFamily: fontTimes,
            }}
          >
            EARNINGS
          </div>
          <div
            style={{
              width: '50%',
              flex: '0 0 50%',
              boxSizing: 'border-box',
              textAlign: 'center',
              padding: '6px 0',
              fontFamily: fontTimes,
            }}
          >
            DEDUCTIONS
          </div>
        </div>

        {/* Earnings & Deductions Body Rows - Laser-Straight 50/50 Split */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #111827',
            fontSize: '11px',
            fontFamily: fontTimes,
          }}
        >
          {/* Earnings Column */}
          <div
            style={{
              width: '50%',
              flex: '0 0 50%',
              boxSizing: 'border-box',
              borderRight: '1px solid #111827',
              padding: '8px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4.5px',
              fontFamily: fontTimes,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: fontTimes }}>
              <span style={{ color: '#111827', fontWeight: 700, fontFamily: fontTimes }}>BASIC SALARY</span>
              <span style={{ fontWeight: 500, fontFamily: fontTimes }}>{formatCurrency(data.basicSalary)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: fontTimes }}>
              <span style={{ color: '#111827', fontWeight: 700, fontFamily: fontTimes }}>CONVEYANCE ALLOWANCE</span>
              <span style={{ fontWeight: 500, fontFamily: fontTimes }}>{formatCurrency(data.conveyanceAllowance)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: fontTimes }}>
              <span style={{ color: '#111827', fontWeight: 700, fontFamily: fontTimes }}>HOUSE RENT ALLOWANCE</span>
              <span style={{ fontWeight: 500, fontFamily: fontTimes }}>{formatCurrency(data.houseRentAllowance)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: fontTimes }}>
              <span style={{ color: '#111827', fontWeight: 700, fontFamily: fontTimes }}>OTHERS</span>
              <span style={{ fontWeight: 500, fontFamily: fontTimes }}>{formatCurrency(data.othersAllowance)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: fontTimes }}>
              <span style={{ color: '#111827', fontWeight: 700, fontFamily: fontTimes }}>INCENTIVES</span>
              <span style={{ fontWeight: 500, fontFamily: fontTimes }}>{formatCurrency(data.incentives)}</span>
            </div>
          </div>

          {/* Deductions Column */}
          <div
            style={{
              width: '50%',
              flex: '0 0 50%',
              boxSizing: 'border-box',
              padding: '8px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4.5px',
              fontFamily: fontTimes,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: fontTimes }}>
              <span style={{ color: '#111827', fontWeight: 700, fontFamily: fontTimes }}>PROFESSIONAL TAX</span>
              <span style={{ fontWeight: 500, fontFamily: fontTimes }}>{formatCurrency(data.professionalTax)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: fontTimes }}>
              <span style={{ color: '#111827', fontWeight: 700, fontFamily: fontTimes }}>PROVIDENT FUND</span>
              <span style={{ fontWeight: 500, fontFamily: fontTimes }}>{formatCurrency(data.providentFund)}</span>
            </div>
            {Number(data.esicDeduction || 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: fontTimes }}>
                <span style={{ color: '#111827', fontWeight: 700, fontFamily: fontTimes }}>ESIC</span>
                <span style={{ fontWeight: 500, fontFamily: fontTimes }}>{formatCurrency(data.esicDeduction)}</span>
              </div>
            )}
            {Number(data.tdsDeduction || 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: fontTimes }}>
                <span style={{ color: '#111827', fontWeight: 700, fontFamily: fontTimes }}>TDS</span>
                <span style={{ fontWeight: 500, fontFamily: fontTimes }}>{formatCurrency(data.tdsDeduction)}</span>
              </div>
            )}
            {Number(data.otherDeductions || 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: fontTimes }}>
                <span style={{ color: '#111827', fontWeight: 700, fontFamily: fontTimes }}>OTHER DEDUCTIONS</span>
                <span style={{ fontWeight: 500, fontFamily: fontTimes }}>{formatCurrency(data.otherDeductions)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Totals Row - Laser-Straight 50/50 Split */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #111827',
            fontSize: '11px',
            fontWeight: 700,
            fontFamily: fontTimes,
          }}
        >
          <div
            style={{
              width: '50%',
              flex: '0 0 50%',
              boxSizing: 'border-box',
              display: 'flex',
              justifyContent: 'space-between',
              padding: '6px 14px',
              borderRight: '1px solid #111827',
              backgroundColor: '#fafafa',
              fontFamily: fontTimes,
            }}
          >
            <span style={{ fontFamily: fontTimes }}>TOTAL EARNINGS</span>
            <span style={{ fontFamily: fontTimes }}>{formatCurrency(totalEarnings)}</span>
          </div>
          <div
            style={{
              width: '50%',
              flex: '0 0 50%',
              boxSizing: 'border-box',
              display: 'flex',
              justifyContent: 'space-between',
              padding: '6px 14px',
              backgroundColor: '#fafafa',
              fontFamily: fontTimes,
            }}
          >
            <span style={{ fontFamily: fontTimes }}>TOTAL DEDUCTIONS</span>
            <span style={{ fontFamily: fontTimes }}>{formatCurrency(totalDeductions)}</span>
          </div>
        </div>

        {/* Net Salary & In Words Row - Laser-Straight 50/50 Split */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #111827',
            fontSize: '10.5px',
            alignItems: 'center',
            fontFamily: fontTimes,
          }}
        >
          {/* Left: In Words */}
          <div
            style={{
              width: '50%',
              flex: '0 0 50%',
              boxSizing: 'border-box',
              padding: '7px 12px',
              borderRight: '1px solid #111827',
              lineHeight: 1.35,
              fontWeight: 700,
              color: '#111827',
              textTransform: 'uppercase',
              fontFamily: fontTimes,
            }}
          >
            IN-WORDS:{amountInWords} ₹
          </div>

          {/* Right: Net Salary */}
          <div
            style={{
              width: '50%',
              flex: '0 0 50%',
              boxSizing: 'border-box',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '7px 14px',
              fontSize: '11.5px',
              fontWeight: 700,
              backgroundColor: '#ffffff',
              fontFamily: fontTimes,
            }}
          >
            <span style={{ color: '#111827', fontFamily: fontTimes }}>NET SALARY</span>
            <span style={{ color: '#111827', fontSize: '12px', fontWeight: 800, fontFamily: fontTimes }}>
              {formatCurrency(netSalary)}
            </span>
          </div>
        </div>

        {/* Bottom Note - Sans-Serif */}
        <div
          style={{
            padding: '5px 10px',
            fontSize: '8px',
            fontWeight: 700,
            color: '#4b5563',
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
            backgroundColor: '#ffffff',
            fontFamily: fontHeader,
          }}
        >
          NOTE: THIS DOCUMENT IS COMPUTER GENERATED, DATE {genDateStr} AT {genTimeStr}. (NO SIGNATURE REQUIRED)
        </div>
      </div>

      {/* Colorful Bottom Accent Bar */}
      <div
        style={{
          height: '4px',
          width: '100%',
          marginTop: '6px',
          background: 'linear-gradient(90deg, #00C0F3 0%, #E91E63 35%, #FFC107 70%, #6B2FA0 100%)',
          borderRadius: '2px',
        }}
      />
    </div>
  );
};
