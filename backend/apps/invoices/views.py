import os
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


class InvoiceNextNumberView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        next_num = InvoiceCounter.peek_next_number()
        return Response({"next_invoice_number": next_num})


class InvoiceListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Invoice.objects.all()
        
        # Search parameters
        search_query = request.query_params.get("search") or request.query_params.get("q")
        if search_query:
            queryset = queryset.filter(
                Q(invoice_number__icontains=search_query) |
                Q(client_name__icontains=search_query) |
                Q(patient_name__icontains=search_query) |
                Q(billing_period_text__icontains=search_query) |
                Q(invoice_type__icontains=search_query) |
                Q(barcode_value__icontains=search_query)
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
        
        # Generate next invoice number if not provided or empty
        if not data.get("invoice_number"):
            data["invoice_number"] = InvoiceCounter.get_next_number()
        else:
            # Check uniqueness
            existing = Invoice.objects.filter(invoice_number=data["invoice_number"]).first()
            if existing:
                data["invoice_number"] = InvoiceCounter.get_next_number()

        # Set barcode value
        data["barcode_value"] = str(data["invoice_number"]).replace(" ", "")

        # Compute Amount In Words if not present
        grand_total = data.get("grand_total") or 0
        if not data.get("amount_in_words"):
            data["amount_in_words"] = amount_in_rupees_words(grand_total)

        serializer = InvoiceSerializer(data=data)
        if serializer.is_valid():
            invoice = serializer.save(generated_by=getattr(request.user, "name", "Admin"))
            
            # Generate and store PDF file
            try:
                pdf_bytes = generate_invoice_pdf(invoice)
                pdf_dir = os.path.join(settings.BASE_DIR, "media", "invoices")
                os.makedirs(pdf_dir, exist_ok=True)
                pdf_filename = f"{invoice.invoice_number.replace(' ', '_')}.pdf"
                pdf_full_path = os.path.join(pdf_dir, pdf_filename)
                
                with open(pdf_full_path, "wb") as f:
                    f.write(pdf_bytes)

                invoice.pdf_path = f"/media/invoices/{pdf_filename}"
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
        serializer = InvoiceSerializer(invoice, data=request.data, partial=True)
        if serializer.is_valid():
            invoice = serializer.save()
            # Regenerate PDF
            try:
                pdf_bytes = generate_invoice_pdf(invoice)
                pdf_dir = os.path.join(settings.BASE_DIR, "media", "invoices")
                os.makedirs(pdf_dir, exist_ok=True)
                pdf_filename = f"{invoice.invoice_number.replace(' ', '_')}.pdf"
                pdf_full_path = os.path.join(pdf_dir, pdf_filename)
                with open(pdf_full_path, "wb") as f:
                    f.write(pdf_bytes)
                invoice.pdf_path = f"/media/invoices/{pdf_filename}"
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
        
        # Deleting does NOT reset sequence numbering (per spec requirement)
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
        query = request.query_params.get("number") or request.query_params.get("barcode") or request.query_params.get("q")
        if not query:
            return Response({"found": False, "message": "Please provide an invoice number or scan barcode."}, status=status.HTTP_400_BAD_REQUEST)

        query_clean = str(query).strip()
        invoice = Invoice.objects.filter(
            Q(invoice_number__iexact=query_clean) |
            Q(barcode_value__iexact=query_clean.replace(" ", "")) |
            Q(invoice_number__icontains=query_clean)
        ).first()

        if not invoice:
            return Response({"found": False, "message": "Invoice Not Found"}, status=status.HTTP_200_OK)

        return Response({
            "found": True,
            "invoice": InvoiceSerializer(invoice).data
        })
