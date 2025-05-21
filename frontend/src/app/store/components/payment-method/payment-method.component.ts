import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CartService } from '../../../services/cart.service';
import { WebpayService, WebpayInitResponse } from '../../../services/webpay.service';
import { CommonModule } from '@angular/common';

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

  totalAmount: number = 0;
  private priceSubscription!: Subscription;
  selectedPaymentMethod: 'webpay' | 'transferencia' | null = null;
  isProcessingPayment: boolean = false;
  paymentError: string | null = null;
  bankDetails: string = "Banco Santander - Ferremas - Cuenta Corriente: 75344988 - RUT: 69.924-337-1 - Email: pagos@ferremas.com";
  subtotalAmount: number = 0;
  shippingCost: number = 0;

  constructor(
    public cartService: CartService,
    private webpayService: WebpayService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.priceSubscription = this.cartService.getTotalPrice().subscribe(price => {
      this.totalAmount = Math.round(price);
      this.subtotalAmount = this.totalAmount;

      if (this.cartService.getCurrentCartItems().length === 0 && this.totalAmount <= 0) {
      }
    });
  }

  selectPaymentMethod(method: 'webpay' | 'transferencia'): void {
    this.selectedPaymentMethod = method;
    this.paymentError = null;
  }

  private generateOrderNumber(): string {
    return `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  confirmPayment(): void {
    if (!this.selectedPaymentMethod) {
      this.paymentError = "Por favor, selecciona un método de pago.";
      return;
    }
    if (this.totalAmount <= 0) {
        this.paymentError = "El monto a pagar debe ser mayor a cero.";
        return;
    }

    const orderNumber = this.generateOrderNumber();

    if (this.selectedPaymentMethod === 'webpay') {
      this.proceedToWebpay(orderNumber);
    } else if (this.selectedPaymentMethod === 'transferencia') {
      this.isProcessingPayment = true;
      setTimeout(() => {
        this.cartService.clearCart();
        this.router.navigate(['/payment-result'], {
          queryParams: {
            status: 'transfer_pending',
            orden_compra: orderNumber,
            monto: this.totalAmount.toString()
          }
        });
        this.isProcessingPayment = false;
      }, 1000);
    }
  }

  private proceedToWebpay(orderNumber: string): void {
    this.isProcessingPayment = true;
    this.paymentError = null;

    localStorage.setItem('webpay_payment_status', 'pending');
    localStorage.setItem('webpay_order_id', orderNumber);
    this.webpayService.initTransaction(this.totalAmount, orderNumber).subscribe(
      (response: WebpayInitResponse) => {
        if (response && response.token && response.url) {
          localStorage.setItem('webpay_token', response.token);
          const redirectUrl = `${response.url}?token_ws=${response.token}`;
          window.location.href = redirectUrl;
        } else {
          this.isProcessingPayment = false;
          this.paymentError = response.details || response.error || 'Error al iniciar el pago Webpay. Respuesta inválida.';
          localStorage.removeItem('webpay_payment_status');
          localStorage.removeItem('webpay_token');
          localStorage.removeItem('webpay_order_id');
        }
      },
      (error) => {
        this.isProcessingPayment = false;
        this.paymentError = error.message || 'Error de comunicación al intentar iniciar pago Webpay.';
        localStorage.removeItem('webpay_payment_status');
        localStorage.removeItem('webpay_token');
        localStorage.removeItem('webpay_order_id');
        console.error('Error Webpay Init:', error);
      }
    );
  }

  parseBankDetail(detailsString: string, key: 'bankName' | 'accountHolder' | 'accountNumber' | 'rut' | 'email', defaultValue: string = ''): string {
    if (!detailsString) return defaultValue;
    let match;
    switch (key) {
      case 'bankName':
        match = detailsString.match(/^([^-]+?)\s*-/);
        return match ? match[1].trim() : defaultValue;
      case 'accountHolder':
        match = detailsString.match(/^([^-]+?)\s*-\s*([^-]+?)\s*-/);
        return match && match[2] ? match[2].trim() : defaultValue;
      case 'accountNumber':
        match = detailsString.match(/Cuenta Corriente:\s*([\d-]+)/i);
        return match ? match[1].trim() : defaultValue;
      case 'rut':
        match = detailsString.match(/RUT:\s*([\d.-]+K?)/i);
        return match ? match[1].trim() : defaultValue;
      case 'email':
        match = detailsString.match(/Email:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
        return match ? match[1].trim() : defaultValue;
      default:
        return defaultValue;
    }
  }

  ngOnDestroy(): void {
    if (this.priceSubscription) {
      this.priceSubscription.unsubscribe();
    }
  }
}
