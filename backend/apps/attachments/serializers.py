from rest_framework import serializers


class AttachmentSerializer(serializers.Serializer):
    entity_type = serializers.CharField(max_length=50, help_text="Associated entity type (e.g. NPARequest, Waybill, DeliveryNote)")
    entity_id = serializers.CharField(max_length=100, help_text="Associated entity primary key or reference")
    document_type = serializers.CharField(max_length=100, help_text="Type of document (e.g., SCANNED_WAYBILL, NPA_PERMIT, INSPECTION_CERTIFICATE)")
    filename = serializers.CharField(max_length=255)
    metadata = serializers.JSONField(required=False, default=dict, help_text="Flexible key-value pairs of variable depot or customs metadata")
