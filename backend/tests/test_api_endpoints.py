import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from apps.users.models import User, RoleChoices
from apps.dispatch.models import NPARequest, NPARequestStatus


@pytest.mark.django_db
class TestBOSTManifestAPIEndpoints:

    @pytest.fixture(autouse=True)
    def setup_api_data(self):
        self.client = APIClient()

        self.manager = User.objects.create_user(
            username='api_manager', password='Password123!', role=RoleChoices.MANAGER
        )
        self.customs = User.objects.create_user(
            username='api_customs', password='Password123!', role=RoleChoices.CUSTOMS_OFFICER
        )
        self.operator = User.objects.create_user(
            username='api_operator', password='Password123!', role=RoleChoices.DEPOT_OPERATOR
        )

        self.npa_request = NPARequest.objects.create(
            npa_reference_number='NPA-API-TEST-001',
            product_type='Super Gasoline',
            volume_requested=30000.00,
            depot_id='DEPOT-TEMA-02',
            created_by=self.manager
        )

    def test_jwt_login_success(self):
        url = reverse('token_obtain_pair')
        response = self.client.post(url, {
            'username': 'api_manager',
            'password': 'Password123!'
        })
        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.data
        assert 'refresh' in response.data
        assert response.data['user']['role'] == RoleChoices.MANAGER

    def test_create_npa_request_api(self):
        self.client.force_authenticate(user=self.manager)
        url = reverse('npa-request-list')
        payload = {
            'npa_reference_number': 'NPA-API-NEW-999',
            'product_type': 'Kerosene',
            'volume_requested': 15000.00,
            'depot_id': 'DEPOT-KUMASI-01'
        }
        response = self.client.post(url, payload)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['status'] == NPARequestStatus.SUBMITTED

    def test_pipeline_advancement_api_flow(self):
        # Stage 1: Manager Approval
        self.client.force_authenticate(user=self.manager)
        url_manager = reverse('npa-request-approve-manager', kwargs={'pk': self.npa_request.pk})
        res1 = self.client.post(url_manager)
        assert res1.status_code == status.HTTP_200_OK
        assert res1.data['status'] == NPARequestStatus.MANAGER_APPROVED

        # Stage 2: Customs Approval
        self.client.force_authenticate(user=self.customs)
        url_customs = reverse('npa-request-approve-customs', kwargs={'pk': self.npa_request.pk})
        res2 = self.client.post(url_customs)
        assert res2.status_code == status.HTTP_200_OK
        assert res2.data['status'] == NPARequestStatus.CUSTOMS_APPROVED

        # Stage 3: Lot Clearance
        self.client.force_authenticate(user=self.operator)
        url_clearance = reverse('npa-request-clear-lot', kwargs={'pk': self.npa_request.pk})
        res3 = self.client.post(url_clearance)
        assert res3.status_code == status.HTTP_200_OK
        assert res3.data['status'] == NPARequestStatus.LOT_CLEARED

        # Fetch Audit Trail
        url_audit = reverse('npa-request-audit-trail', kwargs={'pk': self.npa_request.pk})
        res_audit = self.client.get(url_audit)
        assert res_audit.status_code == status.HTTP_200_OK
        assert len(res_audit.data['audit_trail']) == 3

    def test_upload_and_retrieve_mongo_attachment_api(self):
        self.client.force_authenticate(user=self.customs)
        url_create = reverse('attachment-list')
        payload = {
            'entity_type': 'NPARequest',
            'entity_id': str(self.npa_request.id),
            'document_type': 'CUSTOMS_SEAL_CERTIFICATE',
            'filename': 'seal_cert_2026.pdf',
            'metadata': {
                'customs_office': 'Tema Port Office B',
                'seal_numbers': ['SL-99182', 'SL-99183'],
                'verified_temperature_c': 24.5
            }
        }
        res_create = self.client.post(url_create, payload, format='json')
        assert res_create.status_code == status.HTTP_201_CREATED
        assert res_create.data['document_type'] == 'CUSTOMS_SEAL_CERTIFICATE'

        # Fetch attachments
        res_list = self.client.get(f"{url_create}?entity_type=NPARequest&entity_id={self.npa_request.id}")
        assert res_list.status_code == status.HTTP_200_OK
        assert len(res_list.data['attachments']) >= 1
        assert res_list.data['attachments'][0]['metadata']['customs_office'] == 'Tema Port Office B'

    def test_send_npa_batch_api(self):
        self.client.force_authenticate(user=self.manager)
        url = reverse('npa-request-send-npa-batch')
        res = self.client.post(url, {'count': 55}, format='json')
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data['count'] == 55
        assert len(res.data['order_references']) == 55
        assert NPARequest.objects.filter(status=NPARequestStatus.SUBMITTED).count() >= 55

    def test_tv_display_endpoint(self):
        # Set self.npa_request to LOT_CLEARED
        self.npa_request.status = NPARequestStatus.LOT_CLEARED
        self.npa_request.truck_number = 'PLX-8837-E'
        self.npa_request.driver_name = 'Kofi Mensah'
        self.npa_request.save()

        # TV display is public (no authentication required)
        self.client.logout()
        url = reverse('npa-request-tv-display')
        res = self.client.get(url)
        assert res.status_code == status.HTTP_200_OK
        assert len(res.data['bays']) == 9
        assert res.data['bays'][0]['is_occupied'] is True
        assert res.data['bays'][0]['order']['truck_number'] == 'PLX-8837-E'
        assert res.data['bays'][0]['order']['status'] == 'LOT_CLEARED'
        assert res.data['bays'][1]['is_occupied'] is False


