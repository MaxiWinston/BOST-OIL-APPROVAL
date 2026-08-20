# BOST Manifest - Management Command: Run NPA Scheduler Daemon

import time
from django.core.management.base import BaseCommand
from apps.dispatch.scheduler import start_daily_scheduler, stop_daily_scheduler


class Command(BaseCommand):
    help = 'Run the 5:00 AM daily NPA order generator & unworked rollover scheduler daemon in the foreground.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("Starting BOST NPA 5:00 AM daily scheduler daemon... (Press Ctrl+C to stop)"))
        start_daily_scheduler()

        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            self.stdout.write(self.style.NOTICE("\nStopping NPA scheduler..."))
            stop_daily_scheduler()
            self.stdout.write(self.style.SUCCESS("NPA scheduler daemon stopped."))
