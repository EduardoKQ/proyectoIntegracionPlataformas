from rest_framework import serializers
from .validators import get_web_roles
from ..models import WebUser, WebRoles


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True)
    password2 = serializers.CharField(write_only=True, required=True)
    role = serializers.CharField(required=True)
    is_first_time_login = True

    def validate(self, data):
        # password validation function
        def validate_passwords(password, password2):
            if password != password2:
                return False
            if len(password) < 8:
                return False
            return True

        # email validation function
        # !!! simple validation, not production ready !!!
        def validate_email(email):
            if not email or "@" not in email:
                return False
            if WebUser.objects.filter(email=email).exists():
                return False
            return True

        # role validation function
        def validate_roles(role):
            if role not in get_web_roles():
                return False
            return True

        # validations
        if not validate_email(data.get("email")):
            raise serializers.ValidationError("Email invalid.")
        if not validate_passwords(data.get("password"), data.get("password2")):
            raise serializers.ValidationError("Passwords do not match.")
        if not validate_roles(data.get("role")):
            raise serializers.ValidationError("Role invalid.")

        return data

    def save(self, **kwargs):
        # save the user to the database
        user = WebUser(
            email=self.validated_data["email"],
            password=self.validated_data["password"],
            role=self.validated_data["role"],
        )
        user.is_first_time_login = True
        user.save()
        # !!!
        print(
            "User saved:",
            user.email,
            user.password,
            user.role,
            user.is_first_time_login,
        )
        return user


"""
Serializer for login requests. Validates email and password.
"""


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(
        write_only=True,
        required=True,
    )

    def validate(self, data):
        # email validation function
        def validate_email(email):
            if not email or "@" not in email:
                return False
            if not WebUser.objects.filter(email=email).exists():
                return False
            return True

        # password validation function
        def validate_password(password):
            if password is None:
                return False
            return True

        validate_email(data.get("email"))
        validate_password(data.get("password"))
        return data
