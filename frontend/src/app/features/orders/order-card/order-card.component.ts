import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderResponse } from '../../../services/order.service'; // Adjust the import path as necessary
import { OrderService, OrderStatus } from '../../../services/order.service';
import { finalize } from 'rxjs';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-order-card',
  templateUrl: './order-card.component.html',
  styleUrls: ['./order-card.component.scss'],
  imports: [CommonModule],
})
export class OrderCardComponent {
  @Input() order!: OrderResponse;

  showContinueButton = false;
  showCancelButton = false;
  showConfirmDeliveryButton = false;
  authService: AuthService;

  constructor(
    authService: AuthService,
    private orderService: OrderService,
  ) {
    this.authService = authService;

  }


  ngOnInit(): void {
    // when we load the order we process what buttons to show
    console.log('OrderCardComponent received:', this.order);
    this.processOrderStatus();
  }

  private processOrderStatus(): void {
    let userRole = this.authService.getCurrentUserRole(); // Assuming this function retrieves the current user's role
    console.log('userRole', userRole);

    this.showContinueButton = false;
    this.showCancelButton = false;
    this.showConfirmDeliveryButton = false;

    if (userRole == 'vendedor') {
      console.log("check para vendedor");

      switch (this.order.order_status) {
        case 'esperando confirmacion en tienda':
          this.showContinueButton = true;
          this.showCancelButton = true;
          return;
        case 'preparando pedido en tienda':
          this.showContinueButton = true;
          return;
        case 'pedido listo para retiro':
          this.showConfirmDeliveryButton = true;
          return;
        case 'pedido enviado a domicilio':
          this.showConfirmDeliveryButton = true;
          return;
      }
    } else if (userRole == 'bodeguero') {
      console.log("check para bodeguero");

      // If the user is a warehouse worker, we don't show any buttons
      this.showContinueButton = false;
      this.showCancelButton = false;
      return;
    } else if (userRole == 'contador') {
      console.log("check para contador");

      // If the user is an accountant, we don't show any buttons
      this.showContinueButton = false;
      this.showCancelButton = false;
      return;
    }
  }

  isUpdating = false;
  updateError: string | null = null;


  updateStatus(newStatus: OrderStatus): void {
    this.isUpdating = true;
    this.updateError = null;

    // this.orderService.updateOrderStatus(this.order.order_id, newStatus)
    //   .pipe(
    //     finalize(() => this.isUpdating = false)
    //   )
    //   .subscribe({
    //     next: (updatedOrder) => {
    //       // The order object is updated with the response from the server
    //       //this.order = updatedOrder;
    //     },
    //     error: (err) => {
    //       console.error('Failed to update order status', err);
    //       this.updateError = 'Could not update the order. Please try again.';
    //     }
    //   });
  }


  async continueButtonClicked(): Promise<void> {
    // spinner loading
    this.isUpdating = true;
    this.updateError = null;

    console.log('Continue button clicked for order:', this.order.order_id);
    let status, result = await this.orderService.nextStatus(String(this.order.order_id));

    if (!status) {
      this.updateError = 'No response received from server.';
      console.error('No response received from server.');
      this.isUpdating = false;
      return;
    }
    console.log('Order status updated successfully:', result.message);

  }

  async cancelButtonClicked(): Promise<void> {
    console.log('Cancel button clicked for order:', this.order.order_id);
    // spinner loading
    this.isUpdating = true;
    this.updateError = null;

    console.log('Cancel button clicked for order:', this.order.order_id);
    let status, result = await this.orderService.cancelOrder(String(this.order.order_id));

    if (!status) {
      this.updateError = 'No response received from server.';
      console.error('No response received from server.');
      this.isUpdating = false;
      return;
    }
    console.log('Order status updated successfully:', result.message);
  }

  confirmDeliveryButtonClicked(): void {
    console.log('Confirm delivery button clicked for order:', this.order.order_id);
    // Implement the logic to confirm the delivery of the order
    // For example, you might want to update the order status or navigate to another page
  }





}
