import os
from io import BytesIO
from django.conf import settings
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.graphics.barcode import code128

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


def generate_invoice_pdf(invoice) -> bytes:
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4 # 595.27 x 841.89 pt

    assets_dir = os.path.join(settings.BASE_DIR, "static", "invoice")
    bg_regular = os.path.join(assets_dir, "template_regular.png")
    bg_school = os.path.join(assets_dir, "template_school.png")
    bg_multi_p1 = os.path.join(assets_dir, "template_multi_p1.png")
    bg_multi_p2 = os.path.join(assets_dir, "template_multi_p2.png")

    inv_type = getattr(invoice, "invoice_type", "REGULAR")
    services = getattr(invoice, "services_data", []) or []
    is_multi_page = inv_type == "MULTI_SERVICE" or len(services) > 8

    inv_num_str = str(getattr(invoice, "invoice_number", "1370 - 0001"))
    inv_num_clean = inv_num_str.replace(" ", "")

    inv_date_str = invoice.invoice_date.strftime("%d-%b-%Y") if getattr(invoice, "invoice_date", None) else ""
    start_date_str = invoice.start_date.strftime("%d-%b-%Y") if getattr(invoice, "start_date", None) else ""
    billing_period_str = str(getattr(invoice, "billing_period_text", "")) or "Monthly"

    # --- PAGE 1 DRAWING ---
    if is_multi_page:
        bg_p1 = bg_multi_p1 if os.path.exists(bg_multi_p1) else bg_regular
    elif inv_type == "SCHOOL":
        bg_p1 = bg_school if os.path.exists(bg_school) else bg_regular
    else:
        bg_p1 = bg_regular

    # 1. Draw Template Image Background
    if os.path.exists(bg_p1):
        c.drawImage(bg_p1, 0, 0, width=width, height=height)

    # 2. Draw Barcode (Top Right Box)
    try:
        barcode_obj = code128.Code128(inv_num_clean, barHeight=22, barWidth=1.0)
        barcode_obj.drawOn(c, 435, 770)
    except Exception:
        pass

    # 3. Draw Header Meta (Top Right Box)
    c.setFont("Helvetica-Bold", 8)
    c.setFillColorRGB(0.1, 0.1, 0.1)
    c.drawString(472, 744, inv_num_str)
    c.drawString(472, 728, inv_date_str)
    c.drawString(472, 712, billing_period_str)
    c.drawString(472, 696, start_date_str)

    # 4. Draw Profile Grid
    c.setFont("Helvetica-Bold", 8)
    if inv_type == "SCHOOL":
        c.drawString(110, 620, str(getattr(invoice, "school_branch", "") or getattr(invoice, "client_name", "")))
        c.drawString(110, 594, str(getattr(invoice, "contact_person", "")))
        c.drawString(110, 568, str(getattr(invoice, "client_contact", "")))
        c.drawString(110, 542, str(getattr(invoice, "client_address", ""))[:40])
    else:
        c.drawString(100, 620, str(getattr(invoice, "client_name", "")))
        c.drawString(100, 594, str(getattr(invoice, "client_contact", "")))
        c.drawString(100, 568, str(getattr(invoice, "client_address", ""))[:40])
        if getattr(invoice, "client_gst", None):
            c.drawString(100, 536, str(invoice.client_gst))

    # Service Profile (Middle Box)
    if inv_type != "SCHOOL":
        c.setFont("Helvetica", 8)
        c.drawString(278, 620, str(getattr(invoice, "patient_name", "")))
        c.drawString(278, 594, str(getattr(invoice, "patient_age_gender", "")))
        c.drawString(278, 568, str(getattr(invoice, "service_type", "")))
        c.drawString(278, 542, str(getattr(invoice, "consultant", "")))
        c.drawString(278, 516, start_date_str)
        c.drawString(278, 490, "In Process")
        c.drawString(278, 464, str(getattr(invoice, "rendered_days", "") or "30 Days"))

    # Other Info (Right Box)
    c.setFont("Helvetica", 8)
    per_day = float(getattr(invoice, "per_day_charges", 0) or 0)
    adv_amt = float(getattr(invoice, "advance_received", 0) or 0)
    pay_stat = str(getattr(invoice, "payment_status", "Pending"))

    c.drawString(480, 620, f"₹ {per_day:,.2f}" if per_day > 0 else "N/A")
    c.drawString(480, 594, f"₹ {adv_amt:,.2f}" if adv_amt > 0 else "Not Paid")
    c.setFont("Helvetica-Bold", 8)
    c.drawString(480, 568, pay_stat)

    # 5. Service Table Rows (Page 1)
    page1_items = services[:9] if is_multi_page else services
    y_pos = 415
    for idx, item in enumerate(page1_items, 1):
        s_no = item.get("s_no", idx)
        name = item.get("service_name", "")
        desc = item.get("description", "")
        rate = float(item.get("rate", 0))
        days = item.get("days", 1)
        amt = float(item.get("amount", rate * days))
        oth = float(item.get("other_expenses", 0))
        tot = float(item.get("total", amt + oth))

        c.setFont("Helvetica-Bold", 7.5)
        c.drawCentredString(32, y_pos, str(s_no))
        c.drawString(56, y_pos, name[:45])
        
        if desc:
            c.setFont("Helvetica", 6.5)
            c.setFillColorRGB(0.3, 0.3, 0.3)
            c.drawString(56, y_pos - 8, desc[:60])
            c.setFillColorRGB(0.1, 0.1, 0.1)

        c.setFont("Helvetica", 7.5)
        c.drawRightString(292, y_pos, f"₹ {rate:,.2f}" if rate > 0 else "0.00")
        c.drawCentredString(330, y_pos, str(days))
        c.drawRightString(410, y_pos, f"₹ {amt:,.2f}" if amt > 0 else "0.00")
        c.drawRightString(500, y_pos, f"₹ {oth:,.2f}" if oth > 0 else "Not Applicable")
        c.setFont("Helvetica-Bold", 7.5)
        c.drawRightString(568, y_pos, f"₹ {tot:,.2f}" if tot > 0 else "0.00")

        y_pos -= 26

    # If Single Page (Regular / School), Draw Remarks & Financial Totals
    if not is_multi_page:
        # Remarks
        c.setFont("Helvetica", 7)
        rem_text = str(getattr(invoice, "remarks", "") or "Invoice for the service period. Kindly process the due amount at the earliest.")
        c.drawString(35, 245, rem_text[:65])

        # Financial Summary
        subtotal = float(getattr(invoice, "subtotal", 0) or 0)
        gst = float(getattr(invoice, "gst", 0) or 0)
        discount = float(getattr(invoice, "discount", 0) or 0)
        tot_after_gst = float(getattr(invoice, "total_after_gst", 0) or 0)
        balance_due = float(getattr(invoice, "balance_due", 0) or 0)
        grand_total = float(getattr(invoice, "grand_total", 0) or 0)
        amt_words = str(getattr(invoice, "amount_in_words", "") or amount_in_rupees_words(grand_total))

        c.setFont("Helvetica-Bold", 8)
        c.drawRightString(568, 252, f"₹ {gst:,.2f}")
        c.drawRightString(568, 234, f"₹ {discount:,.2f}")
        c.drawRightString(568, 216, f"₹ {tot_after_gst:,.2f}")
        c.drawRightString(568, 198, f"₹ {adv_amt:,.2f}")
        c.drawRightString(568, 180, f"₹ {balance_due:,.2f}")
        
        c.setFont("Helvetica-Bold", 9)
        c.setFillColorRGB(1.0, 1.0, 1.0)
        c.drawRightString(568, 158, f"₹ {grand_total:,.2f}")
        c.setFillColorRGB(0.1, 0.1, 0.1)

        c.setFont("Helvetica-Bold", 7.5)
        c.drawString(335, 138, amt_words)

    # --- PAGE 2 DRAWING (IF MULTI-PAGE) ---
    if is_multi_page:
        c.showPage() # End Page 1, start Page 2

        if os.path.exists(bg_multi_p2):
            c.drawImage(bg_multi_p2, 0, 0, width=width, height=height)

        # Page 2 Top Meta Strip
        c.setFont("Helvetica-Bold", 8)
        c.drawString(75, 735, inv_num_str)
        c.drawString(190, 735, str(getattr(invoice, "patient_name", "") or getattr(invoice, "client_name", "")))
        c.drawString(330, 735, billing_period_str)
        c.drawString(515, 735, "2 of 2")

        # Barcode on Page 2
        try:
            barcode_obj = code128.Code128(inv_num_clean, barHeight=22, barWidth=1.0)
            barcode_obj.drawOn(c, 435, 770)
        except Exception:
            pass

        # Page 2 Service Rows (Items 10+)
        page2_items = services[9:]
        y_pos = 665
        for idx, item in enumerate(page2_items, 10):
            s_no = item.get("s_no", idx)
            name = item.get("service_name", "")
            desc = item.get("description", "")
            rate = float(item.get("rate", 0))
            days = item.get("days", 1)
            amt = float(item.get("amount", rate * days))
            oth = float(item.get("other_expenses", 0))
            tot = float(item.get("total", amt + oth))

            c.setFont("Helvetica-Bold", 7.5)
            c.drawCentredString(32, y_pos, str(s_no))
            c.drawString(56, y_pos, name[:45])
            
            if desc:
                c.setFont("Helvetica", 6.5)
                c.setFillColorRGB(0.3, 0.3, 0.3)
                c.drawString(56, y_pos - 8, desc[:60])
                c.setFillColorRGB(0.1, 0.1, 0.1)

            c.setFont("Helvetica", 7.5)
            c.drawRightString(292, y_pos, f"₹ {rate:,.2f}" if rate > 0 else "0.00")
            c.drawCentredString(330, y_pos, str(days))
            c.drawRightString(410, y_pos, f"₹ {amt:,.2f}" if amt > 0 else "0.00")
            c.drawRightString(500, y_pos, f"₹ {oth:,.2f}" if oth > 0 else "Not Applicable")
            c.setFont("Helvetica-Bold", 7.5)
            c.drawRightString(568, y_pos, f"₹ {tot:,.2f}" if tot > 0 else "0.00")

            y_pos -= 26

        # Page 2 Remarks & Totals
        c.setFont("Helvetica", 7)
        rem_text = str(getattr(invoice, "remarks", "") or "Invoice for the service period. Kindly process the due amount at the earliest.")
        c.drawString(35, 245, rem_text[:65])

        subtotal = float(getattr(invoice, "subtotal", 0) or 0)
        gst = float(getattr(invoice, "gst", 0) or 0)
        discount = float(getattr(invoice, "discount", 0) or 0)
        tot_after_gst = float(getattr(invoice, "total_after_gst", 0) or 0)
        balance_due = float(getattr(invoice, "balance_due", 0) or 0)
        grand_total = float(getattr(invoice, "grand_total", 0) or 0)
        amt_words = str(getattr(invoice, "amount_in_words", "") or amount_in_rupees_words(grand_total))

        c.setFont("Helvetica-Bold", 8)
        c.drawRightString(568, 252, f"₹ {gst:,.2f}")
        c.drawRightString(568, 234, f"₹ {discount:,.2f}")
        c.drawRightString(568, 216, f"₹ {tot_after_gst:,.2f}")
        c.drawRightString(568, 198, f"₹ {adv_amt:,.2f}")
        c.drawRightString(568, 180, f"₹ {balance_due:,.2f}")
        
        c.setFont("Helvetica-Bold", 9)
        c.setFillColorRGB(1.0, 1.0, 1.0)
        c.drawRightString(568, 158, f"₹ {grand_total:,.2f}")
        c.setFillColorRGB(0.1, 0.1, 0.1)

        c.setFont("Helvetica-Bold", 7.5)
        c.drawString(335, 138, amt_words)

    c.save()
    pdf_data = buffer.getvalue()
    buffer.close()
    return pdf_data
