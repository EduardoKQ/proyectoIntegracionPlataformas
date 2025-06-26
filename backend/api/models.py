from django.db import models
from django.contrib.auth.models import (
    AbstractBaseUser,
    BaseUserManager,
    PermissionsMixin,
)
from api.orders.interfaces import OrderStatus


# Custom WebUser Manager
# This manager handles the creation of users and superusers.
class WebUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("The Email field must be set")
        email = self.normalize_email(email)
        # Ensure role is handled, e.g., fetch default or require it
        role = extra_fields.pop("role", None)
        if not role:
            # Example: Get a default role or raise error
            try:
                role = WebRoles.objects.get(role="cliente")  # Or some default
            except WebRoles.DoesNotExist:
                raise ValueError("Default role not found.")

        user = self.model(email=email, role=role, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)  # Superusers should be active
        extra_fields.setdefault(
            "is_first_time_login", False
        )  # Superusers don't need this flag

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        # Assign a specific role for superuser, e.g., 'administrador_sistema'
        try:
            admin_role = WebRoles.objects.get(role="superuser")  # Adjust role name
        except WebRoles.DoesNotExist:
            raise ValueError("Admin role 'administrador_sistema' not found.")
        extra_fields["role"] = admin_role

        return self.create_user(email, password, **extra_fields)


### MODELS ###
# Web user models
class WebUser(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=255)
    role = models.ForeignKey("WebRoles", on_delete=models.CASCADE, related_name="users")
    is_first_time_login = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)  # Required by Django auth
    is_staff = models.BooleanField(default=False)  # Required for admin access

    objects = WebUserManager()

    USERNAME_FIELD = "email"  # Use email to log in
    REQUIRED_FIELDS = (
        []
    )  # No extra fields needed for createsuperuser besides email/password


class WebRoles(models.Model):
    role = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True, null=True)


class Client(models.Model):
    client_id = models.AutoField(primary_key=True)
    user_account = models.ForeignKey(
        WebUser, on_delete=models.CASCADE, related_name="clients"
    )
    recieve_offers = models.BooleanField(default=False)


class Branch(models.Model):
    branch_id = models.AutoField(primary_key=True)
    branch_code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100, unique=True)
    address = models.CharField(max_length=255)
    city = models.CharField(max_length=100)


class Worker(models.Model):
    worker_id = models.AutoField(primary_key=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    user_account = models.ForeignKey(
        WebUser, on_delete=models.DO_NOTHING, related_name="workers"
    )
    branch = models.ForeignKey(
        Branch, on_delete=models.DO_NOTHING, related_name="workers"
    )


class Product(models.Model):
    product_id = models.AutoField(primary_key=True)
    product_code = models.CharField(max_length=50, unique=True)
    brand = models.CharField(max_length=100)
    brand_code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField()
    image_url = models.URLField()
    current_price = models.DecimalField(max_digits=10, decimal_places=2)
    current_price_date = models.DateField()
    subcategory = models.ForeignKey(
        "Subcategory",
        on_delete=models.SET_NULL,
        related_name="products",
        null=True,
        blank=True,
    )

    def get_current_promotion(self):
        """Obtiene la promoción activa más ventajosa para este producto"""
        from django.utils import timezone
        from api.promotions.models import Promotion, PromotionProduct, PromotionCategory, PromotionSubcategory
        from decimal import Decimal
        
        now = timezone.now()
        best_promotion = None
        best_discount = Decimal('0')
        product_promotions = Promotion.objects.filter(
            promotion_products__product=self,
            status='active',
            start_date__lte=now,
            end_date__gte=now
        )
        
        if self.subcategory and self.subcategory.category:
            category_promotions = Promotion.objects.filter(
                promotion_categories__category=self.subcategory.category,
                status='active',
                start_date__lte=now,
                end_date__gte=now
            )
            product_promotions = product_promotions.union(category_promotions)
        
        if self.subcategory:
            subcategory_promotions = Promotion.objects.filter(
                promotion_subcategories__subcategory=self.subcategory,
                status='active',
                start_date__lte=now,
                end_date__gte=now
            )
            product_promotions = product_promotions.union(subcategory_promotions)
        
        for promotion in product_promotions:
            discount_amount = self._calculate_discount_amount(promotion)
            if discount_amount > best_discount:
                best_discount = discount_amount
                best_promotion = promotion
        
        return best_promotion

    def _calculate_discount_amount(self, promotion):
        """Calcula el monto del descuento para una promoción específica"""
        from decimal import Decimal
        
        if promotion.discount_type == 'percentage':
            discount = self.current_price * (promotion.discount_value / Decimal('100'))
            if promotion.max_discount_percentage:
                max_discount = self.current_price * (promotion.max_discount_percentage / Decimal('100'))
                discount = min(discount, max_discount)
            return discount
        else:
            return min(promotion.discount_value, self.current_price)

    def get_promotional_price(self):
        """Obtiene el precio promocional si existe una promoción activa"""
        promotion = self.get_current_promotion()
        if promotion:
            discount = self._calculate_discount_amount(promotion)
            return self.current_price - discount
        return self.current_price

    def get_discount_percentage(self):
        """Obtiene el porcentaje de descuento aplicado"""
        from decimal import Decimal
        
        promotion = self.get_current_promotion()
        if not promotion:
            return Decimal('0')
        
        discount_amount = self._calculate_discount_amount(promotion)
        if self.current_price > 0:
            return (discount_amount / self.current_price) * Decimal('100')
        return Decimal('0')

    def has_active_promotion(self):
        """Verifica si el producto tiene una promoción activa"""
        return self.get_current_promotion() is not None

    def get_promotion_info(self):
        """Obtiene información completa de la promoción activa"""
        promotion = self.get_current_promotion()
        if not promotion:
            return None
        
        return {
            'promotion_id': promotion.id,
            'promotion_code': promotion.promotion_code,
            'promotion_name': promotion.name,
            'original_price': self.current_price,
            'promotional_price': self.get_promotional_price(),
            'discount_amount': self._calculate_discount_amount(promotion),
            'discount_percentage': self.get_discount_percentage(),
            'discount_type': promotion.discount_type
        }


class Subcategory(models.Model):
    subcategory_id = models.AutoField(primary_key=True)
    subcategory_code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100, unique=True)
    category = models.ForeignKey(
        "Category", on_delete=models.CASCADE, related_name="subcategories"
    )


