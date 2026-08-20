# BOST Manifest - User & Auth Serializers

from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import RoleChoices

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Safe representation of a user. Never exposes the password."""

    name = serializers.SerializerMethodField()
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'name',
            'role', 'role_display', 'depot_id', 'phone_number',
            'company_name', 'location', 'is_active', 'date_joined',
        ]
        read_only_fields = ['id', 'date_joined', 'role_display']

    def get_name(self, obj):
        full_name = obj.get_full_name().strip()
        return full_name or obj.username


class UserCreateSerializer(serializers.ModelSerializer):
    """Used by admins to create accounts. Password is write-only."""

    password = serializers.CharField(write_only=True, min_length=8, style={'input_type': 'password'})

    class Meta:
        model = User
        fields = [
            'id', 'username', 'password', 'email', 'first_name', 'last_name',
            'role', 'depot_id', 'phone_number', 'company_name', 'location',
        ]
        read_only_fields = ['id']

    def validate_role(self, value):
        if value not in RoleChoices.values:
            raise serializers.ValidationError(f"'{value}' is not a valid role.")
        return value

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Self-service profile update. Role and username are not editable here."""

    class Meta:
        model = User
        fields = [
            'email', 'first_name', 'last_name', 'phone_number',
            'company_name', 'location',
        ]


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Returns the authenticated user alongside the token pair, so the
    frontend can route by role without a second round trip."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['username'] = user.username
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = UserSerializer(self.user).data
        return data
