import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

export interface ApiPrecio {
  precio_actual: number;
  fecha_precio: string;
}

export interface ApiProduct {
  codigo_producto: string;
  nombre: string;
  precio: ApiPrecio;
  marca: string;
  codigo_marca: string;
  categoria: string;
  subcategoria: string;
  imageUrl: string;
  descripcion: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private productsApiUrl = 'http://localhost:8100/api/products';

  constructor(private http: HttpClient) { }

  getProducts(): Observable<ApiProduct[]> {
    return this.http.get<ApiProduct[]>(this.productsApiUrl)
      .pipe(
        tap(data => console.log('Productos recibidos (ProductService):', data)),
        catchError(this.handleError)
      );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Ocurrió un error desconocido al obtener los productos.';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      if (error.status === 0) {
        errorMessage = 'No se pudo conectar con el servidor. Verifique su red e inténtelo de nuevo.';
      } else if (error.error && typeof error.error.detail === 'string') {
        errorMessage = `Error ${error.status}: ${error.error.detail}`;
      } else if (error.error && typeof error.error === 'string') {
        errorMessage = `Error ${error.status}: ${error.error}`;
      } else {
        errorMessage = `Error del servidor ${error.status}. Por favor, intente más tarde.`;
      }
    }
    console.error('Error en ProductService:', errorMessage, error);
    return throwError(() => new Error(errorMessage));
  }
}
