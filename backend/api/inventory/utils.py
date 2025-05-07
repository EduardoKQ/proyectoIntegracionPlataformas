from django.http import JsonResponse

from .serializer import (
    InventoryGetAllSerializer,
    BranchGetAllSerializer,
    BranchAddSerializer,
    BranchUpdateSerializer,
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

def process_branches_update(request_data, branch_code):
    try:
        # Get the branch by code
        branch = Branch.objects.get(branch_code=branch_code)
        # Get the data from the request
        branch_serializer = BranchUpdateSerializer(data=request_data)
        # Check if the data is valid
        if not branch_serializer.is_valid():
            return JsonResponse(
                {"error": "Invalid data", "details": branch_serializer.errors},
                status=400,
            )
        # Check if the branch code is being updated
        if "branch_code" in branch_serializer.validated_data:
            new_branch_code = branch_serializer.validated_data["branch_code"]
            if new_branch_code != branch.branch_code:
                if Branch.objects.filter(branch_code=new_branch_code).exists():
                    return JsonResponse(
                        {"error": "Branch code already exists."}, status=400
                    )
        # Update the branch with the new data
        for attr, value in branch_serializer.validated_data.items():
            setattr(branch, attr, value)
        branch.save()
        return JsonResponse(branch_serializer.data, status=200)

    except Branch.DoesNotExist:
        return JsonResponse({"error": "Branch not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


def process_branches_delete(branch_code):
    def delete_brach(branch):
        # Delete the branch and all related inventories
        inventories = Inventory.objects.filter(branch=branch)
        inventories.delete()
        branch.delete()
    
    try:
        # Get the branch by code
        branch = Branch.objects.get(branch_code=branch_code)
        # Delete the branch
        delete_brach(branch)
        return JsonResponse({"message": "Sucursal eliminada con exito"}, status=200)
    except Branch.DoesNotExist:
        return JsonResponse({"error": "No se encontro la Sucursal"}, status=404)
    except Inventory.DoesNotExist:
        return JsonResponse({"error": "No se encontro el inventario"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


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

def process_inventory_by_branch(branch_code):
    try:
        # Get the branch by code
        branch = Branch.objects.get(branch_code=branch_code)
        # Get all inventories for the branch
        inventories = Inventory.objects.filter(branch=branch)
        if not inventories:
            return JsonResponse({"error": "No hay datos de inventario"}, status=404)
        # Serialize the data
        inventories_serializer = InventoryGetAllSerializer(inventories, many=True)
        return JsonResponse(inventories_serializer.data, safe=False, status=200)
    except Branch.DoesNotExist:
        return JsonResponse({"error": "Branch not found"}, status=404)
    except Inventory.DoesNotExist:
        return JsonResponse({"error": "Inventory not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

def process_inventory_get_quantity(branch_code, product_code):
    try:
        # Get the branch by code
        branch = Branch.objects.get(branch_code=branch_code)
        # Get the product by code
        product = Product.objects.get(product_code=product_code)
        # Get the inventory for the branch and product
        inventory = Inventory.objects.get(branch=branch, product=product)
        # Serialize the data
        inventory_serializer = InventoryGetAllSerializer(inventory)
        return JsonResponse(inventory_serializer.data, status=200)
    except Branch.DoesNotExist:
        return JsonResponse({"error": "Branch not found"}, status=404)
    except Product.DoesNotExist:
        return JsonResponse({"error": "Product not found"}, status=404)
    except Inventory.DoesNotExist:
        return JsonResponse({"error": "Inventory not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

def process_inventory_update_quantity(branch_code, product_code, quantity):
    try:
        # Get the branch by code
        branch = Branch.objects.get(branch_code=branch_code)
        # Get the product by code
        product = Product.objects.get(product_code=product_code)
        # Get the inventory for the branch and product
        inventory = Inventory.objects.get(branch=branch, product=product)
        # Update the quantity
        inventory.quantity = quantity
        inventory.save()
        return JsonResponse({"message": "Cantidad actualizada con exito"}, status=200)
    except Branch.DoesNotExist:
        return JsonResponse({"error": "Branch not found"}, status=404)
    except Product.DoesNotExist:
        return JsonResponse({"error": "Product not found"}, status=404)
    except Inventory.DoesNotExist:
        return JsonResponse({"error": "Inventory not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

