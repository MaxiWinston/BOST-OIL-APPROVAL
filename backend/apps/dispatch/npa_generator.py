# BOST Manifest - NPA Order Generator Service

from datetime import date, time
from decimal import Decimal
import random
import uuid

from django.db import transaction

from apps.core.mongo import mongo_service
from apps.users.models import User, RoleChoices
from .models import NPARequest, NPARequestStatus, QuantityUnit, Tanker, TankerStatus
from .serializers import calculate_pricing

OMC_COMPANIES = [
    'GOIL PLC',
    'TotalEnergies Ghana Ltd',
    'StarOil Ghana',
    'Acme Oil Ghana Ltd',
    'Puma Energy Ghana',
    'Zen Petroleum Ltd',
    'Shell Ghana',
]

PRODUCT_TYPES = ['AGO', 'PMS', 'DPK']

DRIVERS = [
    ('Kwesi Appiah', '+233 24 111 2233'),
    ('Kofi Mensah', '+233 20 444 5566'),
    ('Emmanuel Osei', '+233 27 777 8899'),
    ('Ibrahim Musah', '+233 54 222 3344'),
    ('Peter Nkrumah', '+233 24 555 6677'),
    ('Samuel Tetteh', '+233 20 888 9900'),
    ('Daniel Danso', '+233 26 333 4455'),
    ('Yaw Boateng', '+233 50 666 7788'),
]

LOCATIONS = [
    'Razs Oil Sorkpeyiri SS',
    'Tema Harbour Terminal, Region 1',
    'Accra Plains Depot, Heavy Industrial Area',
    'Takoradi Port Oil Terminal',
    'Kumasi Central Depot, Ashanti Region',
    'Tamale Distribution Point, Northern Region',
]

STANDARD_BRV_VOLUMES = [
    Decimal('13500.00'),
    Decimal('27000.00'),
    Decimal('36000.00'),
    Decimal('45000.00'),
]

PLATE_PREFIXES = ['GR', 'GT', 'AS', 'GW', 'GN', 'GX', 'GE']


def generate_random_truck_number():
    prefix = random.choice(PLATE_PREFIXES)
    number = random.randint(1000, 9999)
    year = random.randint(22, 26)
    return f"{prefix}-{number}-{year}"


@transaction.atomic
def generate_npa_batch(count=None, depot_id=None, creator=None, target_date=None):
    """
    Generates a batch of NPA orders (default 50 to 100 per day).
    All orders are created with status SUBMITTED and recorded in audit log.
    """
    if count is None:
        count = random.randint(50, 100)
    else:
        count = int(count)

    if count < 1:
        raise ValueError("Count must be at least 1.")

    depot_id = depot_id or 'DEPOT-TEMA-01'
    target_date = target_date or date.today()
    date_str = target_date.strftime('%Y%m%d')

    if creator is None:
        creator = User.objects.filter(role__in=[RoleChoices.MANAGER, RoleChoices.ADMIN]).first()
        if not creator:
            creator = User.objects.create_user(
                username=f'npa_system_{uuid.uuid4().hex[:6]}',
                password='Password123!',
                role=RoleChoices.MANAGER,
                depot_id=depot_id,
            )

    created_orders = []
    total_volume = Decimal('0.00')
    total_value = Decimal('0.00')

    batch_id = uuid.uuid4().hex[:8].upper()

    for i in range(1, count + 1):
        ref_num = f"NPA-{date_str}-{batch_id}-{i:03d}"
        product = random.choice(PRODUCT_TYPES)
        unit = QuantityUnit.LITERS if random.random() > 0.10 else QuantityUnit.GALLONS
        volume = random.choice(STANDARD_BRV_VOLUMES)
        company = random.choice(OMC_COMPANIES)
        driver_name, driver_phone = random.choice(DRIVERS)
        truck_num = generate_random_truck_number()
        location = random.choice(LOCATIONS)
        delivery_t = time(hour=random.randint(6, 18), minute=random.choice([0, 15, 30, 45]))

        tanker, _ = Tanker.objects.get_or_create(
            truck_number=truck_num,
            defaults={
                'driver_name': driver_name,
                'driver_license': f'DL-{truck_num.replace("-", "")}',
                'capacity_liters': Decimal('45000.00'),
                'status': TankerStatus.ACTIVE,
            }
        )

        per_unit, total_price = calculate_pricing(product, volume, unit)

        order = NPARequest.objects.create(
            npa_reference_number=ref_num,
            product_type=product,
            product_group='WHITE PRODUCT',
            compartments=4,
            volume_requested=volume,
            unit=unit,
            depot_id=depot_id,
            customer_company=company,
            delivery_date=target_date,
            delivery_time=delivery_t,
            delivery_location=location,
            contact_name=f"Operations Manager ({company})",
            contact_phone='+233 30 200 ' + str(random.randint(1000, 9999)),
            contact_email=f"dispatch@{company.lower().replace(' ', '').replace('ltd', '').replace('plc', '')}.com",
            truck_number=truck_num,
            driver_name=driver_name,
            driver_phone=driver_phone,
            tanker=tanker,
            price_per_unit=per_unit,
            total_price=total_price,
            created_by=creator,
            status=NPARequestStatus.SUBMITTED,
        )

        mongo_service.log_audit_event(
            entity_type='NPARequest',
            entity_id=order.id,
            previous_state=None,
            new_state=NPARequestStatus.SUBMITTED,
            user_id=creator.id,
            user_role=creator.role,
            ip_address='127.0.0.1',
            user_agent='NPA-Order-Dispatch-Feed/1.0',
            correlation_id=f"batch-{batch_id}-{i:03d}",
            notes='Order sorted and sent by NPA daily batch feed.',
        )

        created_orders.append(order)
        total_volume += volume
        total_value += total_price

    return {
        'batch_id': batch_id,
        'count': len(created_orders),
        'depot_id': depot_id,
        'target_date': str(target_date),
        'total_volume': str(total_volume),
        'total_value': str(total_value),
        'order_references': [o.npa_reference_number for o in created_orders],
        'orders': created_orders,
    }


