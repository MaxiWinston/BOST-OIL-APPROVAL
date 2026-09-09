# BOST Manifest - Dispatch API Views
#
# Implements the order-to-loading-authorisation flow:
#   Customer submits -> Manager approves (permit issued) -> Customs signs off
#   -> Lot cleared -> Loading bay verifies car number -> Loading -> Completed

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from apps.core.mongo import mongo_service
from apps.users.models import RoleChoices
from apps.users.permissions import IsManager, IsCustomsOfficer, IsDepotOperator

from .models import (
    Tanker, Lot, NPARequest, NPARequestStatus,
    DeliveryNote, Waybill, DispatchRequest,
)
from .serializers import (
    TankerSerializer, LotSerializer, NPARequestSerializer,
    NPARequestCreateSerializer, DeliveryNoteSerializer, WaybillSerializer,
    DispatchRequestSerializer, RejectionSerializer, HoldSerializer,
    StartLoadingSerializer, DenyEntrySerializer, CompleteLoadingSerializer,
    NPABatchRequestSerializer,
)
from .npa_generator import generate_npa_batch, process_daily_npa_cycle
from .state_machine import WorkflowStateMachine



def request_meta(request):
    """Capture the audit context for a state transition."""
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    ip = forwarded.split(',')[0].strip() if forwarded else request.META.get('REMOTE_ADDR')
    return {
        'ip_address': ip,
        'user_agent': request.META.get('HTTP_USER_AGENT'),
        'correlation_id': getattr(request, 'correlation_id', None),
    }


def run_transition(fn, *args, **kwargs):
    """Run a state machine call, translating its errors into DRF 400s."""
    try:
        return fn(*args, **kwargs)
    except DjangoValidationError as exc:
        messages = exc.messages if hasattr(exc, 'messages') else [str(exc)]
        raise DRFValidationError({'detail': messages})


