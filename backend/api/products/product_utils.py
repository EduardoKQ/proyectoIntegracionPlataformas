from django.http import JsonResponse
from .serializer import (
    ProductDetailSerializer,
    ProductAddSerializer,
    ProductUpdateSerializer,
)
from external_apis.dollar_service import DolarService
from api.models import Product, Category, Subcategory, Inventory, Branch


def process_product_get_by_code(product_code):
    try:
        # Get the product by code
        product = Product.objects.get(product_code=product_code)
        # Serialize the data
        dolar_service = DolarService()
        dollar_exchange_info = dolar_service.get_dollar_exchange()
        # context to be used in the serializer
        serializer_context = {
            "dollar_price": dollar_exchange_info["dollar_price"],
            "exchange_date": dollar_exchange_info["date"],
        }
        product_serializer = ProductDetailSerializer(
            product, context=serializer_context
        )
        return JsonResponse(product_serializer.data, status=200)
    except Product.DoesNotExist:
        return JsonResponse({"error": "Product not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


def process_product_update(product_code, request_data):
    try:
        # Get the product related to the endpoint
        product = Product.objects.get(product_code=product_code)
        # serialize the data
        product_serializer = ProductUpdateSerializer(data=request_data)
        # Check if the data is valid
        if not product_serializer.is_valid():
            return JsonResponse(
                {"error": "Invalid data", "details": product_serializer.errors},
                status=400,
            )
        # Check if the product code is being updated
        if "product_code" in product_serializer.validated_data:
            new_product_code = product_serializer.validated_data["product_code"]
            if new_product_code != product.product_code:
                # Check if the new product code already exists
                if Product.objects.filter(product_code=new_product_code).exists():
                    return JsonResponse(
                        {"error": "Código de producto ya existe"}, status=400
                    )
                # Update the product code
                product.product_code = new_product_code
        # Update the product with the new data
        for attr, value in product_serializer.validated_data.items():
            print(f"attr: {attr}, value: {value}")
            if attr == "subcategory":
                # get the subcategory by its name
                subcategory = Subcategory.objects.filter(name=value.get("name")).first()
                product.subcategory = subcategory

            else:
                setattr(product, attr, value)
        product.save()
        return JsonResponse(product_serializer.data, status=200)
    except Product.DoesNotExist:
        return JsonResponse(
            {"error": "No se encontró el codigo de producto"}, status=404
        )
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


def process_product_delete(product_code):
    try:
        # Get the product by code
        product = Product.objects.get(product_code=product_code)
        # Delete the product and all related inventories
        inventories = Inventory.objects.filter(product=product)
        inventories.delete()
        product.delete()
        return JsonResponse(
            {"message": "Producto eliminado correctamente e inventario actualizado"},
            status=200,
        )
    except Product.DoesNotExist:
        return JsonResponse(
            {"error": "No se encontró el codigo de producto"}, status=404
        )
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


def process_product_create(request_data):
    def get_current_date():
        # Get the current date in the format YYYY-MM-DD
        from datetime import datetime

        return datetime.now().strftime("%Y-%m-%d")

    def create_new_product(**kwargs):
        print(f"kwargs: {kwargs}")
        # get the category and subcategory by their codes
        if "subcategory" in kwargs:
            subcategory_name = kwargs.get("subcategory").get("name")
            subcategory = Subcategory.objects.filter(name=subcategory_name).first()
        # Create a new product with the given data
        product = Product.objects.create(
            product_code=kwargs.get("product_code"),
            name=kwargs.get("name"),
            current_price=kwargs.get("current_price"),
            current_price_date=get_current_date(),
            brand=kwargs.get("brand"),
            brand_code=kwargs.get("brand_code"),
            image_url=kwargs.get("image_url"),
            description=kwargs.get("description"),
            subcategory=subcategory if subcategory else None,
        )
        # Create an inventory for the new product in all branches
        for branch in Branch.objects.all():
            Inventory.objects.create(product=product, branch=branch, quantity=0)

    try:
        # Get the data from the request
        product_serializer = ProductAddSerializer(data=request_data)
        # Check if the data is valid
        if not product_serializer.is_valid():
            return JsonResponse(
                {"error": "Invalid data", "details": product_serializer.errors},
                status=400,
            )
        # Check if the product code already exists
        if Product.objects.filter(
            product_code=product_serializer.validated_data["product_code"]
        ).exists():
            return JsonResponse({"error": "Código de producto ya existe"}, status=400)
        # Create the product with the new data and update the inventory
        create_new_product(**product_serializer.validated_data)
        return JsonResponse(product_serializer.data, status=201)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
