from rest_framework import serializers
from apps.payslips.models import Payslip


class PayslipSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payslip
        fields = "__all__"
