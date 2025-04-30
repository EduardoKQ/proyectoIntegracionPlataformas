from django.shortcuts import render
from django.http import JsonResponse
from rest_framework.decorators import api_view
from api.user.role_permision import require_roles, check_auth_allowed_role
from api.user.web_role_names import WebRoleNames
from .utils import (
    process_inventory_list,
    process_branches_list,
    process_branches_create,
)


# branches endpoints
@api_view(["GET", "POST"])
def branch_list_create(request):
    # public endpoint for all users
    if request.method == "GET":
        return process_branches_list(request)
    # only admin can create branches
    if request.method == "POST":
        allowed_roles = [WebRoleNames.ADMIN_TIENDA]
        auth_response = check_auth_allowed_role(request, allowed_roles)
        if auth_response is not None:
            return auth_response
        # process the request to create a branch
        return process_branches_create(request)


# inventory endpoints


@api_view(["GET"])
def inventory_list(request):
    return process_inventory_list(request)
