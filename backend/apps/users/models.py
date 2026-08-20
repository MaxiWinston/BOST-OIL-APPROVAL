# BOST Manifest - User & Role Models
# Author: Abena Adjei

from django.contrib.auth.models import AbstractUser
from django.db import models


class RoleChoices(models.TextChoices):
    # Flowchart actor 1 - BOST depot manager who reviews and grants permits.
    MANAGER = 'MANAGER', 'Manager'
    # Flowchart actor 2 - customs officer who signs off or raises a query.
    CUSTOMS_OFFICER = 'CUSTOMS_OFFICER', 'Customs Officer'
    # Flowchart actor 3 - loading bay operator who verifies the car and loads.
    DEPOT_OPERATOR = 'DEPOT_OPERATOR', 'Depot Operator'
    ADMIN = 'ADMIN', 'Administrator'


class User(AbstractUser):
    role = models.CharField(
        max_length=30,
        choices=RoleChoices.choices,
        default=RoleChoices.DEPOT_OPERATOR,
        help_text="System role defining workflow approval permissions."
    )
    depot_id = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Associated Depot identifier."
    )
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    company_name = models.CharField(
        max_length=150,
        blank=True,
        null=True,
        help_text="Customer company this user belongs to (customers only)."
    )
    location = models.CharField(max_length=200, blank=True, null=True)

    class Meta:
        db_table = 'bost_users'
        indexes = [
            models.Index(fields=['role']),
            models.Index(fields=['depot_id']),
        ]

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"
