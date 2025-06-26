from rest_framework import serializers
from api.models import Product, Branch, Order, OrderItem, Inventory
from api.orders.interfaces import OrderType, OrderPaymentMethod

class OrderItemCreateSerializer(serializers.Serializer):
    product_code = serializers.CharField(max_length=50)
    quantity = serializers.IntegerField(min_value=1)
    has_promotion = serializers.BooleanField(default=False, required=False)
    promotion_info = serializers.DictField(required=False, allow_null=True)

    def validate_product_code(self, value):
        if not Product.objects.filter(product_code=value).exists():
            raise serializers.ValidationError(f"Producto con codigo '{value}' no existe.")
        return value



class OrderCreateSerializer(serializers.Serializer):
    # dynamic choices for payment and retrieval types
    PAYMENT_TYPE_CHOICES = [
        (method.value, method.name.replace("_", " ").title()) for method in OrderPaymentMethod
    ]
    RETRIEVAL_TYPE_CHOICES = [
        (type.value, type.name.replace("_", " ").title()) for type in OrderType
    ]
    # error message for invalid choices
    available_payment_types_str = ", ".join([f"'{choice[0]}'" for choice in PAYMENT_TYPE_CHOICES])
    available_retrieval_types_str = ", ".join([f"'{choice[0]}'" for choice in RETRIEVAL_TYPE_CHOICES])

    payment_type = serializers.ChoiceField(
        choices=PAYMENT_TYPE_CHOICES,
        error_messages={
            "invalid_choice": f"Opción no válida. Las opciones disponibles son: {available_payment_types_str}."
        })
    retrieval_type = serializers.ChoiceField(
        choices=RETRIEVAL_TYPE_CHOICES,
        error_messages={
            "invalid_choice": f"Opción no válida. Las opciones disponibles son: {available_retrieval_types_str}."
            })
    shipping_address = serializers.CharField(max_length=255, allow_null=True, required=False)
    branch_code = serializers.CharField(max_length=50, required=True)
    shipping_cost = serializers.DecimalField(
        max_digits=10, decimal_places=2, default=0.00, required=False
    )
    items = OrderItemCreateSerializer(many=True, allow_empty=False)

    def validate_branch_code(self, value):
        """
        Check that the branch_code exists if provided.
        """
        if value and not Branch.objects.filter(branch_code=value).exists():
            raise serializers.ValidationError(f"Sucursal con codigo '{value}' no existe.")
        return value

    def validate(self, data):
        """
        Validate conditional fields:
        - shipping_address is required if retrieval_type is 'domicilio'.
        """
        retrieval_type = data.get("retrieval_type")
        shipping_address = data.get("shipping_address")

        if retrieval_type == OrderType.DELIVERY.value:
            shipping_cost = data.get("shipping_cost") 
            if not shipping_address:
                raise serializers.ValidationError(
                    {"shipping_address": "Este campo es requerido para entregas a 'domicilio'."}
                )
            if not shipping_cost or shipping_cost <= 0:
                raise serializers.ValidationError(
                    {"shipping_cost": "El costo de envío es obligatorio y debe ser mayor que 0 para entregas a 'domicilio'."}
                )
            
        if not data.get('items'):
            raise serializers.ValidationError({"items": "la lista de productos y cantidades no puede estr vacia."})

        return data

# --- New Serializers for Listing Orders ---
class OrderItemListSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product_name_copy')
    product_brand = serializers.CharField(source='product_brand_copy')
    product_code = serializers.CharField(source='product_code_copy')
    total_original_price = serializers.SerializerMethodField()
    total_discount_amount = serializers.SerializerMethodField()
    total_final_price = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = [
            'product_code', 
            'product_name', 
            'product_brand', 
            'quantity', 
            'transaction_price',
            'original_price',
            'promotion_applied',
            'promotion_code',
            'promotion_name',
            'discount_amount',
            'discount_percentage',
            'total_original_price',
            'total_discount_amount',
            'total_final_price'
        ]
    
    def get_total_original_price(self, obj):
        return float(obj.get_total_original_price())
    
    def get_total_discount_amount(self, obj):
        return float(obj.get_total_discount_amount())
    
    def get_total_final_price(self, obj):
        return float(obj.get_total_final_price())

class OrderListSerializer(serializers.ModelSerializer):
    order_items = OrderItemListSerializer(many=True, read_only=True)
    pickup_branch_name = serializers.CharField(source='pickup_branch.name', allow_null=True, read_only=True)
    client_email = serializers.EmailField(source='client.user_account.email', read_only=True)
    subtotal_original = serializers.SerializerMethodField()
    total_discount_amount = serializers.SerializerMethodField()
    subtotal_with_discounts = serializers.SerializerMethodField()
    total_final = serializers.SerializerMethodField()
    has_promotions = serializers.SerializerMethodField()
    
    class Meta:
        model = Order
        fields = [
            'order_id', 
            'client_email',
            'payment_type', 
            'retrieval_type', 
            'shipping_address', 
            'pickup_branch_name',
            'order_status', 
            'creation_date', 
            'delivery_date',
            'shipping_cost',
            'subtotal_original',
            'total_discount_amount',
            'subtotal_with_discounts',
            'total_final',
            'has_promotions',
            'order_items'
        ]

    def get_subtotal_original(self, obj: Order) -> float:
        """Obtiene el subtotal original (sin descuentos)"""
        return float(obj.get_subtotal_original())
    
    def get_total_discount_amount(self, obj: Order) -> float:
        """Obtiene el monto total de descuentos"""
        return float(obj.get_total_discount_amount())
    
    def get_subtotal_with_discounts(self, obj: Order) -> float:
        """Obtiene el subtotal con descuentos aplicados"""
        return float(obj.get_subtotal_with_discounts())
    
    def get_total_final(self, obj: Order) -> float:
        """Obtiene el total final incluyendo envío"""
        return float(obj.get_total_final())
    
    def get_has_promotions(self, obj: Order) -> bool:
        """Verifica si la orden tiene promociones aplicadas"""
        return obj.has_promotional_items()
