from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from django.db import connections

from apps.common.cloudinary_service import cloudinary_status


def health_view(request):
    try:
        connection = connections["default"]
        connection.ensure_connection()
        return JsonResponse(
            {
                "status": "ok",
                "database": {
                    "engine": settings.DATABASES["default"].get("ENGINE", ""),
                    "name": settings.DATABASES["default"].get("NAME", ""),
                    "host": settings.DATABASES["default"].get("HOST", ""),
                    "provider": "mysql" if "mysql" in settings.DATABASES["default"].get("ENGINE", "") else "sqlite",
                },
            }
        )
    except Exception as exc:  # pragma: no cover - runtime validation path
        return JsonResponse(
            {"status": "error", "message": str(exc)},
            status=503,
        )


def cloudinary_health_view(request):
    return JsonResponse(cloudinary_status())


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/face/", include("apps.vision.urls")),
    path("api/attendance/", include("apps.attendance.urls")),
    path("api/assignments/", include("apps.assignments.urls")),
    path("api/location/", include("apps.tracking.urls")),
    path("api/employees/", include("apps.accounts.employee_urls")),
    path("api/dashboard/", include("apps.analytics.urls")),
    path("api/health/database", health_view, name="database-health"),
    path("api/health/cloudinary", cloudinary_health_view, name="cloudinary-health"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
