import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

const API_BASE_URL = 'http://localhost:8100/api';

export interface OrderItemPayload {
  product_code: string;
  quantity: number;
}

export interface OrderPayload {
  payment_type: string;
  retrieval_type: string;
  shipping_address?: string | null;
  shipping_cost?: number | null;
  branch_code: string;
  items: OrderItemPayload[];
}

export interface OrderItemResponse {
  product_code: string;
  product_name: string;
  product_brand: string;
  quantity: number;
  transaction_price: string;
}

export interface OrderResponse {
  order_id: number;
  client_email: string | null;
  payment_type: string;
  retrieval_type: string;
  shipping_address: string | null;
  shipping_cost: string | null;
  pickup_branch_name: string | null;
  order_status: string;
  creation_date: string;
  delivery_date: string | null;
  order_items: OrderItemResponse[];
  total_amount?: string;
}

export interface OrderStatus {
  'internal-name': string;
  value: string;
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private http = inject(HttpClient);
  private orderApiUrl = `${API_BASE_URL}/orders`;

  constructor(
    private authService: AuthService
  ) { }

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getAccessToken();
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  createOrder(orderData: OrderPayload): Observable<OrderResponse> {
    return this.http.post<OrderResponse>(this.orderApiUrl, orderData);
  }

  getOrders(): Observable<OrderResponse[]> {
    const timestamp = Date.now();
    return this.http.get<OrderResponse[]>(`${this.orderApiUrl}?_=${timestamp}`);
  }

  getOrderStatuses(): Observable<OrderStatus[]> {
    return this.http.get<OrderStatus[]>(`${this.orderApiUrl}/statuses`);
  }

  updateOrderStatus(orderId: number, statusName: string): Observable<{ message: string }> {
    const body = { order_status: statusName };
    return this.http.put<{ message: string }>(`${this.orderApiUrl}/${orderId}`, body);
  }

  async clearOrder(): Promise<boolean> {
    try {
      let orderId = localStorage.getItem('webpay_order_id_pending');
      if (!orderId) {
        console.warn('No order ID found in local storage.');
        return false;
      }
      await this.http.delete<{ message: string }>(`${this.orderApiUrl}/${orderId}`);
      localStorage.removeItem('webpay_order_id_pending');
      console.log('Order cleared successfully.');
      return true;
    }
    catch {
      return false;
    }

  }

  nextOrderStatus(orderId: string): Observable<OrderResponse> {
    // Remove async/await and lastValueFrom, return the Observable directly.
    return this.http.post<OrderResponse>(`${this.orderApiUrl}/${orderId}/next`, {}, {
      headers: this.getAuthHeaders()
    });
  }

  cancelOrder(orderId: string): Observable<OrderResponse> {
    return this.http.post<OrderResponse>(`${this.orderApiUrl}/${orderId}/cancel`, {}, {
      headers: this.getAuthHeaders()
    });
  }
}
