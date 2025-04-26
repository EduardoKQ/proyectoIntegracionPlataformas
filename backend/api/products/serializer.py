from rest_framework import serializers
from api.models import Product


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
