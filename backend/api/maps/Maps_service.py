import googlemaps
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

LOCAL_MAX_DISTANCE_KM = 5
LOCAL_SHIPPING_COST = 1500
LOCAL_EXTRA_KM_COST = 200

REGIONAL_MAX_DISTANCE_KM = 30
REGIONAL_SHIPPING_COST = 2500
REGIONAL_EXTRA_KM_COST = 150

NACIONAL_BASE_SHIPPING_COST = 4000
NACIONAL_EXTRA_KM_COST = 100

def calculate_shipping_cost(distance_km):
    """Calcula el costo de envío basado en la distancia y las tarifas definidas."""
    if distance_km <= LOCAL_MAX_DISTANCE_KM:
        return LOCAL_SHIPPING_COST
    elif distance_km <= REGIONAL_MAX_DISTANCE_KM:
        return LOCAL_SHIPPING_COST + max(0, round((distance_km - LOCAL_MAX_DISTANCE_KM) * LOCAL_EXTRA_KM_COST))
    else:
        return NACIONAL_BASE_SHIPPING_COST + round((distance_km - REGIONAL_MAX_DISTANCE_KM) * NACIONAL_EXTRA_KM_COST)

def get_shipping_info(origin_address, destination_address):
    """
    Calcula la distancia y duración entre dos direcciones usando Google Maps.
    Devuelve un diccionario con la info o None si hay error.
    """
    api_key = settings.MAPS_API_KEY

    if not api_key:
        logger.error("LA CLAVE API DE GOOGLE MAPS NO ESTÁ CONFIGURADA (MAPS_API_KEY).")
        return None

    try:
        gmaps = googlemaps.Client(key=api_key)

        matrix_result = gmaps.distance_matrix(
            origins=[origin_address],
            destinations=[destination_address],
            mode="driving",
            units="metric",
            language="es-CL"
        )

        logger.debug(f"Respuesta de Google Maps: {matrix_result}")

        if matrix_result['status'] == 'OK' and matrix_result['rows'][0]['elements'][0]['status'] == 'OK':
            element = matrix_result['rows'][0]['elements'][0]
            distance = element['distance']
            duration = element['duration']

            distance_km = distance['value'] / 1000
            shipping_cost = calculate_shipping_cost(distance_km)

            return {
                'distance_text': distance['text'],
                'distance_value': distance['value'],
                'duration_text': duration['text'],
                'duration_value': duration['value'],
                'cost': shipping_cost,
                'origin_address_maps': matrix_result['origin_addresses'][0],
                'destination_address_maps': matrix_result['destination_addresses'][0],
            }
        else:
            status_code = matrix_result['rows'][0]['elements'][0].get('status', 'UNKNOWN')
            logger.warning(f"No se pudo calcular la distancia. Status Google: {status_code}")
            return None

    except googlemaps.exceptions.ApiError as e:
        logger.error(f"Error de API de Google Maps: {e}")
        return None
    except Exception as e:
        logger.error(f"Error inesperado al calcular envío: {e}")
        return None