import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiProduct, CreateProductPayload, UpdateProductPayload } from './product.interfaces';
import { ProductWithPromotion } from './promotions.interfaces';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private apiUrl = 'http://localhost:8100/api';
  private productsApiUrl = `${this.apiUrl}/products`;

  constructor(private http: HttpClient) { }

  getProducts(): Observable<ApiProduct[]> {
    return this.http.get<ApiProduct[]>(this.productsApiUrl)
      .pipe(
        catchError(this.handleError)
      );
  }

  getProductByCode(productCode: string): Observable<ApiProduct> {
    const url = `${this.productsApiUrl}/${productCode}`;
    return this.http.get<ApiProduct>(url)
      .pipe(
        catchError(this.handleError)
      );
  }

  createProduct(productData: CreateProductPayload): Observable<ApiProduct> {
    return this.http.post<ApiProduct>(this.productsApiUrl, productData)
      .pipe(
        catchError(this.handleError)
      );
  }

  updateProduct(productCode: string, productData: UpdateProductPayload): Observable<ApiProduct> {
    const url = `${this.productsApiUrl}/${productCode}`;
    return this.http.put<ApiProduct>(url, productData)
      .pipe(
        catchError(this.handleError)
      );
  }

  deleteProduct(productCode: string): Observable<void> {
    const url = `${this.productsApiUrl}/${productCode}`;
    return this.http.delete<void>(url)
      .pipe(
        catchError(this.handleError)
      );
  }

  getProductsWithPromotions(): Observable<ProductWithPromotion[]> {
    const url = `${this.productsApiUrl}/with-promotions`;
    return this.http.get<ProductWithPromotion[]>(url)
      .pipe(
        catchError(this.handleError)
      );
  }

  getProductWithPromotions(productCode: string): Observable<ProductWithPromotion> {
    const url = `${this.productsApiUrl}/${productCode}/with-promotions`;
    return this.http.get<ProductWithPromotion>(url)
      .pipe(
        catchError(this.handleError)
      );
  }

  getProductsOnSale(): Observable<ProductWithPromotion[]> {
    const url = `${this.productsApiUrl}/on-sale`;
    return this.http.get<ProductWithPromotion[]>(url)
      .pipe(
        catchError(this.handleError)
      );
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Ocurrió un error desconocido.';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error del cliente: ${error.error.message}`;
    } else {
      if (error.status === 0) {
        errorMessage = 'No se pudo conectar con el servidor. Verifique su red e inténtelo de nuevo.';
      } else {
        const errorBody = error.error;
        let backendMessage: string | null = null;

        if (errorBody) {
          if (typeof errorBody.detail === 'string') {
            backendMessage = errorBody.detail;
          } else if (typeof errorBody.error === 'string') {
            backendMessage = errorBody.error;
          } else if (typeof errorBody === 'object' && errorBody !== null) {
            const fieldErrors = Object.entries(errorBody)
              .map(([field, messages]) => `${field}: ${(Array.isArray(messages) ? messages.join(', ') : messages)}`)
              .join('; ');
            if (fieldErrors) {
              backendMessage = fieldErrors;
            }
          } else if (typeof errorBody === 'string') {
            backendMessage = errorBody;
          }
        }
        errorMessage = backendMessage ? `Error ${error.status}: ${backendMessage}` : `Error del servidor ${error.status}. Mensaje: ${error.message}`;
      }
    }
    console.error('Error en ProductService:', errorMessage, error);
    return throwError(() => new Error(errorMessage));
  }
}
