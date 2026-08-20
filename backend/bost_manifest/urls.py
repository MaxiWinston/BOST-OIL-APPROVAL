from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # API Version 1 endpoints
    path('api/v1/auth/', include('apps.users.urls')),
    path('api/v1/', include('apps.dispatch.urls')),
    path('api/v1/attachments/', include('apps.attachments.urls')),
    path('api/v1/audit/', include('apps.audit.urls')),

    # OpenAPI Schema & Documentation endpoints
    path('api/v1/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/v1/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/v1/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]
