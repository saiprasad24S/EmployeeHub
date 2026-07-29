from django.urls import path
from apps.invoices.views import (
    InvoiceDetailView,
    InvoiceDownloadPDFView,
    InvoiceListCreateView,
    InvoiceNextNumberView,
    InvoiceVerifyView,
)

urlpatterns = [
    path("next-number", InvoiceNextNumberView.as_view(), name="invoice-next-number"),
    path("verify", InvoiceVerifyView.as_view(), name="invoice-verify"),
    path("", InvoiceListCreateView.as_view(), name="invoice-list-create"),
    path("<int:pk>", InvoiceDetailView.as_view(), name="invoice-detail-pk"),
    path("<str:pk>", InvoiceDetailView.as_view(), name="invoice-detail-str"),
    path("<int:pk>/download", InvoiceDownloadPDFView.as_view(), name="invoice-download-pk"),
    path("<str:pk>/download", InvoiceDownloadPDFView.as_view(), name="invoice-download-str"),
]
