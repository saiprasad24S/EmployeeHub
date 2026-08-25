from django.db import models
from apps.accounts.models import Employee


class Payslip(models.Model):
    employee = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payslips"
    )
    payslip_number = models.CharField(max_length=64, unique=True, db_index=True)
    month = models.CharField(max_length=32)
    year = models.IntegerField(default=2026)
    generation_date = models.CharField(max_length=32, blank=True)
    generation_time = models.CharField(max_length=32, blank=True)

    # Employee Information
    employee_code = models.CharField(max_length=64, db_index=True)
    employee_name = models.CharField(max_length=255, db_index=True)
    designation = models.CharField(max_length=255, blank=True)
    grade_level = models.CharField(max_length=64, default="AA / II")
    location = models.CharField(max_length=255, default="TELANGANA")
    department = models.CharField(max_length=255, default="OPERATIONS")
    bank_name = models.CharField(max_length=128, default="SBI")
    bank_account_number = models.CharField(max_length=128, blank=True)
    pan_number = models.CharField(max_length=64, default="NA")
    pf_account_number = models.CharField(max_length=64, default="NA")
    date_of_joining = models.CharField(max_length=64, blank=True)
    days_worked = models.IntegerField(default=30)
    lop_days = models.IntegerField(default=0)
    arrears_days = models.IntegerField(default=0)
    esic_account_number = models.CharField(max_length=64, default="NA")
    uan_number = models.CharField(max_length=64, default="NA")

    # Earnings
    basic_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    conveyance_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    house_rent_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    others_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    incentives = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_earnings = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    # Deductions
    professional_tax = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    provident_fund = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    esic_deduction = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    tds_deduction = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    other_deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    # Net Pay
    net_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    amount_in_words = models.TextField(blank=True)

    # Cloudinary storage
    cloudinary_pdf_url = models.URLField(max_length=500, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.payslip_number} - {self.employee_name} ({self.month} {self.year})"
