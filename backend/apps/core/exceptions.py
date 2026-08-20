# BOST Manifest - Custom Exception Handler
# Author: Abena Adjei

from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is not None:
        customized_response = {
            "error": {
                "code": getattr(exc, 'default_code', 'error'),
                "message": str(exc.detail) if hasattr(exc, 'detail') and isinstance(exc.detail, str) else "Validation error occurred",
                "details": response.data if isinstance(response.data, (dict, list)) else str(response.data),
                "status_code": response.status_code
            }
        }
        return Response(customized_response, status=response.status_code)

    return Response(
        {
            "error": {
                "code": "internal_server_error",
                "message": "An unexpected server error occurred.",
                "details": str(exc),
                "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR
            }
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR
    )
