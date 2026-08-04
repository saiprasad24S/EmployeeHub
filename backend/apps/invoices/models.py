from django.db import models, transaction
from django.utils import timezone


class InvoiceCounter(models.Model):
    prefix = models.CharField(max_length=20, default="1369")
    last_number = models.PositiveIntegerField(default=0)

    @classmethod
    def get_next_number(cls) -> str:
        with transaction.atomic():
            counter, _ = cls.objects.select_for_update().get_or_create(
                prefix="1369",
                defaults={"last_number": 0}
            )
            counter.last_number += 1
            counter.save()
            return f"{counter.prefix}-{counter.last_number:04d}"

    @classmethod
    def peek_next_number(cls) -> str:
        counter = cls.objects.filter(prefix="1369").first()
        next_num = (counter.last_number + 1) if counter else 1
        return f"1369-{next_num:04d}"


class Invoice(models.Model):
    class InvoiceType(models.TextChoices):
        REGULAR = "REGULAR", "Generate Invoice (Regular)"
        SCHOOL = "SCHOOL", "Generate Invoice (School / College)"
        MULTI_SERVICE = "MULTI_SERVICE", "Generate Invoice (Multi-Service)"

    class PaymentStatus(models.TextChoices):
        PAID = "PAID", "Paid"
        UNPAID = "UNPAID", "Not Paid"
        PARTIAL = "PARTIAL", "Partial / Advance Received"
        PENDING = "PENDING", "Pending"

    invoice_number = models.CharField(max_length=50, unique=True, db_index=True)
    invoice_type = models.CharField(max_length=30, choices=InvoiceType.choices, default=InvoiceType.REGULAR)
    
    # SHA-256 Verification Hashes
    verification_hash = models.CharField(max_length=64, blank=True, db_index=True)
    display_hash = models.CharField(max_length=16, blank=True)
    barcode_value = models.CharField(max_length=100, blank=True)

    invoice_date = models.DateField(default=timezone.now)
    billing_period_start = models.DateField(null=True, blank=True)
    billing_period_end = models.DateField(null=True, blank=True)
    billing_period_text = models.CharField(max_length=150, blank=True)
    start_date = models.DateField(null=True, blank=True)

    # Client Info
    client_name = models.CharField(max_length=200)
    client_contact = models.CharField(max_length=50, blank=True)
    client_address = models.TextField(blank=True)
    client_gst = models.CharField(max_length=50, blank=True)

    # Patient / Service Profile
    patient_name = models.CharField(max_length=200, blank=True)
    patient_age_gender = models.CharField(max_length=100, blank=True)
    service_type = models.CharField(max_length=200, blank=True)
    consultant = models.CharField(max_length=200, blank=True)
    service_start_date = models.DateField(null=True, blank=True)
    service_end_date = models.DateField(null=True, blank=True)
    rendered_days = models.CharField(max_length=100, blank=True)

    # School / College Specific
    school_branch = models.CharField(max_length=200, blank=True)
    contact_person = models.CharField(max_length=200, blank=True)
    contact_person_designation = models.CharField(max_length=200, blank=True)
    no_of_nurses = models.IntegerField(default=0)
    no_of_students = models.IntegerField(default=0)

    # Calculations & Financials
    per_day_charges = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    gst = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_after_gst = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    advance_received = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    balance_due = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    grand_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    amount_in_words = models.CharField(max_length=300, blank=True)
    payment_status = models.CharField(max_length=50, choices=PaymentStatus.choices, default=PaymentStatus.UNPAID)
    remarks = models.TextField(blank=True)

    # Service Table JSON Data
    services_data = models.JSONField(default=list, blank=True)

    # Saved PDF path
    pdf_path = models.CharField(max_length=500, blank=True)

    generated_by = models.CharField(max_length=120, default="HR Admin")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.invoice_number} - {self.client_name} ({self.grand_total})"