@transaction.atomic
def process_daily_npa_cycle(target_date=None, depot_id=None, count=None):
    """
    Executes the 5:00 AM daily NPA dispatch cycle:
    1. Recycles unworked orders from previous days (status=SUBMITTED and delivery_date < target_date).
       Unworked orders are marked as rolled over, assigned to today's date, and re-dispatched into the queue.
    2. Generates new NPA orders to complete the target 50 to 100 daily quota.
    3. Records comprehensive audit log events for all recycled and new orders.
    """
    target_date = target_date or date.today()
    depot_id = depot_id or 'DEPOT-TEMA-01'
    if count is None:
        target_total = random.randint(50, 100)
    else:
        target_total = max(1, int(count))

    creator = User.objects.filter(role__in=[RoleChoices.MANAGER, RoleChoices.ADMIN]).first()
    if not creator:
        creator = User.objects.create_user(
            username=f'npa_system_{uuid.uuid4().hex[:6]}',
            password='Password123!',
            role=RoleChoices.MANAGER,
            depot_id=depot_id,
        )

    # 1. Find unworked orders from previous days (SUBMITTED and delivery_date < target_date)
    unworked_qs = NPARequest.objects.filter(
        status=NPARequestStatus.SUBMITTED,
        delivery_date__lt=target_date,
    )
    if depot_id:
        unworked_qs = unworked_qs.filter(depot_id=depot_id)

    rolled_over_orders = []
    cycle_batch_id = uuid.uuid4().hex[:8].upper()

    for old_order in unworked_qs:
        old_delivery_date = old_order.delivery_date
        old_order.delivery_date = target_date
        old_order.save(update_fields=['delivery_date', 'updated_at'])

        mongo_service.log_audit_event(
            entity_type='NPARequest',
            entity_id=old_order.id,
            previous_state=NPARequestStatus.SUBMITTED,
            new_state=NPARequestStatus.SUBMITTED,
            user_id=creator.id,
            user_role=creator.role,
            ip_address='127.0.0.1',
            user_agent='NPA-5AM-Daily-Scheduler/1.0',
            correlation_id=f"cycle-{cycle_batch_id}-rollover-{old_order.id}",
            notes=f"Order unworked on {old_delivery_date}. Recycled back to NPA and re-dispatched into 5:00 AM daily queue for {target_date}.",
        )
        rolled_over_orders.append(old_order)

    # 2. Determine how many new orders to generate
    needed_new_count = max(0, target_total - len(rolled_over_orders))
    new_batch_result = None

    if needed_new_count > 0:
        new_batch_result = generate_npa_batch(
            count=needed_new_count,
            depot_id=depot_id,
            creator=creator,
            target_date=target_date,
        )

    new_orders = new_batch_result['orders'] if new_batch_result else []

    all_today_orders = rolled_over_orders + new_orders
    total_volume = sum(o.volume_requested for o in all_today_orders)
    total_value = sum(o.total_price for o in all_today_orders)

    return {
        'cycle_batch_id': cycle_batch_id,
        'target_date': str(target_date),
        'depot_id': depot_id,
        'rolled_over_count': len(rolled_over_orders),
        'new_orders_count': len(new_orders),
        'total_active_orders_count': len(all_today_orders),
        'total_volume': str(total_volume),
        'total_value': str(total_value),
        'rolled_over_references': [o.npa_reference_number for o in rolled_over_orders],
        'new_order_references': [o.npa_reference_number for o in new_orders],
    }

