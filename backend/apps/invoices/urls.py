from django.urls import path
from apps.invoices.views import (
    InvoiceClientsListView,
    InvoiceDetailView,
    InvoiceDownloadPDFView,
    InvoiceListCreateView,
    InvoiceNextNumberView,
    InvoiceVerifyView,
)

urlpatterns = [
    path("next-number", InvoiceNextNumberView.as_view(), name="invoice-next-number"),
    path("next-number/", InvoiceNextNumberView.as_view()),
    path("clients", InvoiceClientsListView.as_view(), name="invoice-clients"),
    path("clients/", InvoiceClientsListView.as_view()),
    path("verify", InvoiceVerifyView.as_view(), name="invoice-verify"),
    path("verify/", InvoiceVerifyView.as_view()),
    path("", InvoiceListCreateView.as_view(), name="invoice-list-create"),
    path("<int:pk>/download", InvoiceDownloadPDFView.as_view(), name="invoice-download-pk"),
    path("<int:pk>/download/", InvoiceDownloadPDFView.as_view()),
    path("<str:pk>/download", InvoiceDownloadPDFView.as_view(), name="invoice-download-str"),
    path("<str:pk>/download/", InvoiceDownloadPDFView.as_view()),
    path("<int:pk>/pdf", InvoiceDownloadPDFView.as_view(), name="invoice-pdf-pk"),
    path("<int:pk>/pdf/", InvoiceDownloadPDFView.as_view()),
    path("<str:pk>/pdf", InvoiceDownloadPDFView.as_view(), name="invoice-pdf-str"),
    path("<str:pk>/pdf/", InvoiceDownloadPDFView.as_view()),
    path("<int:pk>", InvoiceDetailView.as_view(), name="invoice-detail-pk"),
    path("<int:pk>/", InvoiceDetailView.as_view()),
    path("<str:pk>", InvoiceDetailView.as_view(), name="invoice-detail-str"),
    path("<str:pk>/", InvoiceDetailView.as_view()),
]
