import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CartService } from '../../../services/cart.service';

@Component({
  selector: 'app-payment-result',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payment-result.component.html',
  styleUrls: ['./payment-result.component.scss']
})
export class PaymentResultComponent implements OnInit, OnDestroy {

  paymentStatus: 'success' | 'failure' | 'error' | 'unknown' | 'transfer_pending' = 'unknown';
  message: string = 'Procesando resultado del pago...';
  buyOrder: string | null = null;
  amount: string | null = null;
  isTransferPendingInitially: boolean = false;

  private navigationTimeout: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private cartService: CartService
  ) {}

  ngOnInit(): void {
    const localWebpayStatus = localStorage.getItem('webpay_payment_status');
    if (localWebpayStatus === 'pending') {
        localStorage.setItem('webpay_payment_status', 'processed');
    }

    this.route.queryParamMap.subscribe(params => {
      const statusParam = params.get('status');
      this.buyOrder = params.get('orden_compra');
      this.amount = params.get('monto');
      const motivo = params.get('motivo');

      if (statusParam === 'transfer_pending') {
        this.paymentStatus = 'transfer_pending';
        this.isTransferPendingInitially = true;
        this.message = `Tu orden de compra ${this.buyOrder || 'N/A'} con transferencia por un monto de $${this.amount || 'N/A'} ha sido recibida.`;
        return;
      }

      switch (statusParam) {
        case 'success':
          this.paymentStatus = 'success';
          this.message = `¡Pago Aceptado! Orden de Compra: ${this.buyOrder || 'N/A'}.`;
          if (this.amount) {
            this.message += ` Monto: $${this.amount}.`;
          }
          this.cartService.clearCart();

          this.navigationTimeout = setTimeout(() => {
            this.router.navigate(['/home']);
          }, 7000);
          break;
        case 'failure':
        case 'aborted':
        case 'abandoned':
          this.paymentStatus = 'failure';
          let failureReason = "Tu pago no pudo ser completado o fue cancelado.";
          if (statusParam === 'aborted') failureReason = "Cancelaste el pago en Webpay.";
          if (statusParam === 'abandoned') failureReason = "El proceso de pago fue interrumpido o abandonado.";
          if (motivo) failureReason += ` Motivo: ${motivo}.`;
          this.message = failureReason;
          if (this.buyOrder) this.message += ` Orden: ${this.buyOrder}.`;
          break;

        case 'error':
        case 'exception':
        case 'unknown_response':
          this.paymentStatus = 'error';
          let errorReason = "Ocurrió un error durante el proceso de pago.";
          if (motivo) errorReason += ` Motivo: ${motivo}.`;
          this.message = errorReason;
          break;
        default:
          if (!this.isTransferPendingInitially) {
            this.paymentStatus = 'unknown';
            this.message = 'No se pudo determinar el estado final de tu pago. Por favor, revisa el estado de tu orden o contacta a soporte.';
            if (this.buyOrder) this.message += ` Orden de referencia: ${this.buyOrder}.`;
          }
          break;
      }
    });
  }

  goToCart(): void {
    this.router.navigate(['/cart']);
  }

  goToHome(): void {
    this.router.navigate(['/home']);
  }

  ngOnDestroy(): void {
    if (this.navigationTimeout) {
      clearTimeout(this.navigationTimeout);
    }
  }
}
