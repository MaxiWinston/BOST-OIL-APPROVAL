# BOST Manifest - Dispatch Serializers

from decimal import Decimal

from rest_framework import serializers

from apps.users.serializers import UserSerializer
from .models import (
    Tanker, Lot, NPARequest, NPARequestStatus, QuantityUnit,
    DeliveryNote, Waybill, DispatchRequest,
)

# Indicative rates used to price an order at submission time.
# Keyed by lowercase product type, then by unit.
PRICING_RATES = {
    'crude': {'GALLONS': Decimal('2.50'), 'LITERS': Decimal('0.66')},
    'refined': {'GALLONS': Decimal('3.00'), 'LITERS': Decimal('0.79')},
    'diesel': {'GALLONS': Decimal('3.50'), 'LITERS': Decimal('0.92')},
    'petrol': {'GALLONS': Decimal('3.20'), 'LITERS': Decimal('0.85')},
    'kerosene': {'GALLONS': Decimal('2.80'), 'LITERS': Decimal('0.74')},
}
DEFAULT_RATE = {'GALLONS': Decimal('3.00'), 'LITERS': Decimal('0.79')}


def calculate_pricing(product_type, quantity, unit):
    """Return (price_per_unit, total_price) for an order line."""
    rates = PRICING_RATES.get(str(product_type).strip().lower(), DEFAULT_RATE)
    per_unit = rates.get(unit, DEFAULT_RATE['LITERS'])
    total = (Decimal(str(quantity)) * per_unit).quantize(Decimal('0.01'))
    return per_unit, total


class TankerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tanker
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class LotSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lot
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class DeliveryNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryNote
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class WaybillSerializer(serializers.ModelSerializer):
    tanker_number = serializers.CharField(source='tanker.truck_number', read_only=True)

    class Meta:
        model = Waybill
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class DispatchRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = DispatchRequest
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class NPARequestSerializer(serializers.ModelSerializer):
    """Read representation of an order as it moves through the pipeline."""

    created_by = UserSerializer(read_only=True)
    approved_by_manager = UserSerializer(read_only=True)
    approved_by_customs = UserSerializer(read_only=True)
    cleared_by_operator = UserSerializer(read_only=True)
    rejected_by = UserSerializer(read_only=True)
    held_by = UserSerializer(read_only=True)
    denied_by = UserSerializer(read_only=True)
    loaded_by = UserSerializer(read_only=True)

    status_display = serializers.CharField(source='get_status_display', read_only=True)
    car_number_matches = serializers.BooleanField(read_only=True)
    waybill_number = serializers.SerializerMethodField()
    available_actions = serializers.SerializerMethodField()

    class Meta:
        model = NPARequest
        fields = [
            'id', 'npa_reference_number', 'permit_id',
            'product_type', 'volume_requested', 'unit', 'depot_id',
            'status', 'status_display',
            # Order details
            'customer_company', 'delivery_date', 'delivery_time', 'delivery_location',
            'contact_name', 'contact_phone', 'contact_email',
            'truck_number', 'driver_name', 'driver_phone', 'tanker',
            'price_per_unit', 'total_price',
            # Workflow actors and timestamps
            'created_by', 'created_at', 'updated_at',
            'approved_by_manager', 'manager_approval_time',
            'approved_by_customs', 'customs_approval_time',
            'cleared_by_operator', 'lot_clearance_time',
            'rejected_by', 'rejection_reason',
            'held_by', 'hold_reason', 'hold_time',
            'verified_truck_number', 'car_number_matches',
            'loading_started_at', 'loaded_by', 'quantity_loaded', 'completed_at',
            'denied_by', 'denial_reason',
            'waybill_number', 'available_actions',
        ]
        read_only_fields = fields

    def get_waybill_number(self, obj):
        delivery_note = getattr(obj, 'delivery_note', None)
        waybill = getattr(delivery_note, 'waybill', None) if delivery_note else None
        return waybill.waybill_number if waybill else None

    def get_available_actions(self, obj):
        """What the current user may do to this order right now.
        Lets the frontend render buttons without duplicating workflow rules."""
        request = self.context.get('request')
        if request is None or not request.user.is_authenticated:
            return []

        from apps.users.models import RoleChoices

        role = request.user.role
        is_admin = role == RoleChoices.ADMIN or request.user.is_superuser
        actions = []

        if obj.status in (NPARequestStatus.SUBMITTED, NPARequestStatus.ON_HOLD):
            if is_admin or role == RoleChoices.MANAGER:
                actions += ['approve_manager', 'reject']
        elif obj.status == NPARequestStatus.MANAGER_APPROVED:
            if is_admin or role == RoleChoices.CUSTOMS_OFFICER:
                actions += ['approve_customs', 'hold']
        elif obj.status == NPARequestStatus.CUSTOMS_APPROVED:
            if is_admin or role == RoleChoices.DEPOT_OPERATOR:
                actions += ['clear_lot']
        elif obj.status == NPARequestStatus.LOT_CLEARED:
            if is_admin or role == RoleChoices.DEPOT_OPERATOR:
                actions += ['start_loading', 'deny_entry']
        elif obj.status == NPARequestStatus.LOADING:
            if is_admin or role == RoleChoices.DEPOT_OPERATOR:
                actions += ['complete_loading', 'deny_entry']

        return actions


