import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
export interface WebpayInitResponse {
  token: string;
  url: string;
  error?: string;
  details?: string;
}

@Injectable({
  providedIn: 'root'
})
export class WebpayService {
  private apiUrl = 'http://localhost:8100/api';
  private webpayApiUrl = `${this.apiUrl}/webpay`;

  constructor(private http: HttpClient) { }

  /**
   * Inicia una transacción de Webpay.
   * @param amount El monto a pagar.
   * @param internalBuyOrder (Opcional) Un ID de orden de tu sistema, si quieres enviarlo al backend.
   * El backend actualmente genera su propio UUID para la 'buy_order' de Transbank.
   * @returns Observable con la respuesta del backend (token y URL de Transbank).
   */
  initTransaction(amount: number, internalBuyOrder?: string): Observable<WebpayInitResponse> {
    const payload = {
      amount: amount,
    };

    console.log('WebpayService: Enviando para iniciar transacción:', payload);
    return this.http.post<WebpayInitResponse>(`${this.webpayApiUrl}/iniciar_pago/`, payload)
      .pipe(
        tap(response => console.log('WebpayService: Transacción iniciada, respuesta:', response)),
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
          } else if (typeof errorBody.details === 'string') {
            backendMessage = errorBody.details;
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
    console.error('Error en WebpayService:', errorMessage, error);
    return throwError(() => new Error(errorMessage));
  }
}
