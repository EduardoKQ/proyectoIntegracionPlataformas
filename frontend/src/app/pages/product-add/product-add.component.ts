import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CategorySubcategoryService } from '../../services/category.service';
import { Product } from '../../../models/product.model';
import { Category, Subcategory } from '../../../models/categories.model';
import { Observable, of } from 'rxjs';
import { finalize, catchError, take } from 'rxjs/operators';

@Component({
  selector: 'app-product-add',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
  ],
  templateUrl: './product-add.component.html',
  styleUrls: ['./product-add.component.scss']
})
export class ProductAddComponent implements OnInit {

  private router = inject(Router);
  private categoryService = inject(CategorySubcategoryService);
  private fb = inject(FormBuilder);

  productForm!: FormGroup;
  actionError: string | null = null;
  isSaving = false;
  isLoadingCategories = true;
  isGeneratingCode = false;

  allCategories: Category[] = [];
  filteredSubcategories: Subcategory[] = [];

  ngOnInit(): void {
    this.initializeForm();

    this.categoryService.getCategories().pipe(
      take(1),
      finalize(() => this.isLoadingCategories = false)
    ).subscribe({
      next: categories => {
        categories;
      },
      error: err => {
        console.error("Error loading categories for add form:", err);
        this.actionError = "Error al cargar las categorías.";
      }
    });

    this.productForm.get('categoria')?.valueChanges.subscribe(selectedCategoryName => {
      this.updateSubcategoryOptions(selectedCategoryName);
      this.productForm.get('subcategoria')?.setValue('');
    });
  }

  initializeForm(): void {
    this.productForm = this.fb.group({
      codigo_producto: ['', Validators.required],
      nombre: ['', Validators.required],
      precio: [null, [Validators.required, Validators.min(0)]],
      stock: [null, [Validators.required, Validators.min(0)]],
      marca: [''],
      codigoM: [''],
      categoria: ['', Validators.required],
      subcategoria: [''],
      imageUrl: [''],
      descripcion: ['']
    });
  }

  updateSubcategoryOptions(selectedCategoryName: string | null): void {
    if (!selectedCategoryName || !this.allCategories) {
        this.filteredSubcategories = [];
        return;
    }
    const selectedCategory = this.allCategories.find(cat => cat.name === selectedCategoryName);
    this.filteredSubcategories = selectedCategory ? selectedCategory.subcategories : [];
  }



  cancel(): void {
    this.router.navigate(['/product']);
  }
}
