import json
from django.http import HttpResponse
from django.db.models import Q
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.payslips.models import Payslip
from apps.payslips.serializers import PayslipSerializer
from apps.payslips.pdf_service import generate_payslip_pdf, num_to_words_upper
from apps.common.cloudinary_service import upload_payslip_pdf
from apps.accounts.models import Employee


class PayslipListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Payslip.objects.all()
        q = request.query_params.get("search") or request.query_params.get("q")
        if q:
            queryset = queryset.filter(
                Q(employee_name__icontains=q) |
                Q(employee_code__icontains=q) |
                Q(month__icontains=q) |
                Q(year__icontains=q) |
                Q(payslip_number__icontains=q)
            )
        serializer = PayslipSerializer(queryset, many=True)
        return Response(serializer.data)

    def post(self, request):
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)

        # Generate payslip unique code if not given
        emp_code = data.get("employee_code") or data.get("employeeId") or "EMP"
        month_val = data.get("month") or "JULY"
        year_val = data.get("year") or 2026

        payslip_num = data.get("payslip_number") or data.get("payslipNumber")
        if not payslip_num:
            payslip_num = f"PAY-{year_val}-{month_val[:3].upper()}-{emp_code}"

        # Match employee model if exists
        employee_obj = None
        emp_id_param = data.get("employee") or data.get("employee_id") or data.get("employeeId")
        if emp_id_param:
            if str(emp_id_param).isdigit():
                employee_obj = Employee.objects.filter(id=int(emp_id_param)).first()
            if not employee_obj:
                employee_obj = Employee.objects.filter(employee_id=str(emp_id_param)).first()

        # Compute totals
        basic = float(data.get("basic_salary") or data.get("basicSalary") or 0.0)
        conveyance = float(data.get("conveyance_allowance") or data.get("conveyanceAllowance") or 0.0)
        hra = float(data.get("house_rent_allowance") or data.get("houseRentAllowance") or 0.0)
        others = float(data.get("others_allowance") or data.get("othersAllowance") or 0.0)
        incentives = float(data.get("incentives") or 0.0)
        tot_earn = basic + conveyance + hra + others + incentives

        pt = float(data.get("professional_tax") or data.get("professionalTax") or 0.0)
        pf = float(data.get("provident_fund") or data.get("providentFund") or 0.0)
        esic = float(data.get("esic_deduction") or data.get("esicDeduction") or 0.0)
        tds = float(data.get("tds_deduction") or data.get("tdsDeduction") or 0.0)
        other_ded = float(data.get("other_deductions") or data.get("otherDeductions") or 0.0)
        tot_ded = pt + pf + esic + tds + other_ded

        net_sal = max(0.0, tot_earn - tot_ded)
        amount_words = data.get("amount_in_words") or data.get("amountInWords") or num_to_words_upper(net_sal)

        # Build clean dict for PDF and DB
        payslip_dict = {
            "payslip_number": payslip_num,
            "month": month_val,
            "year": int(year_val),
            "generation_date": data.get("generation_date") or data.get("generationDate") or "",
            "generation_time": data.get("generation_time") or data.get("generationTime") or "05:15 PM",
            "employee_code": str(emp_code),
            "employee_name": data.get("employee_name") or data.get("employeeName") or "",
            "designation": data.get("designation") or "",
            "grade_level": data.get("grade_level") or data.get("gradeLevel") or "AA / II",
            "location": data.get("location") or "TELANGANA",
            "department": data.get("department") or "OPERATIONS",
            "bank_name": data.get("bank_name") or data.get("bankName") or "SBI",
            "bank_account_number": data.get("bank_account_number") or data.get("bankAccountNumber") or "",
            "pan_number": data.get("pan_number") or data.get("panNumber") or "NA",
            "pf_account_number": data.get("pf_account_number") or data.get("pfAccountNumber") or "NA",
            "date_of_joining": data.get("date_of_joining") or data.get("dateOfJoining") or "",
            "days_worked": int(data.get("days_worked") or data.get("daysWorked") or 30),
            "lop_days": int(data.get("lop_days") or data.get("lopDays") or 0),
            "arrears_days": int(data.get("arrears_days") or data.get("arrearsDays") or 0),
            "esic_account_number": data.get("esic_account_number") or data.get("esicAccountNumber") or "NA",
            "uan_number": data.get("uan_number") or data.get("uanNumber") or "NA",
            "basic_salary": basic,
            "conveyance_allowance": conveyance,
            "house_rent_allowance": hra,
            "others_allowance": others,
            "incentives": incentives,
            "total_earnings": tot_earn,
            "professional_tax": pt,
            "provident_fund": pf,
            "esic_deduction": esic,
            "tds_deduction": tds,
            "other_deductions": other_ded,
            "total_deductions": tot_ded,
            "net_salary": net_sal,
            "amount_in_words": amount_words,
        }

        # Generate PDF and upload to Cloudinary
        cloudinary_url = ""
        try:
            pdf_bytes = generate_payslip_pdf(payslip_dict)
            cloudinary_url = upload_payslip_pdf(pdf_bytes, payslip_num)
        except Exception as e:
            # Fallback if Cloudinary error or network issue
            pass

        payslip_dict["cloudinary_pdf_url"] = cloudinary_url

        # Save or update in database
        payslip_instance, created = Payslip.objects.update_or_create(
            payslip_number=payslip_num,
            defaults={
                "employee": employee_obj,
                **payslip_dict
            }
        )

        serializer = PayslipSerializer(payslip_instance)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class PayslipDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            payslip = Payslip.objects.get(pk=pk)
        except Payslip.DoesNotExist:
            return Response({"detail": "Payslip not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(PayslipSerializer(payslip).data)

    def delete(self, request, pk):
        try:
            payslip = Payslip.objects.get(pk=pk)
        except Payslip.DoesNotExist:
            return Response({"detail": "Payslip not found."}, status=status.HTTP_404_NOT_FOUND)
        payslip.delete()
        return Response({"detail": "Payslip deleted successfully."}, status=status.HTTP_204_NO_CONTENT)


class PayslipPdfDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            payslip = Payslip.objects.get(pk=pk)
        except Payslip.DoesNotExist:
            return Response({"detail": "Payslip not found."}, status=status.HTTP_404_NOT_FOUND)

        payslip_dict = PayslipSerializer(payslip).data
        pdf_bytes = generate_payslip_pdf(payslip_dict)

        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="Payslip_{payslip.payslip_number}.pdf"'
        return response


class PayslipDirectPdfView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)

        emp_code = data.get("employee_code") or data.get("employeeId") or "EMP"
        month_val = data.get("month") or "JULY"
        year_val = data.get("year") or 2026

        payslip_num = data.get("payslip_number") or data.get("payslipNumber") or f"PAY-{year_val}-{month_val[:3].upper()}-{emp_code}"

        basic = float(data.get("basic_salary") or data.get("basicSalary") or 0.0)
        conveyance = float(data.get("conveyance_allowance") or data.get("conveyanceAllowance") or 0.0)
        hra = float(data.get("house_rent_allowance") or data.get("houseRentAllowance") or 0.0)
        others = float(data.get("others_allowance") or data.get("othersAllowance") or 0.0)
        incentives = float(data.get("incentives") or 0.0)
        tot_earn = basic + conveyance + hra + others + incentives

        pt = float(data.get("professional_tax") or data.get("professionalTax") or 0.0)
        pf = float(data.get("provident_fund") or data.get("providentFund") or 0.0)
        esic = float(data.get("esic_deduction") or data.get("esicDeduction") or 0.0)
        tds = float(data.get("tds_deduction") or data.get("tdsDeduction") or 0.0)
        other_ded = float(data.get("other_deductions") or data.get("otherDeductions") or 0.0)
        tot_ded = pt + pf + esic + tds + other_ded

        net_sal = max(0.0, tot_earn - tot_ded)
        amount_words = data.get("amount_in_words") or data.get("amountInWords") or num_to_words_upper(net_sal)

        payslip_dict = {
            "payslip_number": payslip_num,
            "month": month_val,
            "year": int(year_val),
            "generation_date": data.get("generation_date") or data.get("generationDate") or "",
            "generation_time": data.get("generation_time") or data.get("generationTime") or "05:15 PM",
            "employee_code": str(emp_code),
            "employee_name": data.get("employee_name") or data.get("employeeName") or "",
            "designation": data.get("designation") or "",
            "grade_level": data.get("grade_level") or data.get("gradeLevel") or "AA / II",
            "location": data.get("location") or "TELANGANA",
            "department": data.get("department") or "OPERATIONS",
            "bank_name": data.get("bank_name") or data.get("bankName") or "SBI",
            "bank_account_number": data.get("bank_account_number") or data.get("bankAccountNumber") or "",
            "pan_number": data.get("pan_number") or data.get("panNumber") or "NA",
            "pf_account_number": data.get("pf_account_number") or data.get("pfAccountNumber") or "NA",
            "date_of_joining": data.get("date_of_joining") or data.get("dateOfJoining") or "",
            "days_worked": int(data.get("days_worked") or data.get("daysWorked") or 30),
            "lop_days": int(data.get("lop_days") or data.get("lopDays") or 0),
            "arrears_days": int(data.get("arrears_days") or data.get("arrearsDays") or 0),
            "esic_account_number": data.get("esic_account_number") or data.get("esicAccountNumber") or "NA",
            "uan_number": data.get("uan_number") or data.get("uanNumber") or "NA",
            "basic_salary": basic,
            "conveyance_allowance": conveyance,
            "house_rent_allowance": hra,
            "others_allowance": others,
            "incentives": incentives,
            "total_earnings": tot_earn,
            "professional_tax": pt,
            "provident_fund": pf,
            "esic_deduction": esic,
            "tds_deduction": tds,
            "other_deductions": other_ded,
            "total_deductions": tot_ded,
            "net_salary": net_sal,
            "amount_in_words": amount_words,
        }

        pdf_bytes = generate_payslip_pdf(payslip_dict)
        clean_filename = f"Payslip_{payslip_num.replace('/', '_').replace(' ', '_')}.pdf"

        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{clean_filename}"'
        return response

