import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProductService } from '../../services/product.service';
import { CategoryService } from '../../services/category.service';
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
  private productService = inject(ProductService);
  private categoryService = inject(CategoryService);
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
        this.allCategories = categories;
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

  generateNextCode(): void {
    if (this.isGeneratingCode) return;
    this.isGeneratingCode = true;
    this.actionError = null;
    this.productService.getNextProductCode()
      .pipe(finalize(() => this.isGeneratingCode = false))
      .subscribe({
        next: (nextCode) => {
          this.productForm.get('codigo_producto')?.setValue(nextCode);
          this.productForm.get('codigo_producto')?.markAsDirty();
        },
        error: (err) => {
          console.error('Error al generar código:', err);
          this.actionError = err?.message || 'No se pudo generar el código.';
        }
      });
  }

  addProduct(): void {
    this.actionError = null;
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }
    if (this.isSaving) return;

    this.isSaving = true;
    const newProductData = this.productForm.value as Omit<Product, 'id'>;

    this.productService.addProduct(newProductData)
      .pipe(finalize(() => this.isSaving = false))
      .subscribe({
        next: (newProduct) => {
          this.router.navigate(['/product']);
        },
        error: (err) => {
          console.error('Error al guardar nuevo producto:', err);
          this.actionError = err?.message || 'Error desconocido al guardar el producto.';
        }
      });
  }

  cancel(): void {
    this.router.navigate(['/product']);
  }
}
