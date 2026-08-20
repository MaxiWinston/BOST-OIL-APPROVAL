# BOST Manifest - Audit Trail Serializers

from rest_framework import serializers


class AuditLogSerializer(serializers.Serializer):
    """Read-only shape of an audit document stored in MongoDB."""

    entity_type = serializers.CharField()
    entity_id = serializers.CharField()
    previous_state = serializers.CharField(allow_null=True)
    new_state = serializers.CharField(allow_null=True)
    user_id = serializers.IntegerField(allow_null=True)
    user_role = serializers.CharField(allow_null=True)
    ip_address = serializers.CharField(allow_null=True)
    user_agent = serializers.CharField(allow_null=True)
    correlation_id = serializers.CharField(allow_null=True)
    notes = serializers.CharField(allow_null=True)
    timestamp = serializers.CharField()


class AuditQuerySerializer(serializers.Serializer):
    """Query parameters accepted by the audit trail endpoint."""

    entity_type = serializers.CharField(default='NPARequest')
    entity_id = serializers.CharField()
