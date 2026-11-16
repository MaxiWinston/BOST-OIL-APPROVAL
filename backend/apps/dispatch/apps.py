import os
import sys
from django.apps import AppConfig


class DispatchConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.dispatch'

    def ready(self):
        # Auto-start background NPA daily scheduler only when explicitly enabled or in dedicated runner
        is_test = 'test' in sys.argv or 'pytest' in sys.modules
        is_management = len(sys.argv) > 1 and not sys.argv[1].startswith('runserver')
        is_enabled = os.environ.get('ENABLE_BACKGROUND_SCHEDULER', 'False').lower() in ('true', '1')
        if not is_test and not is_management and is_enabled:
            try:
                from .scheduler import start_daily_scheduler
                start_daily_scheduler()
            except Exception:
                pass

