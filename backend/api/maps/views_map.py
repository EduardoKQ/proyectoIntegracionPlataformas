from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .Maps_service import get_shipping_info
import logging

logger = logging.getLogger(__name__)

# --- Direcciones ficticias (por el momento) ---
BRANCH_ADDRESSES = {
    "san": "Av. Américo Vespucio 1901, Quilicura, Región Metropolitana, Chile", #  Santiago
    "vin": "Arlegui 646, Viña del Mar, Región de Valparaíso, Chile",            #  Viña del Mar

}

class ShippingCalculationView(APIView):
    """
    Vista de API para calcular la distancia y el costo de envío.
    (Versión con direcciones hardcodeadas pero reales)
    """

    def post(self, request, *args, **kwargs):
        """
        Maneja las peticiones POST.
        Extrae la dirección de destino y el código de sucursal,
        busca la dirección de origen en el diccionario y llama al servicio.
        """
        destination_address = request.data.get('destinationAddress')
        branch_code = request.data.get('branchCode')

        if not destination_address:
            return Response(
                {'error': 'Falta la dirección de destino.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not branch_code:
            return Response(
                {'error': 'Falta el código de sucursal (branchCode).'},
                status=status.HTTP_400_BAD_REQUEST
            )

        origin_address = BRANCH_ADDRESSES.get(branch_code)

        if not origin_address:
            logger.warning(f"El código de sucursal '{branch_code}' no fue encontrado en BRANCH_ADDRESSES.")
            return Response(
                {'error': f"El código de sucursal '{branch_code}' no es válido."},
                status=status.HTTP_400_BAD_REQUEST
            )

        logger.info(f"Calculando envío desde '{origin_address}' ({branch_code}) hacia '{destination_address}'.")

        shipping_data = get_shipping_info(origin_address, destination_address)

        if shipping_data:
            shipping_data['origin_branch_code'] = branch_code
            return Response(shipping_data, status=status.HTTP_200_OK)
        else:
            logger.error(f"Fallo al obtener info de Google Maps para {origin_address} -> {destination_address}")
            return Response(
                {'error': 'No se pudo calcular el envío. Verifica las direcciones o la clave API.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )