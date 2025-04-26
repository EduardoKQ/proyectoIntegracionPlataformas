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


class CategoryAddSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="category_code")

    class Meta:
        model = Category
        fields = [
            "id",
            "name",
        ]

    def validate(self, data):
        # Validate that the category code is unique
        if Category.objects.filter(category_code=data["category_code"]).exists():
            raise serializers.ValidationError(
                "Category code already exists. Please choose a different one."
            )
        return data

    def create(self, validated_data):
        return Category.objects.create(**validated_data)


class CategoryUpdateSerializer(serializers.ModelSerializer):
    id = serializers.CharField(required=True)
    name = serializers.CharField(required=True)

    class Meta:
        model = Category
        fields = [
            "id",
            "name",
        ]

    def validate_name(self, value):
        if value is None or len(value) < 3:
            raise serializers.ValidationError(
                "New name must be at least 3 characters long."
            )
        return value
