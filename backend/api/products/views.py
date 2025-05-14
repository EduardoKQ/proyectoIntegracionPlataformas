from django.shortcuts import render
from django.http import JsonResponse
from rest_framework.decorators import api_view
from api.user.role_permision import require_roles, check_auth_allowed_role
from api.user.web_role_names import WebRoleNames
from .serializer import (
    ProductDetailSerializer,
)
from api.models import Product
from external_apis.dollar_service import DolarService


from .utils import (
    process_category_list_create_get,
    process_category_list_create_post,
    process_category_get,
    process_category_update,
    process_category_delete,
    subprocess_category_list_create_post,
    process_subcategory_get,
    process_subcategory_update,
    process_subcategory_delete,
)

from .product_utils import (
    process_product_get_by_code,
    process_product_update,
    process_product_delete,
    process_product_create,
)


# api backend health check
@api_view(["GET", "POST"])
def products_list_create(request):
    # public endpoint for all users
    if request.method == "GET":
        # get all productos
        try:
            dolar_service = DolarService()
            dollar_exchange_info = dolar_service.get_dollar_exchange()
            # context to be used in the serializer
            serializer_context = {
                "request": request,
                "dollar_price": dollar_exchange_info["dollar_price"],
                "exchange_date": dollar_exchange_info["date"],
            }

            products = Product.objects.all()
            products_serializer = ProductDetailSerializer(
                products, many=True, context=serializer_context
            )
            return JsonResponse(products_serializer.data, safe=False, status=200)

        except Product.DoesNotExist:
            return JsonResponse({"error": "Products not found"}, status=404)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    # only admin can create products
    if request.method == "POST":
        allowed_roles = [WebRoleNames.ADMIN_TIENDA]
        auth_response = check_auth_allowed_role(request, allowed_roles)
        if auth_response is not None:
            return auth_response
        # process the request to create a product
        return process_product_create(request.data)


@api_view(["GET", "PUT", "DELETE"])
def products_get_update_delete(request, product_code):
    # public endpoint for all users
    if request.method == "GET":
        return process_product_get_by_code(product_code)
    # only admin can update or delete products
    if request.method == "PUT" or request.method == "DELETE":
        allowed_roles = [WebRoleNames.ADMIN_TIENDA]
        auth_response = check_auth_allowed_role(request, allowed_roles)
        if auth_response is not None:
            return auth_response
    # process the request to update or delete a product
    if request.method == "PUT":
        return process_product_update(product_code, request.data)
    if request.method == "DELETE":
        return process_product_delete(product_code)


@api_view(["GET", "POST"])
def category_list_create(request):
    # public endpoint for all users
    if request.method == "GET":
        return process_category_list_create_get(request)
    # only admin can create categories
    if request.method == "POST":
        allowed_roles = [WebRoleNames.ADMIN_TIENDA]
        auth_response = check_auth_allowed_role(request, allowed_roles)
        if auth_response is not None:
            return auth_response
        return process_category_list_create_post(request)


@api_view(["GET", "PUT", "DELETE"])
def category_get_update_delete(request, category_code):
    ##public endpoint for all users
    if request.method == "GET":
        return process_category_get(request, category_code)
    # only store admin can update or delete categories
    if request.method == "PUT" or "DELETE":
        allowed_roles = [WebRoleNames.ADMIN_TIENDA]
        auth_response = check_auth_allowed_role(request, allowed_roles)
        if auth_response is not None:
            return auth_response
    # process the request
    if request.method == "PUT":
        return process_category_update(request, category_code)
    if request.method == "DELETE":
        return process_category_delete(request, category_code)


@api_view(["GET", "POST"])
def subcategory_list_create(request):
    # public endpoint for all users, same as categories
    if request.method == "GET":
        return process_category_list_create_get(request)
    # only admin can create subcategories
    if request.method == "POST":
        allowed_roles = [WebRoleNames.ADMIN_TIENDA]
        auth_response = check_auth_allowed_role(request, allowed_roles)
        if auth_response is not None:
            return auth_response
        return subprocess_category_list_create_post(request)
    return None


#!!!
# !!! get, update, delete
@api_view(["GET", "PUT", "DELETE"])
def subcategory_get_update_delete(request, subcategory_code):
    # public endpoint for all users
    if request.method == "GET":
        return process_subcategory_get(request, subcategory_code)
    # only store admin can update or delete subcategories, same as categories
    if request.method == "PUT" or "DELETE":
        allowed_roles = [WebRoleNames.ADMIN_TIENDA]
        auth_response = check_auth_allowed_role(request, allowed_roles)
        if auth_response is not None:
            return auth_response
    # process the request
    if request.method == "PUT":
        return process_subcategory_update(request, subcategory_code)
    if request.method == "DELETE":
        return process_subcategory_delete(request, subcategory_code)
