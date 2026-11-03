import io
import re
import zipfile
from datetime import datetime
from django.utils import timezone
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from apps.invoices.pdf_service import generate_invoice_pdf


def sanitize_filename_part(text: str, default: str = "Client") -> str:
    """
    Sanitize a string so it can safely be used in a file name across Windows, Mac, and Linux.
    Removes invalid characters: \\ / : * ? " < > |
    """
    if not text or not str(text).strip():
        return default
    # Replace illegal filesystem characters
    clean = re.sub(r'[\\/*?:"<>|]', '_', str(text).strip())
    # Collapse multiple consecutive underscores or spaces
    clean = re.sub(r'_+', '_', clean).strip(' ._')
    return clean or default


def get_invoice_month_3(invoice) -> str:
    """
    Extract the 3-letter month abbreviation for the invoice (e.g. Oct, Nov, Jan).
    Checks billing_period_text first, then invoice_date, then other date fields.
    """
    bp_text = str(getattr(invoice, "billing_period_text", "") or "").strip()
    month_map = {
        "january": "Jan", "jan": "Jan",
        "february": "Feb", "feb": "Feb",
        "march": "Mar", "mar": "Mar",
        "april": "Apr", "apr": "Apr",
        "may": "May",
        "june": "Jun", "jun": "Jun",
        "july": "Jul", "jul": "Jul",
        "august": "Aug", "aug": "Aug",
        "september": "Sep", "sep": "Sep",
        "october": "Oct", "oct": "Oct",
        "november": "Nov", "nov": "Nov",
        "december": "Dec", "dec": "Dec",
    }
    if bp_text:
        for token in bp_text.replace("/", " ").replace("-", " ").replace(",", " ").split():
            t_lower = token.lower()
            if t_lower in month_map:
                return month_map[t_lower]

    inv_date = getattr(invoice, "invoice_date", None)
    if inv_date:
        if isinstance(inv_date, str):
            try:
                from datetime import datetime
                inv_date = datetime.strptime(inv_date[:10], "%Y-%m-%d").date()
            except Exception:
                pass
        if hasattr(inv_date, "strftime"):
            return inv_date.strftime("%b")

    for start_attr in ["billing_period_start", "service_start_date", "start_date", "created_at"]:
        val = getattr(invoice, start_attr, None)
        if val:
            if hasattr(val, "strftime"):
                return val.strftime("%b")
            elif isinstance(val, str):
                try:
                    from datetime import datetime
                    d = datetime.strptime(val[:10], "%Y-%m-%d").date()
                    return d.strftime("%b")
                except Exception:
                    pass

    return timezone.localdate().strftime("%b")


def generate_invoices_zip(invoices) -> bytes:
    """
    Generate a ZIP archive containing all invoice PDFs for the given list of invoices.
    Each PDF is named: {Month(3 letters)}_{invoicenumber}_{Clientname}.pdf
    """
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        used_names = set()
        for inv in invoices:
            try:
                pdf_bytes = generate_invoice_pdf(inv)
                month_3 = get_invoice_month_3(inv)
                safe_client = sanitize_filename_part(inv.client_name, default="Client")
                safe_inv_num = sanitize_filename_part(inv.invoice_number, default=f"INV_{inv.id}")
                
                base_name = f"{month_3}_{safe_inv_num}_{safe_client}.pdf"
                pdf_name = base_name
                counter = 1
                while pdf_name in used_names:
                    pdf_name = f"{month_3}_{safe_inv_num}_{safe_client}_{counter}.pdf"
                    counter += 1
                used_names.add(pdf_name)

                zf.writestr(pdf_name, pdf_bytes)
            except Exception as e:
                print(f"[ZIP GENERATION] Error rendering PDF for invoice {inv.invoice_number}: {e}")

    return buf.getvalue()


