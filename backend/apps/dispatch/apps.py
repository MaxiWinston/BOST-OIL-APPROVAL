import os
import sys
from django.apps import AppConfig


class DispatchConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.dispatch'

    def ready(self):
        # Start background scheduler when running server
        is_runserver = 'runserver' in sys.argv
        is_main_process = os.environ.get('RUN_MAIN') == 'true' or not is_runserver
        if is_runserver and is_main_process and 'test' not in sys.argv:
            try:
                from .scheduler import start_daily_scheduler
                start_daily_scheduler()
            except Exception:
                pass

