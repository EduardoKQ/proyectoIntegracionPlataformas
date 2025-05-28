import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, Observable, map } from 'rxjs';
import { CartService, CartItem } from '../../../services/cart.service';
import { WebpayService, WebpayInitResponse } from '../../../services/webpay.service';
import { CommonModule } from '@angular/common';
import { DeliveryAddress } from '../../../features/shared/components/address-modal/address-modal.component';
import { Branch } from '../../../services/branch.service';
import { OrderService, OrderPayload, OrderItemPayload, OrderResponse } from '../../../services/order.service';

export interface BankDetailsObject {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  rut: string;
  email?: string;
  logoUrl?: string;
}

@Component({
  selector: 'app-payment-method',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payment-method.component.html',
  styleUrls: ['./payment-method.component.scss']
})
export class PaymentMethodComponent implements OnInit, OnDestroy {
  public cartService = inject(CartService);
  private webpayService = inject(WebpayService);
  private orderService = inject(OrderService);
  private router = inject(Router);

  subtotalAmount$: Observable<number>;
  shippingCost$: Observable<number | null>;
  totalAmount$: Observable<number>;
  deliveryMode$: Observable<'pickup' | 'delivery'>;

  selectedPaymentMethod: 'webpay' | 'transferencia' | null = null;
  isProcessingPayment: boolean = false;
  paymentError: string | null = null;
  bankDetails: string = "Banco Santander - Ferremas - Cuenta Corriente: 75344988 - RUT: 69.924-337-1 - Email: pagos@ferremas.com";

  private subscriptions: Subscription = new Subscription();

  constructor() {
    this.subtotalAmount$ = this.cartService.getProductSubtotal();
    this.shippingCost$ = this.cartService.shippingCost$;
    this.totalAmount$ = this.cartService.getGrandTotal();
    this.deliveryMode$ = this.cartService.deliveryMode$;
  }

  ngOnInit(): void {
    const cartItems = this.cartService.getCurrentCartItems();
    if (!cartItems || cartItems.length === 0) {
      console.warn("PaymentMethod: Carrito vacío, volviendo a /cart.");
      this.router.navigate(['/cart']);
      return;
    }

    const mode = this.cartService.getCurrentDeliveryMode();
    const address = this.cartService.getCurrentDeliveryAddress();
    const cost = this.cartService.getCurrentShippingCost();

    if (mode === 'delivery' && (!address || cost === null)) {
      console.warn("PaymentMethod: Falta dirección o costo de envío, volviendo a /cart.");
      this.router.navigate(['/cart']);
      return;
    }
  }

  selectPaymentMethod(method: 'webpay' | 'transferencia'): void {
    this.selectedPaymentMethod = method;
    this.paymentError = null;
  }

