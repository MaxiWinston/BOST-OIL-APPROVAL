# BOST Manifest - Management Command: Run NPA Scheduler Daemon

import time
from django.core.management.base import BaseCommand
from apps.dispatch.scheduler import start_daily_scheduler, stop_daily_scheduler


class Command(BaseCommand):
    help = 'Run the 5:00 AM daily NPA order generator & unworked rollover scheduler daemon.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--once',
            action='store_true',
            help='Run a single daily NPA cycle immediately and exit.',
        )

    def handle(self, *args, **options):
        if options.get('once'):
            from apps.dispatch.npa_generator import process_daily_npa_cycle
            result = process_daily_npa_cycle()
            self.stdout.write(self.style.SUCCESS(
                f"NPA daily cycle completed: {result['new_orders_count']} new orders, "
                f"{result['rolled_over_count']} rolled over, {result['total_active_orders_count']} total active."
            ))
            return

        self.stdout.write(self.style.SUCCESS("Starting BOST NPA daily scheduler daemon... (Press Ctrl+C to stop)"))
        start_daily_scheduler()

        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            self.stdout.write(self.style.NOTICE("\nStopping NPA scheduler..."))
            stop_daily_scheduler()
            self.stdout.write(self.style.SUCCESS("NPA scheduler daemon stopped."))

