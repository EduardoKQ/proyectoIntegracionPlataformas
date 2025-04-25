from functools import wraps
from rest_framework.response import Response
from rest_framework import status


def require_roles(allowed_roles_list):
    """
    Decorator for DRF function-based views that checks if the authenticated user's
    role is in the allowed list. Assumes JWT authentication populates request.user.

    Args:
        allowed_roles_list (list): A list of role name strings allowed to access the view.
    """

    def decorator(view_func):
        @wraps(view_func)  # Preserves function metadata (name, docstring, etc.)
        def _wrapped_view(request, *args, **kwargs):
            # 1. Ensure user is authenticated (should be handled by IsAuthenticated, but good safety check)
            if not request.user or not request.user.is_authenticated:
                return Response(
                    {"detail": "Authentication credentials were not provided."},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            # 2. Get the user's role name string
            user_role_name = request.user.role.role if request.user.role else None

            # 3. Check if the user's role is in the allowed list
            if user_role_name not in allowed_roles_list:
                return Response(
                    {
                        "detail": "You do not have permission to perform this action based on your role."
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            # 4. If role is allowed, proceed to the original view function
            return view_func(request, *args, **kwargs)

        return _wrapped_view

    return decorator
