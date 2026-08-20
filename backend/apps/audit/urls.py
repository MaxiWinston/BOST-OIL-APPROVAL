from django.urls import path
from .views import AuditTrailQueryView

urlpatterns = [
    path('logs/', AuditTrailQueryView.as_view(), name='audit_logs_query'),
]
