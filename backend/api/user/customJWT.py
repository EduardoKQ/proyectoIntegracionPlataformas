from rest_framework_simplejwt.authentication import JWTAuthentication


class CustomJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        try:
            user = "user_data"  # Placeholder for user data retrieval logic!!!
            if user is None:
                raise AuthenticationFailed("User not found.")
            return user
        except Exception as e:
            raise AuthenticationFailed(f"Error retrieving user: {str(e)}")
