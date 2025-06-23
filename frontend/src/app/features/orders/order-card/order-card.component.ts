import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderResponse, OrderService, OrderStatus } from '../../../services/order.service';
import { finalize } from 'rxjs';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-order-card',
  templateUrl: './order-card.component.html',
  styleUrls: ['./order-card.component.scss'],
  imports: [CommonModule],
})
export class OrderCardComponent implements OnInit {
  @Input() order!: OrderResponse;
  @Output() orderUpdated = new EventEmitter<boolean>();

  // --- UI State Properties ---
  isUpdating = false;
  updateError: string | null = null;
  showContinueButton = false;
  showCancelButton = false;
  showConfirmDeliveryButton = false;

  // Use constructor property promotion for cleaner dependency injection
  constructor(
    public authService: AuthService,
    private orderService: OrderService
  ) { }

  ngOnInit(): void {
    // On component load, determine which action buttons to display
    this.processOrderStatus();
  }

  /**
   * Updates the local state of the order and re-evaluates button visibility.
   * @param updatedOrder The fresh order data from the backend.
   */
  private handleSuccessfulUpdate(updatedOrder: OrderResponse): void {
    // By using Object.assign, we update the properties of the original 'order'
    // object. Since objects are passed by reference, the parent component's
    // list is updated, and Angular's change detection refreshes the UI.
    Object.assign(this.order, updatedOrder);
    this.processOrderStatus(); // Re-check which buttons should be visible
    this.isUpdating = false;
  }

  /**
   * Handles errors from the API call.
   * @param errorMessage The error message to display.
   */
  private handleUpdateError(errorMessage: string): void {
    this.updateError = errorMessage;
    this.isUpdating = false;
  }

  /**
   * Calls the service to advance the order to its next state.
   */
  continueButtonClicked(): void {
    this.isUpdating = true;
    this.updateError = null;

    this.orderService.nextOrderStatus(String(this.order.order_id)).subscribe({
      next: (updatedOrder) => this.handleSuccessfulUpdate(updatedOrder),
      error: (err) => this.handleUpdateError(err.error?.error || 'Error al avanzar la orden.'),
    });

    this.orderUpdated.emit(true);
    this.disableButtons();
  }

  /**
   * Calls the service to cancel the order.
   */
  cancelButtonClicked(): void {
    this.isUpdating = true;
    this.updateError = null;

    this.orderService.cancelOrder(String(this.order.order_id)).subscribe({
      next: (updatedOrder) => this.handleSuccessfulUpdate(updatedOrder),
      error: (err) => this.handleUpdateError(err.error?.error || 'Error al cancelar la orden.'),
    });

    this.orderUpdated.emit(true);
    this.disableButtons();
  }
  disableButtons() {
    // Disable buttons to prevent multiple clicks while the request is processing
    this.showContinueButton = false;
    this.showCancelButton = false;
    this.showConfirmDeliveryButton = false;
    // make the unclickable and grey
  }

  /**
   * Determines which action buttons to show based on order status and user role.
   */
  private processOrderStatus(): void {
    const userRole = this.authService.getCurrentUserRole();
    const status = this.order.order_status;

    // This logic should match your backend state machine
    // to do: handle all possible statuses and roles from backend to render here
    this.showContinueButton = false;
    this.showCancelButton = false;
    this.showConfirmDeliveryButton = false;

    if (userRole === 'vendedor') {
      switch (status) {
        case 'esperando confirmacion en tienda':
          this.showContinueButton = true;
          this.showCancelButton = true;
          return;
        case 'preparando pedido en tienda':
          this.showContinueButton = true;
          return;
        case 'preparando pedido en bodega':
          this.showContinueButton = true;
          return;
        case 'pedido listo para retiro':
          this.showContinueButton = true;
          return;
        case 'pedido enviado a domicilio':
          this.showContinueButton = true;
          return;
      }
    }
    else if (userRole === 'bodeguero') {
      switch (status) {
        case 'esperando confirmacion en bodega':
          this.showContinueButton = true;
          return;
        case 'preparando pedido en bodega':
          return;
      }
    }

    else if (userRole === 'contador') {
      switch (status) {
        case 'transferencia por confirmar':
          this.showContinueButton = true;
          this.showCancelButton = true;
          return;
      }

    }
  }

  // The original component had this method, which seems to be a duplicate
  // of the logic in continueButtonClicked. It's kept here for reference.
  async confirmDeliveryButtonClicked(): Promise<void> {
    console.log('Confirm delivery button clicked for order:', this.order.order_id);
    this.continueButtonClicked();
  }
}