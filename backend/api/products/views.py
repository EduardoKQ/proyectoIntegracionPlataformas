from django.shortcuts import render
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from api.user.role_permision import require_roles
from api.user.web_role_names import WebRoleNames


# api backend health check
@api_view(["GET"])
@permission_classes([IsAuthenticated])
@require_roles(WebRoleNames.ALL)
def all(request):
    # get all productos
    return JsonResponse({"message": "funciona 1"})


def category_all(request):
    # get all categories
    return JsonResponse({"message": "funciona 2"})
