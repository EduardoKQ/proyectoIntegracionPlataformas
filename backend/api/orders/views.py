from django.shortcuts import render
from django.http import JsonResponse
from rest_framework.decorators import api_view
from api.user.role_permision import require_roles, check_auth_allowed_role
from api.user.web_role_names import WebRoleNames
from api.models import OrderStatus


from .utils import (
    orders_create,
    orders_list,
    orders_get_by_id,
    orders_delete_by_id,
    orders_update_status_by_id,
    u_orders_next_status,
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


@api_view(["DELETE", "GET", "PUT"])
def orders_get_delete_by_id(request, order_code):
    # public endpoint for all users
    # depending of the user role, this endpoint will return different data
    if request.method == "GET":
        return JsonResponse(
            {
                "message": "TOBE IMPLEMENTED: GET request to orders_get_delete_by_id endpoint",
                "order_code": order_code,
            },
            status=200,
        )

    # only web admin can update order status directly
    if request.method == "PUT":
        allowed_roles = [
            WebRoleNames.ADMIN_TIENDA,
        ]
        auth_response = check_auth_allowed_role(request, allowed_roles)
        if auth_response is not None:
            return auth_response
        return orders_update_status_by_id(request, order_code)

    # only admin can delete orders
    if request.method == "DELETE":
        allowed_roles = [
            WebRoleNames.ADMIN_TIENDA,
        ]
        auth_response = check_auth_allowed_role(request, allowed_roles)
        if auth_response is not None:
            return auth_response
        return orders_delete_by_id(order_code)


@api_view(["GET"])
def order_get_statuses(request):
    """
    Process GET request for order statuses.
    """
    if request.method == "GET":
        allowed_roles = [
            WebRoleNames.ADMIN_TIENDA,
            WebRoleNames.CLIENTE,
            WebRoleNames.VENDEDOR,
            WebRoleNames.BODEGUERO,
            WebRoleNames.CONTADOR,
        ]
        auth_response = check_auth_allowed_role(request, allowed_roles)
        if auth_response is not None:
            return auth_response
        order_statuses = OrderStatus.ALL.value
        # Convert the order statuses to a list of dictionaries, excluding "ALL"
        order_statuses_json = [
            {"internal-name": status.name, "value": status.value}
            for status in OrderStatus
            if status.name != "ALL"
        ]
        return JsonResponse(order_statuses_json, safe=False, status=200)


@api_view(["POST"])
def orders_next_status(request, order_code):
    """
    Process POST request to move the order to the next status.
    """
    print(f"orders_next_status called with order_code: {order_code}")
    if request.method == "POST":
        return u_orders_next_status(request, order_code)


@api_view(["POST"])
def orders_cancel(request, order_code):
    """
    Process POST request to cancel an order.
    """
    print(f"orders_cancel called with order_code: {order_code}")
    if request.method == "POST":
        allowed_roles = [
            WebRoleNames.ADMIN_TIENDA,
            WebRoleNames.VENDEDOR,
            WebRoleNames.BODEGUERO,
            WebRoleNames.CONTADOR,
        ]
        auth_response = check_auth_allowed_role(request, allowed_roles)
        if auth_response is not None:
            return auth_response

    return u_orders_next_status(request, order_code, cancel=True)