class Category(models.Model):
    category_id = models.AutoField(primary_key=True)
    category_code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100, unique=True)


class Inventory(models.Model):
    inventory_id = models.AutoField(primary_key=True)
    branch = models.ForeignKey(
        Branch,
        on_delete=models.DO_NOTHING,
        related_name="inventories",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.DO_NOTHING,
        related_name="inventories",
    )
    quantity = models.IntegerField(default=0)

    class Meta:
        # Enforce that the combination of branch and product is unique
        unique_together = ("branch", "product")


class Order(models.Model):
    order_id = models.AutoField(primary_key=True)
    client = models.ForeignKey(
        Client, on_delete=models.SET_NULL, null=True, blank=True, related_name="orders"
    )
    payment_type = models.CharField(max_length=50)
    retrieval_type = models.CharField(max_length=50)
    shipping_address = models.CharField(max_length=255, null=True, blank=True)
    shipping_cost = models.DecimalField(
        max_digits=10, decimal_places=2, default=0.00, null=True, blank=True)
    pickup_branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pickup_orders",
    )
    order_status = models.CharField(max_length=50, default=OrderStatus.PAYMMENT_PENDING)
    creation_date = models.DateTimeField(auto_now_add=True)
    delivery_date = models.DateTimeField(null=True, blank=True)
    
    def get_subtotal_original(self):
        """Obtiene el subtotal original (sin descuentos)"""
        from decimal import Decimal
        total = Decimal('0')
        for item in self.order_items.all():
            total += item.get_total_original_price()
        return total
    
    def get_total_discount_amount(self):
        """Obtiene el monto total de descuentos aplicados"""
        from decimal import Decimal
        total = Decimal('0')
        for item in self.order_items.all():
            total += item.get_total_discount_amount()
        return total
    
    def get_subtotal_with_discounts(self):
        """Obtiene el subtotal con descuentos aplicados"""
        from decimal import Decimal
        total = Decimal('0')
        for item in self.order_items.all():
            total += item.get_total_final_price()
        return total
    
    def get_total_final(self):
        """Obtiene el total final incluyendo costos de envío"""
        subtotal = self.get_subtotal_with_discounts()
        shipping = self.shipping_cost or 0
        return subtotal + shipping
    
    def has_promotional_items(self):
        """Verifica si la orden tiene items con promociones aplicadas"""
        return self.order_items.filter(promotion_applied=True).exists()
    
    def get_order_summary(self):
        """Obtiene un resumen completo de la orden con información de descuentos"""
        return {
            'order_id': self.order_id,
            'subtotal_original': self.get_subtotal_original(),
            'total_discount_amount': self.get_total_discount_amount(),
            'subtotal_with_discounts': self.get_subtotal_with_discounts(),
            'shipping_cost': self.shipping_cost or 0,
            'total_final': self.get_total_final(),
            'has_promotions': self.has_promotional_items(),
            'creation_date': self.creation_date,
            'order_status': self.order_status
        }


class OrderItem(models.Model):
    order_item_id = models.AutoField(primary_key=True)
    order = models.ForeignKey(
        Order, on_delete=models.CASCADE, related_name="order_items"
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="order_items",
    )

    product_code_copy = models.CharField(max_length=50)
    product_name_copy = models.CharField(max_length=100)
    product_brand_copy = models.CharField(max_length=100)

    quantity = models.PositiveIntegerField()
    transaction_price = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Campos para manejar promociones
    original_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    promotion_applied = models.BooleanField(default=False)
    promotion_code = models.CharField(max_length=50, null=True, blank=True)
    promotion_name = models.CharField(max_length=200, null=True, blank=True)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    def get_total_original_price(self):
        """Obtiene el precio total original (sin descuento)"""
        if self.original_price:
            return self.original_price * self.quantity
        return self.transaction_price * self.quantity
    
    def get_total_discount_amount(self):
        """Obtiene el monto total de descuento"""
        return self.discount_amount * self.quantity
    
    def get_total_final_price(self):
        """Obtiene el precio final total (con descuento aplicado)"""
        return self.transaction_price * self.quantity
