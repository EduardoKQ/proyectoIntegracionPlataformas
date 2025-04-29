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


def process_subcategory_update(request, subcategory_code):
    def validate_new_subcategory_code(new_subcategory_code):
        # if the subcategory code is the same as the old one, we are good
        if new_subcategory_code == subcategory_code:
            return True
        # if not, check if the subcategory code already exists
        elif Subcategory.objects.filter(subcategory_code=new_subcategory_code).exists():
            raise Exception(
                "Subcategory code already exists. Please choose a different one."
            )
        return True

    def validate_new_subcategory_name(new_subcategory_name):
        # if the subcategory name is the same as the old one, we are good
        if new_subcategory_name == subcategory_code:
            return True
        # check if the subcategory name is unique
        if Subcategory.objects.filter(name=new_subcategory_name).exists():
            raise Exception(
                "Subcategory name already exists. Please choose a different one."
            )
        return True

    def validate_new_related_category_code(new_related_category_code):
        # check if the related category code is the same as the old one, we are good
        current_category_code = Subcategory.objects.get(
            subcategory_code=subcategory_code
        ).category.category_code
        if new_related_category_code == current_category_code:
            return True
        # check if the new category code is available
        if not Category.objects.filter(
            category_code=new_related_category_code
        ).exists():
            raise Exception("Related category code does not exist.")
        return True

    # serialize the request data
    subcategory_serializer = SubcategoryAddSerializer(data=request.data)
    if not subcategory_serializer.is_valid():
        return JsonResponse(subcategory_serializer.errors, status=400)
    # valid data
    new_subcategory_code = subcategory_serializer.validated_data.get("subcategory_code")
    new_subcategory_name = subcategory_serializer.validated_data.get("name")
    new_related_category_code = subcategory_serializer.validated_data.get(
        "relatedCategoryId"
    )
    try:
        new_subcategory_code_is_valid = validate_new_subcategory_code(
            new_subcategory_code
        )
        new_subcategory_name_is_valid = validate_new_subcategory_name(
            new_subcategory_name
        )
        new_related_category_code_is_valid = validate_new_related_category_code(
            new_related_category_code
        )
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

    if (
        new_subcategory_code_is_valid
        and new_subcategory_name_is_valid
        and new_related_category_code_is_valid
    ):
        # update the subcategory
        subcategory = Subcategory.objects.get(subcategory_code=subcategory_code)
        subcategory.subcategory_code = new_subcategory_code
        subcategory.name = new_subcategory_name
        subcategory.category = Category.objects.get(
            category_code=new_related_category_code
        )
        subcategory.save()
        return JsonResponse(subcategory_serializer.data, status=200)
    else:
        return JsonResponse(
            {
                "error": "something went wrong",
                "subcategory_code_is_valid": new_subcategory_code_is_valid,
                "subcategory_name_is_valid": new_subcategory_name_is_valid,
                "related_category_code_is_valid": new_related_category_code_is_valid,
            },
            status=500,
        )


def process_subcategory_delete(request, subcategory_code):
    # delete a subcategory by code
    try:
        subcategory = Subcategory.objects.filter(subcategory_code=subcategory_code)
        if not subcategory.exists():
            return JsonResponse({"error": "Subcategory not found"}, status=404)
        # delete the subcategory
        subcategory.delete()
        return JsonResponse({"message": "Subcategory deleted successfully"}, status=200)

    except Subcategory.DoesNotExist:
        return JsonResponse({"error": "Subcategory not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
