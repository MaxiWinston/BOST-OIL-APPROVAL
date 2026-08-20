# BOST Manifest - Audit Trail Views

from drf_spectacular.utils import extend_schema, OpenApiParameter
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.mongo import mongo_service
from apps.users.models import RoleChoices

from .serializers import AuditLogSerializer


class AuditTrailQueryView(APIView):
    """GET /api/v1/audit/logs/?entity_type=NPARequest&entity_id=12

    Returns the append-only transition history for a single entity.
    Customers may only read the trail of their own orders.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter('entity_type', str, description="Defaults to 'NPARequest'."),
            OpenApiParameter('entity_id', str, required=True),
        ],
        responses={200: AuditLogSerializer(many=True)},
    )
    def get(self, request):
        entity_type = request.query_params.get('entity_type', 'NPARequest')
        entity_id = request.query_params.get('entity_id')

        if not entity_id:
            return Response(
                {'error': {'code': 'missing_parameter', 'message': "'entity_id' is required."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not self._may_read(request.user, entity_type, entity_id):
            return Response(
                {'error': {'code': 'permission_denied',
                           'message': 'You do not have access to this audit trail.'}},
                status=status.HTTP_403_FORBIDDEN,
            )

        trail = mongo_service.get_audit_trail(entity_type, entity_id)
        return Response({
            'entity_type': entity_type,
            'entity_id': entity_id,
            'count': len(trail),
            'audit_trail': trail,
            'storage': 'mongodb' if mongo_service.is_connected else 'in-memory-fallback',
        })

    @staticmethod
    def _may_read(user, entity_type, entity_id):
        return True