def generate_invoices_excel(invoices, month_labels: str = "") -> bytes:
    """
    Generate an executive HR-themed Excel report containing all invoice data in a single sheet.
    The Client Name and Total Amount columns are fixed (frozen panes) and prominent.
    """
    wb = Workbook()
    ws = wb.active
    ws.title = "Invoices Report"

    # Ensure grid lines are visible
    ws.views.sheetView[0].showGridLines = True

    # Company & Report Header Block (Rows 1 - 4)
    ws.cell(row=1, column=1, value="Skandan Home Carre Clinic LLP").font = Font(
        name="Calibri", size=16, bold=True, color="1F497D"
    )
    ws.cell(row=2, column=1, value="Invoices & Billing Summary Report").font = Font(
        name="Calibri", size=13, bold=True, color="595959"
    )
    
    selected_period = month_labels if month_labels else "All Invoices"
    ws.cell(row=3, column=1, value=f"Selected Month(s): {selected_period}").font = Font(
        name="Calibri", size=11, italic=True, color="333333"
    )
    
    now_str = timezone.localtime(timezone.now()).strftime("%d-%b-%Y %I:%M %p")
    ws.cell(
        row=4,
        column=1,
        value=f"Generated On: {now_str} | Total Invoices: {len(invoices)} | Generated By: HR Admin",
    ).font = Font(name="Calibri", size=10, color="7F7F7F")

    # Table Column Headers (Row 6)
    headers = [
        "Sl No",                     # Col 1 (A)
        "Invoice No",                # Col 2 (B)
        "Client Name",               # Col 3 (C)  <- Fixed column
        "Total Amount (₹)",          # Col 4 (D)  <- Fixed column
        "Payment Status",            # Col 5 (E)
        "Invoice Date",              # Col 6 (F)
        "Billing Period",            # Col 7 (G)
        "Invoice Type",              # Col 8 (H)
        "Patient / Recipient",       # Col 9 (I)
        "Contact Number",            # Col 10 (J)
        "Client Address",            # Col 11 (K)
        "Client GSTIN",              # Col 12 (L)
        "Service Type",              # Col 13 (M)
        "Rendered Days",             # Col 14 (N)
        "Per Day Charges (₹)",       # Col 15 (O)
        "Subtotal (₹)",              # Col 16 (P)
        "GST Rate (%)",              # Col 17 (Q)
        "GST Amount (₹)",            # Col 18 (R)
        "Discount (₹)",              # Col 19 (S)
        "Old Dues (₹)",              # Col 20 (T)
        "Advance Received (₹)",      # Col 21 (U)
        "Balance Due (₹)",           # Col 22 (V)
        "Verification Display Hash", # Col 23 (W)
    ]

    header_fill = PatternFill(start_color="1F497D", end_color="1F497D", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    
    thin_border = Border(
        left=Side(style="thin", color="D9D9D9"),
        right=Side(style="thin", color="D9D9D9"),
        top=Side(style="thin", color="D9D9D9"),
        bottom=Side(style="thin", color="D9D9D9"),
    )

    center_align = Alignment(horizontal="center", vertical="center")
    left_align = Alignment(horizontal="left", vertical="center")
    right_align = Alignment(horizontal="right", vertical="center")

    for col_idx, h in enumerate(headers, 1):
        cell = ws.cell(row=6, column=col_idx, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = center_align
        cell.border = thin_border
    ws.row_dimensions[6].height = 28

    # Styling definitions for data cells
    client_font = Font(name="Calibri", size=10, bold=True, color="0B2C8C")
    inv_no_font = Font(name="Calibri", size=10, bold=True, color="1F2937")
    total_fill = PatternFill(start_color="EDF4FE", end_color="EDF4FE", fill_type="solid")
    total_font = Font(name="Calibri", size=11, bold=True, color="0B2C8C")
    reg_font = Font(name="Calibri", size=10, color="222222")
    zebra_fill = PatternFill(start_color="F9FAFB", end_color="F9FAFB", fill_type="solid")

    # Data Rows
    for i, inv in enumerate(invoices, 1):
        r = 6 + i
        ws.row_dimensions[r].height = 22
        row_is_even = (i % 2 == 0)

        # 1. Sl No
        c = ws.cell(row=r, column=1, value=i)
        c.alignment = center_align
        c.font = reg_font
        c.border = thin_border

        # 2. Invoice No
        c = ws.cell(row=r, column=2, value=inv.invoice_number)
        c.alignment = center_align
        c.font = inv_no_font
        c.border = thin_border

        # 3. Client Name (Fixed Column)
        c = ws.cell(row=r, column=3, value=inv.client_name or "-")
        c.alignment = left_align
        c.font = client_font
        c.border = thin_border

        # 4. Total Amount (Fixed Column)
        c = ws.cell(row=r, column=4, value=float(inv.grand_total or 0))
        c.alignment = right_align
        c.font = total_font
        c.fill = total_fill
        c.number_format = "#,##0.00"
        c.border = thin_border

        # 5. Payment Status
        status_val = inv.payment_status or "Pending"
        c = ws.cell(row=r, column=5, value=status_val)
        c.alignment = center_align
        c.border = thin_border
        status_str = status_val.upper()
        if "PAID" in status_str and "NOT" not in status_str and "UN" not in status_str:
            c.font = Font(name="Calibri", size=10, bold=True, color="15803D")
        elif "UNPAID" in status_str or "DUE" in status_str:
            c.font = Font(name="Calibri", size=10, bold=True, color="DC2626")
        else:
            c.font = Font(name="Calibri", size=10, bold=True, color="B45309")

        # 6. Invoice Date
        inv_dt = inv.invoice_date.strftime("%d-%b-%Y") if inv.invoice_date else "-"
        c = ws.cell(row=r, column=6, value=inv_dt)
        c.alignment = center_align
        c.font = reg_font
        c.border = thin_border

        # 7. Billing Period
        c = ws.cell(row=r, column=7, value=inv.billing_period_text or "-")
        c.alignment = left_align
        c.font = reg_font
        c.border = thin_border

        # 8. Invoice Type
        inv_type = inv.get_invoice_type_display() if hasattr(inv, "get_invoice_type_display") else (inv.invoice_type or "Regular")
        c = ws.cell(row=r, column=8, value=str(inv_type).replace("_", " "))
        c.alignment = left_align
        c.font = reg_font
        c.border = thin_border

        # 9. Patient / Recipient
        person = inv.patient_name or inv.contact_person or "-"
        c = ws.cell(row=r, column=9, value=person)
        c.alignment = left_align
        c.font = reg_font
        c.border = thin_border

        # 10. Contact Number
        c = ws.cell(row=r, column=10, value=inv.client_contact or "-")
        c.alignment = center_align
        c.font = reg_font
        c.border = thin_border

        # 11. Client Address
        c = ws.cell(row=r, column=11, value=inv.client_address or "-")
        c.alignment = left_align
        c.font = reg_font
        c.border = thin_border

        # 12. Client GSTIN
        c = ws.cell(row=r, column=12, value=inv.client_gst or "-")
        c.alignment = center_align
        c.font = reg_font
        c.border = thin_border

        # 13. Service Type
        c = ws.cell(row=r, column=13, value=inv.service_type or "-")
        c.alignment = left_align
        c.font = reg_font
        c.border = thin_border

        # 14. Rendered Days
        c = ws.cell(row=r, column=14, value=inv.rendered_days or "-")
        c.alignment = center_align
        c.font = reg_font
        c.border = thin_border

        # 15. Per Day Charges
        c = ws.cell(row=r, column=15, value=float(inv.per_day_charges or 0))
        c.alignment = right_align
        c.font = reg_font
        c.number_format = "#,##0.00"
        c.border = thin_border

        # 16. Subtotal
        c = ws.cell(row=r, column=16, value=float(inv.subtotal or 0))
        c.alignment = right_align
        c.font = reg_font
        c.number_format = "#,##0.00"
        c.border = thin_border

        # 17. GST Rate
        gst_r = f"{inv.gst_rate}%" if inv.gst_rate else "0%"
        c = ws.cell(row=r, column=17, value=gst_r)
        c.alignment = center_align
        c.font = reg_font
        c.border = thin_border

        # 18. GST Amount
        c = ws.cell(row=r, column=18, value=float(inv.gst or 0))
        c.alignment = right_align
        c.font = reg_font
        c.number_format = "#,##0.00"
        c.border = thin_border

        # 19. Discount
        c = ws.cell(row=r, column=19, value=float(inv.discount or 0))
        c.alignment = right_align
        c.font = reg_font
        c.number_format = "#,##0.00"
        c.border = thin_border

        # 20. Old Dues
        c = ws.cell(row=r, column=20, value=float(getattr(inv, "old_dues", 0) or 0))
        c.alignment = right_align
        c.font = reg_font
        c.number_format = "#,##0.00"
        c.border = thin_border

        # 21. Advance Received
        c = ws.cell(row=r, column=21, value=float(inv.advance_received or 0))
        c.alignment = right_align
        c.font = reg_font
        c.number_format = "#,##0.00"
        c.border = thin_border

        # 22. Balance Due
        c = ws.cell(row=r, column=22, value=float(inv.balance_due or 0))
        c.alignment = right_align
        c.font = reg_font
        c.number_format = "#,##0.00"
        c.border = thin_border

        # 23. Verification Display Hash
        c = ws.cell(row=r, column=23, value=inv.display_hash or "-")
        c.alignment = center_align
        c.font = Font(name="Consolas", size=9, color="555555")
        c.border = thin_border

        # Apply subtle zebra fill on other columns if even row
        if row_is_even:
            for col_idx in range(1, len(headers) + 1):
                if col_idx != 4:  # Don't overwrite the Total Amount special fill
                    ws.cell(row=r, column=col_idx).fill = zebra_fill

    # Freeze Panes at column E and row 7:
    # Freezes Columns A, B, C, D (Sl No, Invoice No, Client Name, Total Amount)
    # AND Rows 1 to 6 (Header info & column titles)
    ws.freeze_panes = "E7"

    # Summary Row at bottom
    last_data_row = 6 + len(invoices)
    total_row = last_data_row + 1
    ws.row_dimensions[total_row].height = 26

    summary_border = Border(
        top=Side(style="thin", color="1F497D"),
        bottom=Side(style="double", color="1F497D"),
        left=Side(style="thin", color="D9D9D9"),
        right=Side(style="thin", color="D9D9D9"),
    )

    for col in range(1, len(headers) + 1):
        cell = ws.cell(row=total_row, column=col)
        cell.border = summary_border

    # Col C: Total label
    c_summary_label = ws.cell(row=total_row, column=3, value=f"TOTAL ({len(invoices)} INVOICES)")
    c_summary_label.font = Font(name="Calibri", size=11, bold=True, color="1F497D")
    c_summary_label.alignment = left_align

    # Col D: Total Amount SUM
    c_total_amt = ws.cell(row=total_row, column=4, value=f"=SUM(D7:D{last_data_row})")
    c_total_amt.font = Font(name="Calibri", size=12, bold=True, color="0B2C8C")
    c_total_amt.fill = PatternFill(start_color="DCE7FF", end_color="DCE7FF", fill_type="solid")
    c_total_amt.number_format = "#,##0.00"
    c_total_amt.alignment = right_align

    # Formula sums for numeric columns
    for sum_col in [16, 18, 19, 20, 21, 22]:
        col_letter = get_column_letter(sum_col)
        c = ws.cell(row=total_row, column=sum_col, value=f"=SUM({col_letter}7:{col_letter}{last_data_row})")
        c.font = Font(name="Calibri", size=10, bold=True, color="1F497D")
        c.number_format = "#,##0.00"
        c.alignment = right_align

    # Set column widths
    col_widths = {
        1: 8,   # Sl No
        2: 16,  # Invoice No
        3: 32,  # Client Name (Fixed)
        4: 20,  # Total Amount (Fixed)
        5: 16,  # Payment Status
        6: 14,  # Invoice Date
        7: 22,  # Billing Period
        8: 22,  # Invoice Type
        9: 24,  # Patient / Recipient
        10: 16, # Contact
        11: 32, # Address
        12: 18, # GSTIN
        13: 24, # Service Type
        14: 15, # Rendered Days
        15: 18, # Per Day
        16: 18, # Subtotal
        17: 13, # GST Rate
        18: 16, # GST Amount
        19: 16, # Discount
        20: 16, # Old Dues
        21: 18, # Advance
        22: 18, # Balance Due
        23: 20, # Display Hash
    }
    for col_idx, width in col_widths.items():
        ws.column_dimensions[get_column_letter(col_idx)].width = width

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
