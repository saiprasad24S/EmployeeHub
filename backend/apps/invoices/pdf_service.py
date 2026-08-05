import os
import re
from io import BytesIO
from django.conf import settings
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

UNITS = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
         "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

def num_to_words(n: int) -> str:
    if n == 0:
        return "Zero"
    if n < 0:
        return "Minus " + num_to_words(abs(n))
    
    words = ""
    if n >= 10000000:
        words += num_to_words(n // 10000000) + " Crore "
        n %= 10000000
    if n >= 100000:
        words += num_to_words(n // 100000) + " Lakh "
        n %= 100000
    if n >= 1000:
        words += num_to_words(n // 1000) + " Thousand "
        n %= 1000
    if n >= 100:
        words += num_to_words(n // 100) + " Hundred "
        n %= 100
    if n > 0:
        if n < 20:
            words += UNITS[n] + " "
        else:
            words += TENS[n // 10] + " " + UNITS[n % 10] + " "
            
    return words.strip()

def amount_in_rupees_words(amount_val) -> str:
    try:
        val = int(round(float(amount_val)))
        if val <= 0:
            return "Zero Rupees Only"
        words = num_to_words(val)
        return f"{words} Rupees Only"
    except Exception:
        return "Zero Rupees Only"


def format_date_ddmmyyyy(val) -> str:
    if not val:
        return ""
    if hasattr(val, "strftime"):
        return val.strftime("%d/%m/%Y")
    val_str = str(val).strip()
    if not val_str:
        return ""
    m = re.match(r"^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})", val_str)
    if m:
        yyyy, mm, dd = m.groups()
        return f"{int(dd):02d}/{int(mm):02d}/{yyyy}"
    return val_str


def generate_invoice_pdf(invoice) -> bytes:
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4 # 595.27 x 841.89 pt

    inv_type = str(getattr(invoice, "invoice_type", "REGULAR"))
    services = getattr(invoice, "services_data", []) or []

    assets_dir = os.path.join(settings.BASE_DIR, "static", "invoice")
    logo_path = os.path.join(assets_dir, "skandan_logo.png")
    hdfc_logo_path = os.path.join(assets_dir, "hdfc_logo.png")
    qr_path = os.path.join(assets_dir, "payment_qr_clean.png")
    seal_path = os.path.join(assets_dir, "skandan_verified_seal.png")

    inv_num_str = str(getattr(invoice, "invoice_number", "1369-0001"))
    inv_date_str = format_date_ddmmyyyy(getattr(invoice, "invoice_date", None))
    start_date_str = format_date_ddmmyyyy(getattr(invoice, "start_date", None))
    billing_period_str = str(getattr(invoice, "billing_period_text", "")) or "Monthly"

    disp_hash = getattr(invoice, "display_hash", None) or (getattr(invoice, "verification_hash", "")[:16] if getattr(invoice, "verification_hash", None) else "8A0D4C6E6E7F91C2")

    # Financials calculation
    subtotal = sum(float(item.get("total", 0) or 0) for item in services)
    gst_rate = float(getattr(invoice, "gst_rate", 0) or 0)
    gst_amount = float(getattr(invoice, "gst", 0) or 0)
    if gst_rate > 0 and gst_amount <= 0:
        gst_amount = (subtotal * gst_rate) / 100.0
    discount_amount = float(getattr(invoice, "discount", 0) or 0)
    total_after_gst = subtotal + (gst_amount if gst_amount > 0 else 0) - discount_amount
    grand_total = max(0.0, total_after_gst)
    advance_received = float(getattr(invoice, "advance_received", 0) or 0)
    balance_due = grand_total - advance_received
    amt_words = str(getattr(invoice, "amount_in_words", "") or amount_in_rupees_words(grand_total))

    is_multi_page = inv_type == "MULTI_SERVICE" or len(services) > 3
    
    pages = []
    if not is_multi_page:
        pages.append((services, True))
    else:
        pages.append((services[:10], False))
        remaining = services[10:]
        while len(remaining) > 0:
            is_last = len(remaining) <= 8
            pages.append((remaining[:8], is_last))
            remaining = remaining[8:]
        if len(pages) == 1:
            pages.append(([], True))

    total_pages = len(pages)

    for page_idx, (page_services, is_last_page) in enumerate(pages, 1):
        # 1. Header (Using Times New Roman font family to match Live Preview)
        if page_idx == 1:
            if os.path.exists(logo_path):
                c.drawImage(logo_path, 30, height - 95, width=240, height=65, preserveAspectRatio=True, mask='auto')
            
            # Tagline
            c.setFont("Times-Italic", 9.5)
            c.setFillColor(colors.HexColor("#0B2C8C"))
            c.setStrokeColor(colors.HexColor("#0B2C8C"))
            c.setLineWidth(0.5)
            c.line(30, height - 103, 80, height - 103)
            c.drawString(85, height - 106, "Strive for service.")
            c.line(165, height - 103, 215, height - 103)

            # INVOICE Title
            c.setFont("Times-BoldItalic", 30)
            c.setFillColor(colors.HexColor("#0B2C8C"))
            c.drawRightString(width - 30, height - 55, "INVOICE")

            # Verification ID
            c.setFont("Times-Bold", 10)
            c.setFillColor(colors.HexColor("#0B2C8C"))
            c.drawRightString(width - 30, height - 74, f"Verification ID : {disp_hash}")

            # 2. Contact Bar
            bar_y = height - 168
            c.setFillColor(colors.HexColor("#F7F9FC"))
            c.setStrokeColor(colors.HexColor("#DCE7FF"))
            c.setLineWidth(1)
            c.roundRect(30, bar_y, width - 60, 52, radius=4, fill=1, stroke=1)

            c.setFillColor(colors.HexColor("#1A1A1A"))
            c.setFont("Times-Roman", 9)

            # Col 1: Address
            c.drawString(40, bar_y + 37, "Plot No 13, SY NO 3,4, RR Plaza,")
            c.drawString(40, bar_y + 25, "Madhapur, Hyderabad, Telangana -")
            c.drawString(40, bar_y + 13, "500081")

            # Divider line 1
            c.line(220, bar_y + 5, 220, bar_y + 47)

            # Col 2: Phone, Email, Website
            c.drawString(230, bar_y + 37, "+91 96609 66369")
            c.drawString(230, bar_y + 25, "skandanhomecarre@gmail.com")
            c.drawString(230, bar_y + 13, "www.skandanhomecarre.com")

            # Divider line 2
            c.line(380, bar_y + 5, 380, bar_y + 47)

            # Col 3: Invoice Meta
            c.drawString(390, bar_y + 37, f"Invoice No.      : {inv_num_str}")
            c.drawString(390, bar_y + 25, f"Invoice Date   : {inv_date_str}")
            c.drawString(390, bar_y + 13, f"Billing Period  : {billing_period_str}")
            c.drawString(390, bar_y + 2,  f"Start Date       : {start_date_str}")

            # 3. Three Profile Cards
            cards_y = height - 275
            card_w = (width - 80) / 3.0
            
            # Card 1: BILLED TO
            x1 = 30
            c.setFillColor(colors.white)
            c.setStrokeColor(colors.HexColor("#DCE7FF"))
            c.roundRect(x1, cards_y, card_w, 95, radius=4, fill=1, stroke=1)
            c.setFillColor(colors.HexColor("#0B2C8C"))
            c.rect(x1, cards_y + 92, card_w, 3, fill=1, stroke=0)
            c.setFont("Times-Bold", 9.5)
            c.drawString(x1 + 10, cards_y + 78, "BILLED TO")
            
            c.setFont("Times-Roman", 8.5)
            c.setFillColor(colors.HexColor("#444444"))
            card1_y = cards_y + 62
            
            client_n = str(getattr(invoice, 'client_name', '') or '').strip()
            contact_p = str(getattr(invoice, 'contact_person', '') or '').strip()
            contact_no = str(getattr(invoice, 'client_contact', '') or '').strip()
            address_str = str(getattr(invoice, 'client_address', '') or '').strip()
            gst_no = str(getattr(invoice, 'client_gst', '') or '').strip()
            school_br = str(getattr(invoice, 'school_branch', '') or '').strip()

            if inv_type == "SCHOOL":
                c.drawString(x1 + 10, card1_y, f"School : {client_n}")
                card1_y -= 13
                if school_br:
                    c.drawString(x1 + 10, card1_y, f"Branch : {school_br}")
                    card1_y -= 13
                if contact_no:
                    c.drawString(x1 + 10, card1_y, f"Contact : {contact_no}")
                    card1_y -= 13
            else:
                c.drawString(x1 + 10, card1_y, f"Name : {client_n}")
                card1_y -= 13
                if contact_p:
                    c.drawString(x1 + 10, card1_y, f"Contact Person : {contact_p}")
                    card1_y -= 13
                if contact_no:
                    c.drawString(x1 + 10, card1_y, f"Contact No : {contact_no}")
                    card1_y -= 13

            # Multiline Address Rendering
            if address_str:
                addr_words = address_str.replace('\n', ' ').split()
                addr_lines = []
                curr_l = ""
                for w in addr_words:
                    t_line = f"{curr_l} {w}".strip() if curr_l else w
                    if c.stringWidth(t_line, "Times-Roman", 8.5) <= (card_w - 55):
                        curr_l = t_line
                    else:
                        addr_lines.append(curr_l)
                        curr_l = w
                if curr_l:
                    addr_lines.append(curr_l)

                if addr_lines:
                    c.drawString(x1 + 10, card1_y, f"Address : {addr_lines[0]}")
                    card1_y -= 12
                    for sub_l in addr_lines[1:3]:
                        c.drawString(x1 + 48, card1_y, sub_l)
                        card1_y -= 12

            if gst_no and card1_y >= cards_y + 4:
                c.drawString(x1 + 10, card1_y, f"GST No : {gst_no}")

            # Card 2: SERVICE PROFILE
            x2 = 30 + card_w + 10
            c.setFillColor(colors.white)
            c.setStrokeColor(colors.HexColor("#DCE7FF"))
            c.roundRect(x2, cards_y, card_w, 95, radius=4, fill=1, stroke=1)
            c.setFillColor(colors.HexColor("#0B2C8C"))
            c.rect(x2, cards_y + 92, card_w, 3, fill=1, stroke=0)
            c.setFont("Times-Bold", 9.5)
            c.drawString(x2 + 10, cards_y + 78, "SERVICE PROFILE")

            pat_name = str(getattr(invoice, 'patient_name', '') or '').strip()
            pat_age = str(getattr(invoice, 'patient_age_gender', '') or '').strip()
            srv_type = str(getattr(invoice, 'service_type', '') or '').strip()
            consult = str(getattr(invoice, 'consultant', '') or '').strip()
            rend_days = str(getattr(invoice, 'rendered_days', '') or '').strip()

            c.setFont("Times-Roman", 8.5)
            c.setFillColor(colors.HexColor("#444444"))
            card2_y = cards_y + 60
            
            # Patient Name is ONLY rendered if non-empty (matching Live Preview)
            if (inv_type in ["MULTI_SERVICE", "REGULAR"]) and pat_name:
                c.drawString(x2 + 10, card2_y, f"Patient : {pat_name}")
                card2_y -= 14
                if pat_age:
                    c.drawString(x2 + 10, card2_y, f"Age/Gender : {pat_age}")
                    card2_y -= 14

            if srv_type:
                c.drawString(x2 + 10, card2_y, f"Service Type : {srv_type}")
                card2_y -= 14
            if consult:
                c.drawString(x2 + 10, card2_y, f"Consultant : {consult}")
                card2_y -= 14
            if start_date_str:
                c.drawString(x2 + 10, card2_y, f"Started On : {start_date_str}")
                card2_y -= 14
            if rend_days:
                c.drawString(x2 + 10, card2_y, f"Rendered : {rend_days}")

            # Card 3: OTHER INFORMATION
            x3 = 30 + (card_w + 10) * 2
            c.setFillColor(colors.white)
            c.setStrokeColor(colors.HexColor("#DCE7FF"))
            c.roundRect(x3, cards_y, card_w, 95, radius=4, fill=1, stroke=1)
            c.setFillColor(colors.HexColor("#0B2C8C"))
            c.rect(x3, cards_y + 92, card_w, 3, fill=1, stroke=0)
            c.setFont("Times-Bold", 9.5)
            c.drawString(x3 + 10, cards_y + 78, "OTHER INFORMATION")

            c.setFont("Times-Roman", 8.5)
            c.setFillColor(colors.HexColor("#444444"))
            per_day = float(getattr(invoice, "per_day_charges", 0) or 0)
            c.drawString(x3 + 10, cards_y + 60, f"Per Day Chg : Rs. {per_day:,.2f}")
            c.drawString(x3 + 10, cards_y + 44, f"Adv. Amount : Rs. {advance_received:,.2f}")
            c.setFont("Times-Bold", 8.5)
            c.setFillColor(colors.HexColor("#0B2C8C"))
            c.drawString(x3 + 10, cards_y + 28, f"Payment Status : {getattr(invoice, 'payment_status', 'Pending')}")

            table_start_y = height - 285
        else:
            # Header for page 2
            if os.path.exists(logo_path):
                c.drawImage(logo_path, 30, height - 55, width=140, height=35, preserveAspectRatio=True, mask='auto')
            c.setFont("Times-BoldItalic", 18)
            c.setFillColor(colors.HexColor("#0B2C8C"))
            c.drawRightString(width - 30, height - 40, "INVOICE")
            c.setFont("Times-Bold", 8.5)
            c.drawRightString(width - 30, height - 52, f"Verification ID : {disp_hash}")

            c.setFont("Times-Roman", 8.5)
            c.setFillColor(colors.HexColor("#444444"))
            c.drawString(30, height - 70, f"Invoice No: {inv_num_str}  |  Client: {getattr(invoice, 'client_name', '')}  |  Page {page_idx} of {total_pages}")
            c.setStrokeColor(colors.HexColor("#0B2C8C"))
            c.setLineWidth(1)
            c.line(30, height - 75, width - 30, height - 75)

            table_start_y = height - 90

        # 4. Service Details Table
        c.setFont("Times-Bold", 11)
        c.setFillColor(colors.HexColor("#0B2C8C"))
        c.drawString(30, table_start_y, "SERVICE DETAILS" if page_idx == 1 else "SERVICE DETAILS (CONTINUED)")

        tbl_header_y = table_start_y - 22
        c.setFillColor(colors.HexColor("#0B2C8C"))
        c.rect(30, tbl_header_y, width - 60, 18, fill=1, stroke=0)

        c.setFont("Times-Bold", 9)
        c.setFillColor(colors.white)
        c.drawString(35, tbl_header_y + 5, "S.No")
        c.drawString(75, tbl_header_y + 5, "Service Details")
        c.drawRightString(360, tbl_header_y + 5, "Amount (Rs.)")
        c.drawRightString(460, tbl_header_y + 5, "Other Exp. (Rs.)")
        c.drawRightString(560, tbl_header_y + 5, "Total (Rs.)")

        row_y = tbl_header_y - 20
        c.setFont("Times-Roman", 8.5)
        c.setFillColor(colors.HexColor("#1A1A1A"))

        for idx, item in enumerate(page_services, 1 if page_idx == 1 else 11):
            s_no = item.get("s_no", idx)
            name = item.get("service_name", "")
            amt = float(item.get("amount", 0) or 0)
            oth = float(item.get("other_expenses", 0) or 0)
            tot = float(item.get("total", amt + oth) or 0)

            c.drawString(35, row_y, str(s_no))
            c.drawString(75, row_y, str(name)[:50])
            c.drawRightString(360, row_y, f"{amt:,.2f}")
            c.drawRightString(460, row_y, f"{oth:,.2f}")
            c.drawRightString(560, row_y, f"{tot:,.2f}")

            c.setStrokeColor(colors.HexColor("#D8E3F5"))
            c.setLineWidth(0.5)
            c.line(30, row_y - 4, width - 30, row_y - 4)

            row_y -= 18

        if not is_last_page:
            c.setFont("Times-Italic", 8.5)
            c.setFillColor(colors.HexColor("#666666"))
            c.drawRightString(width - 30, row_y - 10, "Continued on Next Page →")

        # 5. Financial Summary & Remarks (Only on last page)
        if is_last_page:
            fin_y = row_y - 25 if is_multi_page else 270

            # Remarks (Left)
            c.setFillColor(colors.white)
            c.setStrokeColor(colors.HexColor("#DCE7FF"))
            c.roundRect(30, fin_y, 250, 110, radius=4, fill=1, stroke=1)
            c.setFillColor(colors.HexColor("#F7F9FC"))
            c.rect(30, fin_y + 90, 250, 20, fill=1, stroke=0)
            c.setFont("Times-Bold", 9)
            c.setFillColor(colors.HexColor("#0B2C8C"))
            c.drawString(38, fin_y + 96, "REMARKS / NOTES")
            rem_raw = str(getattr(invoice, "remarks", "") or "Thank you for choosing Skandan Home Carre & Cclinic LLP.").strip()
            c.setFont("Times-Roman", 8.5)
            c.setFillColor(colors.HexColor("#444444"))
            
            rem_lines = []
            for line in rem_raw.split('\n'):
                line_str = line.strip()
                if not line_str:
                    rem_lines.append("")
                    continue
                words = line_str.split()
                current_line = ""
                for w in words:
                    test_line = f"{current_line} {w}".strip() if current_line else w
                    if c.stringWidth(test_line, "Times-Roman", 8.5) <= 235:
                        current_line = test_line
                    else:
                        rem_lines.append(current_line)
                        current_line = w
                if current_line:
                    rem_lines.append(current_line)

            ry = fin_y + 75
            for r_line in rem_lines[:7]:
                c.drawString(38, ry, r_line)
                ry -= 12

            # Financial Summary Table (Right)
            r_x = 300
            c.setFont("Times-Roman", 8.5)
            c.setFillColor(colors.HexColor("#555555"))
            
            c.drawString(r_x, fin_y + 95, "Sub Total")
            c.drawRightString(width - 30, fin_y + 95, f"Rs. {subtotal:,.2f}")
            c.line(r_x, fin_y + 90, width - 30, fin_y + 90)

            curr_y = fin_y + 75
            if gst_amount > 0:
                c.drawString(r_x, curr_y, f"GST ({gst_rate:.0f}%)" if gst_rate > 0 else "GST")
                c.drawRightString(width - 30, curr_y, f"Rs. {gst_amount:,.2f}")
                curr_y -= 15
                c.line(r_x, curr_y + 10, width - 30, curr_y + 10)

            if discount_amount > 0:
                c.drawString(r_x, curr_y, "Discount")
                c.drawRightString(width - 30, curr_y, f"- Rs. {discount_amount:,.2f}")
                curr_y -= 15
                c.line(r_x, curr_y + 10, width - 30, curr_y + 10)

            if gst_amount > 0:
                c.setFont("Times-Bold", 9)
                c.setFillColor(colors.HexColor("#0B2C8C"))
                c.drawString(r_x, curr_y, "Total After GST")
                c.drawRightString(width - 30, curr_y, f"Rs. {total_after_gst:,.2f}")
                curr_y -= 15

            c.setFont("Times-Roman", 8.5)
            c.setFillColor(colors.HexColor("#555555"))
            c.drawString(r_x, curr_y, "Advance Received")
            c.drawRightString(width - 30, curr_y, f"Rs. {advance_received:,.2f}")
            curr_y -= 15

            c.setFont("Times-Bold", 9)
            c.setFillColor(colors.HexColor("#0B2C8C"))
            c.drawString(r_x, curr_y, "Balance Due")
            c.drawRightString(width - 30, curr_y, f"Rs. {balance_due:,.2f}")
            curr_y -= 25

            # GRAND TOTAL Solid Navy Bar
            c.setFillColor(colors.HexColor("#0B2C8C"))
            c.rect(r_x, curr_y, width - 30 - r_x, 22, fill=1, stroke=0)
            c.setFont("Times-Bold", 11)
            c.setFillColor(colors.white)
            c.drawString(r_x + 8, curr_y + 6, "GRAND TOTAL")
            c.drawRightString(width - 38, curr_y + 6, f"Rs. {grand_total:,.2f}")

            # Amount in Words
            c.setFont("Times-Italic", 8)
            c.setFillColor(colors.HexColor("#555555"))
            c.drawRightString(width - 30, curr_y - 12, f"Amount in words: {amt_words}")

            # 6. Bank Details + UPI + Seal Box
            bank_y = 110
            bank_h = 85
            c.setFillColor(colors.HexColor("#F7F9FC"))
            c.setStrokeColor(colors.HexColor("#DCE7FF"))
            c.roundRect(30, bank_y, width - 60, bank_h, radius=4, fill=1, stroke=1)

            # Bank Transfer Column (Left)
            c.setFont("Times-Bold", 8.5)
            c.setFillColor(colors.HexColor("#0B2C8C"))
            c.drawString(40, bank_y + bank_h - 15, "BANK TRANSFER (NEFT/RTGS)")
            
            if os.path.exists(hdfc_logo_path):
                c.drawImage(hdfc_logo_path, 40, bank_y + bank_h - 45, width=50, height=22, preserveAspectRatio=True, mask='auto')

            # 5 separate lines for bank info matching Live Preview
            bx = 100
            by = bank_y + bank_h - 25
            c.setFont("Times-Roman", 7.5)
            c.setFillColor(colors.HexColor("#666666"))
            c.drawString(bx, by, "Beneficiary:")
            c.setFont("Times-Bold", 7.5)
            c.setFillColor(colors.HexColor("#1A1A1A"))
            c.drawString(bx + 55, by, "SKANDAN HOME CARRE CCLINIC LLP")

            by -= 11
            c.setFont("Times-Roman", 7.5)
            c.setFillColor(colors.HexColor("#666666"))
            c.drawString(bx, by, "Account:")
            c.setFont("Times-Bold", 7.5)
            c.setFillColor(colors.HexColor("#1A1A1A"))
            c.drawString(bx + 55, by, "50200090644327")

            by -= 11
            c.setFont("Times-Roman", 7.5)
            c.setFillColor(colors.HexColor("#666666"))
            c.drawString(bx, by, "Type:")
            c.setFont("Times-Roman", 7.5)
            c.setFillColor(colors.HexColor("#1A1A1A"))
            c.drawString(bx + 55, by, "Current Account")

            by -= 11
            c.setFont("Times-Roman", 7.5)
            c.setFillColor(colors.HexColor("#666666"))
            c.drawString(bx, by, "IFSC:")
            c.setFont("Times-Bold", 7.5)
            c.setFillColor(colors.HexColor("#1A1A1A"))
            c.drawString(bx + 55, by, "HDFC0004211")

            by -= 11
            c.setFont("Times-Roman", 7.5)
            c.setFillColor(colors.HexColor("#666666"))
            c.drawString(bx, by, "MICR:")
            c.setFont("Times-Roman", 7.5)
            c.setFillColor(colors.HexColor("#1A1A1A"))
            c.drawString(bx + 55, by, "500240078")

            # Column Divider 1
            c.setStrokeColor(colors.HexColor("#DCE7FF"))
            c.setLineWidth(1)
            c.line(310, bank_y + 5, 310, bank_y + bank_h - 5)

            # UPI Column (Middle)
            upi_cx = 385
            c.setFont("Times-Bold", 8.5)
            c.setFillColor(colors.HexColor("#0B2C8C"))
            c.drawCentredString(upi_cx, bank_y + bank_h - 15, "UPI PAYMENT")

            if os.path.exists(qr_path):
                c.drawImage(qr_path, upi_cx - 26, bank_y + bank_h - 70, width=52, height=52, preserveAspectRatio=True, mask='auto')

            c.setFont("Times-Bold", 7.5)
            c.setFillColor(colors.HexColor("#1A1A1A"))
            c.drawCentredString(upi_cx, bank_y + 6, "UPI ID: 9866613699@hdfcbank")

            # Column Divider 2
            c.line(460, bank_y + 5, 460, bank_y + bank_h - 5)

            # Verified Seal Column (Right)
            if os.path.exists(seal_path):
                c.drawImage(seal_path, 470, bank_y + (bank_h - 68) / 2.0, width=68, height=68, preserveAspectRatio=True, mask='auto')

            # School Signatures if SCHOOL template
            if inv_type == "SCHOOL":
                sig_y = bank_y - 25
                c.setStrokeColor(colors.HexColor("#0B2C8C"))
                c.line(50, sig_y + 12, 160, sig_y + 12)
                c.line(220, sig_y + 12, 330, sig_y + 12)
                c.line(390, sig_y + 12, 500, sig_y + 12)
                c.setFont("Times-Bold", 8.5)
                c.setFillColor(colors.HexColor("#0B2C8C"))
                c.drawCentredString(105, sig_y, "Principal Signature")
                c.drawCentredString(275, sig_y, "AO Signature")
                c.drawCentredString(445, sig_y, "AGM Signature")

        # 7. Footer (On every page)
        c.setFont("Times-Italic", 8)
        c.setFillColor(colors.HexColor("#0B2C8C"))
        c.drawCentredString(width / 2.0, 48, "This invoice is system generated. No signature is required.")
        
        c.setStrokeColor(colors.HexColor("#0B2C8C"))
        c.line(30, 36, width / 2.0 - 50, 36)
        c.setFont("Times-Bold", 8)
        c.drawCentredString(width / 2.0, 33, "OUR SERVICES")
        c.line(width / 2.0 + 50, 36, width - 30, 36)

        c.setFont("Times-Roman", 7)
        c.setFillColor(colors.HexColor("#0B2C8C"))
        services_text = "ICU Care at Home   •   Doctor Visits   •   Nursing Care   •   Caretaker Services   •   Physiotherapy   •   Lab Tests at Home   •   Equipment Rental   •   Medicine Delivery   •   Post-Operative Care"
        c.drawCentredString(width / 2.0, 20, services_text)

        c.showPage()

    c.save()
    pdf_data = buffer.getvalue()
    buffer.close()
    return pdf_data
