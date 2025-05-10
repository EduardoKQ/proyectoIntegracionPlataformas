import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { catchError, finalize, tap } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import {Category,SubcategoryFromCategoryDetail,NewCategoryPayload, UpdateCategoryPayload,NewSubcategoryPayload,UpdateSubcategoryPayload} from '../../services/category.service';
import { CategorySubcategoryService } from '../../services/category.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [ CommonModule, FormsModule ],
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.scss']
})
export class CategoriesComponent implements OnInit {

  private categorySubcategoryService = inject(CategorySubcategoryService);
  private authService = inject(AuthService);

  public categories$!: Observable<Category[]>;
  public errorOcurred = false;
  public isLoading = false;
  public actionError: string | null = null;
  public isSaving = false;

  public showAddCategoryForm = false;
  public newCategoryCode = '';
  public newCategoryName = '';

  public addingSubcategoryTo: string | null = null;
  public newSubcategoryCode = '';
  public newSubcategoryName = '';

  public editingCategoryId: string | null = null;
  public editingSubcategoryId: string | null = null;
  public editedName = '';

  public isAdmin: boolean = false;
  public categoriesLoadedAttempted: boolean = false;
  private readonly ADMIN_ROLE_NAME = 'administrador_tienda';

  ngOnInit(): void {
    const currentUserRole = this.authService.getCurrentUserRole();
    this.isAdmin = currentUserRole === this.ADMIN_ROLE_NAME;
    this.loadCategories();
  }

  private handleApiError(err: HttpErrorResponse, defaultMessageContext: string): void {
    console.error(`API Error (${defaultMessageContext}):`, err);
    this.isSaving = false;

    let descriptiveMessages: string[] = [];
    const fallbackMessage = `Ocurrió un error al ${defaultMessageContext}. Por favor, intente más tarde.`;

    if (err.error && typeof err.error === 'object' && err.error !== null) {
      if (typeof err.error.detail === 'string') {
        descriptiveMessages.push(err.error.detail);
      } else {
        for (const field in err.error) {
          if (err.error.hasOwnProperty(field)) {
            const errors = err.error[field];
            let prefix = '';
            if (field.toLowerCase() !== 'non_field_errors' && field.toLowerCase() !== 'detail') {
              prefix = `${field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' ')}: `;
            }

            if (Array.isArray(errors)) {
              descriptiveMessages.push(prefix + errors.join(' '));
            } else if (typeof errors === 'string') {
              descriptiveMessages.push(prefix + errors);
            }
          }
        }
      }
    } else if (typeof err.error === 'string') {
      descriptiveMessages.push(err.error);
    }

    if (descriptiveMessages.length > 0) {
      this.actionError = descriptiveMessages.join('\n');
    } else {
      if (err.status === 0) {
        this.actionError = 'Error de conexión. Verifique su red e intente de nuevo.';
      } else {
         this.actionError = `Error ${err.status ? err.status : ''} (${err.statusText || 'desconocido'}). ${fallbackMessage}`;
      }
    }
  }

  loadCategories(): void {
    this.isLoading = true;
    this.errorOcurred = false;
    this.actionError = null;
    this.categoriesLoadedAttempted = false;

    this.categories$ = this.categorySubcategoryService.getCategories()
      .pipe(
        tap(categories => {
          console.log('Categorías cargadas:', categories);
        }),
        finalize(() => {
          this.isLoading = false;
          this.categoriesLoadedAttempted = true;
        }),
        catchError((error: HttpErrorResponse) => {
          this.errorOcurred = true;
          this.handleApiError(error, 'cargar la lista de categorías');
          this.categoriesLoadedAttempted = true;
          return of([]);
        })
      );
  }

  showAddCategory(): void {
    if (!this.isAdmin) return;
    this.hideAllForms();
    this.showAddCategoryForm = true;
    this.newCategoryCode = '';
    this.newCategoryName = '';
  }

  cancelAddCategory(): void {
    this.showAddCategoryForm = false;
    this.newCategoryCode = '';
    this.newCategoryName = '';
  }

  saveNewCategory(): void {
    if (!this.isAdmin) {
        this.actionError = "Acción no permitida.";
        return;
    }
    const code = this.newCategoryCode.trim();
    const name = this.newCategoryName.trim();
    if (!code || !name || this.isSaving) return;

    this.isSaving = true;
    this.actionError = null;
    const payload: NewCategoryPayload = { id: code, name: name };

    this.categorySubcategoryService.createCategory(payload)
      .pipe(finalize(() => this.isSaving = false ))
      .subscribe({
        next: () => { this.cancelAddCategory(); this.loadCategories(); },
        error: (err: HttpErrorResponse) => this.handleApiError(err, 'guardar la categoría')
      });
  }

  editCategory(category: Category): void {
    if (!this.isAdmin) return;
    this.hideAllForms();
    this.editingCategoryId = category.id;
    this.editedName = category.name;
  }

  cancelEditCategory(): void {
    this.editingCategoryId = null;
    this.editedName = '';
  }

