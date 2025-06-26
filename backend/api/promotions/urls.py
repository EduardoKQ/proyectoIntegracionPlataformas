from django.urls import path
from . import views

urlpatterns = [
    path('', views.promotion_list_create, name='promotion_list_create'),
    path('active/', views.active_promotions, name='active_promotions'),
    path('<int:promotion_id>/', views.promotion_detail_by_id, name='promotion_detail_by_id'),
    path('<str:promotion_code>/', views.promotion_detail, name='promotion_detail'),
]