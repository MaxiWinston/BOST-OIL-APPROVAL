# BOST Manifest Development Settings
# Author: Kwame Agyeman

from .base import *

DEBUG = True

USE_SQLITE = config('USE_SQLITE', default=True, cast=bool)
DB_ENGINE = config('DB_ENGINE', default='django.db.backends.sqlite3' if USE_SQLITE else 'django.db.backends.postgresql')

if USE_SQLITE or 'sqlite' in DB_ENGINE:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': DB_ENGINE,
            'NAME': config('POSTGRES_DB', default='bost_manifest_db'),
            'USER': config('POSTGRES_USER', default='bost_user'),
            'PASSWORD': config('POSTGRES_PASSWORD', default='bost_password'),
            'HOST': config('POSTGRES_HOST', default='localhost'),
            'PORT': config('POSTGRES_PORT', default='5432', cast=int),
        }
    }