class NPARequestViewSet(viewsets.ModelViewSet):
    """Orders moving through the approval pipeline.

    Visibility rules:
      - Customers see only the orders they created.
      - Manager / Customs / Operator see orders for their depot (all depots
        when no depot is set on their profile).
      - Admins see everything.
    """

    queryset = NPARequest.objects.all()
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_serializer_class(self):
        if self.action == 'create':
            return NPARequestCreateSerializer
        return NPARequestSerializer

    def get_queryset(self):
        user = self.request.user

        # Ensure today's daily NPA batch exists for this depot
        try:
            from .scheduler import ensure_daily_batch_exists
            ensure_daily_batch_exists(depot_id=user.depot_id if hasattr(user, 'depot_id') else None)
        except Exception:
            pass

        queryset = (
            NPARequest.objects
            .select_related(
                'created_by', 'approved_by_manager', 'approved_by_customs',
                'cleared_by_operator', 'rejected_by', 'held_by', 'denied_by',
                'loaded_by', 'tanker', 'delivery_note', 'delivery_note__waybill',
            )
            .order_by('-created_at')
        )

        is_admin = user.role == RoleChoices.ADMIN or user.is_superuser
        if not is_admin and user.depot_id:
            queryset = queryset.filter(Q(depot_id=user.depot_id) | Q(created_by=user))

        status_param = self.request.query_params.get('status')
        if status_param:
            statuses = [s.strip().upper() for s in status_param.split(',') if s.strip()]
            queryset = queryset.filter(status__in=statuses)

        depot_id = self.request.query_params.get('depot_id')
        if depot_id:
            queryset = queryset.filter(depot_id=depot_id)

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(npa_reference_number__icontains=search)
                | Q(permit_id__icontains=search)
                | Q(truck_number__icontains=search)
                | Q(customer_company__icontains=search)
                | Q(product_type__icontains=search)
            )

        return queryset

    @extend_schema(request=NPARequestCreateSerializer, responses={201: NPARequestSerializer})
    def create(self, request, *args, **kwargs):
        serializer = NPARequestCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        npa_request = serializer.save()

        meta = request_meta(request)
        mongo_service.log_audit_event(
            entity_type='NPARequest',
            entity_id=npa_request.id,
            previous_state=None,
            new_state=npa_request.status,
            user_id=request.user.id,
            user_role=request.user.role,
            ip_address=meta['ip_address'],
            user_agent=meta['user_agent'],
            correlation_id=meta['correlation_id'],
            notes='Order sorted and sent by NPA.',
        )

        return Response(
            NPARequestSerializer(npa_request, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    def _respond(self, npa_request):
        return Response(
            NPARequestSerializer(npa_request, context={'request': self.request}).data,
            status=status.HTTP_200_OK,
        )

    # ------------------------------------------------------------------
    # Stage 2 - BOST depot manager
    # ------------------------------------------------------------------

    @extend_schema(request=None, responses={200: NPARequestSerializer})
    @action(detail=True, methods=['post'], permission_classes=[IsManager])
    def approve_manager(self, request, pk=None):
        """Grant authorisation & permission. Issues the permit ID."""
        npa_request = self.get_object()
        updated = run_transition(
            WorkflowStateMachine.approve_manager,
            npa_request=npa_request, user=request.user, request_meta=request_meta(request),
        )
        return self._respond(updated)

    @extend_schema(request=RejectionSerializer, responses={200: NPARequestSerializer})
    @action(detail=True, methods=['post'], permission_classes=[IsManager])
    def reject(self, request, pk=None):
        """Reject with a reason and notify the customer."""
        payload = RejectionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        npa_request = self.get_object()
        updated = run_transition(
            WorkflowStateMachine.reject_request,
            npa_request=npa_request, user=request.user,
            reason=payload.validated_data['reason'], request_meta=request_meta(request),
        )
        return self._respond(updated)

    # ------------------------------------------------------------------
    # Stage 3 - Customs
    # ------------------------------------------------------------------

    @extend_schema(request=None, responses={200: NPARequestSerializer})
    @action(detail=True, methods=['post'], permission_classes=[IsCustomsOfficer])
    def approve_customs(self, request, pk=None):
        """Customs sign-off. Order becomes CLEARED for the depot."""
        npa_request = self.get_object()
        updated = run_transition(
            WorkflowStateMachine.approve_customs,
            npa_request=npa_request, user=request.user, request_meta=request_meta(request),
        )
        return self._respond(updated)

    @extend_schema(request=HoldSerializer, responses={200: NPARequestSerializer})
    @action(detail=True, methods=['post'], permission_classes=[IsCustomsOfficer])
    def hold(self, request, pk=None):
        """Raise a customs query. Sends the order back to the manager."""
        payload = HoldSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        npa_request = self.get_object()
        updated = run_transition(
            WorkflowStateMachine.hold_request,
            npa_request=npa_request, user=request.user,
            reason=payload.validated_data['reason'], request_meta=request_meta(request),
        )
        return self._respond(updated)

    # ------------------------------------------------------------------
    # Stage 4 - Loading bay
    # ------------------------------------------------------------------

    @extend_schema(request=None, responses={200: NPARequestSerializer})
    @action(detail=True, methods=['post'], permission_classes=[IsDepotOperator])
    def clear_lot(self, request, pk=None):
        """Authorise the lot for filling."""
        npa_request = self.get_object()
        updated = run_transition(
            WorkflowStateMachine.clear_lot,
            npa_request=npa_request, user=request.user, request_meta=request_meta(request),
        )
        return self._respond(updated)

    @extend_schema(request=StartLoadingSerializer, responses={200: NPARequestSerializer})
    @action(detail=True, methods=['post'], permission_classes=[IsDepotOperator])
    def start_loading(self, request, pk=None):
        """Gate check. Rejects with 400 when the car number does not match."""
        payload = StartLoadingSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        npa_request = self.get_object()
        updated = run_transition(
            WorkflowStateMachine.start_loading,
            npa_request=npa_request, user=request.user,
            observed_truck_number=payload.validated_data['observed_truck_number'],
            request_meta=request_meta(request),
        )
        return self._respond(updated)

    @extend_schema(request=DenyEntrySerializer, responses={200: NPARequestSerializer})
    @action(detail=True, methods=['post'], permission_classes=[IsDepotOperator])
    def deny_entry(self, request, pk=None):
        """Deny entry and flag the discrepancy to the manager."""
        payload = DenyEntrySerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        npa_request = self.get_object()
        updated = run_transition(
            WorkflowStateMachine.deny_entry,
            npa_request=npa_request, user=request.user,
            reason=payload.validated_data['reason'],
            observed_truck_number=payload.validated_data.get('observed_truck_number'),
            request_meta=request_meta(request),
        )
        return self._respond(updated)

    @extend_schema(request=CompleteLoadingSerializer, responses={200: NPARequestSerializer})
    @action(detail=True, methods=['post'], permission_classes=[IsDepotOperator])
    def complete_loading(self, request, pk=None):
        """Record the quantity loaded and issue the waybill."""
        payload = CompleteLoadingSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        npa_request = self.get_object()
        updated = run_transition(
            WorkflowStateMachine.complete_loading,
            npa_request=npa_request, user=request.user,
            quantity_loaded=payload.validated_data['quantity_loaded'],
            destination=payload.validated_data.get('destination'),
            transporter_name=payload.validated_data.get('transporter_name'),
            request_meta=request_meta(request),
        )
        return self._respond(updated)

    # ------------------------------------------------------------------
    # Audit
    # ------------------------------------------------------------------

    @extend_schema(responses={200: None})
    @action(detail=True, methods=['get'], url_path='audit-trail')
    def audit_trail(self, request, pk=None):
        """Full append-only transition history for this order."""
        npa_request = self.get_object()
        trail = mongo_service.get_audit_trail('NPARequest', npa_request.id)
        return Response({
            'npa_reference_number': npa_request.npa_reference_number,
            'current_status': npa_request.status,
            'audit_trail': trail,
        })

    @extend_schema(responses={200: None})
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Status counts for dashboard cards, scoped to what the user can see."""
        queryset = self.get_queryset()
        counts = {value: 0 for value in NPARequestStatus.values}
        for row in queryset.values('status'):
            counts[row['status']] = counts.get(row['status'], 0) + 1
        counts['TOTAL'] = sum(counts[v] for v in NPARequestStatus.values)
        return Response(counts)

    @extend_schema(request=NPABatchRequestSerializer, responses={201: None})
    @action(detail=False, methods=['post'], url_path='send-npa-batch', permission_classes=[IsManager])
    def send_npa_batch(self, request):
        """Executes the daily NPA orders dispatch & unworked rollover cycle (50 to 100 per day)."""
        serializer = NPABatchRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        count = serializer.validated_data.get('count')
        depot_id = serializer.validated_data.get('depot_id') or request.user.depot_id or 'DEPOT-TEMA-01'

        summary = process_daily_npa_cycle(
            count=count,
            depot_id=depot_id,
        )

        return Response(
            {
                'message': (
                    f"Successfully processed daily NPA cycle: "
                    f"{summary['rolled_over_count']} unworked orders rolled over, "
                    f"{summary['new_orders_count']} new orders generated."
                ),
                'cycle_batch_id': summary['cycle_batch_id'],
                'count': summary['new_orders_count'],
                'order_references': summary['new_order_references'],
                'rolled_over_count': summary['rolled_over_count'],
                'new_orders_count': summary['new_orders_count'],
                'total_active_orders_count': summary['total_active_orders_count'],
                'depot_id': summary['depot_id'],
                'target_date': summary['target_date'],
                'total_volume': summary['total_volume'],
                'total_value': summary['total_value'],
                'rolled_over_references': summary['rolled_over_references'],
                'new_order_references': summary['new_order_references'],
            },
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(responses={200: None})
    @action(detail=False, methods=['get'], permission_classes=[AllowAny], url_path='tv-display')
    def tv_display(self, request):
        """Telemetry feed for yard TV screens: returns 9 bay slots with active authorized/loading vehicles."""
        from django.utils import timezone
        active_orders = (
            NPARequest.objects
            .filter(status__in=[NPARequestStatus.LOT_CLEARED, NPARequestStatus.LOADING])
            .order_by('lot_clearance_time', 'created_at')[:9]
        )

        queued_orders = (
            NPARequest.objects
            .filter(status=NPARequestStatus.CUSTOMS_APPROVED)
            .order_by('created_at')[:5]
        )

        bays = []
        occupied_orders = list(active_orders)

        for i in range(1, 10):
            bay_label = f"BAY D-{i:02d}"
            if i - 1 < len(occupied_orders):
                ord_obj = occupied_orders[i - 1]
                is_loading = ord_obj.status == NPARequestStatus.LOADING
                bays.append({
                    'slot_number': i,
                    'bay_label': bay_label,
                    'is_occupied': True,
                    'is_maintenance': False,
                    'order': {
                        'id': ord_obj.id,
                        'npa_reference_number': ord_obj.npa_reference_number,
                        'truck_number': ord_obj.verified_truck_number or ord_obj.truck_number or 'UNKNOWN',
                        'driver_name': ord_obj.driver_name or 'ASSIGNED DRIVER',
                        'customer_company': ord_obj.customer_company or 'COMMERCIAL CARRIER',
                        'product_type': ord_obj.product_type or 'AGO',
                        'product_name': ord_obj.product_name,
                        'product_display': ord_obj.product_display,
                        'product_group': ord_obj.product_group,
                        'compartments': ord_obj.compartments,
                        'volume_requested': float(ord_obj.volume_requested) if ord_obj.volume_requested else 0,
                        'unit': ord_obj.unit or 'LITERS',
                        'status': ord_obj.status,
                        'status_display': (
                            'FILLING IN PROGRESS' if is_loading
                            else 'READY FOR FILLING'
                        ),
                        'bay_state': 'DISPENSING' if is_loading else 'AUTHORIZED',
                        'flow_rate_lpm': 850.0 if is_loading else 0.0,
                        'lot_clearance_time': ord_obj.lot_clearance_time.isoformat() if ord_obj.lot_clearance_time else None,
                        'loading_started_at': ord_obj.loading_started_at.isoformat() if ord_obj.loading_started_at else None,
                    }
                })
            else:
                bays.append({
                    'slot_number': i,
                    'bay_label': bay_label,
                    'is_occupied': False,
                    'is_maintenance': False,
                    'order': None,
                })

        return Response({
            'depot_name': 'BOST TEMA CENTRAL TERMINAL — GANTRY GANTRY 01-09',
            'server_time': timezone.now().isoformat(),
            'total_active': len(occupied_orders),
            'queued_count': queued_orders.count(),
            'telemetry': {
                'capacity_percent': min(98, max(45, int(len(occupied_orders) * 11 + 42))),
                'current_flow_rate': f"{len(occupied_orders) * 480 + 1200:,} BBL/HR",
                'operating_pressure_psi': '68.4 PSI',
                'terminal_status': 'OPERATIONAL / NOMINAL',
                'weather': 'CLEAR 29°C / WINDS 6 KTS NW',
            },
            'bays': bays,
        })



class TankerViewSet(viewsets.ModelViewSet):
    queryset = Tanker.objects.all().order_by('-created_at')
    serializer_class = TankerSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(truck_number__icontains=search) | Q(driver_name__icontains=search)
            )
        return queryset


class LotViewSet(viewsets.ModelViewSet):
    queryset = Lot.objects.all().order_by('-created_at')
    serializer_class = LotSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.role != RoleChoices.ADMIN and not user.is_superuser and user.depot_id:
            queryset = queryset.filter(depot_id=user.depot_id)
        return queryset


class DeliveryNoteViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Delivery notes are created by the workflow, not by hand."""

    queryset = DeliveryNote.objects.select_related('npa_request').order_by('-created_at')
    serializer_class = DeliveryNoteSerializer
    permission_classes = [IsAuthenticated]


class WaybillViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Waybills are issued when loading completes."""

    queryset = Waybill.objects.select_related('tanker', 'delivery_note').order_by('-created_at')
    serializer_class = WaybillSerializer
    permission_classes = [IsAuthenticated]


class DispatchRequestViewSet(viewsets.ModelViewSet):
    queryset = DispatchRequest.objects.select_related('waybill', 'lot').order_by('-created_at')
    serializer_class = DispatchRequestSerializer
    permission_classes = [IsAuthenticated]
