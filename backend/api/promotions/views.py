from rest_framework.decorators import api_view
from django.http import JsonResponse

from api.user.web_role_names import WebRoleNames
from .utils import (
    process_promotion_list_get,
    process_promotion_create_post,
    process_promotion_detail_get,
    process_promotion_update_put,
    process_promotion_delete,
    process_promotion_detail_get_by_id,
    process_promotion_update_put_by_id,
    process_promotion_delete_by_id,
    process_promotion_detail_get_by_id,
    process_promotion_update_put_by_id,
    process_promotion_delete_by_id
)
from api.user.role_permision import check_auth_allowed_role

@api_view(["GET", "POST"])
def promotion_list_create(request):
    """
    GET: Listar todas las promociones (público)
    POST: Crear nueva promoción (solo admin)
    """
    if request.method == "GET":
        return process_promotion_list_get(request)
    
    if request.method == "POST":
        allowed_roles = [WebRoleNames.ADMIN_TIENDA]
        auth_response = check_auth_allowed_role(request, allowed_roles)
        if auth_response is not None:
            return auth_response
        return process_promotion_create_post(request)

@api_view(["GET", "PUT", "DELETE"])
def promotion_detail(request, promotion_code):
    """
    GET: Obtener detalle de promoción (público)
    PUT: Actualizar promoción (solo admin)
    DELETE: Eliminar promoción (solo admin)
    """
    if request.method == "GET":
        return process_promotion_detail_get(request, promotion_code)
    if request.method in ["PUT", "DELETE"]:
        allowed_roles = [WebRoleNames.ADMIN_TIENDA]
        auth_response = check_auth_allowed_role(request, allowed_roles)
        if auth_response is not None:
            return auth_response
        
        if request.method == "PUT":
            return process_promotion_update_put(request, promotion_code)
        elif request.method == "DELETE":
            return process_promotion_delete(request, promotion_code)

@api_view(["GET"])
def active_promotions(request):
    """Obtener solo promociones activas (público)"""
    # Crear una copia mutable de los parámetros GET
    mutable_params = request.GET.copy()
    mutable_params['active_only'] = 'true'
    request.GET = mutable_params
    return process_promotion_list_get(request)

@api_view(["GET", "PUT", "DELETE"])
def promotion_detail_by_id(request, promotion_id):
    """
    GET: Obtener detalle de promoción por ID (público)
    PUT: Actualizar promoción por ID (solo admin)
    DELETE: Eliminar promoción por ID (solo admin)
    """
    if request.method == "GET":
        return process_promotion_detail_get_by_id(request, promotion_id)
    
    if request.method in ["PUT", "DELETE"]:
        allowed_roles = [WebRoleNames.ADMIN_TIENDA]
        auth_response = check_auth_allowed_role(request, allowed_roles)
        if auth_response is not None:
            return auth_response
        
        if request.method == "PUT":
            return process_promotion_update_put_by_id(request, promotion_id)
        elif request.method == "DELETE":
            return process_promotion_delete_by_id(request, promotion_id)