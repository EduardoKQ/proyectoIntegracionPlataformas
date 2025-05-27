from django.shortcuts import redirect
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
import uuid
import json


# Importaciones de Transbank SDK
from transbank.webpay.webpay_plus.transaction import Transaction
from transbank.common.options import WebpayOptions
from transbank.common.integration_type import IntegrationType

from api.models import Inventory, Order, OrderItem
from api.orders.interfaces import OrderStatus

# --- Función Helper para obtener la transacción de Webpay ---
def get_webpay_plus_transaction():
    env_to_use = IntegrationType.TEST

    if settings.TRANSBANK_ENVIRONMENT == "PRODUCCION":
        env_to_use = IntegrationType.LIVE
    elif settings.TRANSBANK_ENVIRONMENT == "INTEGRACION":
        env_to_use = IntegrationType.TEST
    options = WebpayOptions(
        settings.TRANSBANK_WEBPAY_PLUS_COMMERCE_CODE,
        settings.TRANSBANK_WEBPAY_PLUS_API_KEY,
        env_to_use
    )
    tx = Transaction(options)
    
    return tx

# --- Vista para INICIAR la transacción en Webpay ---
@csrf_exempt
def iniciar_pago_webpay(request):
    print("--- Iniciando vista iniciar_pago_webpay ---")
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            amount_to_pay = int(data.get('amount'))
            order_id = data.get('order_id', None)            
            
            if amount_to_pay is None or amount_to_pay <= 0:
                print(f"[ERROR] Monto inválido o no proporcionado: {data.get('amount')}")
                return JsonResponse({'error': 'Monto inválido o no proporcionado.'}, status=400)

            # check that order_id is currently created and not paid
            if order_id:
                try:
                    order = Order.objects.get(order_id=order_id)
                    order_status = order.order_status
                    print(f"[INFO] Orden encontrada: {order_id}, Estado: {order_status}")
                    if order_status != OrderStatus.PAYMMENT_PENDING.value:
                        print(f"[ERROR] Orden con ID {order_id} no está en estado 'PAYMMENT_PENDING'. Estado actual: {order_status}")
                        return JsonResponse({'error': f'Orden con ID {order_id} no está en estado "{OrderStatus.PAYMMENT_PENDING.value}". Estado actual: {order_status}'}, status=400)
                except Order.DoesNotExist:
                    print(f"[ERROR] Orden con ID {order_id} no encontrada o no está en estado 'pago pendiente'.")
                    return JsonResponse({'error': f'Orden con ID {order_id} no encontrada o no está en estado "pago pendiente".'}, status=404)
            else:
                print("[ERROR] No se proporcionó un order_id válido.")
                return JsonResponse({'error': 'No se proporcionó un order_id válido.'}, status=400)
            
            # check that amount_to_pay is the same as the order amount
            def get_total_amount(obj: Order) -> float:
                items_total = sum(item.quantity * item.transaction_price for item in obj.order_items.all())
                shipping_cost = obj.shipping_cost if obj.shipping_cost is not None else 0.00
                total = float(items_total) + float(shipping_cost)
                return round(total, 2)
            order_total_amount = get_total_amount(order)
            if amount_to_pay != order_total_amount:
                print(f"[ERROR] Monto proporcionado {amount_to_pay} no coincide con el monto de la orden {order_total_amount}.")
                return JsonResponse({'error': f'Monto proporcionado {amount_to_pay} no coincide con el monto de la orden: {order_total_amount}.'}, status=400)
        except (json.JSONDecodeError, TypeError, ValueError) as e:
            print(f"[ERROR] Error al procesar el cuerpo de la solicitud (amount): {e}. Cuerpo recibido: {request.body}")
            return JsonResponse({'error': 'Error al procesar el monto. Se esperaba un JSON con un campo "amount" numérico válido.'}, status=400)
        
        buy_order = order_id
        
        if not request.session.session_key:
            request.session.create()
        session_id = request.session.session_key
        
        return_url = settings.WEBPAY_RETURN_URL
        
        try:
            tx = get_webpay_plus_transaction()
            response = tx.create(buy_order, session_id, amount_to_pay, return_url)

            if response.get("token") and response.get("url"):
                request.session['webpay_buy_order'] = buy_order # Guardar para referencia en caso de abandono
                return JsonResponse({
                    'token': response['token'],
                    'url': response['url']
                })
            else:
                error_details = response.get('error_message', str(response))
                print(f"[ERROR] Error creando transacción en Webpay: {error_details}")
                return JsonResponse({
                    'error': 'Error al crear la transacción en Webpay.',
                    'details': error_details
                }, status=500)

        except Exception as e:
            print(f"[EXCEPTION] Excepción al crear transacción en Webpay: {type(e).__name__} - {e}")
            return JsonResponse({'error': f'Excepción: ({type(e).__name__}, {e})'}, status=500)
    
    return JsonResponse({'error': 'Método no permitido. Se esperaba POST.'}, status=405)


