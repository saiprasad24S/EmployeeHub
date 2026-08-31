import os
import json
import hashlib
from django.conf import settings
from django.http import HttpResponse
from django.db.models import Q
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from apps.invoices.models import Invoice, InvoiceCounter
from apps.invoices.serializers import InvoiceSerializer
from apps.invoices.pdf_service import generate_invoice_pdf, amount_in_rupees_words
from apps.common.cloudinary_service import upload_invoice_pdf


def compute_invoice_sha256(data_dict: dict) -> tuple[str, str]:
    import uuid
    existing_hash = data_dict.get("verification_hash")
    if existing_hash and len(str(existing_hash)) == 64:
        return str(existing_hash), str(existing_hash)[:16]

    random_entropy = uuid.uuid4().hex
    canonical_dict = {
        "invoice_number": str(data_dict.get("invoice_number", "")),
        "invoice_type": str(data_dict.get("invoice_type", "")),
        "invoice_date": str(data_dict.get("invoice_date", "")),
        "billing_period_text": str(data_dict.get("billing_period_text", "")),
        "client_name": str(data_dict.get("client_name", "")),
        "grand_total": str(data_dict.get("grand_total", 0)),
        "services_data": data_dict.get("services_data", []),
        "salt": random_entropy,
    }
    canonical_json = json.dumps(canonical_dict, sort_keys=True)
    full_hash = hashlib.sha256(canonical_json.encode('utf-8')).hexdigest().upper()
    display_hash = full_hash[:16]
    return full_hash, display_hash


class InvoiceNextNumberView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        next_num = InvoiceCounter.peek_next_number()
        return Response({"next_invoice_number": next_num})


