import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProductService } from '../../services/product.service';
import { CategoryService } from '../../services/category.service';
import { Product } from '../../../models/product.model';
import { Category, Subcategory } from '../../../models/categories.model';
import { Observable, of } from 'rxjs';
import { finalize, catchError, take, tap } from 'rxjs/operators';

@Component({
  selector: 'app-product-edit',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink
  ],
  templateUrl: './product-edit.component.html',
  styleUrls: ['./product-edit.component.scss']
})
export class ProductEditComponent implements OnInit {

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);
  private categoryService = inject(CategoryService);
  private fb = inject(FormBuilder);

  productCodigo: string | null = null;
  productForm!: FormGroup;
  isLoading = true;
  productNotFound = false;
  actionError: string | null = null;
  isSaving = false;
  isDeleting = false;

  allCategories: Category[] = [];
  filteredSubcategories: Subcategory[] = [];

  ngOnInit(): void {
    this.initializeForm();

    this.categoryService.getCategories().pipe(take(1)).subscribe({
        next: categories => {
            this.allCategories = categories;
            this.loadProductData();
        },
        error: err => {
            console.error("Error loading categories for edit form:", err);
            this.actionError = "Error al cargar categorías necesarias.";
            this.isLoading = false;
            this.loadProductData();
        }
    });

    this.productForm.get('categoria')?.valueChanges.subscribe(selectedCategoryName => {
      this.updateSubcategoryOptions(selectedCategoryName);
      if (this.productForm.get('categoria')?.dirty) {
        this.productForm.get('subcategoria')?.setValue('');
      }
    });
  }

  initializeForm(): void {
    this.productForm = this.fb.group({
      id: [null],
      codigo_producto: [{ value: null, disabled: true }],
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

  loadProductData(): void {
    this.productCodigo = this.route.snapshot.paramMap.get('codigo');
    if (this.productCodigo) {
      this.productService.getProductByCodigo(this.productCodigo)
        .pipe(
            take(1),
            tap(product => {
                if (product) {
                    this.productForm.patchValue(product);
                    this.updateSubcategoryOptions(product.categoria);
                    this.productNotFound = false;
                } else {
                    this.productNotFound = true;
                }
                this.isLoading = false;
            }),
            catchError(err => {
                console.error(`Error loading product ${this.productCodigo}:`, err);
                this.productNotFound = true;
                this.isLoading = false;
                this.actionError = "Error al cargar los detalles del producto.";
                return of(null);
            })
        ).subscribe();
    } else {
      console.error("No product code found in URL.");
      this.isLoading = false;
      this.productNotFound = true;
    }
  }

  updateSubcategoryOptions(selectedCategoryName: string | null): void {
    if (!selectedCategoryName || !this.allCategories) {
        this.filteredSubcategories = [];
        return;
    }
    const selectedCategory = this.allCategories.find(cat => cat.name === selectedCategoryName);
    this.filteredSubcategories = selectedCategory ? selectedCategory.subcategories : [];
  }

  saveProduct(): void {
    this.actionError = null;
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }
    if (this.isSaving || this.isDeleting) return;

    this.isSaving = true;
    const updatedProductData = this.productForm.getRawValue() as Product;

    this.productService.updateProduct(updatedProductData)
      .pipe(finalize(() => this.isSaving = false))
      .subscribe({
        next: () => {
          this.router.navigate(['/product']);
        },
        error: (err) => {
          console.error('Error al actualizar producto:', err);
          this.actionError = err?.message || 'Error desconocido al guardar los cambios.';
        }
    });
  }

  deleteProduct(): void {
    if (!this.productCodigo) {
      this.actionError = "No se puede eliminar: Código de producto no encontrado.";
      return;
    }
    if (this.isDeleting || this.isSaving) return;

    const productName = this.productForm.get('nombre')?.value || 'este producto';
    if (confirm(`¿Estás seguro de eliminar "${productName}" (${this.productCodigo})? Esta acción no se puede deshacer.`)) {
      this.isDeleting = true;
      this.actionError = null;

      this.productService.deleteProduct(this.productCodigo)
        .pipe(finalize(() => this.isDeleting = false))
        .subscribe({
          next: () => {
            console.log(`Producto ${this.productCodigo} eliminado.`);
            this.router.navigate(['/product']);
          },
          error: (err) => {
            console.error('Error al eliminar producto:', err);
            this.actionError = err?.message || 'Error desconocido al eliminar el producto.';
          }
        });
    }
  }

  cancel(): void {
    this.router.navigate(['/product']);
  }
}
