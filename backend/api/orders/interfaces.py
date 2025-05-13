from enum import Enum


class OrderStatus(str, Enum):
    """Defines standardized names for OrderStatus."""

    PAYMMENT_PENDING = "pago pendiente"
    TRANSFER_PENDING = "transferencia por confirmar"
    SHOP_PENDING = "esperando confirmacion en tienda"
    WAREHOUSE_PENDING = "esperando confirmacion en bodega"
    WAREHOUSE_CONFIRMED = "preparando pedido en bodega"
    SHOP_CONFIRMED = "pedido listo en tienda"
    SHOP_CONFIRMED_DELIVERY = "pedido enviado a domicilio"
    SHOP_CONFIRMED_PICKUP = "pedido listo para retiro"
    COMPLETED = "pedido entregado"
    CANCELLED = "pedido cancelado"

    ALL = [
        PAYMMENT_PENDING,
        TRANSFER_PENDING,
        SHOP_PENDING,
        WAREHOUSE_PENDING,
        WAREHOUSE_CONFIRMED,
        SHOP_CONFIRMED,
        SHOP_CONFIRMED_DELIVERY,
        SHOP_CONFIRMED_PICKUP,
        COMPLETED,
        CANCELLED,
    ]


class OrderType(str, Enum):
    """Defines standardized names for OrderType."""

    DELIVERY = "envio a domicilio"
    PICKUP = "retiro en tienda"

    ALL = [DELIVERY, PICKUP]


class OrderPaymentMethod(str, Enum):
    """Defines standardized names for OrderPaymentMethod."""

    TRANSFER = "transferencia bancaria"
    WEB = "pasarela de pago"

    ALL = [TRANSFER, WEB]
