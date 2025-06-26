import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Observable, Subject, forkJoin, of } from 'rxjs';
import { catchError, tap, takeUntil, finalize } from 'rxjs/operators';

import {PromotionsService} from '../../services/promotions.service';
import { Promotion, CreatePromotionRequest } from '../../services/promotions.interfaces';

import { ProductService } from '../../services/product.service';

interface SelectableItem {
  id: string;
  name: string;
  type: 'product' | 'category' | 'subcategory';
  selected: boolean;
  code?: string;
  price?: number;
  productCount?: number;
  parentCategory?: string;
}

interface ProductItem {
  codigo_producto: string;
  nombre: string;
  precio: {
    precio_actual: number;
  };
  categoria: string;
  subcategoria: string;
  selected: boolean;
}

interface CategoryItem {
  id: string;
  name: string;
  selected: boolean;
}

interface SubcategoryItem {
  id: string;
  name: string;
  selected: boolean;
}

@Component({
  selector: 'app-promotions-edit',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './promotions-edit.component.html',
  styleUrls: ['./promotions-edit.component.scss']
})
export class PromotionsEditComponent implements OnInit, OnDestroy {
  private promotionsService = inject(PromotionsService);
  private productService = inject(ProductService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroy$ = new Subject<void>();
  public promotionForm!: FormGroup;
  public isEditMode = false;
  public promotionCode: string | null = null;
  public isLoading = false;
  public isSaving = false;
  public errorMessage: string | null = null;
  public successMessage: string | null = null;
  public availableProducts: ProductItem[] = [];
  public availableCategories: CategoryItem[] = [];
  public availableSubcategories: SubcategoryItem[] = [];
  public selectableItems: SelectableItem[] = [];
  public filteredItems: SelectableItem[] = [];
  public showSelector = false;
  public searchTerm = '';
  public filterType: 'all' | 'product' | 'category' | 'subcategory' = 'all';

  private dataLoaded = false;
  private promotionData: Promotion | null = null;

  ngOnInit(): void {
    this.initializeForm();
    this.checkEditMode();
    this.loadAvailableData();
  }

  initializeForm(): void {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + 7);

    this.promotionForm = this.fb.group({
      promotion_code: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(20)]],
      name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      description: ['', [Validators.maxLength(500)]],
      discount_type: ['percentage', [Validators.required]],
      discount_value: [0, [Validators.required, Validators.min(0.01)]],
      start_date: [this.formatDateForInput(tomorrow), [Validators.required]],
      end_date: [this.formatDateForInput(nextWeek), [Validators.required]],
      status: ['active', [Validators.required]],
      product_ids: [[]],
      category_ids: [[]],
      subcategory_ids: [[]]
    }, {
      validators: [this.dateRangeValidator, this.discountValueValidator]
    });
  }

  checkEditMode(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['code']) {
        this.isEditMode = true;
        this.promotionCode = params['code'];
        console.log('Modo edición activado para:', this.promotionCode);

        if (this.dataLoaded) {
          this.loadPromotionData();
        }
      }
    });
  }

  loadPromotionData(): void {
    if (!this.promotionCode) return;

    console.log('Cargando datos de promoción:', this.promotionCode);
    this.isLoading = true;

    this.promotionsService.getPromotionsWithDetails()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: (promotions) => {
          const promotion = promotions.find(p => p.promotion_code === this.promotionCode);
          if (promotion) {
            console.log('Datos de promoción cargados:', promotion);
            this.promotionData = promotion;
            this.populateForm(promotion);

            setTimeout(() => {
              this.markSelectedItems(promotion);
            }, 100);
          } else {
            this.errorMessage = 'Promoción no encontrada.';
          }
        },
        error: (error) => {
          console.error('Error loading promotion:', error);
          this.errorMessage = 'Error al cargar la promoción. Verifique que existe.';
        }
      });
  }

  populateForm(promotion: Promotion): void {
    console.log('Populando formulario con:', promotion);

    this.promotionForm.patchValue({
      promotion_code: promotion.promotion_code,
      name: promotion.name,
      description: promotion.description,
      discount_type: promotion.discount_type,
      discount_value: promotion.discount_value,
      start_date: this.formatDateForInput(new Date(promotion.start_date)),
      end_date: this.formatDateForInput(new Date(promotion.end_date)),
      status: promotion.status,
      product_ids: promotion.products?.map(p => p.product_code) || [],
      category_ids: promotion.categories?.map(c => c.category_code) || [],
      subcategory_ids: promotion.subcategories?.map(s => s.subcategory_code) || []
    });
  }

  markSelectedItems(promotion: Promotion): void {
    console.log('=== MARCANDO ELEMENTOS SELECCIONADOS ===');

    const selectedProductCodes = promotion.products?.map(p => p.product_code) || [];
    const selectedCategoryCodes = promotion.categories?.map(c => c.category_code) || [];
    const selectedSubcategoryCodes = promotion.subcategories?.map(s => s.subcategory_code) || [];

    this.selectableItems.forEach(item => {
      switch (item.type) {
        case 'product':
          item.selected = selectedProductCodes.includes(item.code || '');
          break;
        case 'category':
          item.selected = selectedCategoryCodes.includes(item.id);
          break;
        case 'subcategory':
          item.selected = selectedSubcategoryCodes.includes(item.id);
          break;
      }
    });

    this.updateFilteredItems();
    console.log('Elementos marcados:', this.getSelectedItemsCount());
  }

  loadAvailableData(): void {
    console.log('Cargando datos disponibles...');
    this.isLoading = true;

    this.productService.getProducts()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoading = false;
          this.dataLoaded = true;
          console.log('Datos disponibles cargados');
        })
      )
      .subscribe({
        next: (products) => {
          console.log('Productos cargados:', products.length);

          this.availableProducts = products.map(product => ({
            codigo_producto: product.codigo_producto || '',
            nombre: product.nombre || '',
            precio: { precio_actual: (product as any).precio_final || 0 },
            categoria: (product as any).categoria || '',
            subcategoria: (product as any).subcategoria || '',
            selected: false
          }));

          this.extractCategoriesAndSubcategories();
          this.buildSelectableItems();

          console.log('Items seleccionables creados:', this.selectableItems.length);

          if (this.isEditMode && this.promotionCode) {
            this.loadPromotionData();
          }
        },
        error: (error) => {
          console.error('Error loading products:', error);
          this.errorMessage = 'Error al cargar los datos. Inténtelo de nuevo.';
        }
      });
  }

  extractCategoriesAndSubcategories(): void {
    const categoriesMap = new Map<string, CategoryItem>();
    const subcategoriesMap = new Map<string, SubcategoryItem>();

    this.availableProducts.forEach(product => {
      if (product.categoria && !categoriesMap.has(product.categoria)) {
        categoriesMap.set(product.categoria, {
          id: product.categoria,
          name: product.categoria,
          selected: false
        });
      }

      if (product.subcategoria && !subcategoriesMap.has(product.subcategoria)) {
        subcategoriesMap.set(product.subcategoria, {
          id: product.subcategoria,
          name: product.subcategoria,
          selected: false
        });
      }
    });

    this.availableCategories = Array.from(categoriesMap.values());
    this.availableSubcategories = Array.from(subcategoriesMap.values());
  }

  buildSelectableItems(): void {
    this.selectableItems = [];

    this.availableCategories.forEach(category => {
      const productCount = this.availableProducts.filter(p => p.categoria === category.id).length;
      this.selectableItems.push({
        id: category.id,
        name: category.name,
        type: 'category',
        selected: false,
        productCount: productCount
      });
    });

    this.availableSubcategories.forEach(subcategory => {
      const productCount = this.availableProducts.filter(p => p.subcategoria === subcategory.id).length;
      const parentCategory = this.availableProducts.find(p => p.subcategoria === subcategory.id)?.categoria;

      this.selectableItems.push({
        id: subcategory.id,
        name: subcategory.name,
        type: 'subcategory',
        selected: false,
        productCount: productCount,
        parentCategory: parentCategory
      });
    });

    this.availableProducts.forEach(product => {
      this.selectableItems.push({
        id: product.codigo_producto,
        name: product.nombre,
        type: 'product',
        selected: false,
        code: product.codigo_producto,
        price: product.precio.precio_actual,
        parentCategory: product.categoria
      });
    });

    this.updateFilteredItems();
  }

  updateFilteredItems(): void {
    let items = [...this.selectableItems];
    if (this.filterType !== 'all') {
      items = items.filter(item => item.type === this.filterType);
    }
    if (this.searchTerm.trim()) {
      const search = this.searchTerm.toLowerCase();
      items = items.filter(item =>
        item.name.toLowerCase().includes(search) ||
        (item.code && item.code.toLowerCase().includes(search))
      );
    }

    this.filteredItems = items;
  }

  onSearchChange(): void {
    this.updateFilteredItems();
  }

  onFilterTypeChange(): void {
    this.updateFilteredItems();
  }

  toggleItemSelection(item: SelectableItem): void {
    item.selected = !item.selected;
    console.log(`${item.type} "${item.name}" ${item.selected ? 'seleccionado' : 'deseleccionado'}`);

    if (item.type === 'category') {
      this.handleCategorySelection(item);
    } else if (item.type === 'subcategory') {
      this.handleSubcategorySelection(item);
    }

    this.updateFormValues();
  }

  handleCategorySelection(categoryItem: SelectableItem): void {
    const categoryProducts = this.selectableItems.filter(item =>
      item.type === 'product' && item.parentCategory === categoryItem.id
    );

    categoryProducts.forEach(product => {
      product.selected = categoryItem.selected;
    });

    const categorySubcategories = this.selectableItems.filter(item =>
      item.type === 'subcategory' && item.parentCategory === categoryItem.id
    );

    categorySubcategories.forEach(subcategory => {
      subcategory.selected = categoryItem.selected;
    });

    console.log(`Categoría "${categoryItem.name}": ${categoryProducts.length} productos y ${categorySubcategories.length} subcategorías ${categoryItem.selected ? 'seleccionados' : 'deseleccionados'}`);
  }

  handleSubcategorySelection(subcategoryItem: SelectableItem): void {
    const subcategoryProducts = this.selectableItems.filter(item =>
      item.type === 'product' &&
      this.availableProducts.find(p => p.codigo_producto === item.id)?.subcategoria === subcategoryItem.id
    );

    subcategoryProducts.forEach(product => {
      product.selected = subcategoryItem.selected;
    });

    console.log(`Subcategoría "${subcategoryItem.name}": ${subcategoryProducts.length} productos ${subcategoryItem.selected ? 'seleccionados' : 'deseleccionados'}`);

    if (subcategoryItem.selected && subcategoryItem.parentCategory) {
      const parentCategory = this.selectableItems.find(item =>
        item.type === 'category' && item.id === subcategoryItem.parentCategory
      );
      if (parentCategory && !parentCategory.selected) {
        parentCategory.selected = true;
        console.log(`Categoría padre "${parentCategory.name}" seleccionada automáticamente`);
      }
    }
  }

  updateFormValues(): void {
    const selectedProducts = this.selectableItems
      .filter(item => item.type === 'product' && item.selected)
      .map(item => item.code || item.id);

    const selectedCategories = this.selectableItems
      .filter(item => item.type === 'category' && item.selected)
      .map(item => item.id);

    const selectedSubcategories = this.selectableItems
      .filter(item => item.type === 'subcategory' && item.selected)
      .map(item => item.id);

    this.promotionForm.patchValue({
      product_ids: selectedProducts,
      category_ids: selectedCategories,
      subcategory_ids: selectedSubcategories
    });

    console.log('Formulario actualizado:', {
      products: selectedProducts.length,
      categories: selectedCategories.length,
      subcategories: selectedSubcategories.length
    });
  }

  getSelectedItemsCount(): number {
    return this.selectableItems.filter(item => item.selected).length;
  }

  getSelectedProductsCount(): number {
    return this.selectableItems.filter(item => item.type === 'product' && item.selected).length;
  }

  getTypeIcon(type: string): string {
    switch (type) {
      case 'category': return 'fas fa-folder';
      case 'subcategory': return 'fas fa-layer-group';
      case 'product': return 'fas fa-box';
      default: return 'fas fa-circle';
    }
  }

  getTypeBadge(type: string): string {
    switch (type) {
      case 'category': return 'Categoría';
      case 'subcategory': return 'Subcategoría';
      case 'product': return 'Producto';
      default: return '';
    }
  }

  toggleSelector(): void {
    this.showSelector = !this.showSelector;
  }

  dateRangeValidator = (control: AbstractControl): ValidationErrors | null => {
    const formGroup = control as FormGroup;
    const startDate = formGroup.get('start_date')?.value;
    const endDate = formGroup.get('end_date')?.value;

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start >= end) {
        return { dateRange: true };
      }
    }
    return null;
  };

  discountValueValidator = (control: AbstractControl): ValidationErrors | null => {
    const formGroup = control as FormGroup;
    const discountType = formGroup.get('discount_type')?.value;
    const discountValue = formGroup.get('discount_value')?.value;

    if (discountType === 'percentage' && discountValue > 100) {
      return { maxPercentage: true };
    }
    return null;
  };

  formatDateForInput(date: Date): string {
    return date.toISOString().slice(0, 16);
  }

  getDiscountDisplay(): string {
    const type = this.promotionForm.get('discount_type')?.value;
    const value = this.promotionForm.get('discount_value')?.value;

    if (!value) return '';

    if (type === 'percentage') {
      return `${value}% de descuento`;
    } else {
      return `$${value.toLocaleString('es-CL')} de descuento`;
    }
  }

  onSubmit(): void {
    console.log('Enviando formulario...');
    console.log('Formulario válido:', this.promotionForm.valid);
    console.log('Valores del formulario:', this.promotionForm.value);

    if (this.promotionForm.invalid) {
      console.log('Formulario inválido, errores:', this.promotionForm.errors);
      this.markFormGroupTouched();
      return;
    }

    if (this.isEditMode && !this.promotionData) {
      this.errorMessage = 'No se han cargado los datos de la promoción. Inténtelo de nuevo.';
      return;
    }

    this.isSaving = true;
    this.errorMessage = null;
    this.successMessage = null;

    const formData = this.promotionForm.value as CreatePromotionRequest;
    console.log('Datos a enviar:', formData);

    const request = this.isEditMode && this.promotionData
      ? this.promotionsService.updatePromotion(this.promotionData.id, formData)
      : this.promotionsService.createPromotion(formData);

    request.pipe(
      takeUntil(this.destroy$),
      finalize(() => this.isSaving = false)
    ).subscribe({
      next: (promotion) => {
        console.log('Promoción guardada exitosamente:', promotion);
        this.successMessage = this.isEditMode
          ? 'Promoción actualizada exitosamente'
          : 'Promoción creada exitosamente';

        setTimeout(() => {
          this.router.navigate(['/product/promotions']);
        }, 1500);
      },
      error: (error) => {
        console.error('Error saving promotion:', error);
        this.errorMessage = error.error?.message ||
          `Error al ${this.isEditMode ? 'actualizar' : 'crear'} la promoción. Inténtelo de nuevo.`;
      }
    });
  }

  markFormGroupTouched(): void {
    Object.keys(this.promotionForm.controls).forEach(key => {
      const control = this.promotionForm.get(key);
      control?.markAsTouched();
    });
  }

  onCancel(): void {
    this.router.navigate(['/product/promotions']);
  }

  get promotionCodeControl() { return this.promotionForm.get('promotion_code'); }
  get nameControl() { return this.promotionForm.get('name'); }
  get descriptionControl() { return this.promotionForm.get('description'); }
  get discountTypeControl() { return this.promotionForm.get('discount_type'); }
  get discountValueControl() { return this.promotionForm.get('discount_value'); }
  get startDateControl() { return this.promotionForm.get('start_date'); }
  get endDateControl() { return this.promotionForm.get('end_date'); }
  get statusControl() { return this.promotionForm.get('status'); }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
