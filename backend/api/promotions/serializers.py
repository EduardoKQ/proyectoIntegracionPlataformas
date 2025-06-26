from rest_framework import serializers
from .models import Promotion, PromotionProduct, PromotionCategory, PromotionSubcategory

class PromotionCreateSerializer(serializers.ModelSerializer):
    product_ids = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_empty=True
    )
    category_ids = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_empty=True
    )
    subcategory_ids = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_empty=True
    )

    class Meta:
        model = Promotion
        fields = [
            'promotion_code', 'name', 'description', 'discount_type',
            'discount_value', 'max_discount_percentage', 'start_date',
            'end_date', 'status', 'product_ids', 'category_ids', 'subcategory_ids'
        ]

    def validate(self, data):
        if data['discount_type'] == 'percentage' and data['discount_value'] > 100:
            raise serializers.ValidationError("El descuento porcentual no puede ser mayor a 100%")
        
        if data['start_date'] >= data['end_date']:
            raise serializers.ValidationError("La fecha de inicio debe ser anterior a la fecha de fin")
        
        return data

class PromotionDetailSerializer(serializers.ModelSerializer):
    products = serializers.SerializerMethodField()
    categories = serializers.SerializerMethodField()
    subcategories = serializers.SerializerMethodField()

    class Meta:
        model = Promotion
        fields = [
            'id', 'promotion_code', 'name', 'description', 'discount_type',
            'discount_value', 'max_discount_percentage', 'start_date',
            'end_date', 'status', 'created_at', 'updated_at',
            'products', 'categories', 'subcategories'
        ]

    def get_products(self, obj):
        from api.models import Product
        products = [pp.product for pp in obj.promotion_products.all()]
        return [
            {
                'product_id': p.product_id,
                'product_code': p.product_code,
                'name': p.name,
                'current_price': str(p.current_price)
            } for p in products
        ]

    def get_categories(self, obj):
        from api.models import Category
        categories = [pc.category for pc in obj.promotion_categories.all()]
        return [
            {
                'category_id': c.category_id,
                'category_code': c.category_code,
                'name': c.name
            } for c in categories
        ]

    def get_subcategories(self, obj):
        from api.models import Subcategory
        subcategories = [ps.subcategory for ps in obj.promotion_subcategories.all()]
        return [
            {
                'subcategory_id': s.subcategory_id,
                'subcategory_code': s.subcategory_code,
                'name': s.name
            } for s in subcategories
        ]

class PromotionListSerializer(serializers.ModelSerializer):
    total_products = serializers.SerializerMethodField()
    total_categories = serializers.SerializerMethodField()
    total_subcategories = serializers.SerializerMethodField()

    class Meta:
        model = Promotion
        fields = [
            'id', 'promotion_code', 'name', 'description', 'discount_type',
            'discount_value', 'start_date', 'end_date', 'status',
            'total_products', 'total_categories', 'total_subcategories'
        ]

    def get_total_products(self, obj):
        return obj.promotion_products.count()

    def get_total_categories(self, obj):
        return obj.promotion_categories.count()

    def get_total_subcategories(self, obj):
        return obj.promotion_subcategories.count()