# BOST Manifest - Correlation ID Middleware
# Author: Kwame Agyeman

import logging
import uuid
import threading

_thread_locals = threading.local()


def get_current_correlation_id():
    return getattr(_thread_locals, 'correlation_id', 'N/A')


class CorrelationIdFilter(logging.Filter):
    def filter(self, record):
        record.correlation_id = get_current_correlation_id()
        return True


class CorrelationIdMiddleware:
    HEADER_NAME = 'HTTP_X_CORRELATION_ID'

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        correlation_id = request.META.get(self.HEADER_NAME) or str(uuid.uuid4())
        _thread_locals.correlation_id = correlation_id
        request.correlation_id = correlation_id

        response = self.get_response(request)
        response['X-Correlation-ID'] = correlation_id
        return response