  private generateFrontendOrderNumber(): string {
    return `FE-ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  confirmPayment(): void {
    if (!this.selectedPaymentMethod) {
      this.paymentError = "Por favor, selecciona un método de pago.";
      return;
    }
    this.isProcessingPayment = true;
    this.paymentError = null;

    const subtotal = this.cartService.getCurrentProductSubtotal();
    const shippingCost = this.cartService.getCurrentShippingCost();
    const amountToPay = subtotal + (shippingCost || 0);

    if (amountToPay <= 0) {
      this.paymentError = "El monto a pagar debe ser mayor a cero.";
      this.isProcessingPayment = false;
      return;
    }

    const cartItems = this.cartService.getCurrentCartItems();
    const deliveryMode = this.cartService.getCurrentDeliveryMode();
    const deliveryAddress = this.cartService.getCurrentDeliveryAddress();
    const currentBranch = this.cartService.getCurrentSelectedBranch();

    if (!currentBranch) {
        this.paymentError = "No se ha seleccionado una sucursal de operación. Vuelve al carrito.";
        this.isProcessingPayment = false;
        return;
    }

    const orderItemsPayload: OrderItemPayload[] = cartItems.map(item => ({
      product_code: item.product_code,
      quantity: item.quantity,
      // not needed
      // transaction_price: item.price
    }));

    const orderPayload: OrderPayload = {
      payment_type: this.selectedPaymentMethod === 'webpay' ? 'pasarela de pago' : 'transferencia bancaria',
      retrieval_type: deliveryMode === 'delivery' ? 'envio a domicilio' : 'retiro en tienda',
      shipping_address: deliveryAddress ? deliveryAddress.fullAddress : null,
      shipping_cost: shippingCost? shippingCost : 0,
      branch_code: currentBranch.branch_code,
      items: orderItemsPayload
    };

    this.orderService.createOrder(orderPayload).subscribe({
      next: (createdOrder: OrderResponse) => {
        console.log('Orden creada exitosamente en backend:', createdOrder);
        const buyOrderForPayment = createdOrder.order_id ? `${createdOrder.order_id}` : this.generateFrontendOrderNumber();
        this.saveOrderToLocalStorage(buyOrderForPayment);
        if (this.selectedPaymentMethod === 'webpay') {
          this.proceedToWebpay(buyOrderForPayment, amountToPay);
        } else if (this.selectedPaymentMethod === 'transferencia') {
          this.handleTransferPayment(buyOrderForPayment, amountToPay, createdOrder);
        }
      },
      error: (err) => {
        console.error('Error al crear la orden en el backend:', err);
        this.paymentError = err.error?.error || err.error?.errors?.detail || err.message || "No se pudo crear tu pedido en el sistema. Intenta nuevamente.";
        this.isProcessingPayment = false;
      }
    });
  }
  saveOrderToLocalStorage(buyOrderForPayment: string) {
    localStorage.setItem('webpay_order_id_pending', buyOrderForPayment);
    console.log('Orden guardada en localStorage con ID:', buyOrderForPayment);
  }

  private handleTransferPayment(orderNumber: string, amountToPay: number, createdOrder: OrderResponse): void {
    this.cartService.clearCart();
    this.router.navigate(['/payment-result'], {
      queryParams: {
        status: 'transfer_pending',
        order_id: createdOrder.order_id.toString(),
        orden_compra_pago: orderNumber,
        monto: amountToPay.toString()
      }
    });
  }

  private proceedToWebpay(orderNumber: string, amountToPay: number): void {
    localStorage.setItem('webpay_order_id_pending', orderNumber);
    this.webpayService.initTransaction(amountToPay, orderNumber).subscribe(
      (response: WebpayInitResponse) => {
        if (response && response.token && response.url) {
          window.location.href = `${response.url}?token_ws=${response.token}`;
        } else {
          this.isProcessingPayment = false;
          this.paymentError = response.details || response.error || 'Error al iniciar Webpay. Respuesta inválida.';
          localStorage.removeItem('webpay_order_id_pending');
        }
      },
      (error) => {
        this.isProcessingPayment = false;
        this.paymentError = error.message || 'Error de comunicación con Webpay.';
        localStorage.removeItem('webpay_order_id_pending');
        console.error('Error Webpay Init:', error);
      }
    );
  }

  parseBankDetail(detailsString: string, key: 'bankName' | 'accountHolder' | 'accountNumber' | 'rut' | 'email', defaultValue: string = ''): string {
    if (!detailsString) return defaultValue;
    let match;
    switch (key) {
        case 'bankName': match = detailsString.match(/^([^-]+?)\s*-/); return match ? match[1].trim() : defaultValue;
        case 'accountHolder': match = detailsString.match(/^([^-]+?)\s*-\s*([^-]+?)\s*-/); return match && match[2] ? match[2].trim() : defaultValue;
        case 'accountNumber': match = detailsString.match(/Cuenta Corriente:\s*([\d-]+)/i); return match ? match[1].trim() : defaultValue;
        case 'rut': match = detailsString.match(/RUT:\s*([\d.-]+K?)/i); return match ? match[1].trim() : defaultValue;
        case 'email': match = detailsString.match(/Email:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i); return match ? match[1].trim() : defaultValue;
        default: return defaultValue;
    }
  }

  volverAtras(): void {
    this.router.navigate(['/cart']);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
