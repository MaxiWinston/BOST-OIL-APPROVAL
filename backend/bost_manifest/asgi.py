import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'bost_manifest.settings.dev')

application = get_asgi_application()