# --- Vista para CONFIRMAR la transacción después del retorno desde Webpay ---
def retorno_pago_webpay(request):
    print("--- Iniciando vista retorno_pago_webpay ---")
    print(f"[INFO] Retorno Webpay - GET params: {request.GET}")
    print(f"[INFO] Retorno Webpay - POST params: {request.POST}")

    token_ws = request.POST.get('token_ws') or request.GET.get('token_ws')
    
    tbk_token_get = request.GET.get('TBK_TOKEN') # Usado si el usuario cancela explícitamente en Webpay
    tbk_orden_compra_post_abandono = request.POST.get('TBK_ORDEN_COMPRA') 

    buy_order_from_webpay = None
    amount_from_webpay = None
    status_param_for_frontend = "unknown" 
    redirect_url_base = settings.FRONTEND_URL_ERROR
    query_params_dict = {"motivo": "procesamiento_inicial_fallido"}

    try:
        if token_ws: # Ahora token_ws puede venir de GET o POST
            print(f"[INFO] Confirmando transacción con token_ws: {token_ws}")
            tx = get_webpay_plus_transaction()
            commit_response = tx.commit(token_ws)
            print(f"[INFO] Respuesta de COMMIT Webpay: {commit_response}")

            buy_order_from_webpay = commit_response.get('buy_order')
            amount_from_webpay = commit_response.get('amount')
            webpay_status = commit_response.get('status')
            response_code = commit_response.get('response_code')

            query_params_dict = {
                "orden_compra": buy_order_from_webpay,
                "monto": amount_from_webpay,
                "motivo": webpay_status,
                "detalle_resp_code": response_code
            }

            if webpay_status == 'AUTHORIZED' and response_code == 0:
                print(f"[SUCCESS] PAGO EXITOSO: Orden {buy_order_from_webpay}, Monto {amount_from_webpay}")
                redirect_url_base = settings.FRONTEND_URL_SUCCESS
                status_param_for_frontend = "success"
                # update order status to PAID
                try:
                    order = Order.objects.get(order_id=buy_order_from_webpay)
                    order.order_status = OrderStatus.SHOP_PENDING.value
                    order.save()
                    print(f"[INFO] Orden {buy_order_from_webpay} actualizada a estado '{OrderStatus.SHOP_PENDING.value}'.")
                except Order.DoesNotExist:
                    print(f"[ERROR] Orden con ID {buy_order_from_webpay} no encontrada para actualizar estado.")
                    query_params_dict["motivo"] = "orden_no_encontrada_para_actualizar_estado"
            else:
                print(f"[FAILURE] PAGO FALLIDO o RECHAZADO: Estado {webpay_status}, Código Resp {response_code}")
                # eliminar la orden de compra de laa sesion
                delete_update_order(buy_order_from_webpay)
                redirect_url_base = settings.FRONTEND_URL_FAILURE
                status_param_for_frontend = "failure"
        
        elif tbk_token_get: # Flujo abortado: El usuario canceló en el formulario de Webpay.
            print(f"[INFO] PAGO ABORTADO (TBK_TOKEN recibido en GET): {tbk_token_get}")
            buy_order_from_webpay = request.session.get('webpay_buy_order', 'desconocida_sesion') 
            redirect_url_base = settings.FRONTEND_URL_FAILURE
            status_param_for_frontend = "aborted"
            query_params_dict = {
                "orden_compra": buy_order_from_webpay,
                "motivo": "abortado_por_usuario_en_webpay"
            }
            delete_update_order(buy_order_from_webpay) # Eliminar la orden de compra de la sesión

        elif tbk_orden_compra_post_abandono: # Flujo de abandono (POST sin token_ws pero con TBK_ORDEN_COMPRA)
            print(f"[INFO] PAGO ABANDONADO (POST sin token_ws, con TBK_ORDEN_COMPRA): {tbk_orden_compra_post_abandono}")
            buy_order_from_webpay = tbk_orden_compra_post_abandono
            redirect_url_base = settings.FRONTEND_URL_FAILURE
            status_param_for_frontend = "abandoned"
            query_params_dict = {
                "orden_compra": buy_order_from_webpay,
                "motivo": "flujo_abandonado_o_interrumpido"
            }
            delete_update_order(buy_order_from_webpay) # Eliminar la orden de compra de la sesión
            
        else: # No se encontró ningún token o identificador esperado.
            print(f"[ERROR] RESPUESTA DESCONOCIDA o INCOMPLETA de Webpay: GET={request.GET}, POST={request.POST}")
            redirect_url_base = settings.FRONTEND_URL_ERROR
            status_param_for_frontend = "unknown_response"
            delete_update_order(buy_order_from_webpay) # Eliminar la orden de compra de la sesión
            query_params_dict = {"motivo": "respuesta_inesperada_o_incompleta_de_webpay"}

    except Exception as e:
        error_exception_message = str(e).replace("\n", " ")
        print(f"[EXCEPTION] Excepción al procesar retorno de Webpay: {type(e).__name__} - {e}")
        redirect_url_base = settings.FRONTEND_URL_ERROR
        status_param_for_frontend = "exception"
        query_params_dict = {
            "motivo": f"excepcion_en_commit_{type(e).__name__}",
            "detalle": error_exception_message
            }
    
    if 'webpay_buy_order' in request.session:
        del request.session['webpay_buy_order']
    
    query_params_string = f"?status={status_param_for_frontend}"
    for key, value in query_params_dict.items():
        if value is not None:
             query_params_string += f"&{key}={value}"
    
    final_redirect_url = f"{redirect_url_base}{query_params_string}"
    print(f"[DJANGO_REDIRECT] Redirigiendo a: {final_redirect_url}")
    return redirect(final_redirect_url)

def delete_update_order(buy_order_from_webpay):
    order = Order.objects.get(order_id=buy_order_from_webpay)
    order_branch_code = order.pickup_branch.branch_code
                # update inventory and then delete the order
    order_items = OrderItem.objects.filter(order=order)
    if order_items:
        for item in order_items:
            item_quantity = item.quantity
            item_product_code = item.product.product_code
                        # update inventory
            inventory_item = Inventory.objects.filter(
                            branch__branch_code=order_branch_code,
                            product__product_code=item_product_code
                        ).first()
            if inventory_item:
                print(f"[INFO] Actualizando inventario: Producto {item_product_code}, Cantidad {item_quantity} en sucursal {order_branch_code}.")
                inventory_item.quantity += item_quantity
                inventory_item.save()
        order_items.delete()
    order.delete()