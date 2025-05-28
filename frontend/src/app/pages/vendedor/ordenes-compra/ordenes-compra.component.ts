import { Component, OnInit } from '@angular/core';
import { OrderService, OrderResponse, OrderStatus } from '../../../services/order.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface OrderWithState extends OrderResponse {
  selectedStatusName: string;
  isUpdating?: boolean;
  updateError?: string | null;
}

@Component({
  selector: 'app-ordenes-compra',
  standalone: true,
  imports: [ CommonModule, FormsModule ],
  templateUrl: './ordenes-compra.component.html',
  styleUrl: './ordenes-compra.component.scss'
})
export class OrdenesCompraComponent implements OnInit {

  orders: OrderWithState[] = [];
  statuses: OrderStatus[] = [];
  isLoading = true;
  error: string | null = null;

  constructor(
    private orderService: OrderService,
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
            this.error = 'Disponible en proximas versiones. Sea paciente 🙏.';
            this.isLoading = false;
        }
    });
  }

  loadOrders(): void {
    this.orderService.getOrders().subscribe({
      next: (data) => {
        this.orders = data.map(order => {
          const currentStatus = this.statuses.find(s => s.value === order.order_status);
          return {
            ...order,
            selectedStatusName: currentStatus ? currentStatus['internal-name'] : ''
          };
        });
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error fetching orders:', err);
        this.error = 'Disponible en proximas versiones. Sea paciente 🙏.';
        this.isLoading = false;
      }
    });
  }

  updateOrderStatus(orderToUpdate: OrderWithState): void {
    if (!orderToUpdate || !orderToUpdate.selectedStatusName) {
        console.warn("No hay estado seleccionado para actualizar.");
        return;
    }

    orderToUpdate.isUpdating = true;
    orderToUpdate.updateError = null;

    this.orderService.updateOrderStatus(orderToUpdate.order_id, orderToUpdate.selectedStatusName).subscribe({
        next: (response) => {
            console.log(`Orden ${orderToUpdate.order_id} actualizada:`, response.message);
            const updatedStatus = this.statuses.find(s => s['internal-name'] === orderToUpdate.selectedStatusName);
            if (updatedStatus) {
                orderToUpdate.order_status = updatedStatus.value;
            }
            orderToUpdate.isUpdating = false;
        },
        error: (err) => {
            console.error(`Error updating order ${orderToUpdate.order_id}:`, err);
            orderToUpdate.updateError = err.error?.error || 'Error al actualizar.';
            orderToUpdate.isUpdating = false;
        }
    });
  }

  isStatusUnchanged(order: OrderWithState): boolean {
      const currentStatus = this.statuses.find(s => s.value === order.order_status);
      return currentStatus ? order.selectedStatusName === currentStatus['internal-name'] : true;
  }
}
