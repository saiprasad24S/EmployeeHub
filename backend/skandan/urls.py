from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/face/", include("apps.vision.urls")),
    path("api/attendance/", include("apps.attendance.urls")),
    path("api/assignments/", include("apps.assignments.urls")),
    path("api/location/", include("apps.tracking.urls")),
    path("api/employees/", include("apps.accounts.employee_urls")),
    path("api/dashboard/", include("apps.analytics.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
