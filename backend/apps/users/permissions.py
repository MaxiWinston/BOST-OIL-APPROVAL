# BOST Manifest - Role Permissions
# Author: Abena Adjei

from rest_framework.permissions import BasePermission
from .models import RoleChoices


class IsManager(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            (request.user.role == RoleChoices.MANAGER or request.user.role == RoleChoices.ADMIN or request.user.is_superuser)
        )


class IsCustomsOfficer(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            (request.user.role == RoleChoices.CUSTOMS_OFFICER or request.user.role == RoleChoices.ADMIN or request.user.is_superuser)
        )


class IsDepotOperator(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            (request.user.role == RoleChoices.DEPOT_OPERATOR or request.user.role == RoleChoices.ADMIN or request.user.is_superuser)
        )


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            (request.user.role == RoleChoices.ADMIN or request.user.is_superuser)
        )
