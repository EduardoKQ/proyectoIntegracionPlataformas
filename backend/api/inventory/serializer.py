from rest_framework import serializers
from api.models import Inventory, Product, Branch


class BranchGetAllSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ["branch_code", "name", "address", "city"]


class BranchAddSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ["branch_code", "name", "address", "city"]

    def validate_branch_code(self, value):
        if Branch.objects.filter(branch_code=value).exists():
            raise serializers.ValidationError("Branch code already exists.")
        return value


class InventoryGetAllSerializer(serializers.ModelSerializer):
    branch_code = serializers.CharField(source="branch.branch_code")
    branch_name = serializers.CharField(source="branch.name")
    product_code = serializers.CharField(source="product.product_code")
    product_name = serializers.CharField(source="product.name")

    class Meta:
        model = Inventory
        fields = [
            "branch_code",
            "branch_name",
            "product_code",
            "product_name",
            "quantity",
        ]
