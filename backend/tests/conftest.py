import pytest

from apps.core.mongo import mongo_service


@pytest.fixture(autouse=True)
def reset_audit_store():
    """MongoDBService is a process-wide singleton. Without this, audit events
    from one test leak into the next and break entity-scoped assertions."""
    mongo_service.reset_fallback()
    yield
    mongo_service.reset_fallback()
