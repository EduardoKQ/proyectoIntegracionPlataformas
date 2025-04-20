import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { Category, Subcategory } from '../../../models/categories.model';
import { CategoryService } from '../../services/category.service';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [ CommonModule, FormsModule ],
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.scss']
})
export class CategoriesComponent implements OnInit {

  private categoryService = inject(CategoryService);

  public categories$!: Observable<Category[]>;
  public errorOcurred = false;
  public isLoading = false;
  public actionError: string | null = null;
  public isSaving = false;

  public showAddCategoryForm = false;
  public newCategoryName = '';
  public addingSubcategoryTo: string | null = null;
  public newSubcategoryName = '';

  public editingCategoryId: string | null = null;
  public editingSubcategoryId: string | null = null;
  public editedName = '';

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.isLoading = true;
    this.errorOcurred = false;
    this.actionError = null;
    this.categories$ = this.categoryService.getCategories()
      .pipe(
        finalize(() => this.isLoading = false),
        catchError(error => {
          console.error('ERROR al obtener categorías:', error);
          this.errorOcurred = true;
          this.actionError = 'Error al cargar la lista de categorías.';
          return of([]);
        })
      );
  }

  showAddCategory(): void {
    this.hideAllForms();
    this.showAddCategoryForm = true;
    this.newCategoryName = '';
  }
  cancelAddCategory(): void { this.showAddCategoryForm = false; this.newCategoryName = ''; }
  saveNewCategory(): void {
    const name = this.newCategoryName.trim();
    if (!name || this.isSaving) return;
    this.isSaving = true; this.actionError = null;
    this.categoryService.addCategory(name)
      .pipe(finalize(() => this.isSaving = false ))
      .subscribe({
        next: () => { this.cancelAddCategory(); this.loadCategories(); },
        error: (err) => this.actionError = err.message || 'Error al guardar categoría.'
      });
  }
  showAddSubcategory(category: Category): void {
    this.hideAllForms();
    this.addingSubcategoryTo = category.id;
    this.newSubcategoryName = '';
  }
  cancelAddSubcategory(): void { this.addingSubcategoryTo = null; this.newSubcategoryName = ''; }
  saveNewSubcategory(parentCategory: Category): void {
     const name = this.newSubcategoryName.trim();
     if (!name || !parentCategory || this.isSaving) return;
     this.isSaving = true; this.actionError = null;
     this.categoryService.addSubcategory(parentCategory.id, name)
        .pipe(finalize(() => this.isSaving = false ))
        .subscribe({
            next: () => { this.cancelAddSubcategory(); this.loadCategories(); },
            error: (err) => this.actionError = err.message || `Error al guardar subcategoría.`
        });
  }

  editCategory(category: Category): void {
    this.hideAllForms();
    this.editingCategoryId = category.id;
    this.editedName = category.name;
  }
  cancelEditCategory(): void { this.editingCategoryId = null; this.editedName = ''; }
  saveEditedCategory(categoryId: string): void {
     const name = this.editedName.trim();
     if (!name || !categoryId || this.isSaving) return;
     this.isSaving = true; this.actionError = null;
     this.categoryService.updateCategory(categoryId, name)
        .pipe(finalize(() => this.isSaving = false))
        .subscribe({
            next: () => { this.cancelEditCategory(); this.loadCategories(); },
            error: (err) => this.actionError = err.message || 'Error al actualizar categoría.'
        });
  }
  editSubcategory(category: Category, subcategory: Subcategory): void {
     this.hideAllForms();
     this.editingCategoryId = category.id;
     this.editingSubcategoryId = subcategory.id;
     this.editedName = subcategory.name;
  }
  cancelEditSubcategory(): void { this.editingSubcategoryId = null; this.editingCategoryId = null; this.editedName = ''; }
  saveEditedSubcategory(categoryId: string, subcategoryId: string): void {
      const name = this.editedName.trim();
      if(!name || !categoryId || !subcategoryId || this.isSaving) return;
      this.isSaving = true; this.actionError = null;
      this.categoryService.updateSubcategory(categoryId, subcategoryId, name)
        .pipe(finalize(() => this.isSaving = false))
        .subscribe({
            next: () => { this.cancelEditSubcategory(); this.loadCategories(); },
            error: (err) => this.actionError = err.message || 'Error al actualizar subcategoría.'
        });
  }

  deleteCategory(category: Category): void {
    if (confirm(`¿Estás seguro de eliminar la categoría "${category.name}"? Esta acción no se puede deshacer.`)) {
       this.isSaving = true; this.actionError = null;
       this.categoryService.deleteCategory(category.id)
         .pipe(finalize(() => this.isSaving = false))
         .subscribe({
             next: () => this.loadCategories(),
             error: (err) => this.actionError = err.message || 'Error al eliminar categoría.'
         });
    }
  }
  deleteSubcategory(category: Category, subcategory: Subcategory): void {
     if (confirm(`¿Estás seguro de eliminar la subcategoría "${subcategory.name}" de "${category.name}"?`)) {
        this.isSaving = true; this.actionError = null;
        this.categoryService.deleteSubcategory(category.id, subcategory.id)
          .pipe(finalize(() => this.isSaving = false))
          .subscribe({
              next: () => this.loadCategories(),
              error: (err) => this.actionError = err.message || 'Error al eliminar subcategoría.'
          });
     }
  }

  hideAllForms(): void {
    this.showAddCategoryForm = false;
    this.addingSubcategoryTo = null;
    this.editingCategoryId = null;
    this.editingSubcategoryId = null;
    this.newCategoryName = '';
    this.newSubcategoryName = '';
    this.editedName = '';
    this.actionError = null;
  }
}
