from django.urls import path, include
from .system import views as system_views
from .user import views as user_views
from .products import views as product_views
from .inventory import views as inventory_views
from .orders import views as order_views
from rest_framework_simplejwt.views import TokenRefreshView
from .webpay.views_webpay import iniciar_pago_webpay, retorno_pago_webpay

# all API endpoints
urlpatterns = [
    path("health", system_views.health, name="health"),
    path("user/token-refresh", TokenRefreshView.as_view(), name="token_refresh"),
    # user endpoints
    path("user/login", user_views.login, name="login"),
    path("user/me", user_views.me, name="me"),
    path("user/register-client", user_views.register_client, name="register_client"),
    # products related endpoints
    path("products", product_views.products_list_create, name="products_list_create"),
    path(
        "products/<str:product_code>",
        product_views.products_get_update_delete,
        name="products_get_update_delete",
    ),
    # categories and subcategories endpoints
    path("categories", product_views.category_list_create, name="category_list_create"),
    path(
        "categories/<str:category_code>",
        product_views.category_get_update_delete,
        name="category_get_update_delete",
    ),
    path(
        "subcategories",
        product_views.subcategory_list_create,
        name="subcategory_list_create",
    ),
    path(
        "subcategories/<str:subcategory_code>",
        product_views.subcategory_get_update_delete,
        name="subcategory_get_update_delete",
    ),
    # branches endpoints
    path("branches", inventory_views.branch_list_create, name="branch_list_create"),
    path(
        "branches/<str:branch_code>",
        inventory_views.branch_get_update_delete,
        name="branch_get_update_delete",
    ),
    # inventory endpoints
    path("inventory", inventory_views.inventory_list, name="inventory_list"),
    path(
        "inventory/<str:branch_code>",
        inventory_views.inventory_by_branch,
        name="inventory_by_branch",
    ),
    path(
        "inventory/<str:branch_code>/<str:product_code>",
        inventory_views.inventory_get_update_quantity,
        name="inventory_get_update_quantity",
    ),
    # webpay endpoints
    path("webpay/iniciar_pago/", iniciar_pago_webpay, name="webpay_iniciar_pago"),
    path("webpay/retorno/", retorno_pago_webpay, name="webpay_retorno_pago"),
    # orders endpoints
    path("orders", order_views.orders_list_create, name="orders_list_create"),
    path(
        "orders/statuses",
        order_views.order_get_statuses,
        name="order_get_statuses",
    ),
    path(
        "orders/<str:order_code>",
        order_views.orders_get_delete_by_id,
        name="orders_get_delete_by_id",
    ),
    path(
        "orders/<str:order_code>/next",
        order_views.orders_next_status,
        name="orders_next_status",
    ),
    path(
        "orders/<str:order_code>/cancel",
        order_views.orders_cancel,
        name="orders_cancel",
    ),
    # maps endpoints
    path("maps/", include("api.maps.urls_map")),
]
# testing only !!! later remove these endpoints
urlpatterns += [
    path("system/user-roles", system_views.user_roles, name="user_roles"),
]
