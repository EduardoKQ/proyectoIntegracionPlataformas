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
