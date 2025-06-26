from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from api.models import Product, Category, Subcategory

class PromotionType(models.TextChoices):
    PERCENTAGE = 'percentage', 'Porcentaje'
    FIXED_AMOUNT = 'fixed_amount', 'Monto Fijo'

class PromotionStatus(models.TextChoices):
    ACTIVE = 'active', 'Activa'
    INACTIVE = 'inactive', 'Inactiva'
    EXPIRED = 'expired', 'Expirada'

class Promotion(models.Model):
    promotion_code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    discount_type = models.CharField(
        max_length=20,
        choices=PromotionType.choices,
        default=PromotionType.PERCENTAGE
    )
    discount_value = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )

    max_discount_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        blank=True,
        null=True
    )
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    status = models.CharField(
        max_length=20,
        choices=PromotionStatus.choices,
        default=PromotionStatus.ACTIVE
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'promotions'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.promotion_code})"

class PromotionProduct(models.Model):
    promotion = models.ForeignKey(Promotion, on_delete=models.CASCADE, related_name='promotion_products')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='product_promotions')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'promotion_products'
        unique_together = ['promotion', 'product']

class PromotionCategory(models.Model):
    promotion = models.ForeignKey(Promotion, on_delete=models.CASCADE, related_name='promotion_categories')
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='category_promotions')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'promotion_categories'
        unique_together = ['promotion', 'category']

class PromotionSubcategory(models.Model):
    promotion = models.ForeignKey(Promotion, on_delete=models.CASCADE, related_name='promotion_subcategories')
    subcategory = models.ForeignKey(Subcategory, on_delete=models.CASCADE, related_name='subcategory_promotions')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'promotion_subcategories'
        unique_together = ['promotion', 'subcategory']