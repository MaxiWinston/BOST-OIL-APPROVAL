from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Tanker',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('truck_number', models.CharField(max_length=50, unique=True)),
                ('driver_name', models.CharField(max_length=100)),
                ('driver_license', models.CharField(max_length=50)),
                ('capacity_liters', models.DecimalField(decimal_places=2, max_digits=12)),
                ('status', models.CharField(choices=[('ACTIVE', 'Active'), ('MAINTENANCE', 'In Maintenance'), ('INACTIVE', 'Inactive')], default='ACTIVE', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'bost_tankers',
                'indexes': [models.Index(fields=['status', 'created_at'], name='bost_tankers_status_idx')],
            },
        ),
        migrations.CreateModel(
            name='Lot',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('lot_number', models.CharField(max_length=50, unique=True)),
                ('depot_id', models.CharField(max_length=50)),
                ('product_type', models.CharField(max_length=50)),
                ('quantity_liters', models.DecimalField(decimal_places=2, max_digits=12)),
                ('status', models.CharField(choices=[('PENDING', 'Pending Approval'), ('CUSTOMS_APPROVED', 'Customs Approved'), ('CLEARED_FOR_FILLING', 'Cleared for Filling'), ('FILLED', 'Tanker Filled'), ('REJECTED', 'Rejected')], default='PENDING', max_length=30)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'bost_lots',
                'indexes': [models.Index(fields=['status', 'depot_id', 'created_at'], name='bost_lots_status_idx')],
            },
        ),
        migrations.CreateModel(
            name='NPARequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('npa_reference_number', models.CharField(max_length=100, unique=True)),
                ('product_type', models.CharField(max_length=50)),
                ('volume_requested', models.DecimalField(decimal_places=2, max_digits=12)),
                ('depot_id', models.CharField(max_length=50)),
                ('status', models.CharField(choices=[('SUBMITTED', 'Submitted (Pending Manager)'), ('MANAGER_APPROVED', 'Manager Approved (Pending Customs)'), ('CUSTOMS_APPROVED', 'Customs Approved (Pending Lot Clearance)'), ('LOT_CLEARED', 'Lot Cleared (Authorized for Filling)'), ('REJECTED', 'Rejected')], default='SUBMITTED', max_length=30)),
                ('manager_approval_time', models.DateTimeField(blank=True, null=True)),
                ('customs_approval_time', models.DateTimeField(blank=True, null=True)),
                ('lot_clearance_time', models.DateTimeField(blank=True, null=True)),
                ('rejection_reason', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('approved_by_customs', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='customs_approved_npa_requests', to=settings.AUTH_USER_MODEL)),
                ('approved_by_manager', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='manager_approved_npa_requests', to=settings.AUTH_USER_MODEL)),
                ('cleared_by_operator', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='cleared_npa_requests', to=settings.AUTH_USER_MODEL)),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='created_npa_requests', to=settings.AUTH_USER_MODEL)),
                ('rejected_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='rejected_npa_requests', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'bost_npa_requests',
            },
        ),
        migrations.CreateModel(
            name='DeliveryNote',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('delivery_note_number', models.CharField(max_length=100, unique=True)),
                ('quantity_dispatched', models.DecimalField(decimal_places=2, max_digits=12)),
                ('status', models.CharField(default='ISSUED', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('npa_request', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='delivery_note', to='dispatch.nparequest')),
            ],
            options={
                'db_table': 'bost_delivery_notes',
            },
        ),
        migrations.CreateModel(
            name='Waybill',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('waybill_number', models.CharField(max_length=100, unique=True)),
                ('destination', models.CharField(max_length=200)),
                ('transporter_name', models.CharField(max_length=150)),
                ('status', models.CharField(default='ISSUED', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('delivery_note', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='waybill', to='dispatch.deliverynote')),
                ('tanker', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='waybills', to='dispatch.tanker')),
            ],
            options={
                'db_table': 'bost_waybills',
            },
        ),
        migrations.CreateModel(
            name='DispatchRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('dispatch_reference', models.CharField(max_length=100, unique=True)),
                ('approval_stage', models.IntegerField(default=1)),
                ('status', models.CharField(choices=[('SUBMITTED', 'Submitted (Pending Manager)'), ('MANAGER_APPROVED', 'Manager Approved (Pending Customs)'), ('CUSTOMS_APPROVED', 'Customs Approved (Pending Lot Clearance)'), ('LOT_CLEARED', 'Lot Cleared (Authorized for Filling)'), ('REJECTED', 'Rejected')], default='SUBMITTED', max_length=30)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('lot', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='dispatch_requests', to='dispatch.lot')),
                ('waybill', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='dispatch_request', to='dispatch.waybill')),
            ],
            options={
                'db_table': 'bost_dispatch_requests',
            },
        ),
        migrations.AddIndex(
            model_name='nparequest',
            index=models.Index(fields=['status', 'created_at'], name='bost_npa_status_idx'),
        ),
        migrations.AddIndex(
            model_name='nparequest',
            index=models.Index(fields=['depot_id', 'status'], name='bost_npa_depot_status_idx'),
        ),
        migrations.AddIndex(
            model_name='nparequest',
            index=models.Index(fields=['npa_reference_number'], name='bost_npa_ref_idx'),
        ),
        migrations.AddConstraint(
            model_name='nparequest',
            constraint=models.CheckConstraint(check=models.Q(('status__in', ['SUBMITTED', 'MANAGER_APPROVED', 'CUSTOMS_APPROVED', 'LOT_CLEARED', 'REJECTED'])), name='valid_npa_status_check'),
        ),
        migrations.AddIndex(
            model_name='deliverynote',
            index=models.Index(fields=['delivery_note_number'], name='bost_dn_num_idx'),
        ),
        migrations.AddIndex(
            model_name='deliverynote',
            index=models.Index(fields=['created_at'], name='bost_dn_created_idx'),
        ),
        migrations.AddIndex(
            model_name='waybill',
            index=models.Index(fields=['waybill_number'], name='bost_wb_num_idx'),
        ),
        migrations.AddIndex(
            model_name='waybill',
            index=models.Index(fields=['tanker_id'], name='bost_wb_tanker_idx'),
        ),
        migrations.AddIndex(
            model_name='waybill',
            index=models.Index(fields=['created_at'], name='bost_wb_created_idx'),
        ),
        migrations.AddIndex(
            model_name='dispatchrequest',
            index=models.Index(fields=['status', 'approval_stage'], name='bost_dr_status_stage_idx'),
        ),
        migrations.AddIndex(
            model_name='dispatchrequest',
            index=models.Index(fields=['lot_id'], name='bost_dr_lot_idx'),
        ),
        migrations.AddIndex(
            model_name='dispatchrequest',
            index=models.Index(fields=['created_at'], name='bost_dr_created_idx'),
        ),
    ]
