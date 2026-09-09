# BOST Manifest - Relational Domain Models
# Author: Abena Adjei

from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError


class TankerStatus(models.TextChoices):
    ACTIVE = 'ACTIVE', 'Active'
    MAINTENANCE = 'MAINTENANCE', 'In Maintenance'
    INACTIVE = 'INACTIVE', 'Inactive'


class Tanker(models.Model):
    truck_number = models.CharField(max_length=50, unique=True)
    driver_name = models.CharField(max_length=100)
    driver_license = models.CharField(max_length=50)
    capacity_liters = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=20, choices=TankerStatus.choices, default=TankerStatus.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'bost_tankers'
        indexes = [
            models.Index(fields=['status', 'created_at']),
        ]

    def __str__(self):
        return f"Tanker {self.truck_number} ({self.driver_name})"


class LotStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending Approval'
    CUSTOMS_APPROVED = 'CUSTOMS_APPROVED', 'Customs Approved'
    CLEARED_FOR_FILLING = 'CLEARED_FOR_FILLING', 'Cleared for Filling'
    FILLED = 'FILLED', 'Tanker Filled'
    REJECTED = 'REJECTED', 'Rejected'


class Lot(models.Model):
    lot_number = models.CharField(max_length=50, unique=True)
    depot_id = models.CharField(max_length=50)
    product_type = models.CharField(max_length=50)
    quantity_liters = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=30, choices=LotStatus.choices, default=LotStatus.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'bost_lots'
        indexes = [
            models.Index(fields=['status', 'depot_id', 'created_at']),
        ]

    def __str__(self):
        return f"Lot {self.lot_number} - Depot {self.depot_id} ({self.status})"


class QuantityUnit(models.TextChoices):
    LITERS = 'LITERS', 'Liters'
    GALLONS = 'GALLONS', 'Gallons'


class ProductCode(models.TextChoices):
    PMS = 'PMS', 'Premium Motor Spirit (Petrol)'
    AGO = 'AGO', 'Automotive Gas Oil (Diesel)'
    DPK = 'DPK', 'Dual Purpose Kerosene (Kerosene)'
    ATK = 'ATK', 'Aviation Turbine Kerosene (Jet Fuel)'
    MGO = 'MGO', 'Marine Gas Oil (Marine)'


PRODUCT_COMMERCIAL_NAMES = {
    'PMS': 'Petrol',
    'AGO': 'Diesel',
    'DPK': 'Kerosene',
    'ATK': 'Jet Fuel',
    'MGO': 'Marine',
}

PRODUCT_CODE_ALIASES = {
    # Diesel / AGO
    'diesel': 'AGO',
    'ago': 'AGO',
    'diesel ago': 'AGO',
    'automotive gas oil': 'AGO',
    'automotive gas oil (diesel)': 'AGO',
    'ago (retail outlets)': 'AGO',
    'ulsd': 'AGO',
    'ulsd / diesel #2': 'AGO',
    # Petrol / PMS
    'petrol': 'PMS',
    'pms': 'PMS',
    'super gasoline': 'PMS',
    'gasoline': 'PMS',
    'premium motor spirit': 'PMS',
    'premium motor spirit (petrol)': 'PMS',
    # Kerosene / DPK
    'kerosene': 'DPK',
    'dpk': 'DPK',
    'dual purpose kerosene': 'DPK',
    'dual purpose kerosene (kerosene)': 'DPK',
    # Jet Fuel / ATK
    'jet fuel': 'ATK',
    'atk': 'ATK',
    'aviation turbine kerosene': 'ATK',
    'aviation fuel': 'ATK',
    # Marine / MGO
    'marine': 'MGO',
    'mgo': 'MGO',
    'marine gas oil': 'MGO',
}


def normalize_product_code(value: str) -> str:
    """
    Normalizes a product name or code to its official Ghanaian NPA product code (e.g. AGO, PMS, DPK, ATK, MGO).
    Accepts both commercial names ("Diesel", "Petrol") and official codes ("AGO", "PMS").
    """
    if not value:
        return 'AGO'
    clean_val = str(value).strip().lower()
    return PRODUCT_CODE_ALIASES.get(clean_val, str(value).strip().upper())


def get_product_group(product_code: str) -> str:
    """Returns the official NPA product group. Refined fuels are WHITE PRODUCT."""
    return 'WHITE PRODUCT'


