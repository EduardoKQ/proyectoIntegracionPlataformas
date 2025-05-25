import json
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.db import transaction
from api.orders.order_filters import parse_orders_for

# interface
from api.orders.interfaces import OrderStatus, OrderPaymentMethod
from api.user.web_role_names import WebRoleNames

# serializers
from api.orders.serializer import OrderCreateSerializer, OrderListSerializer
from api.models import Branch, Client, Inventory, Order, OrderItem, Product

# utils
def orders_create(request):
    def inventory_has_enough_quantity(branch_code, items):
        """
        Check if the inventory has enough quantity for the given items.
        """
        # get the inventory for the given branch
        branch_inventory_items = Inventory.objects.filter(branch__branch_code=branch_code)
        if not branch_inventory_items.exists():
            return False
        # check if the inventory has enough quantity for each item
        print(items) #!!!
        for item in items:
            product_code_to_check = item["product_code"]
            required_quantity = item["quantity"]
            
            # get the specific product from the branch's inventory
            product_inventory_item = branch_inventory_items.filter(product__product_code=product_code_to_check).first()
            
            print(f"order: {product_code_to_check}, req_quantity:{required_quantity}, inventory: {product_inventory_item.quantity if product_inventory_item else 'Not Found'}") #!!!
            if not product_inventory_item or product_inventory_item.quantity < required_quantity:
                return False
        return True
    
    def create_db_order(client, data):
        """
        Create a new order and save it to the database.
        """
        ### create the order
        with transaction.atomic():
            order_branch = get_object_or_404(Branch, branch_code=data["branch_code"])
            # define initial order status
            payment_type = data["payment_type"]
            if payment_type == OrderPaymentMethod.WEB.value:
                order_status = OrderStatus.PAYMMENT_PENDING.value
            elif payment_type == OrderPaymentMethod.TRANSFER.value:
                order_status = OrderStatus.TRANSFER_PENDING.value
            else:
                raise ValueError("CREACION DE LA ORDEN: Tipo de pago no válido.")
            
            order = Order.objects.create(
                client=client,
                payment_type=data["payment_type"],
                retrieval_type=data["retrieval_type"],
                shipping_address=data.get("shipping_address"),
                pickup_branch=order_branch,
                order_status=order_status,
                shipping_cost=data.get("shipping_cost", 0.00),
            )
            order_items_to_create = []
            ### create the order items
            for item in data["items"]:
                product = get_object_or_404(Product, product_code=item["product_code"])
                order_item = OrderItem(
                    order=order,
                    product=product,
                    quantity=item["quantity"],
                    # data snapshots
                    product_code_copy = product.product_code,
                    product_name_copy = product.name,
                    product_brand_copy = product.brand,
                    transaction_price = product.current_price,
                )
                order_items_to_create.append(order_item)

            OrderItem.objects.bulk_create(order_items_to_create)

            return order
    
    # MAIN LOGIC
    try:
        # serialize the request data and check if it is valid
        data = json.loads(request.body)
        serializer = OrderCreateSerializer(data=data)
        if not serializer.is_valid():
            # return 400 with the errors
            return JsonResponse({"errors": serializer.errors}, status=400)
        # validation: check if the inventory has enough quantity
        if not inventory_has_enough_quantity(serializer.validated_data["branch_code"],serializer.validated_data["items"]):
            return JsonResponse(
                {"error": "No hay suficiente cantidad de productos en inventario."},
                status=400,
            )
        # with all validated, create the order
        # but first we get the client from the request
        client_webuser = request.user
        client = Client.objects.filter(user_account=client_webuser).first()
        new_order = create_db_order(client, serializer.validated_data)

        response_data = OrderListSerializer(new_order).data
        return JsonResponse(response_data, status=201) 

    except Exception as e:
        # Handle any exceptions that occur during order creation
        return JsonResponse({"error": str(e)}, status=500)

def orders_list(request):

    def getOrdersByRole(user_role, request):
        """
        Get orders based on the user's role.
        """
        if user_role == WebRoleNames.ADMIN_TIENDA:
            # Admin role: return all orders
            return Order.objects.all().order_by('-creation_date')
        
        if user_role == WebRoleNames.CLIENTE:
            # Client role: return orders for the client
            try:
                client_instance = Client.objects.get(user_account=request.user)
                return Order.objects.filter(client=client_instance).order_by('-creation_date')
            except Client.DoesNotExist:
                return Order.objects.none()
        
        # orders for internal users depdens of their status and branch
        user_webuser = request.user
        try:
            worker_orders = parse_orders_for(user_webuser)
            return JsonResponse(worker_orders, safe=False)
        except Exception as e:
            raise ValueError(f"MAQUINA DE ESTDOS. Error al obtener las ordenes para el usuario: {str(e)}")
    
    # MAIN LOGIC
    user_role = None
    # Safely access role; request.user might be AnonymousUser or have no role attribute
    if hasattr(request.user, 'role') and request.user.role:
        user_role = request.user.role.role # Assuming 'role' is the field name in WebRoles model

    orders_queryset = Order.objects.none() # Default to an empty queryset

    try:
        orders_queryset = getOrdersByRole(user_role, request)
    except Exception as e:
        # Handle any exceptions that occur during order retrieval
        return JsonResponse({"error": str(e)}, status=500)

    if not orders_queryset.exists():
        return JsonResponse([], safe=False, status=200)

    serializer = OrderListSerializer(orders_queryset, many=True)
    return JsonResponse(serializer.data, safe=False, status=200)

    

def orders_get_by_id(request, order_code):
    """
    Process GET request for order by ID.
    """
    return None

def orders_delete_by_id(request, order_code):
    """
    Process GET request for order by ID.
    """
    return None
