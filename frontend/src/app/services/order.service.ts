import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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

  constructor() { }

  createOrder(orderData: OrderPayload): Observable<OrderResponse> {
    return this.http.post<OrderResponse>(this.orderApiUrl, orderData);
  }

  getOrders(): Observable<OrderResponse[]> {
    return this.http.get<OrderResponse[]>(this.orderApiUrl);
  }

  getOrderStatuses(): Observable<OrderStatus[]> {
    return this.http.get<OrderStatus[]>(`${this.orderApiUrl}/statuses`);
  }

  updateOrderStatus(orderId: number, statusName: string): Observable<{ message: string }> {
    const body = { order_status: statusName };
    return this.http.put<{ message: string }>(`${this.orderApiUrl}/${orderId}`, body);
  }
}
