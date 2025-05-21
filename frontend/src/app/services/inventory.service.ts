import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

export interface InventoryItem {
  branch_code: string;
  branch_name: string;
  product_code: string;
  product_name: string;
  quantity: number;
}

export interface UpdateStockPayload {
  quantity: number;
}

export interface UpdateStockResponse {
  message: string;
  error?: boolean;
  errorMessage?: string;
  branch_code?: string;
  product_code?: string;
}

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private apiUrl = 'http://localhost:8100/api';
  private inventoryBaseApiUrl = `${this.apiUrl}/inventory`;

  constructor(
    private http: HttpClient,
  ) { }

  getInventory(): Observable<InventoryItem[]> {
    return this.http.get<InventoryItem[]>(this.inventoryBaseApiUrl)
      .pipe(
        catchError(this.handleError)
      );
  }

  updateInventoryItem(branchCode: string, productCode: string, quantity: number): Observable<UpdateStockResponse> {
    const url = `${this.inventoryBaseApiUrl}/${branchCode}/${productCode}`;
    const payload: UpdateStockPayload = { quantity };
    return this.http.put<UpdateStockResponse>(url, payload)
      .pipe(
        tap(response => {
        }),
        catchError(this.handleError)
      );
  }

  getProductStockInBranch(branchCode: string, productCode: string): Observable<InventoryItem> {
    const url = `${this.inventoryBaseApiUrl}/${branchCode}/${productCode}`;
    return this.http.get<InventoryItem>(url)
      .pipe(
        catchError(this.handleError)
      );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Ocurrió un error desconocido al interactuar con el inventario.';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error del cliente o de red: ${error.error.message}`;
    } else {
      if (error.status === 0) {
        errorMessage = 'No se pudo conectar con el servidor. Verifique su red e inténtelo de nuevo.';
      } else if (error.error && typeof error.error.detail === 'string') {
        errorMessage = `Error ${error.status} (${error.statusText || ''}): ${error.error.detail}`;
      } else if (error.error && typeof error.error.error === 'string') {
        errorMessage = `Error ${error.status} (${error.statusText || ''}): ${error.error.error}`;
      } else if (error.error && typeof error.error.message === 'string') {
        errorMessage = `Error ${error.status} (${error.statusText || ''}): ${error.error.message}`;
      } else if (error.error && typeof error.error === 'string') {
        errorMessage = `Error ${error.status} (${error.statusText || ''}): ${error.error}`;
      } else if (error.message) {
        errorMessage = `Error ${error.status} (${error.statusText || ''}): ${error.message}.`;
      } else {
        errorMessage = `Error del servidor ${error.status} (${error.statusText || ''}). Por favor, intente más tarde.`;
      }
    }
    return throwError(() => new Error(errorMessage));
  }
}
