from django.shortcuts import render
from django.http import JsonResponse
from rest_framework.decorators import api_view
from api.user.role_permision import require_roles, check_auth_allowed_role
from api.user.web_role_names import WebRoleNames


from .utils import (
    orders_create,
    orders_list,
    orders_get_by_id,
    orders_delete_by_id,
)


# api backend health check
@api_view(["GET", "POST"])
def orders_list_create(request):
    # public endpoint for all users
    # depending of the user role, this endpoint will return different data
    if request.method == "GET":
        return orders_list(request)
        
    # only admin and client can create orders
    if request.method == "POST":
        allowed_roles = [
            WebRoleNames.ADMIN_TIENDA,
            WebRoleNames.CLIENTE,
        ]
        auth_response = check_auth_allowed_role(request, allowed_roles)
        if auth_response is not None:
            return auth_response
        
        return orders_create(request)

@api_view(["DELETE", "GET"])
def orders_get_delete_by_id(request, order_code):
    # public endpoint for all users
    # depending of the user role, this endpoint will return different data
    if request.method == "GET":
        return JsonResponse(
            {"message": "GET request to orders_get_delete_by_id endpoint", "order_code": order_code}, status=200)
        
    # only admin can delete orders
    if request.method == "DELETE":
        allowed_roles = [
            WebRoleNames.ADMIN_TIENDA,
        ]
        auth_response = check_auth_allowed_role(request, allowed_roles)
        if auth_response is not None:
            return auth_response
        return JsonResponse(
            {
                "message": "DELETE request to orders_get_delete_by_id endpoint",
                "order_code": order_code}, status=200)
