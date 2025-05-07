import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

export interface Branch {
  branch_code: string;
  name: string;
  address: string;
  city: string;
}

@Injectable({
  providedIn: 'root'
})
export class BranchService {
  private branchesApiUrl = 'http://localhost:8100/api/branches';

  constructor(private http: HttpClient) { }

  getBranches(): Observable<Branch[]> {
    return this.http.get<Branch[]>(this.branchesApiUrl)
      .pipe(
        tap(data => console.log('Sucursales recibidas (BranchService):', data)),
        catchError(this.handleError)
      );
  }

  getBranchByCode(branchCode: string): Observable<Branch> {
    return this.http.get<Branch>(`${this.branchesApiUrl}/${branchCode}/`)
      .pipe(
        tap(data => console.log(`Sucursal ${branchCode} obtenida:`, data)),
        catchError(this.handleError)
      );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Ocurrió un error desconocido al interactuar con las sucursales.';
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
        errorMessage = `Error ${error.status} (${error.statusText}): ${error.message}. Es posible que la URL sea incorrecta o el servidor no esté disponible.`;
      } else {
        errorMessage = `Error del servidor ${error.status} (${error.statusText}). Por favor, intente más tarde.`;
      }
    }
    console.error('Error en BranchService:', errorMessage, error);
    return throwError(() => new Error(errorMessage));
  }
}
