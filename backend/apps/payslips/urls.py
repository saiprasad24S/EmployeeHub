from django.urls import path
from apps.payslips.views import (
    PayslipListCreateView,
    PayslipDetailView,
    PayslipPdfDownloadView,
    PayslipDirectPdfView,
)

urlpatterns = [
    path("", PayslipListCreateView.as_view(), name="payslip-list-create"),
    path("generate-pdf/", PayslipDirectPdfView.as_view(), name="payslip-direct-pdf"),
    path("<int:pk>/", PayslipDetailView.as_view(), name="payslip-detail"),
    path("<int:pk>/pdf/", PayslipPdfDownloadView.as_view(), name="payslip-pdf-download"),
]

