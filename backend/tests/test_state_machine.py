import pytest
from django.core.exceptions import ValidationError
from apps.users.models import User, RoleChoices
from apps.dispatch.models import NPARequest, NPARequestStatus, Tanker, Lot, DeliveryNote, Waybill, DispatchRequest
from apps.dispatch.state_machine import WorkflowStateMachine
from apps.core.mongo import mongo_service


@pytest.mark.django_db
class TestWorkflowStateMachine:

    @pytest.fixture(autouse=True)
    def setup_data(self):
        # Create users with specific roles
        self.manager = User.objects.create_user(
            username='manager1', password='Password123!', role=RoleChoices.MANAGER
        )
        self.customs = User.objects.create_user(
            username='customs1', password='Password123!', role=RoleChoices.CUSTOMS_OFFICER
        )
        self.operator = User.objects.create_user(
            username='operator1', password='Password123!', role=RoleChoices.DEPOT_OPERATOR
        )
        self.unauthorized_user = User.objects.create_user(
            username='clerk1', password='Password123!', role=RoleChoices.DEPOT_OPERATOR
        )

        # Create NPA Request
        self.npa_request = NPARequest.objects.create(
            npa_reference_number='NPA-GH-2026-001',
            product_type='Diesel AGO',
            volume_requested=45000.00,
            depot_id='DEPOT-ACCRA-01',
            created_by=self.manager
        )

    def test_full_successful_3_stage_pipeline(self):
        """
        Tests the complete 3-stage pipeline in correct order:
        Submitted -> Manager Approved -> Customs Approved -> Lot Cleared.
        """
        assert self.npa_request.status == NPARequestStatus.SUBMITTED

        # Stage 1: Manager Acceptance
        req_stage1 = WorkflowStateMachine.approve_manager(self.npa_request, self.manager)
        assert req_stage1.status == NPARequestStatus.MANAGER_APPROVED
        assert req_stage1.approved_by_manager == self.manager

        # Stage 2: Customs Approval
        req_stage2 = WorkflowStateMachine.approve_customs(req_stage1, self.customs)
        assert req_stage2.status == NPARequestStatus.CUSTOMS_APPROVED
        assert req_stage2.approved_by_customs == self.customs

        # Stage 3: Lot Clearance
        req_stage3 = WorkflowStateMachine.clear_lot(req_stage2, self.operator)
        assert req_stage3.status == NPARequestStatus.LOT_CLEARED
        assert req_stage3.cleared_by_operator == self.operator

        # Verify audit trail recorded in MongoDB layer
        audit_trail = mongo_service.get_audit_trail("NPARequest", self.npa_request.id)
        assert len(audit_trail) == 3
        assert audit_trail[0]["new_state"] == NPARequestStatus.MANAGER_APPROVED
        assert audit_trail[1]["new_state"] == NPARequestStatus.CUSTOMS_APPROVED
        assert audit_trail[2]["new_state"] == NPARequestStatus.LOT_CLEARED

    def test_out_of_order_customs_approval_raises_validation_error(self):
        """
        Attempting Customs approval directly on a SUBMITTED request must fail.
        """
        assert self.npa_request.status == NPARequestStatus.SUBMITTED
        with pytest.raises(ValidationError) as excinfo:
            WorkflowStateMachine.approve_customs(self.npa_request, self.customs)
        assert "requires prior Manager Approval" in str(excinfo.value)

    def test_out_of_order_lot_clearance_raises_validation_error(self):
        """
        Attempting Lot clearance directly on a MANAGER_APPROVED request must fail.
        """
        req_stage1 = WorkflowStateMachine.approve_manager(self.npa_request, self.manager)
        with pytest.raises(ValidationError) as excinfo:
            WorkflowStateMachine.clear_lot(req_stage1, self.operator)
        assert "requires prior Customs Approval" in str(excinfo.value)

    def test_unauthorized_role_stage1_fails(self):
        """
        Non-manager user attempting Stage 1 approval must fail.
        """
        with pytest.raises(ValidationError) as excinfo:
            WorkflowStateMachine.approve_manager(self.npa_request, self.customs)
        assert "Only a Manager or Admin" in str(excinfo.value)

    def test_rejection_flow(self):
        """
        Tests request rejection with mandatory reason recording.
        """
        req_stage1 = WorkflowStateMachine.approve_manager(self.npa_request, self.manager)
        rejected_req = WorkflowStateMachine.reject_request(
            req_stage1, user=self.customs, reason="Discrepancy in seal numbers"
        )
        assert rejected_req.status == NPARequestStatus.REJECTED
        assert rejected_req.rejection_reason == "Discrepancy in seal numbers"
        assert rejected_req.rejected_by == self.customs

        # Confirm further pipeline progression on rejected request is blocked
        with pytest.raises(ValidationError):
            WorkflowStateMachine.approve_customs(rejected_req, self.customs)
