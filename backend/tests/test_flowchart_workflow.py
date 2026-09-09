"""End-to-end coverage of the order-to-loading-authorisation flowchart.

Covers the branches the original suite did not: the customs query (ON HOLD),
the loading bay car-number gate check, entry denial, and completion/waybill.
"""

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.dispatch.models import NPARequest, NPARequestStatus
from apps.users.models import User, RoleChoices

TRUCK = 'GR-4521-24'


@pytest.mark.django_db
class TestFlowchartWorkflow:

    @pytest.fixture(autouse=True)
    def setup(self):
        self.client = APIClient()
        self.manager = User.objects.create_user(
            username='flow_manager', password='Password123!',
            role=RoleChoices.MANAGER, depot_id='DEPOT-1',
            company_name='Acme Oil Ghana Ltd',
        )
        self.customs = User.objects.create_user(
            username='flow_customs', password='Password123!',
            role=RoleChoices.CUSTOMS_OFFICER, depot_id='DEPOT-1',
        )
        self.operator = User.objects.create_user(
            username='flow_operator', password='Password123!',
            role=RoleChoices.DEPOT_OPERATOR, depot_id='DEPOT-1',
        )

    # --- helpers ---------------------------------------------------------

    def _submit_order(self):
        self.client.force_authenticate(user=self.manager)
        response = self.client.post(reverse('npa-request-list'), {
            'product_type': 'Diesel',
            'volume_requested': '30000.00',
            'unit': 'LITERS',
            'depot_id': 'DEPOT-1',
            'customer_company': 'Acme Oil Ghana Ltd',
            'truck_number': TRUCK,
            'driver_name': 'Kwesi Appiah',
            'delivery_location': 'Tema Harbour',
        }, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        return response.data

    def _act(self, user, order_id, action, payload=None):
        self.client.force_authenticate(user=user)
        url = reverse(f'npa-request-{action.replace("_", "-")}', kwargs={'pk': order_id})
        return self.client.post(url, payload or {}, format='json')

    # --- stage 1: NPA order submission -----------------------------------

    def test_npa_submission_prices_the_order_and_sets_submitted(self):
        order = self._submit_order()
        assert order['status'] == NPARequestStatus.SUBMITTED
        assert order['npa_reference_number'].startswith('NPA-')
        # Diesel @ 0.92/litre x 30000
        assert float(order['total_price']) == pytest.approx(27600.00)
        assert order['permit_id'] is None

    def test_submission_without_depot_or_reference_uses_defaults(self):
        self.client.force_authenticate(user=self.manager)
        response = self.client.post(reverse('npa-request-list'), {
            'product_type': 'Petrol',
            'volume_requested': '5000.00',
            'unit': 'LITERS',
            'truck_number': TRUCK,
        }, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['depot_id'] == 'DEPOT-1'  # from the user's profile
        assert response.data['npa_reference_number'].startswith('NPA-')
        assert response.data['customer_company'] == 'Acme Oil Ghana Ltd'

    # --- stage 2: manager -------------------------------------------------

    def test_manager_approval_issues_a_permit(self):
        order = self._submit_order()
        response = self._act(self.manager, order['id'], 'approve_manager')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == NPARequestStatus.MANAGER_APPROVED
        assert response.data['permit_id'].startswith('PERMIT-')

    def test_rejection_requires_a_reason(self):
        order = self._submit_order()
        response = self._act(self.manager, order['id'], 'reject', {'reason': ''})
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_rejected_order_records_reason_for_the_customer(self):
        order = self._submit_order()
        response = self._act(self.manager, order['id'], 'reject',
                             {'reason': 'Credit limit exceeded.'})
        assert response.data['status'] == NPARequestStatus.REJECTED
        assert response.data['rejection_reason'] == 'Credit limit exceeded.'

    # --- stage 3: customs -------------------------------------------------

    def test_customs_query_puts_order_on_hold_and_manager_can_reapprove(self):
        order = self._submit_order()
        self._act(self.manager, order['id'], 'approve_manager')

        held = self._act(self.customs, order['id'], 'hold',
                         {'reason': 'Import declaration mismatch.'})
        assert held.status_code == status.HTTP_200_OK
        assert held.data['status'] == NPARequestStatus.ON_HOLD
        assert held.data['hold_reason'] == 'Import declaration mismatch.'

        # Flowchart: an on-hold order goes back to the manager.
        reapproved = self._act(self.manager, order['id'], 'approve_manager')
        assert reapproved.status_code == status.HTTP_200_OK
        assert reapproved.data['status'] == NPARequestStatus.MANAGER_APPROVED

    def test_customs_cannot_sign_off_before_manager_approval(self):
        order = self._submit_order()
        response = self._act(self.customs, order['id'], 'approve_customs')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_manager_cannot_raise_a_customs_query(self):
        order = self._submit_order()
        self._act(self.manager, order['id'], 'approve_manager')
        response = self._act(self.manager, order['id'], 'hold', {'reason': 'nope'})
        assert response.status_code == status.HTTP_403_FORBIDDEN

    # --- stage 4: loading bay --------------------------------------------

    def _advance_to_cleared(self):
        order = self._submit_order()
        self._act(self.manager, order['id'], 'approve_manager')
        self._act(self.customs, order['id'], 'approve_customs')
        response = self._act(self.operator, order['id'], 'clear_lot')
        assert response.data['status'] == NPARequestStatus.LOT_CLEARED
        return order['id']

    def test_matching_car_number_allows_loading(self):
        order_id = self._advance_to_cleared()
        response = self._act(self.operator, order_id, 'start_loading',
                             {'observed_truck_number': TRUCK})
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == NPARequestStatus.LOADING
        assert response.data['car_number_matches'] is True

    def test_car_number_match_ignores_case_spacing_and_hyphens(self):
        order_id = self._advance_to_cleared()
        response = self._act(self.operator, order_id, 'start_loading',
                             {'observed_truck_number': ' gr 4521 24 '})
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == NPARequestStatus.LOADING

    def test_mismatched_car_number_is_rejected(self):
        order_id = self._advance_to_cleared()
        response = self._act(self.operator, order_id, 'start_loading',
                             {'observed_truck_number': 'XX-0000-00'})
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        # The order must not advance.
        assert NPARequest.objects.get(pk=order_id).status == NPARequestStatus.LOT_CLEARED

    def test_deny_entry_flags_the_discrepancy(self):
        order_id = self._advance_to_cleared()
        response = self._act(self.operator, order_id, 'deny_entry', {
            'reason': 'Plate does not match the permit.',
            'observed_truck_number': 'XX-0000-00',
        })
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == NPARequestStatus.DENIED
        assert response.data['denial_reason'] == 'Plate does not match the permit.'

    def test_completion_records_quantity_and_issues_waybill(self):
        order_id = self._advance_to_cleared()
        self._act(self.operator, order_id, 'start_loading',
                  {'observed_truck_number': TRUCK})

        response = self._act(self.operator, order_id, 'complete_loading',
                             {'quantity_loaded': '29850.00'})
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == NPARequestStatus.COMPLETED
        assert float(response.data['quantity_loaded']) == pytest.approx(29850.00)
        assert response.data['waybill_number'].startswith('WB-')

    def test_cannot_load_more_than_the_approved_volume(self):
        order_id = self._advance_to_cleared()
        self._act(self.operator, order_id, 'start_loading',
                  {'observed_truck_number': TRUCK})
        response = self._act(self.operator, order_id, 'complete_loading',
                             {'quantity_loaded': '99999.00'})
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_loading_requires_a_cleared_lot(self):
        order = self._submit_order()
        response = self._act(self.operator, order['id'], 'start_loading',
                             {'observed_truck_number': TRUCK})
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    # --- cross-cutting ----------------------------------------------------

    def test_available_actions_reflect_role_and_status(self):
        order = self._submit_order()

        self.client.force_authenticate(user=self.manager)
        detail = self.client.get(reverse('npa-request-detail', kwargs={'pk': order['id']}))
        assert set(detail.data['available_actions']) == {'approve_manager', 'reject'}

        # Customs has nothing to do with a merely submitted order.
        self.client.force_authenticate(user=self.customs)
        detail = self.client.get(reverse('npa-request-detail', kwargs={'pk': order['id']}))
        assert detail.data['available_actions'] == []

    def test_audit_trail_captures_every_transition(self):
        order_id = self._advance_to_cleared()
        self._act(self.operator, order_id, 'start_loading',
                  {'observed_truck_number': TRUCK})
        self._act(self.operator, order_id, 'complete_loading',
                  {'quantity_loaded': '30000.00'})

        self.client.force_authenticate(user=self.manager)
        response = self.client.get(
            reverse('npa-request-audit-trail', kwargs={'pk': order_id})
        )
        assert response.status_code == status.HTTP_200_OK
        states = [entry['new_state'] for entry in response.data['audit_trail']]
        assert states == [
            NPARequestStatus.SUBMITTED,
            NPARequestStatus.MANAGER_APPROVED,
            NPARequestStatus.CUSTOMS_APPROVED,
            NPARequestStatus.LOT_CLEARED,
            NPARequestStatus.LOADING,
            NPARequestStatus.COMPLETED,
        ]

    def test_summary_endpoint_counts_by_status(self):
        self._submit_order()
        order_id = self._advance_to_cleared()
        self._act(self.manager, order_id, 'approve_manager')  # no-op, already cleared

        self.client.force_authenticate(user=self.manager)
        response = self.client.get(reverse('npa-request-summary'))
        assert response.status_code == status.HTTP_200_OK
        assert response.data['TOTAL'] == 2
        assert response.data['SUBMITTED'] == 1
        assert response.data['LOT_CLEARED'] == 1

    def test_product_code_normalization_and_white_product_group(self):
        self.client.force_authenticate(user=self.manager)

        # 1. Submit using commercial name "Diesel" -> should normalize to official code "AGO"
        res_diesel = self.client.post(reverse('npa-request-list'), {
            'product_type': 'Diesel',
            'volume_requested': '13500.00',
            'unit': 'LITERS',
            'truck_number': 'GR-1234-24',
            'delivery_location': 'Razs Oil Sorkpeyiri SS',
        }, format='json')
        assert res_diesel.status_code == status.HTTP_201_CREATED
        assert res_diesel.data['product_type'] == 'AGO'
        assert res_diesel.data['product_name'] == 'Diesel'
        assert res_diesel.data['product_display'] == 'AGO (Diesel)'
        assert res_diesel.data['product_group'] == 'WHITE PRODUCT'
        assert res_diesel.data['compartments'] == 4

        # 2. Submit using official code "AGO" -> remains "AGO"
        res_ago = self.client.post(reverse('npa-request-list'), {
            'product_type': 'AGO',
            'volume_requested': '27000.00',
            'unit': 'LITERS',
            'truck_number': 'GT-5678-24',
        }, format='json')
        assert res_ago.status_code == status.HTTP_201_CREATED
        assert res_ago.data['product_type'] == 'AGO'
        assert res_ago.data['product_group'] == 'WHITE PRODUCT'

        # 3. Submit commercial name "Petrol" -> normalizes to "PMS"
        res_pms = self.client.post(reverse('npa-request-list'), {
            'product_type': 'Petrol',
            'volume_requested': '10000.00',
            'unit': 'LITERS',
            'truck_number': 'AS-9999-24',
        }, format='json')
        assert res_pms.status_code == status.HTTP_201_CREATED
        assert res_pms.data['product_type'] == 'PMS'
        assert res_pms.data['product_name'] == 'Petrol'
        assert res_pms.data['product_display'] == 'PMS (Petrol)'
        assert res_pms.data['product_group'] == 'WHITE PRODUCT'
