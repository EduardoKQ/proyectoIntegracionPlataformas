import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
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
        tap(data => {}),
        catchError(this.handleError)
      );
  }

  getBranchByCode(branchCode: string): Observable<Branch | null> {
    const url = `${this.branchesApiUrl}/${branchCode}`;

    return this.http.get<Branch>(url)
      .pipe(
        tap(data => {
          if (data) {
          } else {
          }
        }),
        catchError(error => {
          if (error.status === 404) {
            return of(null);
          }
          return this.handleError(error);
        })
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
        errorMessage = `Error ${error.status} (${error.statusText || 'Error'}): ${error.error.detail}`;
      } else if (error.error && typeof error.error === 'string') {
        errorMessage = `Error ${error.status} (${error.statusText || 'Error'}): ${error.error}`;
      } else if (error.message) {
        errorMessage = `Error ${error.status} (${error.statusText || 'Error'}): ${error.message}.`;
      } else {
        errorMessage = `Error del servidor ${error.status} (${error.statusText || 'Error'}). Por favor, intente más tarde.`;
      }
    }
    return throwError(() => new Error(errorMessage));
  }
}