class NPARequestStatus(models.TextChoices):
    # --- Flowchart stage 1: customer company ---
    SUBMITTED = 'SUBMITTED', 'Submitted (Pending Manager)'
    # --- Flowchart stage 2: BOST depot manager ---
    MANAGER_APPROVED = 'MANAGER_APPROVED', 'Manager Approved / Permit Issued (Pending Customs)'
    REJECTED = 'REJECTED', 'Rejected by Manager'
    # --- Flowchart stage 3: customs ---
    CUSTOMS_APPROVED = 'CUSTOMS_APPROVED', 'Customs Signed Off (Pending Lot Clearance)'
    ON_HOLD = 'ON_HOLD', 'On Hold (Customs Query Raised)'
    # --- Flowchart stage 4: loading bay ---
    LOT_CLEARED = 'LOT_CLEARED', 'Lot Cleared (Authorized for Filling)'
    LOADING = 'LOADING', 'Vehicle Loading'
    COMPLETED = 'COMPLETED', 'Completed (Waybill Issued)'
    DENIED = 'DENIED', 'Entry Denied (Vehicle Discrepancy)'


# Every status the CheckConstraint will permit.
ALL_NPA_STATUSES = [choice[0] for choice in NPARequestStatus.choices]


class NPARequest(models.Model):
    npa_reference_number = models.CharField(max_length=100, unique=True)
    product_type = models.CharField(
        max_length=50,
        help_text="Official NPA product code (AGO, PMS, DPK, ATK, MGO)."
    )
    product_group = models.CharField(
        max_length=50,
        default='WHITE PRODUCT',
        help_text="NPA Product Group (e.g. WHITE PRODUCT for refined fuels)."
    )
    compartments = models.PositiveSmallIntegerField(
        default=4,
        help_text="Number of BRV tanker compartments."
    )
    volume_requested = models.DecimalField(max_digits=12, decimal_places=2)
    unit = models.CharField(
        max_length=10,
        choices=QuantityUnit.choices,
        default=QuantityUnit.LITERS
    )
    depot_id = models.CharField(max_length=50)
    status = models.CharField(
        max_length=30,
        choices=NPARequestStatus.choices,
        default=NPARequestStatus.SUBMITTED
    )

    # ------------------------------------------------------------------
    # Flowchart stage 1 - order details captured from the customer company
    # ------------------------------------------------------------------
    customer_company = models.CharField(max_length=150, blank=True, null=True)
    delivery_date = models.DateField(null=True, blank=True)
    delivery_time = models.TimeField(null=True, blank=True)
    delivery_location = models.CharField(max_length=250, blank=True, null=True)
    contact_name = models.CharField(max_length=120, blank=True, null=True)
    contact_phone = models.CharField(max_length=30, blank=True, null=True)
    contact_email = models.EmailField(blank=True, null=True)

    # Car number + driver travel with the order itself. The loading bay
    # compares the vehicle that physically arrives against these values.
    truck_number = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Car/plate number declared by the customer at order time."
    )
    driver_name = models.CharField(max_length=120, blank=True, null=True)
    driver_phone = models.CharField(max_length=30, blank=True, null=True)
    tanker = models.ForeignKey(
        'Tanker',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='npa_requests',
        help_text="Registered tanker matched to this order, if one exists."
    )

    price_per_unit = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    total_price = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='created_npa_requests'
    )
    approved_by_manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='manager_approved_npa_requests'
    )
    manager_approval_time = models.DateTimeField(null=True, blank=True)

    approved_by_customs = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='customs_approved_npa_requests'
    )
    customs_approval_time = models.DateTimeField(null=True, blank=True)

    cleared_by_operator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cleared_npa_requests'
    )
    lot_clearance_time = models.DateTimeField(null=True, blank=True)

    rejected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='rejected_npa_requests'
    )
    rejection_reason = models.TextField(blank=True, null=True)

    # ------------------------------------------------------------------
    # Flowchart stage 2 - permit issued when the manager grants authorisation
    # ------------------------------------------------------------------
    permit_id = models.CharField(
        max_length=100,
        unique=True,
        null=True,
        blank=True,
        help_text="Permit identifier issued once the depot manager grants authorisation."
    )

    # ------------------------------------------------------------------
    # Flowchart stage 3 - customs query ("ON HOLD", routed back to manager)
    # ------------------------------------------------------------------
    held_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='held_npa_requests'
    )
    hold_reason = models.TextField(blank=True, null=True)
    hold_time = models.DateTimeField(null=True, blank=True)

    # ------------------------------------------------------------------
    # Flowchart stage 4 - loading bay gate check, loading, completion
    # ------------------------------------------------------------------
    verified_truck_number = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Car number physically observed at the loading bay gate."
    )
    loading_started_at = models.DateTimeField(null=True, blank=True)
    loaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='loaded_npa_requests'
    )
    quantity_loaded = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Actual quantity dispensed into the vehicle."
    )
    completed_at = models.DateTimeField(null=True, blank=True)

    denied_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='denied_npa_requests'
    )
    denial_reason = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'bost_npa_requests'
        indexes = [
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['depot_id', 'status']),
            models.Index(fields=['npa_reference_number']),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(status__in=ALL_NPA_STATUSES),
                name='valid_npa_status_check'
            )
        ]

    def clean(self):
        if self.status == NPARequestStatus.CUSTOMS_APPROVED and not self.approved_by_manager:
            raise ValidationError("Customs approval requires prior Manager approval.")
        if self.status in (
            NPARequestStatus.LOT_CLEARED,
            NPARequestStatus.LOADING,
            NPARequestStatus.COMPLETED,
        ):
            if not self.approved_by_manager:
                raise ValidationError("Lot clearance requires prior Manager approval.")
            if not self.approved_by_customs:
                raise ValidationError("Lot clearance requires prior Customs approval.")

    def save(self, *args, **kwargs):
        if self.product_type:
            self.product_type = normalize_product_code(self.product_type)
        if not self.product_group:
            self.product_group = get_product_group(self.product_type)
        super().save(*args, **kwargs)

    @property
    def product_name(self):
        """Returns the commercial name for the product code (e.g. 'Diesel' for 'AGO')."""
        return PRODUCT_COMMERCIAL_NAMES.get(self.product_type, self.product_type)

    @property
    def product_display(self):
        """Returns official code with commercial designation, e.g. 'AGO (Diesel)'."""
        comm = self.product_name
        if comm and comm != self.product_type:
            return f"{self.product_type} ({comm})"
        return self.product_type

    @property
    def car_number_matches(self):
        """Gate check from the flowchart: does the arriving car match the order?

        Returns None when the bay has not recorded an observed number yet.
        Comparison is case-insensitive and ignores spaces/hyphens, since plate
        numbers get typed inconsistently.
        """
        if not self.verified_truck_number or not self.truck_number:
            return None
        return self._normalise_plate(self.verified_truck_number) == self._normalise_plate(self.truck_number)

    @staticmethod
    def _normalise_plate(value):
        return ''.join(ch for ch in str(value) if ch.isalnum()).upper()

    def __str__(self):
        return f"NPA Request {self.npa_reference_number} [{self.status}]"


