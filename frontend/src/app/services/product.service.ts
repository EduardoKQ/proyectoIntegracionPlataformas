import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { Product } from '../../models/product.model';

@Injectable({
  providedIn: 'root'
})
export class ProductService {

  private productsUrl = 'assets/data/products.json';
  private readonly LOCAL_STORAGE_KEY = 'ferreteriaAppProducts';

  constructor(private http: HttpClient) { }

  getProducts(): Observable<Product[]> {
    const localProducts = this._loadFromLocalStorage();

    if (localProducts) {
      console.log('Productos cargados desde localStorage');
      return of(localProducts);
    } else {
      console.log('Productos no encontrados en localStorage. Cargando desde JSON y guardando...');
      return this._fetchFromHttpAndSave();
    }
  }

  getProductByCodigo(codigo: string): Observable<Product | undefined> {
    return this.getProducts().pipe(
      map(products => products.find(p => p.codigo_producto === codigo))
    );
  }

  updateProduct(productToUpdate: Product): Observable<Product> {
    let currentProducts = this._loadFromLocalStorage();

    if (!currentProducts) {
        const errorMsg = 'Error: No se encontraron datos locales para actualizar.';
        console.error(errorMsg);
        return throwError(() => new Error(errorMsg));
    }

    const productIndex = currentProducts.findIndex(p => p.codigo_producto === productToUpdate.codigo_producto);

    if (productIndex > -1) {
      const updatedProducts = [
        ...currentProducts.slice(0, productIndex),
        productToUpdate,
        ...currentProducts.slice(productIndex + 1)
      ];

      this._saveToLocalStorage(updatedProducts);
      console.log('Producto actualizado en localStorage:', productToUpdate.codigo_producto);
      return of(productToUpdate);
    } else {
      const errorMsg = `Error: Producto con código ${productToUpdate.codigo_producto} no encontrado para actualizar.`;
      console.error(errorMsg);
      return throwError(() => new Error(errorMsg));
    }
  }

  private _loadFromLocalStorage(): Product[] | null {
    try {
      const jsonData = localStorage.getItem(this.LOCAL_STORAGE_KEY);
      if (jsonData) {
        return JSON.parse(jsonData) as Product[];
      }
      return null;
    } catch (e) {
      console.error('Error al leer o parsear localStorage:', e);
      localStorage.removeItem(this.LOCAL_STORAGE_KEY);
      return null;
    }
  }

  private _saveToLocalStorage(products: Product[]): void {
    try {
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(products));
    } catch (e) {
      console.error('Error al guardar en localStorage:', e);
    }
  }

  private _fetchFromHttpAndSave(): Observable<Product[]> {
    return this.http.get<Product[]>(this.productsUrl).pipe(
      tap(fetchedProducts => {
        this._saveToLocalStorage(fetchedProducts);
        console.log(`Leídos ${fetchedProducts.length} productos de ${this.productsUrl} y guardados en localStorage.`);
      }),
      catchError(this._handleHttpError)
    );
  }
  private _handleHttpError(error: HttpErrorResponse) {
    let errorMessage = 'Ocurrió un error desconocido al cargar los datos iniciales.';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      errorMessage = `Error del servidor: Código ${error.status}, Mensaje: ${error.message}`;
    }
    console.error(errorMessage);
    return throwError(() => new Error('No se pudieron cargar los datos iniciales de productos. Verifica que el archivo JSON exista y sea accesible.'));
  }

}
