import enum
from .interfaces import OrderStatus, OrderType
from api.user.web_role_names import WebRoleNames
from api.models import Order
from typing import Dict, Set, List, Optional
from dataclasses import dataclass


@dataclass
class TransitionRule:
    next_state: OrderStatus
    allowed_roles: Set[WebRoleNames]
    action: "Action"
    pickup_type: Optional[OrderType] = None


# action enum
class Action(enum.Enum):
    CONTINUE = "continue"
    CANCEL = "cancel"
    REJECT = "reject"


# main class
class OrderStateMachine:
    def __init__(self, order: Order):
        try:
            current_order_status_value = order.order_status
            self.current_state = OrderStatus(current_order_status_value)
        except ValueError:
            raise ValueError(
                f"SM. La orden tiene un estado de orden inválido: '{current_order_status_value}'"
            )

        # Convert order.retrieval_type string to OrderType enum
        if order.retrieval_type:
            try:
                self.retrieval_type = OrderType(order.retrieval_type)
            except ValueError:
                raise ValueError(
                    f"SM. La orden tiene un tipo de retiro inválido: '{order.retrieval_type}'"
                )
        else:
            self.retrieval_type = None

        self._transitions: Dict[OrderStatus, List[TransitionRule]] = (
            self._define_transitions()
        )

    def _define_transitions(self) -> Dict[OrderStatus, List[TransitionRule]]:
        """
        Allowed transitions between order states.
        """
        transitions: Dict[OrderStatus, List[TransitionRule]] = {
            OrderStatus.PAYMMENT_PENDING: [
                TransitionRule(
                    next_state=OrderStatus.SHOP_PENDING,
                    allowed_roles={WebRoleNames.ADMIN_TIENDA, WebRoleNames.CLIENTE},
                    action=Action.CONTINUE,
                ),
                TransitionRule(
                    next_state=OrderStatus.CANCELLED,
                    allowed_roles={WebRoleNames.ADMIN_TIENDA, WebRoleNames.CLIENTE},
                    action=Action.CANCEL,
                ),
            ],
            OrderStatus.TRANSFER_PENDING: [
                TransitionRule(
                    next_state=OrderStatus.SHOP_PENDING,
                    allowed_roles={WebRoleNames.ADMIN_TIENDA, WebRoleNames.CONTADOR},
                    action=Action.CONTINUE,
                ),
                TransitionRule(
                    next_state=OrderStatus.CANCELLED,
                    allowed_roles={WebRoleNames.ADMIN_TIENDA, WebRoleNames.CONTADOR},
                    action=Action.CANCEL,
                ),
            ],
            OrderStatus.SHOP_PENDING: [
                TransitionRule(
                    next_state=OrderStatus.WAREHOUSE_PENDING,
                    allowed_roles={WebRoleNames.ADMIN_TIENDA, WebRoleNames.VENDEDOR},
                    action=Action.CONTINUE,
                ),
                TransitionRule(
                    next_state=OrderStatus.CANCELLED,
                    allowed_roles={WebRoleNames.ADMIN_TIENDA, WebRoleNames.VENDEDOR},
                    action=Action.CANCEL,
                ),
            ],
            OrderStatus.WAREHOUSE_PENDING: [
                TransitionRule(
                    next_state=OrderStatus.WAREHOUSE_CONFIRMED,
                    allowed_roles={WebRoleNames.ADMIN_TIENDA, WebRoleNames.BODEGUERO},
                    action=Action.CONTINUE,
                ),
            ],
            OrderStatus.WAREHOUSE_CONFIRMED: [
                TransitionRule(
                    next_state=OrderStatus.SHOP_CONFIRMED,
                    allowed_roles={WebRoleNames.ADMIN_TIENDA, WebRoleNames.VENDEDOR},
                    action=Action.CONTINUE,
                ),
            ],
            OrderStatus.SHOP_CONFIRMED: [
                TransitionRule(
                    next_state=OrderStatus.SHOP_CONFIRMED_DELIVERY,
                    allowed_roles={WebRoleNames.ADMIN_TIENDA, WebRoleNames.VENDEDOR},
                    action=Action.CONTINUE,
                    pickup_type=OrderType.DELIVERY,
                ),
                TransitionRule(
                    next_state=OrderStatus.SHOP_CONFIRMED_PICKUP,
                    allowed_roles={WebRoleNames.ADMIN_TIENDA, WebRoleNames.VENDEDOR},
                    action=Action.CONTINUE,
                    pickup_type=OrderType.PICKUP,
                ),
            ],
            OrderStatus.SHOP_CONFIRMED_DELIVERY: [
                TransitionRule(
                    next_state=OrderStatus.COMPLETED,
                    allowed_roles={WebRoleNames.ADMIN_TIENDA, WebRoleNames.VENDEDOR},
                    action=Action.CONTINUE,
                ),
            ],
            OrderStatus.SHOP_CONFIRMED_PICKUP: [
                TransitionRule(
                    next_state=OrderStatus.COMPLETED,
                    allowed_roles={WebRoleNames.ADMIN_TIENDA, WebRoleNames.VENDEDOR},
                    action=Action.CONTINUE,
                ),
            ],
            OrderStatus.COMPLETED: [],  # Terminal state
            OrderStatus.CANCELLED: [],  # Terminal state
        }
        # Ensure all OrderStatus members are keys in the transitions dictionary
        for status_member in OrderStatus:
            if status_member not in transitions:
                transitions[status_member] = []
        return transitions

    def _find_matching_rule(
        self, role_str: str, action_str: str
    ) -> Optional[TransitionRule]:
        """
        Finds a transition rule for the current state, role string, and action string.
        Converts role_str and action_str to their respective enum types for comparison.
        """
        try:
            # Convert input strings to enum members for comparison
            role_enum = WebRoleNames(role_str)
            action_enum = Action(action_str)
        except ValueError:
            # If the string doesn't match any enum member
            return None

        possible_rules = self._transitions.get(self.current_state, [])
        for rule in possible_rules:
            # rule.allowed_roles is Set[WebRoleNames] (enum members)
            # rule.action is Action (enum member)
            if role_enum in rule.allowed_roles and action_enum == rule.action:
                # Check pickup_type if the rule specifies one
                if rule.pickup_type is not None:
                    # self.retrieval_type is OrderType enum member or None
                    if self.retrieval_type == rule.pickup_type:
                        return rule
                else:  # Rule doesn't care about pickup_type
                    return rule
        return None

    def get_possible_actions(self, role_str: str) -> List[Dict[str, str]]:
        """
        Returns a list of possible actions (as strings) and their target states (as strings)
        for the given role string from the current state. Useful for UI.
        """
        try:
            role_enum = WebRoleNames(role_str)
        except ValueError:
            return []  # Invalid role string, so no actions

        possible_rules = self._transitions.get(self.current_state, [])
        allowed_actions_info = []
        for rule in possible_rules:
            if role_enum in rule.allowed_roles:
                if rule.pickup_type is not None:
                    if self.retrieval_type == rule.pickup_type:
                        allowed_actions_info.append(
                            {
                                "action": rule.action.value,
                                "next_state": rule.next_state.value,
                            }
                        )
                else:
                    allowed_actions_info.append(
                        {
                            "action": rule.action.value,
                            "next_state": rule.next_state.value,
                        }
                    )
        return allowed_actions_info

    def transition(self, role: str, action: str) -> None:
        """
        Attempts to transition to the next state based on the current state, role, and action.
        Updates the current_state if successful.
        Raises ValueError if the transition is not allowed or if role/action strings are invalid.
        """
        matching_rule = self._find_matching_rule(role, action)

        if matching_rule:
            previous_state = self.current_state
            self.current_state = matching_rule.next_state
            #!!!
            print(
                f"Order (logic) transitioned from {previous_state.value} to {self.current_state.value} via action '{action}' by role '{role}'"
            )
            return self.current_state
            # The actual saving of the order model to DB happens outside this class.
            # Example: print(f"Order (logic) transitioned from {previous_state.value} to {self.current_state.value} via action '{action}' by role '{role}'")
        else:
            # Provide a more specific error message
            error_message_detail = ""
            try:
                # Check if role and action strings are valid enum values first
                WebRoleNames(role)
                Action(action)
                # If they are valid, but no rule matched:
                error_message_detail = (
                    f"No valid transition rule found from state '{self.current_state.value}' "
                    f"with action '{action}' for role '{role}'. "
                    f"Order retrieval type: '{self.retrieval_type.value if self.retrieval_type else 'N/A'}'."
                )
            except ValueError:
                # If role or action string itself is not a valid enum member
                error_message_detail = f"Invalid role ('{role}') or action ('{action}') string provided for transition."

            raise ValueError(error_message_detail)

    def can_perform_action(self, role: str, action: str) -> bool:
        """
        Checks if the given role can perform the specified action from the current state.
        Returns True if a valid transition rule exists, False otherwise.
        """
        return self._find_matching_rule(role, action) is not None

    def get_current_state(self) -> OrderStatus:
        return self.current_state