class DeliveryNote(models.Model):
    npa_request = models.OneToOneField(
        NPARequest,
        on_delete=models.CASCADE,
        related_name='delivery_note'
    )
    delivery_note_number = models.CharField(max_length=100, unique=True)
    quantity_dispatched = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=20, default='ISSUED')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'bost_delivery_notes'
        indexes = [
            models.Index(fields=['delivery_note_number']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"Delivery Note {self.delivery_note_number}"


class Waybill(models.Model):
    delivery_note = models.OneToOneField(
        DeliveryNote,
        on_delete=models.CASCADE,
        related_name='waybill'
    )
    tanker = models.ForeignKey(
        Tanker,
        on_delete=models.PROTECT,
        related_name='waybills'
    )
    waybill_number = models.CharField(max_length=100, unique=True)
    destination = models.CharField(max_length=200)
    transporter_name = models.CharField(max_length=150)
    status = models.CharField(max_length=20, default='ISSUED')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'bost_waybills'
        indexes = [
            models.Index(fields=['waybill_number']),
            models.Index(fields=['tanker_id']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"Waybill {self.waybill_number} (Tanker: {self.tanker.truck_number})"


class DispatchRequest(models.Model):
    waybill = models.OneToOneField(
        Waybill,
        on_delete=models.CASCADE,
        related_name='dispatch_request'
    )
    lot = models.ForeignKey(
        Lot,
        on_delete=models.PROTECT,
        related_name='dispatch_requests'
    )
    dispatch_reference = models.CharField(max_length=100, unique=True)
    approval_stage = models.IntegerField(default=1)
    status = models.CharField(
        max_length=30,
        choices=NPARequestStatus.choices,
        default=NPARequestStatus.SUBMITTED
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'bost_dispatch_requests'
        indexes = [
            models.Index(fields=['status', 'approval_stage']),
            models.Index(fields=['lot_id']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"Dispatch Request {self.dispatch_reference} - Stage {self.approval_stage} ({self.status})"
