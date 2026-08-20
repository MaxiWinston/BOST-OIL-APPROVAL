from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import CustomTokenObtainPairView, UserMeView, UserListCreateView, RoleListView

urlpatterns = [
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', UserMeView.as_view(), name='user_me'),
    path('users/', UserListCreateView.as_view(), name='user_list_create'),
    path('roles/', RoleListView.as_view(), name='role_list'),
]
