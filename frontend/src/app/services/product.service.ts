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

  clearLocalProductStorage(): void {
    try {
      localStorage.removeItem(this.LOCAL_STORAGE_KEY);
      console.log('Product data cleared from localStorage.');
    } catch (e) {
      console.error('Error clearing localStorage:', e);
    }
  }

  getProducts(): Observable<Product[]> {
    const localData = this._loadProductsFromLocalStorage();
    if (localData) {
      return of(localData);
    } else {
      return this._fetchProductsFromHttpAndSave();
    }
  }

  getProductByCodigo(codigo: string): Observable<Product | undefined> {
    return this.getProducts().pipe(
      map(products => products.find(p => p.codigo_producto === codigo))
    );
  }

  updateProduct(productToUpdate: Product): Observable<Product> {
    let products = this._loadProductsFromLocalStorage();
    if (!products) {
      return throwError(() => new Error('Cannot update: No product data found in localStorage.'));
    }
    const productIndex = products.findIndex(p => p.id === productToUpdate.id);
    if (productIndex > -1) {
      const updatedProducts = [...products];
      updatedProducts[productIndex] = productToUpdate;
      this._saveProductsToLocalStorage(updatedProducts);
      return of(productToUpdate);
    } else {
      return throwError(() => new Error(`Product with code ${productToUpdate.codigo_producto} not found for update.`));
    }
  }

  updateCategoryNameInProducts(oldCategoryName: string, newCategoryName: string): Observable<void> {
    let products = this._loadProductsFromLocalStorage();
    if (!products) return of(undefined);

    const productsToUpdate = products.filter(p => p.categoria === oldCategoryName);

    if (productsToUpdate.length > 0) {
        console.log(`Actualizando nombre de categoría '${oldCategoryName}' a '${newCategoryName}' en ${productsToUpdate.length} productos.`);
        const updatedProducts = products.map(p =>
            p.categoria === oldCategoryName ? { ...p, categoria: newCategoryName } : p
        );
        this._saveProductsToLocalStorage(updatedProducts);
    }
    return of(undefined);
  }

 updateSubcategoryNameInProducts(categoryName: string, oldSubcategoryName: string, newSubcategoryName: string): Observable<void> {
    let products = this._loadProductsFromLocalStorage();
    if (!products) return of(undefined);

    const productsToUpdate = products.filter(p => p.categoria === categoryName && p.subcategoria === oldSubcategoryName);

     if (productsToUpdate.length > 0) {
        console.log(`Actualizando nombre de subcategoría '${oldSubcategoryName}' a '${newSubcategoryName}' en ${productsToUpdate.length} productos de la categoría '${categoryName}'.`);
        const updatedProducts = products.map(p =>
          (p.categoria === categoryName && p.subcategoria === oldSubcategoryName)
            ? { ...p, subcategoria: newSubcategoryName }
            : p
        );
        this._saveProductsToLocalStorage(updatedProducts);
    }
    return of(undefined);
  }

  isCategoryInUse(categoryName: string): Observable<boolean> {
     const products = this._loadProductsFromLocalStorage() ?? [];
     const isInUse = products.some(p => p.categoria === categoryName);
     return of(isInUse);
  }

  isSubcategoryInUse(categoryName: string, subcategoryName: string): Observable<boolean> {
     const products = this._loadProductsFromLocalStorage() ?? [];
     const isInUse = products.some(p => p.categoria === categoryName && p.subcategoria === subcategoryName);
     return of(isInUse);
  }

  private _loadProductsFromLocalStorage(): Product[] | null {
    try {
      const jsonData = localStorage.getItem(this.LOCAL_STORAGE_KEY);
      return jsonData ? JSON.parse(jsonData) : null;
    } catch (e) {
      console.error('Error reading products from localStorage:', e);
      localStorage.removeItem(this.LOCAL_STORAGE_KEY);
      return null;
    }
  }

  private _saveProductsToLocalStorage(data: Product[]): void {
    try {
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Error saving products to localStorage:', e);
    }
  }

  private _fetchProductsFromHttpAndSave(): Observable<Product[]> {
    return this.http.get<Product[]>(this.productsUrl).pipe(
      tap(products => {
        this._saveProductsToLocalStorage(products);
        console.log(`Workspaceed ${products.length} products from ${this.productsUrl} and saved to localStorage.`);
      }),
      catchError(this._handleHttpError)
    );
  }

   private _handleHttpError(error: HttpErrorResponse) {
    console.error('Error loading products.json:', error.message);
    return throwError(() => new Error('Could not load initial product data.'));
  }
}
