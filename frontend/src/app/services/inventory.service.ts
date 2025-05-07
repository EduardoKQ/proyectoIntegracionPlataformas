import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

export interface InventoryItem {
  branch_code: string;
  branch_name: string;
  product_code: string;
  product_name: string;
  quantity: number;
}

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private inventoryApiUrl = 'http://localhost:8100/api/inventory';

  constructor(private http: HttpClient) { }

  getInventory(): Observable<InventoryItem[]> {
    return this.http.get<InventoryItem[]>(this.inventoryApiUrl)
      .pipe(
        tap(data => console.log('Inventario completo recibido (InventoryService):', data)),
        catchError(this.handleError)
      );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Ocurrió un error desconocido al obtener el inventario.';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error del cliente o de red: ${error.error.message}`;
    } else {
      if (error.status === 0) {
        errorMessage = 'No se pudo conectar con el servidor. Verifique su red e inténtelo de nuevo.';
      } else if (error.error && typeof error.error.detail === 'string') {
        errorMessage = `Error ${error.status} (${error.statusText}): ${error.error.detail}`;
      } else if (error.error && typeof error.error === 'string') {
        errorMessage = `Error ${error.status} (${error.statusText}): ${error.error}`;
      } else if (error.message) {
        errorMessage = `Error ${error.status} (${error.statusText}): ${error.message}.`;
      } else {
        errorMessage = `Error del servidor ${error.status} (${error.statusText}). Por favor, intente más tarde.`;
      }
    }
    console.error('Error en InventoryService:', errorMessage, error);
    return throwError(() => new Error(errorMessage));
  }
}
