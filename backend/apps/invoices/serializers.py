from rest_framework import serializers
from apps.invoices.models import Invoice


class InvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invoice
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, "copy") else dict(data)

        # Sanitize date fields: empty string -> None (or omitted for invoice_date so default applies)
        for date_field in ["billing_period_start", "billing_period_end"]:
            if data.get(date_field) == "":
                data[date_field] = None
        if not data.get("invoice_date"):
            data.pop("invoice_date", None)

        # Sanitize numeric fields: empty string or None -> 0
        numeric_fields = [
            "old_dues",
            "per_day_charges",
            "subtotal",
            "gst_rate",
            "gst",
            "discount",
            "total_after_gst",
            "advance_received",
            "balance_due",
            "grand_total",
            "no_of_nurses",
            "no_of_students",
        ]
        for field in numeric_fields:
            if field in data and (data[field] == "" or data[field] is None):
                data[field] = 0

        return super().to_internal_value(data)
