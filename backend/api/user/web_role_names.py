from enum import Enum


class WebRoleNames(str, Enum):
    """Defines standardized names for WebRoles."""

    # Use names that match the 'role' field values in your WebRoles model/fixtures
    ADMIN_TIENDA = "administrador_tienda"
    CLIENTE = "cliente"
    BODEGUERO = "bodeguero"
    CONTADOR = "contador"
    VENDEDOR = "vendedor"

    ALL = [ADMIN_TIENDA, CLIENTE, BODEGUERO, CONTADOR, VENDEDOR]
    # Add any other roles you have
