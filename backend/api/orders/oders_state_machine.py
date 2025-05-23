from .interfaces import OrderStatus
from typing import Dict, Set

class OrderStateMachine:
    def __init__(self, initial_state: OrderStatus):
        if not isinstance(initial_state, OrderStatus):
            raise ValueError("Initial state must be a valid OrderStatus enum member.")
        self.current_state = initial_state
        self._transitions: Dict[OrderStatus, Set[OrderStatus]] = self._define_transitions()

    def _define_transitions(self) -> Dict[OrderStatus, Set[OrderStatus]]:
        """
        Allowed transitions between order states.
        """
        transitions = {
            # Example: From PAYMENT_PENDING, can go to TRANSFER_PENDING, SHOP_PENDING, or CANCELLED
            OrderStatus.PAYMENT_PENDING:{
                OrderStatus.SHOP_PENDING,
            },
            OrderStatus.TRANSFER_PENDING: {
                OrderStatus.SHOP_PENDING,
            },
            OrderStatus.SHOP_PENDING: {
                OrderStatus.WAREHOUSE_PENDING,
                OrderStatus.CANCELLED,
            },
            OrderStatus.WAREHOUSE_PENDING: {
                OrderStatus.WAREHOUSE_CONFIRMED,
            },
            OrderStatus.WAREHOUSE_CONFIRMED: {
                OrderStatus.SHOP_CONFIRMED,
            },
            OrderStatus.SHOP_CONFIRMED: {
                OrderStatus.SHOP_CONFIRMED_DELIVERY,
                OrderStatus.SHOP_CONFIRMED_PICKUP,
            },
            OrderStatus.SHOP_CONFIRMED_DELIVERY: {
                OrderStatus.COMPLETED,
            },
            OrderStatus.COMPLETED: set(), # Terminal state
            OrderStatus.CANCELLED: set(), # Terminal state
        }
        # Ensure all states are present as keys, even if they have no outgoing transitions (terminal states)
        for status in OrderStatus:
            if status not in transitions:
                transitions[status] = set()
        return transitions

    def can_transition_to(self, next_state: OrderStatus) -> bool:
        """Checks if a transition from the current state to the next_state is allowed."""
        if not isinstance(next_state, OrderStatus):
            return False
        return next_state in self._transitions.get(self.current_state, set())

    def transition_to(self, next_state: OrderStatus) -> None:
        """
        Attempts to transition to the next_state.
        Raises ValueError if the transition is not allowed.
        """
        if not isinstance(next_state, OrderStatus):
            raise ValueError(f"Invalid next state: {next_state}. Must be an OrderStatus enum member.")

        if self.can_transition_to(next_state):
            # Optional: Add pre-transition actions here
            previous_state = self.current_state
            self.current_state = next_state
            # Optional: Add post-transition actions here
            print(f"Order transitioned from {previous_state.value} to {self.current_state.value}")
        else:
            raise ValueError(f"Invalid transition from {self.current_state.value} to {next_state.value}")

    def get_current_state(self) -> OrderStatus:
        return self.current_state