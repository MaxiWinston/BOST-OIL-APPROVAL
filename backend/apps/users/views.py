# BOST Manifest - User & Auth Views

from django.contrib.auth import get_user_model
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import RoleChoices
from .permissions import IsAdmin
from .serializers import (
    CustomTokenObtainPairSerializer,
    UserSerializer,
    UserCreateSerializer,
    UserUpdateSerializer,
)

User = get_user_model()


class CustomTokenObtainPairView(TokenObtainPairView):
    """POST /api/v1/auth/login/ -> {access, refresh, user}"""

    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]


class UserMeView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /api/v1/auth/me/ - the authenticated user's own profile."""

    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return UserUpdateSerializer
        return UserSerializer

    def update(self, request, *args, **kwargs):
        super().update(request, *args, **kwargs)
        # Always echo back the full profile, not just the editable subset.
        return Response(UserSerializer(self.get_object()).data)


class UserListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/v1/auth/users/ - administrator user management."""

    permission_classes = [IsAdmin]

    def get_serializer_class(self):
        return UserCreateSerializer if self.request.method == 'POST' else UserSerializer

    def get_queryset(self):
        queryset = User.objects.all().order_by('-date_joined')
        role = self.request.query_params.get('role')
        if role:
            queryset = queryset.filter(role=role.upper())
        depot_id = self.request.query_params.get('depot_id')
        if depot_id:
            queryset = queryset.filter(depot_id=depot_id)
        return queryset

    @extend_schema(request=UserCreateSerializer, responses={201: UserSerializer})
    def create(self, request, *args, **kwargs):
        serializer = UserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class RoleListView(generics.GenericAPIView):
    """GET /api/v1/auth/roles/ - the roles the frontend can assign."""

    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer  # satisfies drf-spectacular

    @extend_schema(responses={200: None})
    def get(self, request, *args, **kwargs):
        return Response({
            'roles': [{'value': value, 'label': label} for value, label in RoleChoices.choices]
        })
