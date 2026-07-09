from django.contrib import admin

from apps.attendance.models import Attendance, Session

admin.site.register(Session)
admin.site.register(Attendance)
