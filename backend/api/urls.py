from django.urls import path, include
from .system import views as system_views
from .user import views as user_views

# all API endpoints
urlpatterns = [
    path("health", system_views.health, name="health"),
    # user endpoints
    path("user/login", user_views.login, name="login"),
    path("user/me", user_views.me, name="me"),
]
