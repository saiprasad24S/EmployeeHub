from django.contrib import admin

from apps.accounts.models import Admin, Employee

admin.site.register(Employee)
admin.site.register(Admin)
