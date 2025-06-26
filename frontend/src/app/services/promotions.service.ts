import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  Promotion,
  CreatePromotionRequest,
  UpdatePromotionRequest,
  ProductWithPromotion,
  OrderWithDiscounts
} from './promotions.interfaces';

@Injectable({
  providedIn: 'root'
})
export class PromotionsService {
  private apiUrl = 'http://localhost:8100/api';
  private promotionsApiUrl = `${this.apiUrl}/promotions/`;
  constructor(private http: HttpClient) { }

  getPromotions(): Observable<Promotion[]> {
    return this.http.get<Promotion[]>(this.promotionsApiUrl)
      .pipe(
        catchError(this.handleError)
      );
  }

  getPromotionById(id: number): Observable<Promotion> {
    const url = `${this.promotionsApiUrl}${id}/`;
    return this.http.get<Promotion>(url)
      .pipe(
        catchError(this.handleError)
      );
  }

  getPromotionByCode(code: string): Observable<Promotion> {
    const url = `${this.promotionsApiUrl}code/${code}`;
    return this.http.get<Promotion>(url)
      .pipe(
        catchError(this.handleError)
      );
  }

  createPromotion(promotionData: CreatePromotionRequest): Observable<Promotion> {
    console.log('PromotionsService - Datos a enviar:', JSON.stringify(promotionData, null, 2));
    console.log('PromotionsService - Tipo de promotion_code:', typeof promotionData.promotion_code);
    console.log('PromotionsService - promotion_code value:', promotionData.promotion_code);
    return this.http.post<Promotion>(this.promotionsApiUrl, promotionData)
      .pipe(
        catchError(this.handleError)
      );
  }

  updatePromotion(id: number, promotionData: UpdatePromotionRequest): Observable<Promotion> {
    const url = `${this.promotionsApiUrl}${id}/`;
    return this.http.put<Promotion>(url, promotionData)
      .pipe(
        catchError(this.handleError)
      );
  }

  deletePromotion(id: number): Observable<void> {
    const url = `${this.promotionsApiUrl}${id}/`;
    return this.http.delete<void>(url)
      .pipe(
        catchError(this.handleError)
      );
  }

  getActivePromotions(): Observable<Promotion[]> {
    const url = `${this.promotionsApiUrl}active/?include_details=true`;
    return this.http.get<Promotion[]>(url)
      .pipe(
        catchError(this.handleError)
      );
  }

  activatePromotion(id: number): Observable<Promotion> {
    const url = `${this.promotionsApiUrl}${id}/activate/`;
    return this.http.patch<Promotion>(url, {})
      .pipe(
        catchError(this.handleError)
      );
  }

  deactivatePromotion(id: number): Observable<Promotion> {
    const url = `${this.promotionsApiUrl}${id}/deactivate/`;
    return this.http.patch<Promotion>(url, {})
      .pipe(
        catchError(this.handleError)
      );
  }

  getProductsWithPromotions(): Observable<ProductWithPromotion[]> {
    const url = `${this.apiUrl}/products/with-promotions`;
    return this.http.get<ProductWithPromotion[]>(url)
      .pipe(
        catchError(this.handleError)
      );
  }

  getProductWithPromotions(productCode: string): Observable<ProductWithPromotion> {
    const url = `${this.apiUrl}/products/${productCode}/with-promotions`;
    return this.http.get<ProductWithPromotion>(url)
      .pipe(
        catchError(this.handleError)
      );
  }

  getProductsOnSale(): Observable<ProductWithPromotion[]> {
    const url = `${this.apiUrl}/products/on-sale`;
    return this.http.get<ProductWithPromotion[]>(url)
      .pipe(
        catchError(this.handleError)
      );
  }

  addProductsToPromotion(promotionId: number, productCodes: string[]): Observable<any> {
    const url = `${this.promotionsApiUrl}${promotionId}/products`;
    return this.http.post(url, { product_ids: productCodes })
      .pipe(
        catchError(this.handleError)
      );
  }

  removeProductsFromPromotion(promotionId: number, productCodes: string[]): Observable<any> {
    const url = `${this.promotionsApiUrl}${promotionId}/products`;
    return this.http.delete(url, { body: { product_ids: productCodes } })
      .pipe(
        catchError(this.handleError)
      );
  }

  addCategoriesToPromotion(promotionId: number, categoryCodes: string[]): Observable<any> {
    const url = `${this.promotionsApiUrl}${promotionId}/categories`;
    return this.http.post(url, { category_ids: categoryCodes })
      .pipe(
        catchError(this.handleError)
      );
  }

  removeCategoriesFromPromotion(promotionId: number, categoryCodes: string[]): Observable<any> {
    const url = `${this.promotionsApiUrl}${promotionId}/categories`;
    return this.http.delete(url, { body: { category_ids: categoryCodes } })
      .pipe(
        catchError(this.handleError)
      );
  }

  getOrderWithDiscounts(orderId: number): Observable<OrderWithDiscounts> {
    const url = `${this.apiUrl}/orders/${orderId}/with-discounts`;
    return this.http.get<OrderWithDiscounts>(url)
      .pipe(
        catchError(this.handleError)
      );
  }

  getPromotionsWithDetails(): Observable<Promotion[]> {
    const url = `${this.promotionsApiUrl}?include_details=true`;
    return this.http.get<Promotion[]>(url)
      .pipe(
        catchError(this.handleError)
      );
  }

  calculateDiscountedPrice(originalPrice: number, discountType: 'percentage' | 'fixed_amount', discountValue: number): number {
    if (discountType === 'percentage') {
      return originalPrice * (1 - discountValue / 100);
    } else {
      return Math.max(0, originalPrice - discountValue);
    }
  }

  calculateDiscountPercentage(originalPrice: number, discountedPrice: number): number {
    if (originalPrice <= 0) return 0;
    return ((originalPrice - discountedPrice) / originalPrice) * 100;
  }

  formatDiscount(discountType: 'percentage' | 'fixed_amount', discountValue: number): string {
    if (discountType === 'percentage') {
      return `${discountValue}% OFF`;
    } else {
      return `$${discountValue.toLocaleString()} OFF`;
    }
  }

  isPromotionActive(promotion: Promotion): boolean {
    const now = new Date();
    const startDate = new Date(promotion.start_date);
    const endDate = new Date(promotion.end_date);

    return promotion.status === 'active' &&
           now >= startDate &&
           now <= endDate;
  }

  getDaysRemaining(endDate: string): number {
    const now = new Date();
    const end = new Date(endDate);
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }


  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Ocurrió un error desconocido';

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      switch (error.status) {
        case 400:
          console.error('Error 400 details:', error.error);
          errorMessage = error.error?.error || error.error?.message || 'Solicitud incorrecta. Verifica los datos enviados.';
          break;
        case 401:
          errorMessage = 'No autorizado. Inicia sesión nuevamente.';
          break;
        case 403:
          errorMessage = 'Acceso denegado. No tienes permisos para esta acción.';
          break;
        case 404:
          errorMessage = 'Promoción no encontrada.';
          break;
        case 409:
          errorMessage = 'Conflicto. La promoción ya existe o hay un conflicto de datos.';
          break;
        case 500:
          errorMessage = 'Error interno del servidor. Intenta nuevamente más tarde.';
          break;
        default:
          errorMessage = `Error ${error.status}: ${error.message}`;
      }

      if (error.error && error.error.message) {
        errorMessage = error.error.message;
      }
    }

    console.error('Error en PromotionsService:', errorMessage, error);
    return throwError(() => errorMessage);
  }
}
