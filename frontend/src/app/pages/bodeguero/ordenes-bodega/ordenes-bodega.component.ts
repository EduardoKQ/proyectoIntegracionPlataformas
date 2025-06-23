import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { OrderService, OrderResponse, OrderStatus } from '../../../services/order.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderCardComponent } from '../../../features/orders/order-card/order-card.component';

@Component({
  selector: 'app-ordenes-bodega',
  standalone: true,
  imports: [CommonModule, FormsModule, OrderCardComponent],
  templateUrl: './ordenes-bodega.component.html',
  styleUrl: './ordenes-bodega.component.scss'
})
export class OrdenesBodegaComponent implements OnInit {
  orders: OrderResponse[] = [];
  statuses: OrderStatus[] = [];
  isLoading = true;
  error: string | null = null;

  constructor(
    private orderService: OrderService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadStatusesAndOrders();
  }

  loadStatusesAndOrders(): void {
    this.isLoading = true;
    this.error = null;
    this.orderService.getOrderStatuses().subscribe({
      next: (statusData) => {
        this.statuses = statusData;
        this.loadOrders();
      },
      error: (err) => {
        console.error('Error fetching statuses:', err);
        this.error = 'No se pudieron cargar los estados de orden. No se puede continuar.';
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  loadOrders(): void {
    this.isLoading = true;
    this.orderService.getOrders().subscribe({
      next: (data) => {
        this.orders = data;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error fetching orders:', err);
        this.error = 'No se pudieron cargar las órdenes. Intente más tarde.';
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * This method is called when an order card emits an update event.
   * It triggers a reload of the entire order list to reflect all changes.
   */
  onOrderUpdate(): void {
    console.log('Order updated from card, reloading all orders...');
    window.location.reload(); //!!! to change
  }
}