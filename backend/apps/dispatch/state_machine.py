# BOST Manifest - Workflow State Machine Engine
# Author: Kwame Agyeman

import uuid
from datetime import datetime, timezone
from django.db import transaction
from django.core.exceptions import ValidationError
from apps.users.models import RoleChoices
from apps.core.mongo import mongo_service
from .models import (
    NPARequest, NPARequestStatus, LotStatus,
    Tanker, TankerStatus, DeliveryNote, Waybill,
)


class WorkflowStateMachine:
    """Implements the order-to-loading-authorisation flow.

    SUBMITTED -> MANAGER_APPROVED -> CUSTOMS_APPROVED -> LOT_CLEARED
              -> LOADING -> COMPLETED

    Off-ramps: REJECTED (manager), ON_HOLD (customs query, returns to the
    manager), DENIED (loading bay car-number mismatch, alerts the manager).
    """

    # A manager may approve a fresh submission or one returned by customs.
    MANAGER_APPROVABLE_FROM = (
        NPARequestStatus.SUBMITTED,
        NPARequestStatus.ON_HOLD,
    )

    @classmethod
    @transaction.atomic
    def approve_manager(cls, npa_request: NPARequest, user, request_meta=None) -> NPARequest:
        if user.role not in [RoleChoices.MANAGER, RoleChoices.ADMIN] and not user.is_superuser:
            raise ValidationError("Only a Manager or Admin can perform Stage 1 Manager Approval.")

        if npa_request.status not in cls.MANAGER_APPROVABLE_FROM:
            raise ValidationError(
                f"Cannot perform Manager Approval on request with status '{npa_request.status}'. "
                f"Must be one of {', '.join(cls.MANAGER_APPROVABLE_FROM)}."
            )

        previous_state = npa_request.status
        npa_request.status = NPARequestStatus.MANAGER_APPROVED
        npa_request.approved_by_manager = user
        npa_request.manager_approval_time = datetime.now(timezone.utc)

        # Grant authorisation & permission: issue the permit ID.
        if not npa_request.permit_id:
            npa_request.permit_id = cls._generate_permit_id(npa_request)

        # Re-approval after a customs query clears the previous hold.
        npa_request.hold_reason = None
        npa_request.rejection_reason = None

        npa_request.clean()
        npa_request.save()

        cls._log_transition(
            npa_request=npa_request,
            previous_state=previous_state,
            new_state=npa_request.status,
            user=user,
            request_meta=request_meta,
            notes=f"Stage 1 Manager Acceptance Completed. Permit {npa_request.permit_id} issued."
        )
        return npa_request

    @staticmethod
    def _generate_permit_id(npa_request: NPARequest) -> str:
        stamp = datetime.now(timezone.utc).strftime('%Y%m%d')
        return f"PERMIT-{stamp}-{npa_request.pk}-{uuid.uuid4().hex[:6].upper()}"

    @classmethod
    @transaction.atomic
    def approve_customs(cls, npa_request: NPARequest, user, request_meta=None) -> NPARequest:
        if user.role not in [RoleChoices.CUSTOMS_OFFICER, RoleChoices.ADMIN] and not user.is_superuser:
            raise ValidationError("Only a Customs Officer or Admin can perform Stage 2 Customs Approval.")

        if npa_request.status != NPARequestStatus.MANAGER_APPROVED:
            raise ValidationError(f"Customs Approval requires prior Manager Approval. Current status is '{npa_request.status}'.")

        previous_state = npa_request.status
        npa_request.status = NPARequestStatus.CUSTOMS_APPROVED
        npa_request.approved_by_customs = user
        npa_request.customs_approval_time = datetime.now(timezone.utc)
        npa_request.clean()
        npa_request.save()

        if hasattr(npa_request, 'delivery_note') and hasattr(npa_request.delivery_note, 'waybill') and hasattr(npa_request.delivery_note.waybill, 'dispatch_request'):
            lot = npa_request.delivery_note.waybill.dispatch_request.lot
            lot.status = LotStatus.CUSTOMS_APPROVED
            lot.save()

        cls._log_transition(
            npa_request=npa_request,
            previous_state=previous_state,
            new_state=npa_request.status,
            user=user,
            request_meta=request_meta,
            notes="Stage 2 Customs Approval Completed"
        )
        return npa_request

    @classmethod
    @transaction.atomic
    def clear_lot(cls, npa_request: NPARequest, user, request_meta=None) -> NPARequest:
        if user.role not in [RoleChoices.DEPOT_OPERATOR, RoleChoices.ADMIN] and not user.is_superuser:
            raise ValidationError("Only a Depot Operator or Admin can perform Stage 3 Lot Clearance.")

        if npa_request.status != NPARequestStatus.CUSTOMS_APPROVED:
            raise ValidationError(f"Lot Clearance requires prior Customs Approval. Current status is '{npa_request.status}'.")

        previous_state = npa_request.status
        npa_request.status = NPARequestStatus.LOT_CLEARED
        npa_request.cleared_by_operator = user
        npa_request.lot_clearance_time = datetime.now(timezone.utc)
        npa_request.clean()
        npa_request.save()

        if hasattr(npa_request, 'delivery_note') and hasattr(npa_request.delivery_note, 'waybill') and hasattr(npa_request.delivery_note.waybill, 'dispatch_request'):
            lot = npa_request.delivery_note.waybill.dispatch_request.lot
            lot.status = LotStatus.CLEARED_FOR_FILLING
            lot.save()

        cls._log_transition(
            npa_request=npa_request,
            previous_state=previous_state,
            new_state=npa_request.status,
            user=user,
            request_meta=request_meta,
            notes="Stage 3 Lot Clearance Completed (Authorized for filling)"
        )
        return npa_request

    @classmethod
    @transaction.atomic
    def hold_request(cls, npa_request: NPARequest, user, reason: str, request_meta=None) -> NPARequest:
        """Customs raises a query. Status becomes ON_HOLD and the request goes
        back to the depot manager for review (flowchart: 'back to manager')."""
        if user.role not in [RoleChoices.CUSTOMS_OFFICER, RoleChoices.ADMIN] and not user.is_superuser:
            raise ValidationError("Only a Customs Officer or Admin can raise a customs query.")

        if not reason or not reason.strip():
            raise ValidationError("A query reason must be provided when placing a request on hold.")

        if npa_request.status != NPARequestStatus.MANAGER_APPROVED:
            raise ValidationError(
                f"A customs query can only be raised on a manager-approved request. "
                f"Current status is '{npa_request.status}'."
            )

        previous_state = npa_request.status
        npa_request.status = NPARequestStatus.ON_HOLD
        npa_request.held_by = user
        npa_request.hold_reason = reason
        npa_request.hold_time = datetime.now(timezone.utc)
        npa_request.save()

        cls._log_transition(
            npa_request=npa_request,
            previous_state=previous_state,
            new_state=npa_request.status,
            user=user,
            request_meta=request_meta,
            notes=f"Customs query raised, returned to manager: {reason}"
        )
        return npa_request

    @classmethod
    @transaction.atomic
    def start_loading(cls, npa_request: NPARequest, user, observed_truck_number: str, request_meta=None) -> NPARequest:
        """Loading bay gate check. The observed car number must match the one
        declared on the order before the vehicle is allowed to load."""
        if user.role not in [RoleChoices.DEPOT_OPERATOR, RoleChoices.ADMIN] and not user.is_superuser:
            raise ValidationError("Only a Depot Operator or Admin can authorise loading.")

        if npa_request.status != NPARequestStatus.LOT_CLEARED:
            raise ValidationError(
                f"Loading requires a cleared lot. Current status is '{npa_request.status}'."
            )

        if not observed_truck_number or not observed_truck_number.strip():
            raise ValidationError("The observed car number must be recorded at the gate.")

        npa_request.verified_truck_number = observed_truck_number.strip()

        if npa_request.car_number_matches is not True:
            raise ValidationError(
                f"Car number mismatch. Order declares '{npa_request.truck_number}', "
                f"gate observed '{observed_truck_number}'. Deny entry and flag the discrepancy."
            )

        previous_state = npa_request.status
        npa_request.status = NPARequestStatus.LOADING
        npa_request.loading_started_at = datetime.now(timezone.utc)
        npa_request.loaded_by = user
        npa_request.clean()
        npa_request.save()

        cls._log_transition(
            npa_request=npa_request,
            previous_state=previous_state,
            new_state=npa_request.status,
            user=user,
            request_meta=request_meta,
            notes=f"Car number {observed_truck_number} verified. Vehicle allowed to load."
        )
        return npa_request

    @classmethod
    @transaction.atomic
    def deny_entry(cls, npa_request: NPARequest, user, reason: str, observed_truck_number=None, request_meta=None) -> NPARequest:
        """Loading bay denies entry and flags the discrepancy to the manager."""
        if user.role not in [RoleChoices.DEPOT_OPERATOR, RoleChoices.ADMIN] and not user.is_superuser:
            raise ValidationError("Only a Depot Operator or Admin can deny entry at the loading bay.")

        if not reason or not reason.strip():
            raise ValidationError("A reason must be provided when denying entry.")

        if npa_request.status not in (NPARequestStatus.LOT_CLEARED, NPARequestStatus.LOADING):
            raise ValidationError(
                f"Entry can only be denied for a cleared or loading request. "
                f"Current status is '{npa_request.status}'."
            )

        previous_state = npa_request.status
        npa_request.status = NPARequestStatus.DENIED
        npa_request.denied_by = user
        npa_request.denial_reason = reason
        if observed_truck_number:
            npa_request.verified_truck_number = observed_truck_number.strip()
        npa_request.save()

        cls._log_transition(
            npa_request=npa_request,
            previous_state=previous_state,
            new_state=npa_request.status,
            user=user,
            request_meta=request_meta,
            notes=f"Entry denied, manager alerted: {reason}"
        )
        return npa_request

    @classmethod
    @transaction.atomic
    def complete_loading(cls, npa_request: NPARequest, user, quantity_loaded, destination=None,
                         transporter_name=None, request_meta=None) -> NPARequest:
        """Record the quantity loaded and issue the waybill. Terminal state."""
        if user.role not in [RoleChoices.DEPOT_OPERATOR, RoleChoices.ADMIN] and not user.is_superuser:
            raise ValidationError("Only a Depot Operator or Admin can complete loading.")

        if npa_request.status != NPARequestStatus.LOADING:
            raise ValidationError(
                f"Only a loading request can be completed. Current status is '{npa_request.status}'."
            )

        if quantity_loaded is None:
            raise ValidationError("The quantity loaded must be recorded.")

        try:
            quantity_loaded = float(quantity_loaded)
        except (TypeError, ValueError):
            raise ValidationError("The quantity loaded must be a number.")

        if quantity_loaded <= 0:
            raise ValidationError("The quantity loaded must be greater than zero.")

        if quantity_loaded > float(npa_request.volume_requested):
            raise ValidationError(
                f"Quantity loaded ({quantity_loaded}) cannot exceed the approved "
                f"volume ({npa_request.volume_requested})."
            )

        previous_state = npa_request.status
        npa_request.status = NPARequestStatus.COMPLETED
        npa_request.quantity_loaded = quantity_loaded
        npa_request.completed_at = datetime.now(timezone.utc)
        npa_request.loaded_by = user
        npa_request.clean()
        npa_request.save()

        waybill = cls._issue_waybill(
            npa_request=npa_request,
            quantity_loaded=quantity_loaded,
            destination=destination,
            transporter_name=transporter_name,
        )

        cls._log_transition(
            npa_request=npa_request,
            previous_state=previous_state,
            new_state=npa_request.status,
            user=user,
            request_meta=request_meta,
            notes=f"Loading completed. {quantity_loaded} recorded. Waybill {waybill.waybill_number} issued."
        )
        return npa_request

    @classmethod
    def _issue_waybill(cls, npa_request: NPARequest, quantity_loaded, destination=None, transporter_name=None) -> Waybill:
        """Create the delivery note and waybill that close out the order."""
        suffix = uuid.uuid4().hex[:6].upper()

        delivery_note = getattr(npa_request, 'delivery_note', None)
        if delivery_note is None:
            delivery_note = DeliveryNote.objects.create(
                npa_request=npa_request,
                delivery_note_number=f"DN-{npa_request.pk}-{suffix}",
                quantity_dispatched=quantity_loaded,
            )
        else:
            delivery_note.quantity_dispatched = quantity_loaded
            delivery_note.save()

        tanker = npa_request.tanker
        if tanker is None:
            # The customer may have declared a plate that was never registered
            # as a Tanker record. Register it now so the waybill can reference it.
            tanker, _ = Tanker.objects.get_or_create(
                truck_number=npa_request.truck_number or f"UNKNOWN-{npa_request.pk}",
                defaults={
                    'driver_name': npa_request.driver_name or 'Unknown',
                    'driver_license': 'UNRECORDED',
                    'capacity_liters': npa_request.volume_requested,
                    'status': TankerStatus.ACTIVE,
                },
            )
            npa_request.tanker = tanker
            npa_request.save(update_fields=['tanker'])

        waybill = getattr(delivery_note, 'waybill', None)
        if waybill is None:
            waybill = Waybill.objects.create(
                delivery_note=delivery_note,
                tanker=tanker,
                waybill_number=f"WB-{npa_request.pk}-{suffix}",
                destination=destination or npa_request.delivery_location or 'Not specified',
                transporter_name=transporter_name or npa_request.customer_company or 'Not specified',
            )
        return waybill

    @classmethod
    @transaction.atomic
    def reject_request(cls, npa_request: NPARequest, user, reason: str, request_meta=None) -> NPARequest:
        if not reason or not reason.strip():
            raise ValidationError("A valid rejection reason must be provided.")

        if npa_request.status in (NPARequestStatus.COMPLETED, NPARequestStatus.REJECTED):
            raise ValidationError(
                f"A request with status '{npa_request.status}' can no longer be rejected."
            )

        previous_state = npa_request.status
        npa_request.status = NPARequestStatus.REJECTED
        npa_request.rejected_by = user
        npa_request.rejection_reason = reason
        npa_request.save()

        if hasattr(npa_request, 'delivery_note') and hasattr(npa_request.delivery_note, 'waybill') and hasattr(npa_request.delivery_note.waybill, 'dispatch_request'):
            lot = npa_request.delivery_note.waybill.dispatch_request.lot
            lot.status = LotStatus.REJECTED
            lot.save()

        cls._log_transition(
            npa_request=npa_request,
            previous_state=previous_state,
            new_state=npa_request.status,
            user=user,
            request_meta=request_meta,
            notes=f"Request Rejected: {reason}"
        )
        return npa_request

    @classmethod
    def _log_transition(cls, npa_request: NPARequest, previous_state: str, new_state: str, user, request_meta=None, notes=None):
        meta = request_meta or {}
        mongo_service.log_audit_event(
            entity_type="NPARequest",
            entity_id=npa_request.id,
            previous_state=previous_state,
            new_state=new_state,
            user_id=user.id,
            user_role=user.role,
            ip_address=meta.get("ip_address"),
            user_agent=meta.get("user_agent"),
            correlation_id=meta.get("correlation_id"),
            notes=notes
        )
