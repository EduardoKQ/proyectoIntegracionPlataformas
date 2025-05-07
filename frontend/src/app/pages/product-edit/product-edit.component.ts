import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CategorySubcategoryService } from '../../services/category.service';
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
  private categoryService = inject(CategorySubcategoryService);
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
