import json
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

from apps.invoices.models import Invoice, InvoiceCounter
from apps.invoices.pdf_service import (
    generate_invoice_pdf,
    num_to_words,
    amount_in_rupees_words,
    format_date_ddmmyyyy,
)

User = get_user_model()


class InvoiceCounterTests(TestCase):
    def test_peek_and_get_next_number(self):
        peek_first = InvoiceCounter.peek_next_number()
        self.assertEqual(peek_first, "1369-0001")

        next_num_1 = InvoiceCounter.get_next_number()
        self.assertEqual(next_num_1, "1369-0001")

        peek_second = InvoiceCounter.peek_next_number()
        self.assertEqual(peek_second, "1369-0002")

        next_num_2 = InvoiceCounter.get_next_number()
        self.assertEqual(next_num_2, "1369-0002")


class InvoicePDFAndUtilityTests(TestCase):
    def test_number_to_words(self):
        self.assertEqual(amount_in_rupees_words(0), "Zero Rupees Only")
        self.assertEqual(amount_in_rupees_words(1500), "One Thousand Five Hundred Rupees Only")
        self.assertEqual(amount_in_rupees_words(125000), "One Lakh Twenty Five Thousand Rupees Only")

    def test_format_date_ddmmyyyy(self):
        self.assertEqual(format_date_ddmmyyyy("2026-08-05"), "05/08/2026")
        self.assertEqual(format_date_ddmmyyyy("05/08/2026"), "05/08/2026")
        self.assertEqual(format_date_ddmmyyyy(None), "")

    def test_pdf_generation_regular(self):
        invoice = Invoice.objects.create(
            invoice_number="1369-0001",
            invoice_type="REGULAR",
            client_name="Apollo Hospital",
            client_contact="9876543210",
            client_address="Plot No 13, SY NO 3,4, RR Plaza,\nMadhapur, Hyderabad, Telangana -\n500081",
            subtotal=10000,
            gst_rate=18,
            gst=1800,
            discount=0,
            total_after_gst=11800,
            advance_received=2000,
            balance_due=9800,
            grand_total=11800,
            payment_status="Pending",
            verification_hash="A" * 64,
            display_hash="A" * 16,
            services_data=[
                {
                    "s_no": 1,
                    "service_name": "Home Caretaker Service",
                    "rate": 1000,
                    "days": 10,
                    "amount": 10000,
                    "other_expenses": 0,
                    "total": 10000,
                }
            ],
        )
        pdf_bytes = generate_invoice_pdf(invoice)
        self.assertTrue(len(pdf_bytes) > 0)
        self.assertTrue(pdf_bytes.startswith(b"%PDF-"))

    def test_pdf_generation_school(self):
        invoice = Invoice.objects.create(
            invoice_number="1369-0002",
            invoice_type="SCHOOL",
            school_branch="Madhapur Branch",
            contact_person="Principal Sharma",
            client_name="Skandan International School",
            grand_total=50000,
            services_data=[
                {
                    "s_no": 1,
                    "service_name": "Campus Nursing Wellness",
                    "rate": 50000,
                    "days": 1,
                    "amount": 50000,
                    "other_expenses": 0,
                    "total": 50000,
                }
            ],
        )
        pdf_bytes = generate_invoice_pdf(invoice)
        self.assertTrue(len(pdf_bytes) > 0)
        self.assertTrue(pdf_bytes.startswith(b"%PDF-"))


class InvoiceAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="admin@skandan.com",
            email="admin@skandan.com",
            password="testpassword123",
        )
        self.client.force_authenticate(user=self.user)

    def test_get_next_invoice_number(self):
        response = self.client.get("/api/invoices/next-number")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get("next_invoice_number"), "1369-0001")

    def test_create_and_list_invoice(self):
        payload = {
            "invoice_type": "REGULAR",
            "invoice_date": "2026-08-05",
            "billing_period_text": "01/08/2026 to 10/08/2026",
            "start_date": "05/08/2026",
            "client_name": "Test Hospital",
            "client_contact": "9876543210",
            "client_address": "Plot No 13, SY NO 3,4, RR Plaza,\nMadhapur, Hyderabad, Telangana -\n500081",
            "per_day_charges": 1000,
            "subtotal": 10000,
            "gst_rate": 18,
            "gst": 1800,
            "discount": 0,
            "total_after_gst": 11800,
            "advance_received": 1800,
            "balance_due": 10000,
            "grand_total": 11800,
            "payment_status": "Pending",
            "services_data": [
                {
                    "s_no": 1,
                    "service_name": "ICU Care at Home",
                    "rate": 1000,
                    "days": 10,
                    "amount": 10000,
                    "other_expenses": 0,
                    "total": 10000,
                }
            ],
        }
        create_res = self.client.post("/api/invoices/", data=payload, format="json")
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_res.data["invoice_number"], "1369-0001")
        self.assertTrue(len(create_res.data["verification_hash"]) == 64)
        self.assertTrue(len(create_res.data["display_hash"]) == 16)

        # List invoices
        list_res = self.client.get("/api/invoices/")
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_res.data), 1)

    def test_verify_invoice(self):
        invoice = Invoice.objects.create(
            invoice_number="1369-0010",
            invoice_type="REGULAR",
            client_name="Verification Test Client",
            grand_total=15000,
            verification_hash="B" * 64,
            display_hash="B" * 16,
        )

        # Verify by invoice number
        verify_res_1 = self.client.get("/api/invoices/verify/?q=1369-0010")
        self.assertEqual(verify_res_1.status_code, status.HTTP_200_OK)
        self.assertTrue(verify_res_1.data["found"])
        self.assertTrue(verify_res_1.data["verified"])

        # Verify by display hash
        verify_res_2 = self.client.get(f"/api/invoices/verify/?q={'B' * 16}")
        self.assertEqual(verify_res_2.status_code, status.HTTP_200_OK)
        self.assertTrue(verify_res_2.data["found"])

    def test_delete_invoice(self):
        invoice = Invoice.objects.create(
            invoice_number="1369-0020",
            invoice_type="REGULAR",
            client_name="Delete Test Client",
            grand_total=2000,
        )
        del_res = self.client.delete(f"/api/invoices/{invoice.id}")
        self.assertEqual(del_res.status_code, status.HTTP_200_OK)
        self.assertFalse(Invoice.objects.filter(id=invoice.id).exists())

    def test_clients_list_endpoint(self):
        Invoice.objects.create(
            invoice_number="1369-0101",
            invoice_type="REGULAR",
            client_name="Apollo Hospital",
            client_contact="9876543210",
            client_address="Hyderabad",
            contact_person="Dr. Ramesh",
            per_day_charges=2500,
        )
        Invoice.objects.create(
            invoice_number="1369-0102",
            invoice_type="REGULAR",
            client_name="Apollo Hospital",
            client_contact="9876543210",
            client_address="Hyderabad New Branch",
            contact_person="Dr. Ramesh",
            per_day_charges=2500,
        )
        Invoice.objects.create(
            invoice_number="1369-0103",
            invoice_type="SCHOOL",
            client_name="Delhi Public School",
            client_contact="9123456780",
            client_address="Secunderabad",
            school_branch="Nacharam",
        )

        res = self.client.get("/api/invoices/clients/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 2)
        apollo = next((c for c in res.data if c["client_name"] == "Apollo Hospital"), None)
        self.assertIsNotNone(apollo)
        self.assertEqual(apollo["total_invoices"], 2)
        self.assertEqual(apollo["client_contact"], "9876543210")
        self.assertEqual(apollo["contact_person"], "Dr. Ramesh")

        # Test search query
        search_res = self.client.get("/api/invoices/clients/?q=delhi")
        self.assertEqual(search_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(search_res.data), 1)
        self.assertEqual(search_res.data[0]["client_name"], "Delhi Public School")

