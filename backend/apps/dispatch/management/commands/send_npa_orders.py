# BOST Manifest - Management Command: Send NPA Orders (50-100 per day with Rollover)

from django.core.management.base import BaseCommand
from apps.dispatch.npa_generator import process_daily_npa_cycle


class Command(BaseCommand):
    help = 'Execute the 5:00 AM daily NPA order dispatch and unworked orders rollover cycle.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--count',
            type=int,
            default=None,
            help='Target total active orders for today (defaults to random between 50 and 100).',
        )
        parser.add_argument(
            '--depot',
            type=str,
            default='DEPOT-TEMA-01',
            help='Target Depot ID (defaults to DEPOT-TEMA-01).',
        )

    def handle(self, *args, **options):
        count = options.get('count')
        depot = options.get('depot')

        self.stdout.write(self.style.NOTICE(f'Executing daily NPA orders cycle for {depot}...'))

        try:
            summary = process_daily_npa_cycle(count=count, depot_id=depot)
            self.stdout.write(
                self.style.SUCCESS(
                    f"Successfully processed daily NPA cycle!\n"
                    f"Cycle Batch ID: {summary['cycle_batch_id']}\n"
                    f"Target Date: {summary['target_date']}\n"
                    f"Rolled Over Unworked Orders: {summary['rolled_over_count']}\n"
                    f"New Fresh NPA Orders: {summary['new_orders_count']}\n"
                    f"Total Active Today: {summary['total_active_orders_count']}\n"
                    f"Total Volume: {summary['total_volume']} L\n"
                    f"Total Value: GHS {summary['total_value']}"
                )
            )
        except Exception as exc:
            self.stdout.write(self.style.ERROR(f'Failed to process daily NPA orders cycle: {exc}'))

