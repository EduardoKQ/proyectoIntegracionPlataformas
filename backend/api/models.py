from django.db import models


# Web user models
class WebUser(models.Model):
    email = models.EmailField(unique=True, primary_key=True)
    password = models.CharField(max_length=255)
    role = models.ForeignKey("WebRoles", on_delete=models.CASCADE, related_name="users")
    is_first_time_login = models.BooleanField(default=True)


class WebRoles(models.Model):
    role = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True, null=True)


class Client(models.Model):
    client_id = models.AutoField(primary_key=True)
    user_account = models.ForeignKey(
        WebUser, on_delete=models.CASCADE, related_name="clients"
    )
    recieve_offers = models.BooleanField(default=False)
