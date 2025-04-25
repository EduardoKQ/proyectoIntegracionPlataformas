from rest_framework import serializers
from .validators import get_web_roles

"""
Serializer for client registration requests. Validates email and password.
Also sets the role to "cliente" by default.
"""


class RegisterClientSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True)

    def validate(self, data):
        # password validation function
        def validate_passwords(password):
            if len(password) < 6:
                return False
            return True

        # email validation function
        def validate_email_format(email):
            if not email or "@" not in email:
                return False
            return True

        # validations
        if not validate_email_format(data.get("email")):
            raise serializers.ValidationError("Email invalid format.")
        if not validate_passwords(data.get("password")):
            raise serializers.ValidationError(
                "Password must be at least 6 characters long."
            )
        return data


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
            return True

        # password validation function
        def validate_password(password):
            if password is None:
                return False
            return True

        validate_email(data.get("email"))
        validate_password(data.get("password"))
        return data
