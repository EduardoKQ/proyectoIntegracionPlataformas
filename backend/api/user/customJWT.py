from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed
from ..models import WebUser


class CustomJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        try:
            user_id = validated_token.get("user_id")  # Get user identifier from token
            if user_id is None:
                raise AuthenticationFailed(
                    "Token contained no recognizable user identification."
                )

            # Retrieve the user from the database
            user = WebUser.objects.get(email=user_id)
            return user
        except WebUser.DoesNotExist:
            raise AuthenticationFailed("User not found.")
        except Exception as e:
            # Log the exception e for debugging if necessary
            raise AuthenticationFailed(f"Error retrieving user: {str(e)}")
