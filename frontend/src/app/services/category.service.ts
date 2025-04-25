import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError, switchMap, map, tap, catchError } from 'rxjs';
import { Category,Subcategory } from '../../models/categories.model';
import { ProductService } from './product.service';

@Injectable({
  providedIn: 'root'
})
export class CategoryService {

  private categoriesUrl = 'assets/data/categories.json';
  private readonly LOCAL_STORAGE_KEY = 'ferreteriaAppCategories';

  private http = inject(HttpClient);
  private productService = inject(ProductService);

  getCategories(): Observable<Category[]> {
    const localData = this._loadFromLocalStorage();
    if (localData) {
      return of(localData);
    } else {
      return this._fetchFromHttpAndSave();
    }
  }

  addCategory(name: string): Observable<Category> {
    const currentCategories = this._loadFromLocalStorage() ?? [];
    const newId = `cat-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
    const existing = currentCategories.find(cat => cat.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      return throwError(() => new Error(`La categoría "${name}" ya existe.`));
    }
    const newCategory: Category = { id: newId, name: name, subcategories: [] };
    const updatedCategories = [...currentCategories, newCategory];
    this._saveToLocalStorage(updatedCategories);
    return of(newCategory);
  }

  addSubcategory(categoryId: string, name: string): Observable<Subcategory> {
    let currentCategories = this._loadFromLocalStorage();
    if (!currentCategories) {
      return throwError(() => new Error('Error: No se encontraron datos de categorías.'));
    }
    const categoryIndex = currentCategories.findIndex(cat => cat.id === categoryId);
    if (categoryIndex === -1) {
      return throwError(() => new Error(`Error: Categoría padre con ID "${categoryId}" no encontrada.`));
    }
    const parentCategory = currentCategories[categoryIndex];
    const existingSub = parentCategory.subcategories.find(sub => sub.name.toLowerCase() === name.toLowerCase());
    if (existingSub) {
      return throwError(() => new Error(`La subcategoría "${name}" ya existe en "${parentCategory.name}".`));
    }
    const newSubId = `sub-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
    const newSubcategory: Subcategory = { id: newSubId, name: name };
    const updatedCategories = currentCategories.map((cat, index) => {
      if (index === categoryIndex) {
        return { ...cat, subcategories: [...cat.subcategories, newSubcategory] };
      }
      return cat;
    });
    this._saveToLocalStorage(updatedCategories);
    return of(newSubcategory);
  }

  updateCategory(categoryId: string, newName: string): Observable<Category> {
    let currentCategories = this._loadFromLocalStorage();
    if (!currentCategories) { return throwError(() => new Error('Error: No hay categorías cargadas.')); }

    const categoryIndex = currentCategories.findIndex(cat => cat.id === categoryId);
    if (categoryIndex === -1) { return throwError(() => new Error('Categoría no encontrada.')); }

    const existing = currentCategories.find((cat, index) => index !== categoryIndex && cat.name.toLowerCase() === newName.toLowerCase());
    if (existing) { return throwError(() => new Error(`La categoría "${newName}" ya existe.`)); }

    const oldCategory = currentCategories[categoryIndex];
    const oldName = oldCategory.name;
    const updatedCategory = { ...oldCategory, name: newName };
    const updatedCategories = [...currentCategories];
    updatedCategories[categoryIndex] = updatedCategory;

    this._saveToLocalStorage(updatedCategories);

    if (oldName !== newName) {
       return this.productService.updateCategoryNameInProducts(oldName, newName).pipe(
            map(() => updatedCategory)
       );
    } else {
        return of(updatedCategory);
    }
  }

  updateSubcategory(categoryId: string, subcategoryId: string, newName: string): Observable<Subcategory> {
     let currentCategories = this._loadFromLocalStorage();
     if (!currentCategories) { return throwError(() => new Error('Error: No hay categorías cargadas.')); }

     const categoryIndex = currentCategories.findIndex(cat => cat.id === categoryId);
     if (categoryIndex === -1) { return throwError(() => new Error('Categoría padre no encontrada.')); }

     const parentCategory = currentCategories[categoryIndex];
     const subcategoryIndex = parentCategory.subcategories.findIndex(sub => sub.id === subcategoryId);
     if (subcategoryIndex === -1) { return throwError(() => new Error('Subcategoría no encontrada.')); }

     const existingSub = parentCategory.subcategories.find((sub, index) => index !== subcategoryIndex && sub.name.toLowerCase() === newName.toLowerCase());
     if (existingSub) { return throwError(() => new Error(`La subcategoría "${newName}" ya existe en "${parentCategory.name}".`)); }

     const oldSubcategory = parentCategory.subcategories[subcategoryIndex];
     const oldSubcategoryName = oldSubcategory.name;
     const updatedSubcategory = { ...oldSubcategory, name: newName };

     const updatedSubcategories = [...parentCategory.subcategories];
     updatedSubcategories[subcategoryIndex] = updatedSubcategory;

     const updatedCategory = { ...parentCategory, subcategories: updatedSubcategories };
     const updatedCategories = [...currentCategories];
     updatedCategories[categoryIndex] = updatedCategory;

     this._saveToLocalStorage(updatedCategories);

     if(oldSubcategoryName !== newName) {
        return this.productService.updateSubcategoryNameInProducts(parentCategory.name, oldSubcategoryName, newName).pipe(
            map(() => updatedSubcategory)
        );
     } else {
        return of(updatedSubcategory);
     }
  }

