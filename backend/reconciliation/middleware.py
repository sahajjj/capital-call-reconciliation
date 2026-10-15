from django.http import JsonResponse
from .models import Organization


class OrgMiddleware:
    """
    Reads X-Organization header, attaches request.org.
    Only applies to /api/ routes so admin still works.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # skip non-api paths (admin, static, etc.)
        if not request.path.startswith("/api/"):
            return self.get_response(request)

        slug = request.headers.get("X-Organization")
        if not slug:
            return JsonResponse(
                {"detail": "Missing X-Organization header."}, status=400
            )

        try:
            request.org = Organization.objects.get(slug=slug)
        except Organization.DoesNotExist:
            return JsonResponse(
                {"detail": "Organization not found."}, status=404
            )

        return self.get_response(request)
