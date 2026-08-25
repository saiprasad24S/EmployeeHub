import os
import io
from django.conf import settings
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib import colors

UNITS = ["", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN",
         "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN"]
TENS = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"]

def num_to_words_upper(amount_val) -> str:
    try:
        val = int(round(float(amount_val)))
        if val <= 0:
            return "ZERO RUPEES ONLY"
        
        def _in_words(num: int) -> str:
            res = ""
            if num >= 100:
                res += UNITS[num // 100] + " HUNDRED "
                num %= 100
            if num >= 20:
                res += TENS[num // 10] + " "
                num %= 10
            if num > 0:
                res += UNITS[num] + " "
            return res

        num = val
        words = ""
        if num >= 10000000:
            words += _in_words(num // 10000000) + "CRORE "
            num %= 10000000
        if num >= 100000:
            words += _in_words(num // 100000) + "LAKH "
            num %= 100000
        if num >= 1000:
            words += _in_words(num // 1000) + "THOUSAND "
            num %= 1000
        if num > 0:
            words += _in_words(num)

        cleaned = " ".join(words.split())
        return f"{cleaned} RUPEES ONLY"
    except Exception:
        return "ZERO RUPEES ONLY"


def format_currency_str(val) -> str:
    """Format number with Indian comma grouping: 1,23,456.78"""
    try:
        num = float(val)
        # Split into integer and decimal parts
        int_part = int(abs(num))
        dec_part = f"{abs(num) - int_part:.2f}"[1:]  # .XX

        s = str(int_part)
        if len(s) > 3:
            # Last 3 digits, then groups of 2
            result = s[-3:]
            s = s[:-3]
            while s:
                result = s[-2:] + "," + result
                s = s[:-2]
        else:
            result = s
        sign = "-" if num < 0 else ""
        return f"{sign}{result}{dec_part}"
    except Exception:
        return "0.00"


def generate_payslip_pdf(payslip_dict: dict) -> bytes:
    buffer = io.BytesIO()
    page_width, page_height = A4  # 595.27 x 841.89 pt
    c = canvas.Canvas(buffer, pagesize=A4)

    margin_x = 36  # ~0.5 inch left/right margin
    box_width = page_width - (2 * margin_x)
    box_top = page_height - 36
    
    # Calculate dimensions
    # Table starts at box_top and extends down
    curr_y = box_top

    # 1. Header Box
    header_height = 64
    c.setStrokeColor(colors.HexColor("#111827"))
    c.setLineWidth(1)
    
    # Draw Outer Border Top & Sides
    # We will draw the full outer box around content
    content_top = box_top

    # Header Row
    logo_path = os.path.join(settings.BASE_DIR, "..", "frontend", "public", "assets", "payslip", "skandan_payslip_logo.png")
    if not os.path.exists(logo_path):
        logo_path = os.path.join(settings.BASE_DIR, "apps", "common", "assets", "skandan_payslip_logo.png")

    if os.path.exists(logo_path):
        try:
            c.drawImage(logo_path, margin_x + 10, curr_y - 52, width=130, height=44, preserveAspectRatio=True, mask='auto')
        except Exception:
            pass

    # Header Center Title (Times-Bold - Dark Blue #0B2C8C, ALL CAPS)
    c.setFont("Times-Bold", 12.5)
    c.setFillColor(colors.HexColor("#0B2C8C"))
    c.drawCentredString(margin_x + (box_width / 2) + 20, curr_y - 28, "SKANDAN HOME CARRE CCLINIC LLP")

    # Header Right Contact Info (Times-Roman, ALL CAPS)
    c.setFont("Times-Roman", 7.5)
    c.setFillColor(colors.HexColor("#1F2937"))
    right_x = margin_x + box_width - 10
    c.drawRightString(right_x, curr_y - 18, "+91 96609 66369")
    c.drawRightString(right_x, curr_y - 30, "SKANDANHOMECARRE.COM")
    c.drawRightString(right_x, curr_y - 42, "ADMIN@SKANDANHOMECARRE.COM")

    curr_y -= header_height
    c.line(margin_x, curr_y, margin_x + box_width, curr_y)

    # 2. Month Banner (Times-Bold, ALL CAPS)
    banner_height = 20
    c.setFont("Times-Bold", 9.5)
    c.setFillColor(colors.HexColor("#111827"))
    month_upper = str(payslip_dict.get("month", "JULY")).upper()
    year_val = str(payslip_dict.get("year", "2026"))
    c.drawCentredString(margin_x + (box_width / 2), curr_y - 14, f"PAYSLIP FOR THE MONTH OF {month_upper} {year_val}")

    curr_y -= banner_height
    c.line(margin_x, curr_y, margin_x + box_width, curr_y)

    # 3. Employee Details Grid (8 rows, 2 columns) - Times New Roman (Left Label BOLD, Details NOT BOLD, ALL CAPS)
    emp_rows = [
        ("EMPLOYEE CODE", str(payslip_dict.get("employee_code", "3699-D09600")).upper(), "EMPLOYEE NAME", str(payslip_dict.get("employee_name", "ALWALA MADHURI")).upper()),
        ("DESIGNATION", str(payslip_dict.get("designation", "OHC-DOCTOR")).upper(), "GRADE / LEVEL", str(payslip_dict.get("grade_level", "AA / II")).upper()),
        ("LOCATION", str(payslip_dict.get("location", "TELANGANA")).upper(), "DEPARTMENT", str(payslip_dict.get("department", "OPERATIONS")).upper()),
        ("BANK NAME", str(payslip_dict.get("bank_name", "SBI")).upper(), "BANK ACCOUNT NUMBER", str(payslip_dict.get("bank_account_number", "39398771652")).upper()),
        ("PAN NUMBER", str(payslip_dict.get("pan_number", "CVRPA6711N")).upper(), "PF ACCOUNT NUMBER", str(payslip_dict.get("pf_account_number", "NA")).upper()),
        ("DATE OF JOINING", str(payslip_dict.get("date_of_joining", "29-06-2026")).upper(), "DAYS WORKED", str(payslip_dict.get("days_worked", 30)).upper()),
        ("LOP", str(payslip_dict.get("lop_days", "01")).zfill(2).upper(), "ESIC ACCOUNT NUMBER", str(payslip_dict.get("esic_account_number", "NA")).upper()),
        ("ARREARS DAYS", str(payslip_dict.get("arrears_days", 0)).upper(), "UAN NUMBER", str(payslip_dict.get("uan_number", "NA")).upper()),
    ]

    row_h = 16
    col1_label_w = 110
    col1_val_w = (box_width / 2) - col1_label_w
    col2_label_w = 110
    col2_val_w = (box_width / 2) - col2_label_w
    mid_x = margin_x + (box_width / 2)

    for r_idx, (l1, v1, l2, v2) in enumerate(emp_rows):
        r_y = curr_y - ((r_idx + 1) * row_h)
        # Label 1 (BOLD)
        c.setFont("Times-Bold", 8)
        c.setFillColor(colors.HexColor("#111827"))
        c.drawString(margin_x + 8, r_y + 4, l1)
        # Value 1 (REGULAR / NOT BOLD)
        c.setFont("Times-Roman", 8)
        c.setFillColor(colors.HexColor("#111827"))
        c.drawString(margin_x + col1_label_w + 4, r_y + 4, v1)

        # Label 2 (BOLD)
        c.setFont("Times-Bold", 8)
        c.setFillColor(colors.HexColor("#111827"))
        c.drawString(mid_x + 8, r_y + 4, l2)
        # Value 2 (REGULAR / NOT BOLD)
        c.setFont("Times-Roman", 8)
        c.setFillColor(colors.HexColor("#111827"))
        c.drawString(mid_x + col2_label_w + 4, r_y + 4, v2)

    # Middle dividing line for employee grid
    c.line(mid_x, curr_y, mid_x, curr_y - (len(emp_rows) * row_h))
    curr_y -= (len(emp_rows) * row_h)
    c.line(margin_x, curr_y, margin_x + box_width, curr_y)

    # 4. Earnings & Deductions Table Header (Times-Bold, Green, ALL CAPS)
    header_table_h = 18
    c.setFont("Times-Bold", 9)
    c.setFillColor(colors.HexColor("#16A34A"))
    c.drawCentredString(margin_x + (box_width / 4), curr_y - 13, "EARNINGS")
    c.drawCentredString(margin_x + (box_width * 3 / 4), curr_y - 13, "DEDUCTIONS")

    curr_y -= header_table_h
    c.line(margin_x, curr_y, margin_x + box_width, curr_y)

    # 5. Earnings & Deductions Data Rows (Labels BOLD, Amounts REGULAR, ALL CAPS)
    earnings_items = [
        ("BASIC SALARY", payslip_dict.get("basic_salary", 12096.81)),
        ("CONVEYANCE ALLOWANCE", payslip_dict.get("conveyance_allowance", 7258.00)),
        ("HOUSE RENT ALLOWANCE", payslip_dict.get("house_rent_allowance", 4838.71)),
        ("OTHERS", payslip_dict.get("others_allowance", 0.00)),
        ("INCENTIVES", payslip_dict.get("incentives", 0.00)),
    ]

    deductions_items = [
        ("PROFESSIONAL TAX", payslip_dict.get("professional_tax", 200.00)),
        ("PROVIDENT FUND", payslip_dict.get("provident_fund", 1452.00)),
    ]
    if float(payslip_dict.get("esic_deduction", 0) or 0) > 0:
        deductions_items.append(("ESIC", payslip_dict.get("esic_deduction", 0)))
    if float(payslip_dict.get("tds_deduction", 0) or 0) > 0:
        deductions_items.append(("TDS", payslip_dict.get("tds_deduction", 0)))
    if float(payslip_dict.get("other_deductions", 0) or 0) > 0:
        deductions_items.append(("OTHER DEDUCTIONS", payslip_dict.get("other_deductions", 0)))

    max_rows = max(len(earnings_items), len(deductions_items), 5)
    body_row_h = 16
    start_body_y = curr_y

    for r_i in range(max_rows):
        row_y = curr_y - ((r_i + 1) * body_row_h)
        # Left (Earnings) - Label BOLD, Amount REGULAR
        if r_i < len(earnings_items):
            lbl, amt = earnings_items[r_i]
            c.setFont("Times-Bold", 8)
            c.setFillColor(colors.HexColor("#111827"))
            c.drawString(margin_x + 8, row_y + 4, lbl)
            c.setFont("Times-Roman", 8)
            c.drawRightString(mid_x - 12, row_y + 4, format_currency_str(amt))

        # Right (Deductions) - Label BOLD, Amount REGULAR
        if r_i < len(deductions_items):
            lbl, amt = deductions_items[r_i]
            c.setFont("Times-Bold", 8)
            c.setFillColor(colors.HexColor("#111827"))
            c.drawString(mid_x + 8, row_y + 4, lbl)
            c.setFont("Times-Roman", 8)
            c.drawRightString(margin_x + box_width - 12, row_y + 4, format_currency_str(amt))

    # Middle line for table body
    c.line(mid_x, start_body_y, mid_x, curr_y - (max_rows * body_row_h))
    curr_y -= (max_rows * body_row_h)
    c.line(margin_x, curr_y, margin_x + box_width, curr_y)

    # 6. Totals Row
    totals_h = 18
    tot_earn = sum(float(x[1] or 0) for x in earnings_items)
    tot_ded = sum(float(x[1] or 0) for x in deductions_items)

    c.setFont("Times-Bold", 8.5)
    c.setFillColor(colors.HexColor("#111827"))
    c.drawString(margin_x + 8, curr_y - 13, "TOTAL EARNINGS")
    c.drawRightString(mid_x - 12, curr_y - 13, format_currency_str(tot_earn))

    c.drawString(mid_x + 8, curr_y - 13, "TOTAL DEDUCTIONS")
    c.drawRightString(margin_x + box_width - 12, curr_y - 13, format_currency_str(tot_ded))

    c.line(mid_x, curr_y, mid_x, curr_y - totals_h)
    curr_y -= totals_h
    c.line(margin_x, curr_y, margin_x + box_width, curr_y)

    # 7. In-Words & Net Salary Row
    net_h = 24
    net_val = max(0.0, tot_earn - tot_ded)
    in_words_str = str(payslip_dict.get("amount_in_words", "")).strip()
    if not in_words_str:
        in_words_str = num_to_words_upper(net_val)

    # Left: In-Words (Times-Bold)
    c.setFont("Times-Bold", 7.5)
    c.setFillColor(colors.HexColor("#111827"))
    in_words_formatted = f"IN-WORDS:{in_words_str} ₹"
    c.drawString(margin_x + 8, curr_y - 15, in_words_formatted)

    # Right: Net Salary (Times-Bold)
    c.setFont("Times-Bold", 8.5)
    c.setFillColor(colors.HexColor("#374151"))
    c.drawString(mid_x + 8, curr_y - 15, "NET SALARY")
    c.setFont("Times-Bold", 9.5)
    c.setFillColor(colors.HexColor("#111827"))
    c.drawRightString(margin_x + box_width - 12, curr_y - 15, format_currency_str(net_val))

    c.line(mid_x, curr_y, mid_x, curr_y - net_h)
    curr_y -= net_h
    c.line(margin_x, curr_y, margin_x + box_width, curr_y)

    # 8. Bottom Note (Helvetica / Sans-Serif)
    note_h = 16
    gen_d = payslip_dict.get("generation_date", "07-08-2026")
    gen_t = payslip_dict.get("generation_time", "05:15 PM")
    c.setFont("Helvetica-Bold", 6.5)
    c.setFillColor(colors.HexColor("#4B5563"))
    c.drawString(margin_x + 8, curr_y - 11, f"NOTE: THIS DOCUMENT IS COMPUTER GENERATED, DATE {gen_d} AT {gen_t}. (NO SIGNATURE REQUIRED)")

    curr_y -= note_h

    # Complete Outer Rectangle Border
    c.setLineWidth(1)
    c.setStrokeColor(colors.HexColor("#111827"))
    c.rect(margin_x, curr_y, box_width, content_top - curr_y)

    # 9. Bottom Colorful Gradient Line
    curr_y -= 4
    # Cyan, Magenta, Yellow, Purple segments
    segment_w = box_width / 4
    c.setFillColor(colors.HexColor("#00C0F3"))
    c.rect(margin_x, curr_y, segment_w, 3, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#E91E63"))
    c.rect(margin_x + segment_w, curr_y, segment_w, 3, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#FFC107"))
    c.rect(margin_x + (2 * segment_w), curr_y, segment_w, 3, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#6B2FA0"))
    c.rect(margin_x + (3 * segment_w), curr_y, segment_w, 3, fill=1, stroke=0)

    c.showPage()
    c.save()

    return buffer.getvalue()
