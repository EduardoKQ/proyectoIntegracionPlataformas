from django.db import models
from django.contrib.auth.models import (
    AbstractBaseUser,
    BaseUserManager,
    PermissionsMixin,
)


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


class PriceHistory(models.Model):
    price_history_id = models.AutoField(primary_key=True)
    product = models.ForeignKey(
        Product, on_delete=models.DO_NOTHING, related_name="price_history"
    )
    price = models.DecimalField(max_digits=10, decimal_places=2)
    date = models.DateField()


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
    quantity = models.PositiveIntegerField()

    class Meta:
        # Enforce that the combination of branch and product is unique
        unique_together = ("branch", "product")
