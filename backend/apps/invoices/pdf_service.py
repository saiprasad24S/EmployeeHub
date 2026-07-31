import os
from io import BytesIO
from django.conf import settings
from reportlab.lib import colors
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

    page1_limit = 2 if inv_type == "SCHOOL" else 3
    is_multi_page = inv_type == "MULTI_SERVICE" or len(services) > page1_limit

    inv_num_str = str(getattr(invoice, "invoice_number", "1370 - 0001"))
    inv_num_clean = inv_num_str.replace(" ", "")

    inv_date_str = invoice.invoice_date.strftime("%d-%b-%Y") if getattr(invoice, "invoice_date", None) else ""
    start_date_str = invoice.start_date.strftime("%d-%b-%Y") if getattr(invoice, "start_date", None) else ""
    billing_period_str = str(getattr(invoice, "billing_period_text", "")) or "Monthly"

    # Select Background Template PNG
    if is_multi_page:
        bg_p1 = bg_multi_p1 if os.path.exists(bg_multi_p1) else bg_regular
    elif inv_type == "SCHOOL":
        bg_p1 = bg_school if os.path.exists(bg_school) else bg_regular
    else:
        bg_p1 = bg_regular

    # 1. Draw 300 DPI Background Template Image
    if os.path.exists(bg_p1):
        c.drawImage(bg_p1, 0, 0, width=width, height=height)

    # 2. Draw Verification ID below INVOICE
    disp_hash = getattr(invoice, "display_hash", None) or (getattr(invoice, "verification_hash", "")[:16] if getattr(invoice, "verification_hash", None) else "8A0D4C6E6E7F91C2")
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(colors.HexColor("#102A71"))
    c.drawRightString(550, 770, f"Verification ID : {disp_hash}")

    # 3. Draw Top Right Header Meta Values (Aligned right after colon :)
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(colors.HexColor("#102A71"))
    c.drawString(475, 743, inv_num_str)
    c.drawString(475, 725, inv_date_str)
    c.drawString(475, 707, billing_period_str)
    c.drawString(475, 689, start_date_str)

    # 4. Draw Profile Grid Values
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(colors.HexColor("#1A1A1A"))
    if inv_type == "SCHOOL":
        c.drawString(115, 620, str(getattr(invoice, "school_branch", "") or getattr(invoice, "client_name", "")))
        c.drawString(115, 592, str(getattr(invoice, "contact_person", "")))
        c.drawString(115, 564, str(getattr(invoice, "client_contact", "")))
        c.drawString(115, 536, str(getattr(invoice, "client_address", ""))[:38])
    else:
        c.drawString(110, 620, str(getattr(invoice, "client_name", "")))
        c.drawString(110, 592, str(getattr(invoice, "client_contact", "")))
        c.drawString(110, 564, str(getattr(invoice, "client_address", ""))[:38])
        if getattr(invoice, "client_gst", None):
            c.drawString(110, 536, str(invoice.client_gst))

    # Service Profile (Middle Box)
    if inv_type != "SCHOOL":
        c.setFont("Helvetica", 8)
        c.drawString(278, 620, str(getattr(invoice, "patient_name", "")))
        c.drawString(278, 598, str(getattr(invoice, "patient_age_gender", "")))
        c.drawString(278, 576, str(getattr(invoice, "service_type", "")))
        c.drawString(278, 554, str(getattr(invoice, "consultant", "")))
        c.drawString(278, 532, start_date_str)
        c.drawString(278, 510, "In Process")
        c.drawString(278, 488, str(getattr(invoice, "rendered_days", "") or "30 Days"))

    # Other Information (Right Box)
    c.setFont("Helvetica", 8)
    per_day = float(getattr(invoice, "per_day_charges", 0) or 0)
    adv_amt = float(getattr(invoice, "advance_received", 0) or 0)
    pay_stat = str(getattr(invoice, "payment_status", "Pending"))

    c.drawString(480, 620, f"₹ {per_day:,.2f}" if per_day > 0 else "N/A")
    c.drawString(480, 592, f"₹ {adv_amt:,.2f}" if adv_amt > 0 else "Not Paid")
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(colors.HexColor("#102A71"))
    c.drawString(480, 564, pay_stat)
    c.setFillColor(colors.HexColor("#1A1A1A"))

    # 5. Dynamic Service Details Table Rows
    page1_items = services[:10] if is_multi_page else services
    y_pos = 405
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
            c.setFillColor(colors.HexColor("#595959"))
            c.drawString(56, y_pos - 8, desc[:60])
            c.setFillColor(colors.HexColor("#1A1A1A"))

        c.setFont("Helvetica", 7.5)
        c.drawRightString(292, y_pos, f"₹ {rate:,.2f}" if rate > 0 else "0.00")
        c.drawCentredString(330, y_pos, str(days))
        c.drawRightString(410, y_pos, f"₹ {amt:,.2f}" if amt > 0 else "0.00")
        c.drawRightString(500, y_pos, f"₹ {oth:,.2f}" if oth > 0 else "Not Applicable")
        c.setFont("Helvetica-Bold", 7.5)
        c.drawRightString(568, y_pos, f"₹ {tot:,.2f}" if tot > 0 else "0.00")

        y_pos -= 25

    # If Single-Page Invoice, Draw Remarks & Financial Totals
    if not is_multi_page:
        # Remarks Box
        c.setFont("Helvetica", 7)
        rem_text = str(getattr(invoice, "remarks", "") or "Invoice for the service period. Kindly process the due amount at the earliest.")
        c.drawString(35, 235, rem_text[:65])

        # Financial Summary Totals
        subtotal = float(getattr(invoice, "subtotal", 0) or 0)
        gst = float(getattr(invoice, "gst", 0) or 0)
        discount = float(getattr(invoice, "discount", 0) or 0)
        tot_after_gst = float(getattr(invoice, "total_after_gst", 0) or 0)
        balance_due = float(getattr(invoice, "balance_due", 0) or 0)
        grand_total = float(getattr(invoice, "grand_total", 0) or 0)
        amt_words = str(getattr(invoice, "amount_in_words", "") or amount_in_rupees_words(grand_total))

        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(colors.HexColor("#1A1A1A"))
        c.drawRightString(568, 302, f"₹ {gst:,.2f}")
        c.drawRightString(568, 284, f"₹ {discount:,.2f}")
        c.drawRightString(568, 266, f"₹ {tot_after_gst:,.2f}")
        c.drawRightString(568, 248, f"₹ {adv_amt:,.2f}")
        c.drawRightString(568, 230, f"₹ {balance_due:,.2f}")
        
        # Grand Total inside navy bar
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(colors.white)
        c.drawRightString(568, 205, f"₹ {grand_total:,.2f}")

        # Amount In Words
        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(colors.HexColor("#102A71"))
        c.drawString(345, 180, amt_words)

    # --- PAGE 2 DRAWING (FOR MULTI-PAGE > 3 ITEMS) ---
    if is_multi_page:
        c.showPage()

        if os.path.exists(bg_multi_p2):
            c.drawImage(bg_multi_p2, 0, 0, width=width, height=height)

        # Page 2 Top Meta Strip
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(colors.HexColor("#102A71"))
        c.drawString(75, 735, inv_num_str)
        c.drawString(190, 735, str(getattr(invoice, "patient_name", "") or getattr(invoice, "client_name", "")))
        c.drawString(330, 735, billing_period_str)
        c.drawString(515, 735, "2 of 2")

        # Page 2 Verification ID
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(colors.HexColor("#102A71"))
        c.drawRightString(550, 770, f"Verification ID : {disp_hash}")

        # Page 2 Service Rows
        page2_items = services[10:]
        y_pos = 665
        for idx, item in enumerate(page2_items, 11):
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
                c.setFillColor(colors.HexColor("#595959"))
                c.drawString(56, y_pos - 8, desc[:60])
                c.setFillColor(colors.HexColor("#1A1A1A"))

            c.setFont("Helvetica", 7.5)
            c.drawRightString(292, y_pos, f"₹ {rate:,.2f}" if rate > 0 else "0.00")
            c.drawCentredString(330, y_pos, str(days))
            c.drawRightString(410, y_pos, f"₹ {amt:,.2f}" if amt > 0 else "0.00")
            c.drawRightString(500, y_pos, f"₹ {oth:,.2f}" if oth > 0 else "Not Applicable")
            c.setFont("Helvetica-Bold", 7.5)
            c.drawRightString(568, y_pos, f"₹ {tot:,.2f}" if tot > 0 else "0.00")

            y_pos -= 25

        # Page 2 Remarks & Totals
        c.setFont("Helvetica", 7)
        rem_text = str(getattr(invoice, "remarks", "") or "Invoice for the service period. Kindly process the due amount at the earliest.")
        c.drawString(35, 235, rem_text[:65])

        subtotal = float(getattr(invoice, "subtotal", 0) or 0)
        gst = float(getattr(invoice, "gst", 0) or 0)
        discount = float(getattr(invoice, "discount", 0) or 0)
        tot_after_gst = float(getattr(invoice, "total_after_gst", 0) or 0)
        balance_due = float(getattr(invoice, "balance_due", 0) or 0)
        grand_total = float(getattr(invoice, "grand_total", 0) or 0)
        amt_words = str(getattr(invoice, "amount_in_words", "") or amount_in_rupees_words(grand_total))

        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(colors.HexColor("#1A1A1A"))
        c.drawRightString(568, 302, f"₹ {gst:,.2f}")
        c.drawRightString(568, 284, f"₹ {discount:,.2f}")
        c.drawRightString(568, 266, f"₹ {tot_after_gst:,.2f}")
        c.drawRightString(568, 248, f"₹ {adv_amt:,.2f}")
        c.drawRightString(568, 230, f"₹ {balance_due:,.2f}")
        
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(colors.white)
        c.drawRightString(568, 205, f"₹ {grand_total:,.2f}")

        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(colors.HexColor("#102A71"))
        c.drawString(345, 180, amt_words)

    c.save()
    pdf_data = buffer.getvalue()
    buffer.close()
    return pdf_data