  saveEditedCategory(currentCategoryCode: string): void {
    if (!this.isAdmin) {
        this.actionError = "Acción no permitida.";
        return;
    }
    const newName = this.editedName.trim();
    if (!newName || !currentCategoryCode || this.isSaving) return;

    this.isSaving = true;
    this.actionError = null;
    const payload: UpdateCategoryPayload = { id: currentCategoryCode, name: newName };

    this.categorySubcategoryService.updateCategory(currentCategoryCode, payload)
      .pipe(finalize(() => this.isSaving = false))
      .subscribe({
        next: () => { this.cancelEditCategory(); this.loadCategories(); },
        error: (err: HttpErrorResponse) => this.handleApiError(err, 'actualizar la categoría')
      });
  }

  deleteCategory(category: Category): void {
    if (!this.isAdmin) {
        this.actionError = "Acción no permitida.";
        return;
    }
    if (confirm(`¿Estás seguro de eliminar la categoría "${category.name}" (Código: ${category.id})? Esta acción no se puede deshacer.`)) {
      this.isSaving = true;
      this.actionError = null;
      this.categorySubcategoryService.deleteCategory(category.id)
        .pipe(finalize(() => this.isSaving = false))
        .subscribe({
          next: () => this.loadCategories(),
          error: (err: HttpErrorResponse) => this.handleApiError(err, 'eliminar la categoría')
        });
    }
  }

  showAddSubcategory(category: Category): void {
    if (!this.isAdmin) return;
    this.hideAllForms();
    this.addingSubcategoryTo = category.id;
    this.newSubcategoryCode = '';
    this.newSubcategoryName = '';
  }

  cancelAddSubcategory(): void {
    this.addingSubcategoryTo = null;
    this.newSubcategoryCode = '';
    this.newSubcategoryName = '';
  }

  saveNewSubcategory(parentCategory: Category): void {
    if (!this.isAdmin) {
        this.actionError = "Acción no permitida.";
        return;
    }
    const subcategoryCode = this.newSubcategoryCode.trim();
    const subcategoryName = this.newSubcategoryName.trim();
    const parentCategoryCode = parentCategory.id;

    if (!subcategoryCode || !subcategoryName || !parentCategoryCode || this.isSaving) return;

    this.isSaving = true;
    this.actionError = null;
    const payload: NewSubcategoryPayload = {
      id: subcategoryCode,
      name: subcategoryName,
      relatedCategoryId: parentCategoryCode
    };

    this.categorySubcategoryService.createSubcategory(payload)
      .pipe(finalize(() => this.isSaving = false ))
      .subscribe({
        next: () => { this.cancelAddSubcategory(); this.loadCategories(); },
        error: (err: HttpErrorResponse) => this.handleApiError(err, 'guardar la subcategoría')
      });
  }

  editSubcategory(category: Category, subcategory: SubcategoryFromCategoryDetail): void {
    if (!this.isAdmin) return;
    this.hideAllForms();
    this.editingCategoryId = category.id;
    this.editingSubcategoryId = subcategory.id;
    this.editedName = subcategory.name;
  }

  cancelEditSubcategory(): void {
    this.editingSubcategoryId = null;
    this.editingCategoryId = null;
    this.editedName = '';
  }

  saveEditedSubcategory(parentCategoryCodeForContext: string, currentSubcategoryCode: string): void {
    if (!this.isAdmin) {
        this.actionError = "Acción no permitida.";
        return;
    }
    const newName = this.editedName.trim();
    if (!newName || !currentSubcategoryCode || !parentCategoryCodeForContext || this.isSaving) {
      if (!parentCategoryCodeForContext) {
        console.error("Error: Código de categoría padre no disponible para la actualización de subcategoría.");
        this.actionError = "No se pudo determinar la categoría padre para la actualización.";
      }
      return;
    }

    this.isSaving = true;
    this.actionError = null;

    const payload: UpdateSubcategoryPayload = {
      id: currentSubcategoryCode,
      name: newName,
      relatedCategoryId: parentCategoryCodeForContext
    };

    this.categorySubcategoryService.updateSubcategory(currentSubcategoryCode, payload)
      .pipe(finalize(() => this.isSaving = false))
      .subscribe({
        next: () => { this.cancelEditSubcategory(); this.loadCategories(); },
        error: (err: HttpErrorResponse) => this.handleApiError(err, 'actualizar la subcategoría')
      });
  }

  deleteSubcategory(category: Category, subcategory: SubcategoryFromCategoryDetail): void {
    if (!this.isAdmin) {
        this.actionError = "Acción no permitida.";
        return;
    }
    if (confirm(`¿Estás seguro de eliminar la subcategoría "${subcategory.name}" (Código: ${subcategory.id}) de la categoría "${category.name}"?`)) {
      this.isSaving = true;
      this.actionError = null;
      this.categorySubcategoryService.deleteSubcategory(subcategory.id)
        .pipe(finalize(() => this.isSaving = false))
        .subscribe({
          next: () => this.loadCategories(),
          error: (err: HttpErrorResponse) => this.handleApiError(err, 'eliminar la subcategoría')
        });
    }
  }

  hideAllForms(): void {
    this.showAddCategoryForm = false;
    this.addingSubcategoryTo = null;
    this.editingCategoryId = null;
    this.editingSubcategoryId = null;
    this.newCategoryCode = '';
    this.newCategoryName = '';
    this.newSubcategoryCode = '';
    this.newSubcategoryName = '';
    this.editedName = '';
    this.actionError = null;
  }
}