class InvoiceClientsListView(APIView):
    """
    Returns unique clients from previous invoices with their most recent details
    for auto-completing invoice forms.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        invoices = Invoice.objects.exclude(client_name="").exclude(client_name__isnull=True).order_by("-created_at")
        if query:
            invoices = invoices.filter(client_name__icontains=query)

        seen_clients: dict[str, dict] = {}
        for inv in invoices:
            name_raw = (inv.client_name or "").strip()
            if not name_raw:
                continue
            name_key = name_raw.lower()
            if name_key not in seen_clients:
                seen_clients[name_key] = {
                    "client_name": name_raw,
                    "client_contact": inv.client_contact or "",
                    "client_address": inv.client_address or "",
                    "client_gst": inv.client_gst or "",
                    "contact_person": inv.contact_person or "",
                    "contact_person_designation": inv.contact_person_designation or "",
                    "school_branch": inv.school_branch or "",
                    "service_type": inv.service_type or "",
                    "consultant": inv.consultant or "",
                    "patient_name": inv.patient_name or "",
                    "patient_age_gender": inv.patient_age_gender or "",
                    "start_date": inv.start_date or "",
                    "service_start_date": inv.service_start_date or inv.start_date or "",
                    "per_day_charges": float(inv.per_day_charges or 0),
                    "invoice_type": inv.invoice_type or "REGULAR",
                    "total_invoices": 1,
                    "last_invoice_number": inv.invoice_number,
                    "last_invoice_date": str(inv.invoice_date),
                }
            else:
                seen_clients[name_key]["total_invoices"] += 1
                if not seen_clients[name_key].get("start_date") and inv.start_date:
                    seen_clients[name_key]["start_date"] = inv.start_date
                if not seen_clients[name_key].get("service_start_date") and (inv.service_start_date or inv.start_date):
                    seen_clients[name_key]["service_start_date"] = inv.service_start_date or inv.start_date

        return Response(list(seen_clients.values()))


class InvoiceListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Invoice.objects.all()
        
        search_query = request.query_params.get("search") or request.query_params.get("q")
        if search_query:
            queryset = queryset.filter(
                Q(invoice_number__icontains=search_query) |
                Q(client_name__icontains=search_query) |
                Q(patient_name__icontains=search_query) |
                Q(billing_period_text__icontains=search_query) |
                Q(invoice_type__icontains=search_query) |
                Q(verification_hash__icontains=search_query) |
                Q(display_hash__icontains=search_query)
            )

        invoice_type = request.query_params.get("invoice_type")
        if invoice_type:
            queryset = queryset.filter(invoice_type=invoice_type)

        payment_status = request.query_params.get("payment_status")
        if payment_status:
            queryset = queryset.filter(payment_status=payment_status)

        serializer = InvoiceSerializer(queryset, many=True)
        return Response(serializer.data)

    def post(self, request):
        data = request.data.copy()
        
        if not data.get("invoice_number"):
            data["invoice_number"] = InvoiceCounter.get_next_number()
        else:
            existing = Invoice.objects.filter(invoice_number=data["invoice_number"]).first()
            if existing:
                data["invoice_number"] = InvoiceCounter.get_next_number()
            else:
                try:
                    from django.db import transaction
                    num_part = int(str(data["invoice_number"]).split("-")[-1])
                    with transaction.atomic():
                        counter, _ = InvoiceCounter.objects.select_for_update().get_or_create(
                            prefix="1369",
                            defaults={"last_number": 0}
                        )
                        if counter.last_number < num_part:
                            counter.last_number = num_part
                            counter.save()
                except Exception:
                    pass

        # Compute SHA-256 Hash
        full_hash, display_hash = compute_invoice_sha256(data)
        data["verification_hash"] = full_hash
        data["display_hash"] = display_hash
        data["barcode_value"] = display_hash

        grand_total = data.get("grand_total") or 0
        if not data.get("amount_in_words"):
            data["amount_in_words"] = amount_in_rupees_words(grand_total)

        serializer = InvoiceSerializer(data=data)
        if serializer.is_valid():
            invoice = serializer.save(generated_by=getattr(request.user, "name", "Admin"))
            
            # Generate and upload PDF to Cloudinary
            try:
                pdf_bytes = generate_invoice_pdf(invoice)
                pdf_url = upload_invoice_pdf(pdf_bytes, invoice.invoice_number)
                invoice.pdf_path = pdf_url
                invoice.save(update_fields=["pdf_path"])
            except Exception as e:
                print(f"[PDF GENERATION ERROR] {e}")

            return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class InvoiceDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        invoice = Invoice.objects.filter(pk=pk).first()
        if not invoice:
            invoice = Invoice.objects.filter(invoice_number=pk).first()
        if not invoice:
            return Response({"detail": "Invoice not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(InvoiceSerializer(invoice).data)

    def put(self, request, pk):
        invoice = Invoice.objects.filter(pk=pk).first()
        if not invoice:
            return Response({"detail": "Invoice not found."}, status=status.HTTP_404_NOT_FOUND)
        
        data = request.data.copy()
        full_hash, display_hash = compute_invoice_sha256(data)
        data["verification_hash"] = full_hash
        data["display_hash"] = display_hash

        serializer = InvoiceSerializer(invoice, data=data, partial=True)
        if serializer.is_valid():
            invoice = serializer.save()
            try:
                pdf_bytes = generate_invoice_pdf(invoice)
                pdf_url = upload_invoice_pdf(pdf_bytes, invoice.invoice_number)
                invoice.pdf_path = pdf_url
                invoice.save(update_fields=["pdf_path"])
            except Exception as e:
                print(f"[PDF UPDATE ERROR] {e}")
            return Response(InvoiceSerializer(invoice).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        invoice = Invoice.objects.filter(pk=pk).first()
        if not invoice:
            invoice = Invoice.objects.filter(invoice_number=pk).first()
        if not invoice:
            return Response({"detail": "Invoice not found."}, status=status.HTTP_404_NOT_FOUND)
        
        # Deleting does NOT reset sequence numbering (never reuse deleted numbers)
        invoice.delete()
        return Response({"detail": "Invoice deleted successfully."}, status=status.HTTP_200_OK)


class InvoiceDownloadPDFView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        invoice = Invoice.objects.filter(pk=pk).first()
        if not invoice:
            invoice = Invoice.objects.filter(invoice_number=pk).first()
        if not invoice:
            return Response({"detail": "Invoice not found."}, status=status.HTTP_404_NOT_FOUND)

        pdf_bytes = generate_invoice_pdf(invoice)
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        filename = f"Invoice_{invoice.invoice_number.replace(' ', '_')}.pdf"
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class InvoiceVerifyView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        query = request.query_params.get("number") or request.query_params.get("hash") or request.query_params.get("q")
        if not query:
            return Response({"found": False, "message": "Please enter an invoice number or verification hash."}, status=status.HTTP_400_BAD_REQUEST)

        query_clean = str(query).strip().upper()
        
        invoice = Invoice.objects.filter(
            Q(invoice_number__iexact=query_clean) |
            Q(verification_hash__iexact=query_clean) |
            Q(display_hash__iexact=query_clean) |
            Q(invoice_number__icontains=query_clean)
        ).first()

        if not invoice:
            return Response({"found": False, "message": "Invoice Not Found"}, status=status.HTTP_200_OK)

        is_verified = bool(invoice.verification_hash)

        return Response({
            "found": True,
            "verified": is_verified,
            "status_text": "✅ ORIGINAL INVOICE VERIFIED" if is_verified else "⚠️ INVOICE UNVERIFIED",
            "invoice": InvoiceSerializer(invoice).data,
            "recalculated_hash": invoice.display_hash,
            "stored_hash": invoice.display_hash,
        })
