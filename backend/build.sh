#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "==> Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "==> Collecting static files..."
python manage.py collectstatic --no-input

echo "==> Running database migrations..."
python manage.py migrate --no-input || echo "==> Migrations deferred to runtime"

echo "==> Seeding initial demo data & users..."
python manage.py seed_demo || echo "==> Seeding deferred to runtime"

echo "==> Build completed successfully!"

