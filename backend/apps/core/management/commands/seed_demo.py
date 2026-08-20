# BOST Manifest - Demo data seeder
#
#   python manage.py seed_demo
#
# Creates one account per flowchart actor plus sample orders sitting at each
# stage of the pipeline, so every screen has something to show.

from datetime import date, time, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction

from apps.dispatch.models import (
    NPARequest, NPARequestStatus, Tanker, TankerStatus, Lot, LotStatus, QuantityUnit,
)
from apps.dispatch.serializers import calculate_pricing
from apps.dispatch.state_machine import WorkflowStateMachine
from apps.users.models import RoleChoices

User = get_user_model()

DEPOT = 'DEPOT-TEMA-01'
PASSWORD = 'Password123!'

DEMO_USERS = [
    # username,   role,                      first name,  last name,  company
    ('manager', RoleChoices.MANAGER, 'Ama', 'Boateng', 'BOST'),
    ('customs', RoleChoices.CUSTOMS_OFFICER, 'Kofi', 'Anane', 'Ghana Customs'),
    ('dock', RoleChoices.DEPOT_OPERATOR, 'Yaw', 'Owusu', 'BOST Loading Bay'),
    ('admin', RoleChoices.ADMIN, 'System', 'Administrator', 'BOST'),
]

DEMO_ORDERS = [
    # product,     volume,  unit,                    truck,        driver,        target stage
    ('Diesel', 30000, QuantityUnit.LITERS, 'GR-4521-24', 'Kwesi Appiah', 'submitted'),
    ('Petrol', 25000, QuantityUnit.LITERS, 'GT-8890-23', 'Musah Ibrahim', 'manager_approved'),
    ('Kerosene', 18000, QuantityUnit.LITERS, 'AS-1177-25', 'Daniel Osei', 'customs_approved'),
    ('Diesel', 40000, QuantityUnit.LITERS, 'GW-6543-24', 'Peter Nkrumah', 'lot_cleared'),
    ('Petrol', 22000, QuantityUnit.LITERS, 'GN-3321-22', 'Samuel Tetteh', 'completed'),
    ('Crude', 35000, QuantityUnit.LITERS, 'GX-9087-24', 'Isaac Danso', 'on_hold'),
    ('Diesel', 15000, QuantityUnit.LITERS, 'GE-2244-23', 'Felix Amoah', 'rejected'),
]


class Command(BaseCommand):
    help = 'Seed demo users, tankers, lots and orders covering every workflow stage.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Delete existing demo orders before seeding.',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options['reset']:
            NPARequest.objects.filter(npa_reference_number__startswith='NPA-DEMO-').delete()
            self.stdout.write(self.style.WARNING('Existing demo orders removed.'))

        users = self._create_users()
        self._create_tankers()
        self._create_lots()
        self._create_orders(users)

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('Demo data ready. Sign in with:'))
        for username, role, *_ in DEMO_USERS:
            self.stdout.write(f'  {username:10s} / {PASSWORD:15s}  ({role})')

    # ------------------------------------------------------------------

    def _create_users(self):
        users = {}
        for username, role, first_name, last_name, company in DEMO_USERS:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'role': role,
                    'first_name': first_name,
                    'last_name': last_name,
                    'email': f'{username}@bost.example.com',
                    'depot_id': DEPOT,
                    'company_name': company,
                    'location': 'Tema, Ghana',
                    'is_staff': role == RoleChoices.ADMIN,
                    'is_superuser': role == RoleChoices.ADMIN,
                },
            )
            # Always reset the password so the documented credentials work.
            user.set_password(PASSWORD)
            user.role = role
            user.save()
            users[role] = user
            verb = 'Created' if created else 'Updated'
            self.stdout.write(f'{verb} user {username} ({role})')
        return users

    def _create_tankers(self):
        for _, _, _, truck, driver, _ in DEMO_ORDERS:
            Tanker.objects.get_or_create(
                truck_number=truck,
                defaults={
                    'driver_name': driver,
                    'driver_license': f'DL-{truck.replace("-", "")}',
                    'capacity_liters': Decimal('45000.00'),
                    'status': TankerStatus.ACTIVE,
                },
            )
        self.stdout.write(f'Tankers ready ({Tanker.objects.count()} total)')

    def _create_lots(self):
        for index, product in enumerate(['Diesel', 'Petrol', 'Kerosene', 'Crude'], start=1):
            Lot.objects.get_or_create(
                lot_number=f'LOT-{DEPOT}-{index:03d}',
                defaults={
                    'depot_id': DEPOT,
                    'product_type': product,
                    'quantity_liters': Decimal('500000.00'),
                    'status': LotStatus.PENDING,
                },
            )
        self.stdout.write(f'Lots ready ({Lot.objects.count()} total)')

    def _create_orders(self, users):
        manager = users[RoleChoices.MANAGER]
        customs = users[RoleChoices.CUSTOMS_OFFICER]
        operator = users[RoleChoices.DEPOT_OPERATOR]

        for index, (product, volume, unit, truck, driver, stage) in enumerate(DEMO_ORDERS, start=1):
            reference = f'NPA-DEMO-{index:03d}'
            if NPARequest.objects.filter(npa_reference_number=reference).exists():
                self.stdout.write(f'Order {reference} already exists, skipping.')
                continue

            per_unit, total = calculate_pricing(product, volume, unit)
            order = NPARequest.objects.create(
                npa_reference_number=reference,
                product_type=product,
                volume_requested=Decimal(volume),
                unit=unit,
                depot_id=DEPOT,
                customer_company='Acme Oil Ghana Ltd',
                delivery_date=date.today() + timedelta(days=index),
                delivery_time=time(hour=8 + (index % 8)),
                delivery_location=f'{index} Harbour Road, Tema, Ghana',
                contact_name='John Mensah',
                contact_phone='+233 20 000 0000',
                contact_email='john.mensah@example.com',
                truck_number=truck,
                driver_name=driver,
                driver_phone='+233 24 111 1111',
                tanker=Tanker.objects.filter(truck_number=truck).first(),
                price_per_unit=per_unit,
                total_price=total,
                created_by=manager,
            )

            self._advance(order, stage, manager, customs, operator)
            self.stdout.write(f'Created order {reference} at stage {order.status}')

    def _advance(self, order, stage, manager, customs, operator):
        """Walk a freshly created order forward to the requested stage."""
        if stage == 'submitted':
            return

        if stage == 'rejected':
            WorkflowStateMachine.reject_request(
                order, manager, reason='Customer credit limit exceeded. Amend and resubmit.'
            )
            return

        WorkflowStateMachine.approve_manager(order, manager)
        if stage == 'manager_approved':
            return

        if stage == 'on_hold':
            WorkflowStateMachine.hold_request(
                order, customs, reason='Import declaration number does not match the permit.'
            )
            return

        WorkflowStateMachine.approve_customs(order, customs)
        if stage == 'customs_approved':
            return

        WorkflowStateMachine.clear_lot(order, operator)
        if stage == 'lot_cleared':
            return

        WorkflowStateMachine.start_loading(order, operator, observed_truck_number=order.truck_number)
        if stage == 'loading':
            return

        WorkflowStateMachine.complete_loading(
            order, operator,
            quantity_loaded=order.volume_requested,
            destination=order.delivery_location,
            transporter_name=order.customer_company,
        )