  deleteCategory(categoryId: string): Observable<void> {
    let currentCategories = this._loadFromLocalStorage();
    if (!currentCategories) { return throwError(() => new Error('Error: No hay categorías cargadas.')); }

    const categoryToDelete = currentCategories.find(cat => cat.id === categoryId);
    if (!categoryToDelete) { return throwError(() => new Error('Categoría no encontrada.')); }

    return this.productService.isCategoryInUse(categoryToDelete.name).pipe(
        switchMap(isInUse => {
            if (isInUse) {
                return throwError(() => new Error(`No se puede eliminar la categoría "${categoryToDelete.name}" porque está siendo usada por al menos un producto.`));
            }
            const updatedCategories = currentCategories.filter(cat => cat.id !== categoryId);
            this._saveToLocalStorage(updatedCategories);
            console.log(`Categoría eliminada: ${categoryToDelete.name}`);
            return of(undefined);
        })
    );
  }

  deleteSubcategory(categoryId: string, subcategoryId: string): Observable<void> {
    let currentCategories = this._loadFromLocalStorage();
    if (!currentCategories) { return throwError(() => new Error('Error: No hay categorías cargadas.')); }

    const categoryIndex = currentCategories.findIndex(cat => cat.id === categoryId);
    if (categoryIndex === -1) { return throwError(() => new Error('Categoría padre no encontrada.')); }

    const parentCategory = currentCategories[categoryIndex];
    const subcategoryToDelete = parentCategory.subcategories.find(sub => sub.id === subcategoryId);
    if (!subcategoryToDelete) { return throwError(() => new Error('Subcategoría no encontrada.')); }

    return this.productService.isSubcategoryInUse(parentCategory.name, subcategoryToDelete.name).pipe(
        switchMap(isInUse => {
            if (isInUse) {
                 return throwError(() => new Error(`No se puede eliminar la subcategoría "${subcategoryToDelete.name}" en "${parentCategory.name}" porque está siendo usada por al menos un producto.`));
            }
            const updatedSubcategories = parentCategory.subcategories.filter(sub => sub.id !== subcategoryId);
            const updatedCategory = { ...parentCategory, subcategories: updatedSubcategories };
            const updatedCategories = [...currentCategories];
            updatedCategories[categoryIndex] = updatedCategory;
            this._saveToLocalStorage(updatedCategories);
            console.log(`Subcategoría eliminada: ${subcategoryToDelete.name} de ${parentCategory.name}`);
            return of(undefined);
        })
    );
  }

  private _loadFromLocalStorage(): Category[] | null {
     try {
        const jsonData = localStorage.getItem(this.LOCAL_STORAGE_KEY);
        return jsonData ? JSON.parse(jsonData) as Category[] : null;
     } catch (e) {
        console.error('Error al leer o parsear categorías de localStorage:', e);
        localStorage.removeItem(this.LOCAL_STORAGE_KEY);
        return null;
     }
  }
  private _saveToLocalStorage(data: Category[]): void {
     try {
        localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(data));
        console.log('Estructura de categorías guardada en localStorage.');
     } catch (e) {
       console.error('Error al guardar categorías en localStorage:', e);
     }
  }
  private _fetchFromHttpAndSave(): Observable<Category[]> {
     return this.http.get<Category[]>(this.categoriesUrl).pipe(
       tap(fetchedCategories => {
         this._saveToLocalStorage(fetchedCategories);
         console.log(`Leídas ${fetchedCategories.length} categorías de ${this.categoriesUrl} y guardadas en localStorage.`);
       }),
       catchError(this._handleHttpError)
     );
  }
  private _handleHttpError(error: HttpErrorResponse) {
     let errorMessage = 'Ocurrió un error desconocido al cargar las categorías iniciales.';
     if (error.error instanceof ErrorEvent) { errorMessage = `Error de red o cliente: ${error.error.message}`; }
     else { errorMessage = `Error del servidor: Código ${error.status}, Mensaje: ${error.message}`; }
     console.error(errorMessage);
     return throwError(() => new Error('No se pudieron cargar los datos iniciales de categorías.'));
  }
}
