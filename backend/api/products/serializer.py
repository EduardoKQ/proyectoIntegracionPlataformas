from rest_framework import serializers
from api.models import Product, Subcategory, Category


class ProductDetailSerializer(serializers.ModelSerializer):
    codigo_producto = serializers.CharField(source="product_code")
    nombre = serializers.CharField(source="name")
    precio = serializers.SerializerMethodField()  #
    marca = serializers.CharField(source="brand")
    codigo_marca = serializers.CharField(source="brand_code")
    categoria = serializers.CharField(source="subcategory.category.name")
    subcategoria = serializers.CharField(source="subcategory.name")
    imageUrl = serializers.CharField(source="image_url")
    descripcion = serializers.CharField(source="description")

    class Meta:
        model = Product
        fields = [
            "codigo_producto",
            "nombre",
            "precio",
            "marca",
            "codigo_marca",
            "categoria",
            "subcategoria",
            "imageUrl",
            "descripcion",
        ]

    def get_precio(self, obj):
        return {
            "precio_actual": round(obj.current_price),
            "fecha_precio": obj.current_price_date,
        }


class CategoriesDetailSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="category_code")
    subcategories = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = [
            "id",
            "name",
            "subcategories",
        ]

    def get_subcategories(self, obj):
        subcategories = Subcategory.objects.filter(category=obj)
        return SubcategorySerializer(subcategories, many=True).data


class SubcategorySerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="subcategory_code")

    class Meta:
        model = Subcategory
        fields = [
            "id",
            "name",
        ]
