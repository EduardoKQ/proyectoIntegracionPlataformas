from django.http import JsonResponse

from .serializer import (
    InventoryGetAllSerializer,
    BranchGetAllSerializer,
    BranchAddSerializer,
)
from api.models import Product, Branch, Inventory


### BRANCHES HELPERS ###
def process_branches_list(request):
    try:
        # Get all branches
        branches = Branch.objects.all()
        if not branches:
            return JsonResponse({"error": "No hay datos de sucursales"}, status=404)
        # Serialize the data
        branches_serializer = BranchGetAllSerializer(branches, many=True)
        return JsonResponse(branches_serializer.data, safe=False, status=200)
    except Branch.DoesNotExist:
        return JsonResponse({"error": "Branches not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


def process_branches_create(request):
    try:
        # Get the data from the request
        branch_serializer = BranchAddSerializer(data=request.data)
        # Check if the data is valid
        if not branch_serializer.is_valid():
            return JsonResponse(
                {"error": "Invalid data", "details": branch_serializer.errors},
                status=400,
            )
        # Create and save new branch
        branch = Branch.objects.create(**branch_serializer.validated_data)
        branch.save()
        # update inventory with the new branch with all products set to 0 quantity
        products = Product.objects.all()
        for product in products:
            Inventory.objects.create(
                branch=branch, product=product, quantity=0
            )  # Set quantity to 0 for all products in the new branch
        return JsonResponse(branch_serializer.data, status=201)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


def process_branches_get(branch_code):
    try:
        # Get the branch by code
        branch = Branch.objects.get(branch_code=branch_code)
        # Serialize the data
        branch_serializer = BranchGetAllSerializer(branch)
        return JsonResponse(branch_serializer.data, status=200)

    except Branch.DoesNotExist:
        return JsonResponse({"error": "Branch not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


def process_branches_update(branch_code):
    return JsonResponse({"error": "Not implemented update"}, status=501)


def process_branches_delete(branch_code):
    return JsonResponse({"error": "Not implemented delete"}, status=501)


### INVENTORY HELPERS ###
def process_inventory_list(request):
    """
    Process the request to get the inventory list.
    """
    try:
        # Get all inventories
        inventories = Inventory.objects.all()
        if not inventories:
            return JsonResponse({"error": "No data in the inventory"}, status=404)
        # Serialize the data
        inventories_serializer = InventoryGetAllSerializer(inventories, many=True)
        return JsonResponse(inventories_serializer.data, safe=False, status=200)

    except Inventory.DoesNotExist:
        return JsonResponse({"error": "Inventory not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
