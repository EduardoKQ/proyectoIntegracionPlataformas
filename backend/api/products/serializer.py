from rest_framework import serializers
from api.models import Product, Subcategory, Category
from external_apis.dollar_service import DolarService


class ProductDetailSerializer(serializers.ModelSerializer):
    codigo_producto = serializers.CharField(source="product_code")
    nombre = serializers.CharField(source="name")
    precio = serializers.SerializerMethodField()  #
    marca = serializers.CharField(source="brand")
    codigo_marca = serializers.CharField(source="brand_code")
    categoria = serializers.SerializerMethodField()
    subcategoria = serializers.SerializerMethodField()
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
        dollar_price = self.context.get("dollar_price")
        exchange_date = self.context.get("exchange_date")
        return {
            "precio_actual": round(obj.current_price),
            "fecha_precio": obj.current_price_date,
            "precio_dolares": round(float(obj.current_price) / dollar_price, 2),
            "fecha_cambio_dolar": exchange_date,
        }

    def get_categoria(self, obj):
        if obj.subcategory and obj.subcategory.category:
            return obj.subcategory.category.name
        return "Ninguna"

    def get_subcategoria(self, obj):
        if obj.subcategory:
            return obj.subcategory.name
        return "Ninguna"


class ProductAddSerializer(serializers.ModelSerializer):
    codigo_producto = serializers.CharField(source="product_code", required=True)
    nombre = serializers.CharField(source="name", required=True)
    precio = serializers.FloatField(source="current_price", required=True)
    marca = serializers.CharField(source="brand", required=True)
    codigo_marca = serializers.CharField(source="brand_code", required=True)
    categoria = serializers.CharField(source="category.name", required=True)
    subcategoria = serializers.CharField(source="subcategory.name", required=True)
    imageUrl = serializers.CharField(source="image_url", required=False)
    descripcion = serializers.CharField(source="description", required=False)

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

    def validate(self, data):
        # validate category and subcategory
        category_name = data.get("category").get("name")
        subcategory_name = data.get("subcategory").get("name")
        category = Category.objects.filter(name=category_name).first()
        subcategory = Subcategory.objects.filter(name=subcategory_name).first()
        if not category or not subcategory:
            raise serializers.ValidationError("La categoria o subcategoria no existe")
        # validate that the subcategory belongs to the category
        if subcategory.category != category:
            raise serializers.ValidationError(
                "La subcategoria no pertenece a la categoria"
            )

        # validate price over 0
        if data.get("current_price") <= 0:
            raise serializers.ValidationError("El precio debe ser mayor a 0")

        return data


class ProductUpdateSerializer(serializers.ModelSerializer):
    codigo_producto = serializers.CharField(source="product_code", required=False)
    nombre = serializers.CharField(source="name", required=False)
    precio = serializers.FloatField(source="current_price", required=False)
    marca = serializers.CharField(source="brand", required=False)
    codigo_marca = serializers.CharField(source="brand_code", required=False)
    categoria = serializers.CharField(source="category.name", required=False)
    subcategoria = serializers.CharField(source="subcategory.name", required=False)
    imageUrl = serializers.CharField(source="image_url", required=False)
    descripcion = serializers.CharField(source="description", required=False)

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

    def validate(self, data):
        # case 1: only subcategory is updated
        if "subcategory" in data and "category" not in data:
            subcategory_name = data.get("subcategory").get("name")
            subcategory = Subcategory.objects.filter(name=subcategory_name).first()
            if not subcategory:
                raise serializers.ValidationError(
                    "La subcategoria no existe o no pertenece a la categoria"
                )

        # case 2: both category and subcategory are updated
        if "category" in data and "subcategory" in data:
            # check that the category and subcategory exist and belong to each other
            category_name = data.get("category").get("name")
            subcategory_name = data.get("subcategory").get("name")
            category = Category.objects.filter(name=category_name).first()
            subcategory = Subcategory.objects.filter(name=subcategory_name).first()
            if not category or not subcategory:
                raise serializers.ValidationError(
                    "La categoria o subcategoria no existe"
                )
            # validate that the subcategory belongs to the category
            if subcategory.category != category:
                raise serializers.ValidationError(
                    "La subcategoria no pertenece a la categoria"
                )
        return data


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


class SubcategoryAddSerializer(serializers.ModelSerializer):
    # These fields map the incoming JSON keys to the serializer
    id = serializers.CharField(source="subcategory_code", required=True)
    name = serializers.CharField(required=True)
    relatedCategoryId = serializers.CharField(required=True)

    class Meta:
        model = Subcategory
        fields = [
            "id",
            "name",
            "relatedCategoryId",
        ]

    def validate(self, data):
        # 'data' dictionary initially has keys: 'subcategoryId', 'subcategoryName', 'relatedCategoryId'
        subcategory_code = data.get("subcategory_code")
        name = data.get("name")
        related_category_id = data.get("relatedCategoryId")
        print(f"data: {data}")
        print(
            f"subcategory_code: {subcategory_code}, name: {name}, related_category_id: {related_category_id}"
        )

        # --- Validation Checks ---
        if subcategory_code is None or len(subcategory_code) < 3:
            raise serializers.ValidationError(
                "Subcategory code must be at least 3 characters long."
            )
        if name is None or len(name) < 3:
            raise serializers.ValidationError(
                "Subcategory name must be at least 3 characters long."
            )
        if related_category_id is None or len(related_category_id) < 3:
            raise serializers.ValidationError(
                "Related category code must be at least 3 characters long."
            )

        return data


class SubcategorySerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="subcategory_code")

    class Meta:
        model = Subcategory
        fields = [
            "id",
            "name",
        ]

    def validate(self, data):
        # Validate that the subcategory code is unique
        if Subcategory.objects.filter(
            subcategory_code=data["subcategory_code"]
        ).exists():
            raise serializers.ValidationError(
                "Subcategory code already exists. Please choose a different one."
            )
        return data

    def create(self, validated_data):
        return Subcategory.objects.create(**validated_data)


class SubcategoryGetSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="subcategory_code")
    relatedCategoryId = serializers.CharField(source="category.category_code")

    class Meta:
        model = Subcategory
        fields = [
            "id",
            "name",
            "relatedCategoryId",
        ]

    def validate(self, data):
        # Validate that the subcategory code is unique
        if Subcategory.objects.filter(
            subcategory_code=data["subcategory_code"]
        ).exists():
            raise serializers.ValidationError(
                "Subcategory code already exists. Please choose a different one."
            )
        return data
