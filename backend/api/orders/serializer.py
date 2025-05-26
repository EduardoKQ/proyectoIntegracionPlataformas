from rest_framework import serializers
from api.models import Product, Branch, Order, OrderItem, Inventory
from api.orders.interfaces import OrderType, OrderPaymentMethod

class OrderItemCreateSerializer(serializers.Serializer):
    product_code = serializers.CharField(max_length=50)
    quantity = serializers.IntegerField(min_value=1)

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
    product_name = serializers.CharField(source='product_name_copy') # Or source='product.name' if you want live data
    product_brand = serializers.CharField(source='product_brand_copy')
    product_code = serializers.CharField(source='product_code_copy')

    class Meta:
        model = OrderItem
        fields = ['product_code', 'product_name', 'product_brand', 'quantity', 'transaction_price']

class OrderListSerializer(serializers.ModelSerializer):
    order_items = OrderItemListSerializer(many=True, read_only=True)
    pickup_branch_name = serializers.CharField(source='pickup_branch.name', allow_null=True, read_only=True)
    client_email = serializers.EmailField(source='client.user_account.email', read_only=True)
    total_amount = serializers.SerializerMethodField()
    
    class Meta:
        model = Order
        fields = [
            'order_id', 
            'client_email',
            'payment_type', 
            'retrieval_type', 
            'shipping_address', 
            'pickup_branch_name', # Using name instead of code for display
            'order_status', 
            'creation_date', 
            'delivery_date',
            'shipping_cost',
            'total_amount',
            'order_items'
        ]

    def get_total_amount(self, obj: Order) -> float:
        """
        Calculate the total amount for the order.
        Sum of (item.quantity * item.transaction_price) for all items + order.shipping_cost.
        """
        items_total = sum(item.quantity * item.transaction_price for item in obj.order_items.all())
        
        shipping_cost = obj.shipping_cost if obj.shipping_cost is not None else 0.00
        
        total = float(items_total) + float(shipping_cost)
        return round(total, 2)
# --- End New Serializers ---
