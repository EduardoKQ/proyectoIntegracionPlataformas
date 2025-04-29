from django.http import JsonResponse
from .serializer import (
    ProductDetailSerializer,
    CategoriesDetailSerializer,
    CategoryAddSerializer,
    CategoryUpdateSerializer,
    SubcategoryAddSerializer,
    SubcategoryGetSerializer,
    # SubcategoryUpdateSerializer,
)
from api.models import Product, Category, Subcategory


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
        categories = Category.objects.get(category_code=category_code)
        if not categories:
            return JsonResponse({"error": "Category not found"}, status=404)
        categories_serializer = CategoriesDetailSerializer(categories)
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


def subprocess_category_list_create_post(request):
    # create a new subcategory
    try:
        print(f"request.data: {request.data}")
        serializer = SubcategoryAddSerializer(data=request.data)
        if not serializer.is_valid():
            return JsonResponse(serializer.errors, status=400)

        # serializer data
        subcategory_code = serializer.validated_data["subcategory_code"]
        subcategory_name = serializer.validated_data["name"]
        related_category_code = serializer.validated_data["relatedCategoryId"]
        print(
            f"subcategory_code: {subcategory_code}, subcategory_name: {subcategory_name}, related_category_code: {related_category_code}"
        )

        # check if the category exists
        if not Category.objects.filter(category_code=related_category_code).exists():
            return JsonResponse({"error": "Category not found"}, status=404)
        # check if the subcategory code is unique
        if Subcategory.objects.filter(subcategory_code=subcategory_code).exists():
            return JsonResponse(
                {"error": "Subcategory code already exists"}, status=400
            )
        # check if the subcategory name is unique
        if Subcategory.objects.filter(name=subcategory_name).exists():
            return JsonResponse(
                {"error": "Subcategory name already exists"}, status=400
            )
        # create the subcategory
        related_category = Category.objects.get(category_code=related_category_code)
        new_subcategory = Subcategory(
            subcategory_code=subcategory_code,
            name=subcategory_name,
            category=related_category,
        )
        new_subcategory.save()
        return JsonResponse(serializer.data, status=201)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


def process_subcategory_get(request, subcategory_code):
    # get a subcategory by code
    try:
        subcategory = Subcategory.objects.get(subcategory_code=subcategory_code)
        if not subcategory:
            return JsonResponse({"error": "Subcategory not found"}, status=404)
        subcategory_serializer = SubcategoryGetSerializer(subcategory)
        return JsonResponse(subcategory_serializer.data, status=200)

    except Subcategory.DoesNotExist:
        return JsonResponse({"error": "Subcategory not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


#!!!
def process_subcategory_update(request, subcategory_code):
    return JsonResponse({"error": "Not implemented"}, status=501)


#!!!
def process_subcategory_delete(request, subcategory_code):
    return JsonResponse({"error": "Not implemented"}, status=501)
