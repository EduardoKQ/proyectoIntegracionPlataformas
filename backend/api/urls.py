from django.urls import path, include
from .system import views as system_views
from .user import views as user_views
from .products import views as product_views
from rest_framework_simplejwt.views import TokenRefreshView

# all API endpoints
urlpatterns = [
    path("health", system_views.health, name="health"),
    path("user/token-refresh", TokenRefreshView.as_view(), name="token_refresh"),
    # user endpoints
    # user endpoints
    path("user/login", user_views.login, name="login"),
    path("user/me", user_views.me, name="me"),
    path("user/register-client", user_views.register_client, name="register_client"),
    path("products/all", product_views.all, name="all"),
]
# testing only !!! later remove these endpoints
urlpatterns += [
    path("system/user-roles", system_views.user_roles, name="user_roles"),
]
