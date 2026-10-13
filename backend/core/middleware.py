from django.conf import settings
from django.http import JsonResponse


class MaxBodySizeMiddleware:
    """Rejects bodies over MAX_REQUEST_BODY_SIZE (Django has no upload limit)."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            length = int(request.META.get("CONTENT_LENGTH") or 0)
        except ValueError:
            length = 0
        if length > settings.MAX_REQUEST_BODY_SIZE:
            return JsonResponse({"detail": "Fichier trop volumineux."}, status=413)
        return self.get_response(request)
