import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CartService } from '../../../services/cart.service';
import { OrderService } from '../../../services/order.service';
import { first } from 'rxjs/operators';

@Component({
  selector: 'app-payment-result',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payment-result.component.html',
  styleUrls: ['./payment-result.component.scss']
})
export class PaymentResultComponent implements OnInit, OnDestroy {

  paymentStatus: 'processing' | 'success' | 'failure' | 'error' | 'unknown' | 'transfer_pending' = 'processing';
  message: string = '';
  buyOrder: string | null = null;
  amount: string | null = null;
  isTransferPendingInitially: boolean = false;

  loadingTitle: string = 'Iniciando proceso...';
  loadingDescription: string = 'Por favor, espera un momento.';
  progress: number = 0;

  private isTransferFlow: boolean = false;

  private navigationTimeout: any;
  private progressInterval: any;
  private processingTimeout: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private cartService: CartService,
    private orderServive: OrderService
  ) {}

  ngOnInit(): void {
    const localWebpayStatus = localStorage.getItem('webpay_payment_status');
    if (localWebpayStatus === 'pending') {
        localStorage.setItem('webpay_payment_status', 'processed');
    }

    this.route.queryParamMap.pipe(first()).subscribe(params => {
        const statusParam = params.get('status');
        this.buyOrder = params.get('orden_compra');
        this.amount = params.get('monto');

        if (statusParam === 'transfer_pending') {
            this.isTransferFlow = true;
            this.isTransferPendingInitially = true;
        }

        this.startLoadingSimulation();
    });
  }

  startLoadingSimulation(): void {
    this.paymentStatus = 'processing';
    this.progress = 0;

    this.loadingTitle = this.isTransferFlow ? 'Recibiendo tu orden...' : 'Preparando tu orden...';
    this.loadingDescription = this.isTransferFlow ? 'Estamos registrando los datos para la transferencia.' : 'Estamos validando la información.';

    this.progressInterval = setInterval(() => {
      this.progress += 5;

      if (this.progress === 30) {
        this.loadingTitle = this.isTransferFlow ? 'Validando datos...' : 'Confirmando pago...';
        this.loadingDescription = this.isTransferFlow ? 'Verificando la información de la transferencia.' : 'Esto puede tardar unos segundos.';
      } else if (this.progress === 70) {
        this.loadingTitle = this.isTransferFlow ? 'Generando orden pendiente...' : 'Finalizando...';
        this.loadingDescription = this.isTransferFlow ? 'Tu orden quedará pendiente de confirmación.' : 'Casi listo.';
      }

      if (this.progress >= 100) {
        clearInterval(this.progressInterval);
        this.progress = 100;
        this.processingTimeout = setTimeout(() => {
            this.processPaymentResult();
        }, 500);
      }
    }, 150);
  }

  processPaymentResult(): void {
    this.route.queryParamMap.pipe(first()).subscribe(async params => {
        const statusParam = params.get('status');
        this.buyOrder = params.get('orden_compra');
        this.amount = params.get('monto');
        const motivo = params.get('motivo');

        if (statusParam === 'transfer_pending') {
            this.paymentStatus = 'transfer_pending';
            this.message = `Tu solicitud de transferencia por un monto de $${this.amount || 'N/A'} ha sido recibida.`;
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
              if (statusParam === 'aborted') failureReason = "Cancelaste el pago.";
              if (statusParam === 'abandoned') failureReason = "El proceso fue interrumpido.";
              if (motivo) failureReason += ` Motivo: ${motivo}.`;
              this.message = failureReason;
              if (this.buyOrder) this.message += ` Orden: ${this.buyOrder}.`;
              try {
                await this.orderServive.clearOrder();
              }
              catch (error) {
                console.error('Error al limpiar el carrito:', error);
              }
              break;
            case 'error':
            case 'exception':
            case 'unknown_response':
              this.paymentStatus = 'error';
              let errorReason = "Ocurrió un error durante el proceso.";
              if (motivo) errorReason += ` Motivo: ${motivo}.`;
              this.message = errorReason;
              break;
            default:
              if (!this.isTransferPendingInitially) {
                this.paymentStatus = 'unknown';
                this.message = 'No se pudo determinar el estado final. Contacta a soporte.';
                if (this.buyOrder) this.message += ` Orden: ${this.buyOrder}.`;
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
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }
     if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
    }
  }
}
