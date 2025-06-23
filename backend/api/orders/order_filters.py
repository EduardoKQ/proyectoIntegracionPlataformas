from typing import List
from django.db.models import Q, QuerySet

from api.models import WebUser, Order, Branch
from api.user.utils import get_worker_branch
from api.user.web_role_names import WebRoleNames
from api.orders.interfaces import OrderStatus, OrderType
from api.orders.orders_state_machine import OrderStateMachine


def get_actionable_statuses_for_role(role_str: str) -> List[str]:
    """
    Determines which order statuses a given role can act upon.
    An order status is actionable if the role can trigger any transition from it.
    """
    actionable_statuses: dict = {
        WebRoleNames.VENDEDOR: [
            OrderStatus.SHOP_PENDING.value,
            OrderStatus.WAREHOUSE_CONFIRMED.value,
            OrderStatus.SHOP_CONFIRMED.value,
            OrderStatus.SHOP_CONFIRMED_DELIVERY.value,
            OrderStatus.SHOP_CONFIRMED_PICKUP.value,
        ],
        WebRoleNames.BODEGUERO: [
            OrderStatus.WAREHOUSE_PENDING.value,
            OrderStatus.WAREHOUSE_CONFIRMED.value,
        ],
        WebRoleNames.CONTADOR: [
            OrderStatus.TRANSFER_PENDING.value,
        ],
    }

    # If the role is not recognized, return an empty list
    if role_str not in actionable_statuses:
        return []
    return actionable_statuses[role_str]


def get_visible_statuses_for_role(role_str: str) -> List[str]:
    visible_statuses: dict = {
        WebRoleNames.ADMIN_TIENDA: OrderStatus.ALL.value,  # Admin can act on all statuses
        WebRoleNames.CLIENTE: OrderStatus.ALL.value,
        WebRoleNames.VENDEDOR: [
            OrderStatus.SHOP_PENDING.value,
            OrderStatus.WAREHOUSE_PENDING.value,
            OrderStatus.WAREHOUSE_CONFIRMED.value,
            OrderStatus.SHOP_CONFIRMED.value,
            OrderStatus.SHOP_CONFIRMED_DELIVERY.value,
            OrderStatus.SHOP_CONFIRMED_PICKUP.value,
            OrderStatus.COMPLETED.value,
            OrderStatus.CANCELLED.value,
        ],
        WebRoleNames.BODEGUERO: [
            OrderStatus.WAREHOUSE_PENDING.value,
            OrderStatus.WAREHOUSE_CONFIRMED.value,
            OrderStatus.SHOP_CONFIRMED.value,
        ],
        WebRoleNames.CONTADOR: [
            OrderStatus.TRANSFER_PENDING.value,
        ],
    }

    # If the role is not recognized, return an empty list
    if role_str not in visible_statuses:
        return []
    return visible_statuses[role_str]


# we use this after we check for admin or client role
def parse_orders_for(user_webuser: WebUser) -> QuerySet[Order]:
    """
    Retrieves orders relevant to the user based on their role, branch,
    and actionable order statuses.
    """
    user_role_str = None
    if hasattr(user_webuser, "role") and user_webuser.role:
        user_role_str = user_webuser.role.role  # e.g., "vendedor", "bodeguero"
    else:
        # User has no role, or role attribute is missing/None
        raise ValueError(
            "El usuario no tiene un rol asignado o el rol es inválido."
            + str(user_role_str)
        )

    user_branch_code = get_worker_branch(user_webuser)
    print(user_webuser.role.role, user_branch_code)

    if not user_branch_code:
        # Worker not assigned to a branch, or role doesn't use branches (e.g., contador)
        raise ValueError(
            "El usuario no tiene una sucursal asignada." + str(user_branch_code)
        )

    try:
        branch_instance = Branch.objects.get(branch_code=user_branch_code)
    except Branch.DoesNotExist:
        return Order.objects.none()  # Branch assigned to worker does not exist

    actionable_statuses = get_actionable_statuses_for_role(user_role_str)

    if not actionable_statuses:
        raise ValueError(
            f"El rol '{user_role_str}' no tiene estados de orden accionables definidos."
        )

    # General case: worker sees orders in their branch that are in an actionable state.
    if user_role_str == WebRoleNames.CONTADOR:
        # Contador can see orders from all branches in their actionable statuses
        orders_queryset = (
            Order.objects.filter(
                order_status__in=actionable_statuses,
            )
            .distinct()
            .order_by("-creation_date")
        )
    else:
        # General case: worker sees orders in their branch that are in an actionable state.
        orders_queryset = (
            Order.objects.filter(
                Q(pickup_branch=branch_instance),
                order_status__in=actionable_statuses,
            )
            .distinct()
            .order_by("-creation_date")
        )

    return orders_queryset


# !!! to be used in the future
# parseVisiblelOrdersForUser