class NPARequestCreateSerializer(serializers.ModelSerializer):
    """Order submission. Everything workflow-related is server-controlled."""

    # Both are optional on submission: the reference is generated and the
    # depot falls back to the submitting user's depot. They are required on
    # the model, so they must be declared optional explicitly here.
    npa_reference_number = serializers.CharField(required=False, allow_blank=True)
    depot_id = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = NPARequest
        fields = [
            'id', 'npa_reference_number', 'product_type', 'volume_requested', 'unit',
            'depot_id', 'customer_company', 'delivery_date', 'delivery_time',
            'delivery_location', 'contact_name', 'contact_phone', 'contact_email',
            'truck_number', 'driver_name', 'driver_phone', 'tanker',
        ]
        read_only_fields = ['id']

    def validate_volume_requested(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError("Volume requested must be greater than zero.")
        return value

    def validate_unit(self, value):
        if value not in QuantityUnit.values:
            raise serializers.ValidationError(f"Unit must be one of {', '.join(QuantityUnit.values)}.")
        return value

    def create(self, validated_data):
        import uuid

        user = self.context['request'].user

        # Generate a reference if the client did not supply one.
        if not validated_data.get('npa_reference_number'):
            validated_data['npa_reference_number'] = f"NPA-{uuid.uuid4().hex[:10].upper()}"

        # Default the depot to the submitting user's depot when omitted.
        if not validated_data.get('depot_id'):
            validated_data['depot_id'] = user.depot_id or 'DEPOT-DEFAULT'

        if not validated_data.get('customer_company'):
            validated_data['customer_company'] = getattr(user, 'company_name', None)

        per_unit, total = calculate_pricing(
            validated_data.get('product_type'),
            validated_data.get('volume_requested'),
            validated_data.get('unit', QuantityUnit.LITERS),
        )
        validated_data['price_per_unit'] = per_unit
        validated_data['total_price'] = total
        validated_data['created_by'] = user
        validated_data['status'] = NPARequestStatus.SUBMITTED

        return NPARequest.objects.create(**validated_data)


# --- Action payload serializers (used for request validation + OpenAPI docs) ---

class RejectionSerializer(serializers.Serializer):
    reason = serializers.CharField(allow_blank=False, help_text="Why the order was rejected.")


class HoldSerializer(serializers.Serializer):
    reason = serializers.CharField(allow_blank=False, help_text="The customs query being raised.")


class StartLoadingSerializer(serializers.Serializer):
    observed_truck_number = serializers.CharField(
        help_text="Car number physically observed at the loading bay gate."
    )


class DenyEntrySerializer(serializers.Serializer):
    reason = serializers.CharField(allow_blank=False)
    observed_truck_number = serializers.CharField(required=False, allow_blank=True)


class CompleteLoadingSerializer(serializers.Serializer):
    quantity_loaded = serializers.DecimalField(max_digits=12, decimal_places=2)
    destination = serializers.CharField(required=False, allow_blank=True)
    transporter_name = serializers.CharField(required=False, allow_blank=True)


class NPABatchRequestSerializer(serializers.Serializer):
    count = serializers.IntegerField(
        required=False,
        min_value=1,
        max_value=500,
        help_text="Number of orders to generate (50-100 recommended). Omit for random between 50 and 100."
    )
    depot_id = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Target depot ID. Defaults to user's depot or DEPOT-TEMA-01."
    )

