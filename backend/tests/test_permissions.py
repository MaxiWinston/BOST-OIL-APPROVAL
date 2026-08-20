import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from apps.users.models import User, RoleChoices
from apps.dispatch.models import NPARequest, NPARequestStatus


@pytest.mark.django_db
class TestRoleBasedPermissions:

    @pytest.fixture(autouse=True)
    def setup_permission_data(self):
        self.client = APIClient()

        self.operator = User.objects.create_user(
            username='perm_operator', password='Password123!', role=RoleChoices.DEPOT_OPERATOR
        )
        self.customs = User.objects.create_user(
            username='perm_customs', password='Password123!', role=RoleChoices.CUSTOMS_OFFICER
        )

        self.npa_request = NPARequest.objects.create(
            npa_reference_number='NPA-PERM-001',
            product_type='Diesel AGO',
            volume_requested=25000.00,
            depot_id='DEPOT-TAKORADI-01',
            created_by=self.operator
        )

    def test_depot_operator_forbidden_from_stage1_manager_approval(self):
        self.client.force_authenticate(user=self.operator)
        url = reverse('npa-request-approve-manager', kwargs={'pk': self.npa_request.pk})
        response = self.client.post(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_customs_officer_forbidden_from_stage1_manager_approval(self):
        self.client.force_authenticate(user=self.customs)
        url = reverse('npa-request-approve-manager', kwargs={'pk': self.npa_request.pk})
        response = self.client.post(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_unauthenticated_access_denied(self):
        url = reverse('npa-request-list')
        response = self.client.get(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
