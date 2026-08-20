# BOST Manifest - Test NPA Daily 5AM Dispatch & Rollover Cycle

from datetime import date, timedelta
from decimal import Decimal
import pytest
from django.utils import timezone

from apps.users.models import User, RoleChoices
from apps.dispatch.models import NPARequest, NPARequestStatus, QuantityUnit, Tanker, TankerStatus
from apps.dispatch.npa_generator import process_daily_npa_cycle, generate_npa_batch
from apps.dispatch.scheduler import get_seconds_until_next_5am


@pytest.mark.django_db
class TestNPADailyCycle:
    def setup_method(self):
        self.manager = User.objects.create_user(
            username='test_manager_npa',
            password='Password123!',
            role=RoleChoices.MANAGER,
            depot_id='DEPOT-TEMA-01',
        )
        self.tanker = Tanker.objects.create(
            truck_number='GR-1001-24',
            driver_name='Kofi Mensah',
            driver_license='DL-GR100124',
            capacity_liters=Decimal('45000.00'),
            status=TankerStatus.ACTIVE,
        )

    def test_process_daily_npa_cycle_rollover_and_new_orders(self):
        yesterday = date.today() - timedelta(days=1)
        today = date.today()

        # Create 3 unworked orders submitted yesterday
        for i in range(1, 4):
            NPARequest.objects.create(
                npa_reference_number=f"NPA-OLD-{i:03d}",
                product_type='Diesel',
                volume_requested=Decimal('25000.00'),
                unit=QuantityUnit.LITERS,
                depot_id='DEPOT-TEMA-01',
                customer_company='GOIL PLC',
                delivery_date=yesterday,
                truck_number='GR-1001-24',
                driver_name='Kofi Mensah',
                tanker=self.tanker,
                price_per_unit=Decimal('12.50'),
                total_price=Decimal('312500.00'),
                created_by=self.manager,
                status=NPARequestStatus.SUBMITTED,
            )

        # Also create an order from yesterday that WAS worked on (e.g. MANAGER_APPROVED)
        NPARequest.objects.create(
            npa_reference_number="NPA-WORKED-001",
            product_type='Diesel',
            volume_requested=Decimal('25000.00'),
            unit=QuantityUnit.LITERS,
            depot_id='DEPOT-TEMA-01',
            customer_company='TotalEnergies',
            delivery_date=yesterday,
            truck_number='GR-1001-24',
            driver_name='Kofi Mensah',
            tanker=self.tanker,
            price_per_unit=Decimal('12.50'),
            total_price=Decimal('312500.00'),
            created_by=self.manager,
            status=NPARequestStatus.MANAGER_APPROVED,
        )

        # Run cycle for today with target count of 50
        result = process_daily_npa_cycle(target_date=today, depot_id='DEPOT-TEMA-01', count=50)

        assert result['rolled_over_count'] == 3
        assert result['new_orders_count'] == 47
        assert result['total_active_orders_count'] == 50
        assert len(result['rolled_over_references']) == 3

        # Verify old unworked orders now have delivery_date set to today
        for i in range(1, 4):
            order = NPARequest.objects.get(npa_reference_number=f"NPA-OLD-{i:03d}")
            assert order.delivery_date == today
            assert order.status == NPARequestStatus.SUBMITTED

        # Verify worked-on order was untouched
        worked_order = NPARequest.objects.get(npa_reference_number="NPA-WORKED-001")
        assert worked_order.delivery_date == yesterday
        assert worked_order.status == NPARequestStatus.MANAGER_APPROVED

    def test_get_seconds_until_next_5am(self):
        seconds = get_seconds_until_next_5am()
        assert seconds > 0
        assert seconds <= 86400
