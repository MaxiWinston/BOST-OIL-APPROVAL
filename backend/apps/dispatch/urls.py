from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    NPARequestViewSet, TankerViewSet, LotViewSet,
    DeliveryNoteViewSet, WaybillViewSet, DispatchRequestViewSet
)

router = DefaultRouter()
router.register(r'npa-requests', NPARequestViewSet, basename='npa-request')
router.register(r'tankers', TankerViewSet, basename='tanker')
router.register(r'lots', LotViewSet, basename='lot')
router.register(r'delivery-notes', DeliveryNoteViewSet, basename='delivery-note')
router.register(r'waybills', WaybillViewSet, basename='waybill')
router.register(r'dispatch-requests', DispatchRequestViewSet, basename='dispatch-request')

urlpatterns = [
    path('', include(router.urls)),
]
