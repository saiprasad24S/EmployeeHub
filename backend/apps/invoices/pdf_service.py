import os
from io import BytesIO
from decimal import Decimal
from django.conf import settings
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import (
    HRFlowable, Image as RLImage, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
)
from reportlab.graphics.barcode import code128

# Convert number to words helper
UNITS = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
         "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

def num_to_words(n: int) -> str:
    if n == 0:
        return "Zero"
    if n < 0:
        return "Minus " + num_to_words(abs(n))
    
    words = ""
    if n >= 10000000: # Crore
        words += num_to_words(n // 10000000) + " Crore "
        n %= 10000000
    if n >= 100000: # Lakh
        words += num_to_words(n // 100000) + " Lakh "
        n %= 100000
    if n >= 1000: # Thousand
        words += num_to_words(n // 1000) + " Thousand "
        n %= 1000
    if n >= 100: # Hundred
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
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=20,
        rightMargin=20,
        topMargin=15,
        bottomMargin=15
    )
    story = []

    # Brand Colors
    PRIMARY = colors.HexColor("#102A71")     # Deep Navy
    SECONDARY = colors.HexColor("#6B2FA0")   # Purple Accent
    TEXT_DARK = colors.HexColor("#1A1A1A")
    MUTED = colors.HexColor("#595959")
    BG_LIGHT = colors.HexColor("#F8FAFC")
    BORDER_CLR = colors.HexColor("#CBD5E1")

    # Typography styles
    style_normal = ParagraphStyle('Norm', fontName='Helvetica', fontSize=7.5, leading=9.5, textColor=TEXT_DARK)
    style_bold = ParagraphStyle('NormB', fontName='Helvetica-Bold', fontSize=7.5, leading=9.5, textColor=TEXT_DARK)
    style_title = ParagraphStyle('TitleP', fontName='Helvetica-Bold', fontSize=16, leading=18, textColor=PRIMARY)

    # Static asset paths
    assets_dir = os.path.join(settings.BASE_DIR, "static", "invoice")
    logo_path = os.path.join(assets_dir, "skandan_logo.png")
    seal_path = os.path.join(assets_dir, "skandan_verified_seal.png")
    hdfc_path = os.path.join(assets_dir, "hdfc_logo.png")
    qr_path = os.path.join(assets_dir, "payment_qr_clean.png")

    # Barcode Drawing
    inv_num_clean = str(invoice.invoice_number).replace(" ", "")
    barcode_obj = code128.Code128(inv_num_clean, barHeight=24, barWidth=1.1)

    services = invoice.services_data or []
    is_multi_page = invoice.invoice_type == "MULTI_SERVICE" or len(services) > 8

    # Helper function for service table headers
    def get_service_table_header():
        return [
            Paragraph("<b>S.No.</b>", ParagraphStyle('TH', parent=style_bold, textColor=colors.white, alignment=1)),
            Paragraph("<b>Particulars / Service Details</b>", ParagraphStyle('TH', parent=style_bold, textColor=colors.white)),
            Paragraph("<b>Per Day Rate (₹)</b>", ParagraphStyle('TH', parent=style_bold, textColor=colors.white, alignment=1)),
            Paragraph("<b>No. of Days</b>", ParagraphStyle('TH', parent=style_bold, textColor=colors.white, alignment=1)),
            Paragraph("<b>Amount (₹)</b>", ParagraphStyle('TH', parent=style_bold, textColor=colors.white, alignment=1)),
            Paragraph("<b>Other Expenses (₹)</b>", ParagraphStyle('TH', parent=style_bold, textColor=colors.white, alignment=1)),
            Paragraph("<b>Total (₹)</b>", ParagraphStyle('TH', parent=style_bold, textColor=colors.white, alignment=1)),
        ]

    # --- FULL HEADER BLOCK (Page 1) ---
    logo_img = RLImage(logo_path, width=190, height=48) if os.path.exists(logo_path) else Paragraph("<b>SKANDAN HOME CARE</b>", style_title)
    
    top_header_table = Table([
        [
            logo_img,
            Paragraph("<font size=20 color='#102A71'><b>INVOICE</b></font>", ParagraphStyle('HRight', parent=style_normal, alignment=2)),
        ],
        [
            Paragraph("", style_normal),
            barcode_obj,
        ]
    ], colWidths=[320, 235])
    top_header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ALIGN', (1,0), (1,-1), 'RIGHT'),
    ]))
    story.append(top_header_table)
    story.append(Spacer(1, 4))

    # --- SUB-HEADER 3-COLUMN BOXED GRID ---
    col1_addr = (
        "<b>Plot No 13, SY NO 3,4, RR Plaza,</b><br/>"
        "Madhapur, Hyderabad,<br/>"
        "Telangana – 500081"
    )
    col2_contact = (
        "<b>+91 96609 66369</b><br/>"
        "<b>info@skandanhomecarre.com</b><br/>"
        "<b>www.skandanhomecarre.com</b>"
    )
    col3_meta = (
        f"<b>Invoice No. :</b> {invoice.invoice_number}<br/>"
        f"<b>Invoice Date :</b> {invoice.invoice_date.strftime('%d-%b-%Y') if invoice.invoice_date else ''}<br/>"
        f"<b>Billing Period :</b> {invoice.billing_period_text or 'Monthly'}<br/>"
        f"<b>Start Date :</b> {invoice.start_date.strftime('%d-%b-%Y') if invoice.start_date else ''}"
    )

    sub_header_data = [[
        Paragraph(col1_addr, style_normal),
        Paragraph(col2_contact, style_normal),
        Paragraph(col3_meta, style_normal),
    ]]
    sub_header_table = Table(sub_header_data, colWidths=[185, 185, 185])
    sub_header_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BG_LIGHT),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER_CLR),
        ('PADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(sub_header_table)
    story.append(Spacer(1, 8))

    # --- CLIENT & SERVICE PROFILE BLOCK ---
    client_box = [
        [Paragraph("<font color='#102A71'><b>BILLED TO (CLIENT)</b></font>", style_bold)],
        [Paragraph(f"<b>Client Name:</b> {invoice.client_name}", style_normal)],
        [Paragraph(f"<b>Contact No:</b> {invoice.client_contact}", style_normal)],
        [Paragraph(f"<b>Address:</b> {invoice.client_address}", style_normal)],
        [Paragraph(f"<b>GST No:</b> {invoice.client_gst or 'N/A'}", style_normal)],
    ]
    
    if invoice.invoice_type == "SCHOOL":
        profile_box = [
            [Paragraph("<font color='#102A71'><b>INSTITUTION DETAILS</b></font>", style_bold)],
            [Paragraph(f"<b>School/Branch:</b> {invoice.school_branch or invoice.client_name}", style_normal)],
            [Paragraph(f"<b>Contact Person:</b> {invoice.contact_person}", style_normal)],
            [Paragraph(f"<b>Designation:</b> {invoice.contact_person_designation}", style_normal)],
            [Paragraph(f"<b>Nurses / Students:</b> {invoice.no_of_nurses} Nurses / {invoice.no_of_students} Students", style_normal)],
        ]
    else:
        profile_box = [
            [Paragraph("<font color='#102A71'><b>SERVICE PROFILE</b></font>", style_bold)],
            [Paragraph(f"<b>Patient:</b> {invoice.patient_name}", style_normal)],
            [Paragraph(f"<b>Age / Gender:</b> {invoice.patient_age_gender}", style_normal)],
            [Paragraph(f"<b>Service Type:</b> {invoice.service_type}", style_normal)],
            [Paragraph(f"<b>Consultant:</b> {invoice.consultant}", style_normal)],
        ]

    other_box = [
        [Paragraph("<font color='#102A71'><b>OTHER INFORMATION</b></font>", style_bold)],
        [Paragraph(f"<b>Per Day Charges:</b> ₹ {invoice.per_day_charges:,.2f}", style_normal)],
        [Paragraph(f"<b>Advance Amount:</b> ₹ {invoice.advance_received:,.2f}", style_normal)],
        [Paragraph(f"<b>Payment Status:</b> <font color='#102A71'><b>{invoice.payment_status}</b></font>", style_normal)],
        [Paragraph(f"<b>Rendered Days:</b> {invoice.rendered_days or 'N/A'}", style_normal)],
    ]

    tbl_client = Table(client_box, colWidths=[180])
    tbl_client.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BG_LIGHT),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER_CLR),
        ('PADDING', (0,0), (-1,-1), 4),
    ]))

    tbl_profile = Table(profile_box, colWidths=[180])
    tbl_profile.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BG_LIGHT),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER_CLR),
        ('PADDING', (0,0), (-1,-1), 4),
    ]))

    tbl_other = Table(other_box, colWidths=[180])
    tbl_other.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BG_LIGHT),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER_CLR),
        ('PADDING', (0,0), (-1,-1), 4),
    ]))

    profile_row_table = Table([[tbl_client, tbl_profile, tbl_other]], colWidths=[185, 185, 185])
    profile_row_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(profile_row_table)
    story.append(Spacer(1, 8))

    # --- SERVICE DETAILS TABLE ---
    if is_multi_page:
        # Split items: Page 1 gets items 1..9, Page 2 gets items 10+
        page1_items = services[:9]
        page2_items = services[9:]

        # Page 1 Service Table
        table_rows_p1 = [get_service_table_header()]
        for idx, item in enumerate(page1_items, 1):
            s_no = item.get("s_no", idx)
            name = item.get("service_name", f"Service #{idx}")
            desc = item.get("description", "")
            rate = float(item.get("rate", 0))
            days = item.get("days", 1)
            amt = float(item.get("amount", rate * days))
            oth = float(item.get("other_expenses", 0))
            tot = float(item.get("total", amt + oth))
            desc_p = Paragraph(f"<b>{name}</b><br/><font color='#595959' size=7>{desc}</font>", style_normal)
            table_rows_p1.append([
                Paragraph(str(s_no), ParagraphStyle('TC', parent=style_normal, alignment=1)),
                desc_p,
                Paragraph(f"{rate:,.2f}", ParagraphStyle('TC', parent=style_normal, alignment=1)),
                Paragraph(str(days), ParagraphStyle('TC', parent=style_normal, alignment=1)),
                Paragraph(f"{amt:,.2f}", ParagraphStyle('TC', parent=style_normal, alignment=1)),
                Paragraph(f"{oth:,.2f}" if oth > 0 else "Not Applicable", ParagraphStyle('TC', parent=style_normal, alignment=1)),
                Paragraph(f"<b>{tot:,.2f}</b>", ParagraphStyle('TC', parent=style_normal, alignment=1)),
            ])

        s_table_p1 = Table(table_rows_p1, colWidths=[35, 185, 75, 55, 65, 70, 70])
        s_table_p1.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), PRIMARY),
            ('ALIGN', (0,0), (-1,0), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('GRID', (0,0), (-1,-1), 0.5, BORDER_CLR),
            ('TOPPADDING', (0,0), (-1,-1), 3),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ]))
        story.append(s_table_p1)
        story.append(Spacer(1, 15))

        # Bottom Page 1 Indicator
        cont_text = Paragraph("<font color='#102A71' size=10><b>Continued on Next Page &rarr;</b></font>", ParagraphStyle('Cont', parent=style_normal, alignment=1))
        story.append(cont_text)
        story.append(PageBreak())

        # --- PAGE 2 HEADER (Matching Image 4) ---
        p2_header_data = [
            [
                logo_img,
                Paragraph("<font size=16 color='#102A71'><b>INVOICE</b></font>", ParagraphStyle('HRight', parent=style_normal, alignment=2)),
            ],
            [
                Paragraph("", style_normal),
                barcode_obj,
            ],
        ]
        p2_header_table = Table(p2_header_data, colWidths=[320, 235])
        p2_header_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('ALIGN', (1,0), (1,-1), 'RIGHT'),
        ]))
        story.append(p2_header_table)
        story.append(Spacer(1, 4))

        # Page 2 Meta strip (Invoice No, Patient Name, Billing Period, Page 2 of 2)
        meta_strip_data = [[
            Paragraph(f"<b>Invoice No.:</b><br/>{invoice.invoice_number}", style_normal),
            Paragraph(f"<b>Patient / Client Name:</b><br/>{invoice.patient_name or invoice.client_name}", style_normal),
            Paragraph(f"<b>Billing Period:</b><br/>{invoice.billing_period_text}", style_normal),
            Paragraph("<b>Page:</b><br/>2 of 2", style_normal),
        ]]
        meta_strip_table = Table(meta_strip_data, colWidths=[130, 160, 185, 80])
        meta_strip_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), BG_LIGHT),
            ('BOX', (0,0), (-1,-1), 0.5, BORDER_CLR),
            ('PADDING', (0,0), (-1,-1), 4),
        ]))
        story.append(meta_strip_table)
        story.append(Spacer(1, 8))

        story.append(Paragraph("<font color='#102A71' size=9><b>SERVICE DETAILS (CONTINUED)</b></font>", style_bold))
        story.append(Spacer(1, 4))

        # Page 2 Service Table
        table_rows_p2 = [get_service_table_header()]
        for idx, item in enumerate(page2_items, 10):
            s_no = item.get("s_no", idx)
            name = item.get("service_name", f"Service #{idx}")
            desc = item.get("description", "")
            rate = float(item.get("rate", 0))
            days = item.get("days", 1)
            amt = float(item.get("amount", rate * days))
            oth = float(item.get("other_expenses", 0))
            tot = float(item.get("total", amt + oth))
            desc_p = Paragraph(f"<b>{name}</b><br/><font color='#595959' size=7>{desc}</font>", style_normal)
            table_rows_p2.append([
                Paragraph(str(s_no), ParagraphStyle('TC', parent=style_normal, alignment=1)),
                desc_p,
                Paragraph(f"{rate:,.2f}", ParagraphStyle('TC', parent=style_normal, alignment=1)),
                Paragraph(str(days), ParagraphStyle('TC', parent=style_normal, alignment=1)),
                Paragraph(f"{amt:,.2f}", ParagraphStyle('TC', parent=style_normal, alignment=1)),
                Paragraph(f"{oth:,.2f}" if oth > 0 else "Not Applicable", ParagraphStyle('TC', parent=style_normal, alignment=1)),
                Paragraph(f"<b>{tot:,.2f}</b>", ParagraphStyle('TC', parent=style_normal, alignment=1)),
            ])

        s_table_p2 = Table(table_rows_p2, colWidths=[35, 185, 75, 55, 65, 70, 70])
        s_table_p2.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), PRIMARY),
            ('ALIGN', (0,0), (-1,0), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('GRID', (0,0), (-1,-1), 0.5, BORDER_CLR),
            ('TOPPADDING', (0,0), (-1,-1), 3),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ]))
        story.append(s_table_p2)
        story.append(Spacer(1, 8))

    else:
        # Single Page Service Table (Regular / School)
        table_rows = [get_service_table_header()]
        for idx, item in enumerate(services, 1):
            s_no = item.get("s_no", idx)
            name = item.get("service_name", f"Service #{idx}")
            desc = item.get("description", "")
            rate = float(item.get("rate", 0))
            days = item.get("days", 1)
            amt = float(item.get("amount", rate * days))
            oth = float(item.get("other_expenses", 0))
            tot = float(item.get("total", amt + oth))
            desc_p = Paragraph(f"<b>{name}</b><br/><font color='#595959' size=7>{desc}</font>", style_normal)
            table_rows.append([
                Paragraph(str(s_no), ParagraphStyle('TC', parent=style_normal, alignment=1)),
                desc_p,
                Paragraph(f"{rate:,.2f}", ParagraphStyle('TC', parent=style_normal, alignment=1)),
                Paragraph(str(days), ParagraphStyle('TC', parent=style_normal, alignment=1)),
                Paragraph(f"{amt:,.2f}", ParagraphStyle('TC', parent=style_normal, alignment=1)),
                Paragraph(f"{oth:,.2f}" if oth > 0 else "Not Applicable", ParagraphStyle('TC', parent=style_normal, alignment=1)),
                Paragraph(f"<b>{tot:,.2f}</b>", ParagraphStyle('TC', parent=style_normal, alignment=1)),
            ])

        service_table = Table(table_rows, colWidths=[35, 185, 75, 55, 65, 70, 70])
        service_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), PRIMARY),
            ('ALIGN', (0,0), (-1,0), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('GRID', (0,0), (-1,-1), 0.5, BORDER_CLR),
            ('TOPPADDING', (0,0), (-1,-1), 3),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ]))
        story.append(service_table)
        story.append(Spacer(1, 8))

    # --- FINANCIAL TOTALS & REMARKS & BANK BLOCK (Final Page) ---
    remarks_text = invoice.remarks or f"Invoice for the month of {invoice.billing_period_text or 'Service Period'}. Kindly process the due amount at the earliest."
    remarks_box = [
        [Paragraph("<font color='#102A71'><b>REMARKS</b></font>", style_bold)],
        [Paragraph(remarks_text, style_normal)],
    ]
    tbl_remarks = Table(remarks_box, colWidths=[240])
    tbl_remarks.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BG_LIGHT),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER_CLR),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))

    totals_box = [
        [Paragraph("Subtotal", style_normal), Paragraph(f"₹ {invoice.subtotal:,.2f}", ParagraphStyle('TR', parent=style_normal, alignment=2))],
        [Paragraph("GST", style_normal), Paragraph(f"₹ {invoice.gst:,.2f}", ParagraphStyle('TR', parent=style_normal, alignment=2))],
        [Paragraph("Discount", style_normal), Paragraph(f"₹ {invoice.discount:,.2f}", ParagraphStyle('TR', parent=style_normal, alignment=2))],
        [Paragraph("Total After GST", style_bold), Paragraph(f"₹ {invoice.total_after_gst:,.2f}", ParagraphStyle('TR', parent=style_bold, alignment=2))],
        [Paragraph("Advance Received", style_normal), Paragraph(f"₹ {invoice.advance_received:,.2f}", ParagraphStyle('TR', parent=style_normal, alignment=2))],
        [Paragraph("Balance Due", style_bold), Paragraph(f"₹ {invoice.balance_due:,.2f}", ParagraphStyle('TR', parent=style_bold, alignment=2))],
        [
            Paragraph("<font color='white' size=9><b>GRAND TOTAL</b></font>", style_bold),
            Paragraph(f"<font color='white' size=10><b>₹ {invoice.grand_total:,.2f}</b></font>", ParagraphStyle('TR', parent=style_bold, alignment=2))
        ]
    ]

    tbl_totals = Table(totals_box, colWidths=[150, 150])
    tbl_totals.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-2), 0.5, BORDER_CLR),
        ('BACKGROUND', (0,6), (-1,6), PRIMARY),
        ('PADDING', (0,0), (-1,-1), 3),
    ]))

    words_p = Paragraph(f"<b>Amount In Words:</b> {invoice.amount_in_words or amount_in_rupees_words(invoice.grand_total)}", ParagraphStyle('W', parent=style_bold, textColor=PRIMARY))

    tot_block_table = Table([
        [tbl_remarks, tbl_totals],
        [words_p, '']
    ], colWidths=[245, 310])
    tot_block_table.setStyle(TableStyle([
        ('SPAN', (0,1), (1,1)),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))

    # --- BANK & UPI PAYMENT BLOCK ---
    bank_text = (
        "<b>BANK TRANSFER (NEFT / RTGS)</b><br/>"
        "<b>Beneficiary Name:</b> SKANDAN HOME CARE & CCLINIC LLP<br/>"
        "<b>Account Number:</b> 50200090644327<br/>"
        "<b>Account Type:</b> Current Account<br/>"
        "<b>IFSC Code:</b> HDFC0004277<br/>"
        "<b>MICR Code:</b> 500240078"
    )

    qr_img = RLImage(qr_path, width=65, height=65) if os.path.exists(qr_path) else Paragraph("[QR CODE]", style_normal)
    seal_img = RLImage(seal_path, width=65, height=65) if os.path.exists(seal_path) else Paragraph("[SEAL]", style_normal)

    upi_text = (
        "<b>UPI PAYMENT</b><br/>"
        "<b>UPI ID:</b> 9866613699@hdfcbank<br/>"
        "<font color='#595959'>Google Pay | PhonePe | Paytm</font>"
    )

    bank_table_data = [
        [
            Paragraph(bank_text, style_normal),
            Paragraph(upi_text, style_normal),
            qr_img,
            seal_img
        ]
    ]

    bank_table = Table(bank_table_data, colWidths=[230, 160, 80, 85])
    bank_table.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.5, BORDER_CLR),
        ('BACKGROUND', (0,0), (-1,-1), BG_LIGHT),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 4),
    ]))

    footer_text = Paragraph("<font color='#595959' size=7>This invoice is system generated. No signature is required.</font>", ParagraphStyle('F', parent=style_normal, alignment=1))

    # School Signatures Table (Only for SCHOOL invoice)
    sig_elements = []
    if invoice.invoice_type == "SCHOOL":
        sig_p1 = Paragraph("<b>Principal Signature</b>", ParagraphStyle('Sig', parent=style_normal, alignment=1, textColor=PRIMARY))
        sig_p2 = Paragraph("<b>AO Signature</b>", ParagraphStyle('Sig', parent=style_normal, alignment=1, textColor=PRIMARY))
        sig_p3 = Paragraph("<b>AGM Signature</b>", ParagraphStyle('Sig', parent=style_normal, alignment=1, textColor=PRIMARY))
        sig_table = Table([[sig_p1, sig_p2, sig_p3]], colWidths=[185, 185, 185])
        sig_table.setStyle(TableStyle([
            ('LINEABOVE', (0,0), (-1,-1), 0.5, BORDER_CLR),
            ('TOPPADDING', (0,0), (-1,-1), 8),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ]))
        sig_elements = [Spacer(1, 4), sig_table]

    # OUR SERVICES Footer Bar (From Image 1/4)
    services_bar_title = Paragraph("<font color='#102A71' size=7.5><b>OUR SERVICES</b></font>", ParagraphStyle('SBTitle', parent=style_normal, alignment=1))
    services_list_text = Paragraph(
        "<font color='#334155' size=6.5>ICU Care at Home &nbsp;|&nbsp; Doctor Visits &nbsp;|&nbsp; Nursing Care &nbsp;|&nbsp; Caretaker Services &nbsp;|&nbsp; Physiotherapy &nbsp;|&nbsp; Lab Tests at Home &nbsp;|&nbsp; Medical Equipment Rental &nbsp;|&nbsp; Medicine Delivery &nbsp;|&nbsp; Post-Operative Care</font>",
        ParagraphStyle('SBBList', parent=style_normal, alignment=1)
    )

    services_bar_table = Table([[services_bar_title], [services_list_text]], colWidths=[555])
    services_bar_table.setStyle(TableStyle([
        ('LINEABOVE', (0,0), (-1,0), 1.5, PRIMARY),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('TOPPADDING', (0,0), (-1,-1), 1),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1),
    ]))

    # Keep Totals & Payment info together
    bottom_items = [
        tot_block_table,
        Spacer(1, 6),
        bank_table,
        *sig_elements,
        Spacer(1, 4),
        footer_text,
        Spacer(1, 4),
        services_bar_table
    ]

    bottom_section = KeepTogether(bottom_items)
    story.append(bottom_section)

    doc.build(story)
    pdf_data = buffer.getvalue()
    buffer.close()
    return pdf_data
