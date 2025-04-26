from django.shortcuts import render
from django.http import JsonResponse
from rest_framework.decorators import api_view
from api.user.role_permision import require_roles, check_auth_allowed_role
from api.user.web_role_names import WebRoleNames
from .serializer import (
    ProductDetailSerializer,
    CategoriesDetailSerializer,
    CategoryAddSerializer,
    CategoryUpdateSerializer,
)
from api.models import Product, Category


# api backend health check
@api_view(["GET"])
def all(request):
    # get all productos
    try:
        products = Product.objects.all()
        products_serializer = ProductDetailSerializer(products, many=True)
        return JsonResponse(products_serializer.data, safe=False, status=200)

    except Product.DoesNotExist:
        return JsonResponse({"error": "Products not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


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


# !!!
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


### helpers
def process_category_list_create_get(request):
    # get all categories
    category_code_filter = request.query_params.get("id", None)
    if category_code_filter:
        try:
            categories = Category.objects.filter(category_code=category_code_filter)
            if not categories.exists():
                return JsonResponse({"error": "Category not found"}, status=404)
            categories_serializer = CategoriesDetailSerializer(categories, many=True)
            return JsonResponse(categories_serializer.data, safe=False, status=200)

        except Category.DoesNotExist:
            return JsonResponse({"error": "Categories not found"}, status=404)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    else:
        try:
            categories = Category.objects.all()
            categories_serializer = CategoriesDetailSerializer(categories, many=True)
            return JsonResponse(categories_serializer.data, safe=False, status=200)

        except Category.DoesNotExist:
            return JsonResponse({"error": "Categories not found"}, status=404)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


def process_category_list_create_post(request):
    # create a new category
    try:
        serializer = CategoryAddSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return JsonResponse(serializer.data, status=201)
        return JsonResponse(serializer.errors, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


def process_category_get(request, category_code):
    # get a category by code
    try:
        categories = Category.objects.filter(category_code=category_code)
        if not categories.exists():
            return JsonResponse({"error": "Category not found"}, status=404)
        categories_serializer = CategoriesDetailSerializer(categories, many=True)
        return JsonResponse(categories_serializer.data, safe=False, status=200)

    except Category.DoesNotExist:
        return JsonResponse({"error": "Categories not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


def process_category_update(request, category_code):
    # update a category by code
    try:
        categories = Category.objects.filter(category_code=category_code)
        if not categories.exists():
            return JsonResponse({"error": "Category not found"}, status=404)
        # parse using serializer
        categories_serializer = CategoryUpdateSerializer(data=request.data)
        if not categories_serializer.is_valid():
            return JsonResponse(categories_serializer.errors, status=400)
        # update the category
        new_category_code = categories_serializer.validated_data.get("id")
        new_name = categories_serializer.validated_data.get("name")
        # if the new category code is the same as the old one, update the name only
        if new_category_code == category_code:
            categories.update(name=new_name)
            return JsonResponse(categories_serializer.data, status=200)

        # check if the new category code already exists
        if Category.objects.filter(category_code=new_category_code).exists():
            return JsonResponse({"error": "Category code already exists"}, status=400)

        # update the category code and name
        categories.update(category_code=new_category_code, name=new_name)
        return JsonResponse(categories_serializer.data, safe=False, status=200)

    except Category.DoesNotExist:
        return JsonResponse({"error": "Categories not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


def process_category_delete(request, category_code):
    # delete a category by code
    try:
        categories = Category.objects.filter(category_code=category_code)
        if not categories.exists():
            return JsonResponse({"error": "Category not found"}, status=404)
        # delete the category
        categories.delete()
        return JsonResponse({"message": "Category deleted successfully"}, status=200)

    except Category.DoesNotExist:
        return JsonResponse({"error": "Categories not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
