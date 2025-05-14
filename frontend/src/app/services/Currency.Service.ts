import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type SupportedCurrency = 'CLP' | 'USD';

@Injectable({
  providedIn: 'root'
})
export class CurrencyService {
  private static readonly CURRENCY_STORAGE_KEY = 'userSelectedCurrency';
  private selectedCurrencySubject: BehaviorSubject<SupportedCurrency>;

  public selectedCurrency$: Observable<SupportedCurrency>;

  constructor() {
    const storedCurrency = localStorage.getItem(CurrencyService.CURRENCY_STORAGE_KEY) as SupportedCurrency | null;
    const initialCurrency: SupportedCurrency = storedCurrency || 'CLP';
    this.selectedCurrencySubject = new BehaviorSubject<SupportedCurrency>(initialCurrency);
    this.selectedCurrency$ = this.selectedCurrencySubject.asObservable();
  }

  setSelectedCurrency(currency: SupportedCurrency): void {
    if (currency === this.selectedCurrencySubject.value) {
      return;
    }
    this.selectedCurrencySubject.next(currency);
    localStorage.setItem(CurrencyService.CURRENCY_STORAGE_KEY, currency);
    console.log(`Moneda cambiada a: ${currency}`);
  }

  getCurrentCurrency(): SupportedCurrency {
    return this.selectedCurrencySubject.value;
  }
}
