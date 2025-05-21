import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type PaymentStatus = 'idle' | 'pending' | 'processed' | null;

@Injectable({
  providedIn: 'root'
})
export class PaymentStatusService {
  private paymentStatusSubject = new BehaviorSubject<PaymentStatus>(this.getInitialStatus());
  public paymentStatus$: Observable<PaymentStatus> = this.paymentStatusSubject.asObservable();

  constructor() {
    window.addEventListener('storage', this.handleStorageChange.bind(this));
  }

  private getInitialStatus(): PaymentStatus {
    return localStorage.getItem('webpay_payment_status') as PaymentStatus || 'idle';
  }

  private handleStorageChange(event: StorageEvent): void {
    if (event.key === 'webpay_payment_status') {
      this.paymentStatusSubject.next(event.newValue as PaymentStatus);
    }
  }

  public getCurrentStatus(): PaymentStatus {
    return this.paymentStatusSubject.value;
  }

  public setStatus(status: PaymentStatus): void {
    if (status) {
      localStorage.setItem('webpay_payment_status', status);
    } else {
      localStorage.removeItem('webpay_payment_status');
    }
    this.paymentStatusSubject.next(status);
  }

  public clearPendingStatus(): void {
    if (this.getCurrentStatus() === 'pending') {
      this.setStatus('processed');
    }
  }
}
