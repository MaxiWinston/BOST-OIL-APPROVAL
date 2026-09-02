import os
import sys
from django.apps import AppConfig


class DispatchConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.dispatch'

    def ready(self):
        # Auto-start background NPA daily scheduler unless running tests or management migrations
        is_test = 'test' in sys.argv or 'pytest' in sys.modules
        is_migration = any(cmd in sys.argv for cmd in ['migrate', 'makemigrations', 'collectstatic', 'createsuperuser'])
        if not is_test and not is_migration:
            try:
                from .scheduler import start_daily_scheduler
                start_daily_scheduler()
            except Exception:
                pass

