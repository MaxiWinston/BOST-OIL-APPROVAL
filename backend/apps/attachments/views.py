# BOST Manifest - Document Attachment Views (MongoDB-backed)

from drf_spectacular.utils import extend_schema, OpenApiParameter
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.mongo import mongo_service

from .serializers import AttachmentSerializer


class AttachmentViewSet(viewsets.ViewSet):
    """Variable-schema supporting documents (permits, seal certificates,
    inspection reports) stored in MongoDB against any entity."""

    permission_classes = [IsAuthenticated]
    serializer_class = AttachmentSerializer

    @extend_schema(
        parameters=[
            OpenApiParameter('entity_type', str, required=True),
            OpenApiParameter('entity_id', str, required=True),
        ],
        responses={200: AttachmentSerializer(many=True)},
    )
    def list(self, request):
        entity_type = request.query_params.get('entity_type')
        entity_id = request.query_params.get('entity_id')

        if not entity_type or not entity_id:
            return Response(
                {'error': {'code': 'missing_parameter',
                           'message': "Both 'entity_type' and 'entity_id' are required."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        attachments = mongo_service.get_attachments(entity_type, entity_id)
        return Response({'count': len(attachments), 'attachments': attachments})

    @extend_schema(request=AttachmentSerializer, responses={201: AttachmentSerializer})
    def create(self, request):
        serializer = AttachmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        record = mongo_service.save_attachment(
            entity_type=data['entity_type'],
            entity_id=data['entity_id'],
            document_type=data['document_type'],
            filename=data['filename'],
            metadata=data.get('metadata') or {},
            uploaded_by=request.user.id,
        )
        return Response(record, status=status.HTTP_201_CREATED)

    def retrieve(self, request, pk=None):
        entity_type = request.query_params.get('entity_type')
        entity_id = request.query_params.get('entity_id')
        if not entity_type or not entity_id:
            return Response(
                {'error': {'code': 'missing_parameter',
                           'message': "Both 'entity_type' and 'entity_id' are required."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        for attachment in mongo_service.get_attachments(entity_type, entity_id):
            if str(attachment.get('id')) == str(pk):
                return Response(attachment)

        return Response(
            {'error': {'code': 'not_found', 'message': 'Attachment not found.'}},
            status=status.HTTP_404_NOT_FOUND,
        )
