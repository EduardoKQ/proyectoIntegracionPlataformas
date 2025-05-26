from django.urls import path
from .views_map import ShippingCalculationView

urlpatterns = [
    path('calculate-shipping/', ShippingCalculationView.as_view(), name='calculate_shipping'),
]