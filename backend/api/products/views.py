from django.shortcuts import render
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from api.user.role_permision import require_roles
from api.user.web_role_names import WebRoleNames
from .serializer import ProductDetailSerializer
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


@api_view(["GET"])
def category_all(request):
    # get all categories
    return JsonResponse({"message": "funciona 2"})
