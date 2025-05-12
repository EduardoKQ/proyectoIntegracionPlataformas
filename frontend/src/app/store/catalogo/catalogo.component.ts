import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, AbstractControl } from '@angular/forms';
import { Subject, combineLatest } from 'rxjs';
import { takeUntil, debounceTime, tap } from 'rxjs/operators';

import { ProductService } from '../../services/product.service';
import { ApiProduct } from '../../services/product.interfaces';
import { CategorySubcategoryService, Category as ApiCategory, SubcategoryFromCategoryDetail as ApiSubcategory } from '../../services/category.service';

interface BrandFilter {
  name: string;
  selected: boolean;
}

type SortOrder = 'default' | 'priceAsc' | 'priceDesc' | 'nameAsc' | 'nameDesc';

@Component({
  selector: 'app-catalogo',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './catalogo.component.html',
  styleUrls: ['./catalogo.component.scss']
})
export class CatalogoComponent implements OnInit, OnDestroy {
  private productService = inject(ProductService);
  private categorySubcategoryService = inject(CategorySubcategoryService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  allProductsMasterList: ApiProduct[] = [];
  productsFilteredByUrlParams: ApiProduct[] = [];
  productsToDisplay: ApiProduct[] = [];
  paginatedProducts: ApiProduct[] = [];

  isLoading = true;
  catalogTitle = 'Catálogo de Productos';
  activeSearchTerm: string | null = null;
  activeCategoryName: string | null = null;
  activeSubcategoryName: string | null = null;

  filterForm!: FormGroup;
  availableCategoriesForFilter: ApiCategory[] = [];

  sortOptions: { value: SortOrder, label: string }[] = [
    { value: 'default', label: 'Relevancia' },
    { value: 'priceAsc', label: 'Precio: Menor a Mayor' },
    { value: 'priceDesc', label: 'Precio: Mayor a Menor' },
    { value: 'nameAsc', label: 'Nombre: A-Z' },
    { value: 'nameDesc', label: 'Nombre: Z-A' },
  ];
  currentSortOrder: SortOrder = 'default';
  showSortDropdown = false;

  currentPage = 1;
  itemsPerPage = 12;
  totalPages = 0;

  constructor() {}

  ngOnInit(): void {
    this.initFilterForm();
    this.loadMasterDataAndHandleRouteParams();
    this.setupFilterFormChangesSubscription();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get currentSortLabel(): string {
    const selectedOption = this.sortOptions.find(o => o.value === this.currentSortOrder);
    return selectedOption?.label || 'Ordenar';
  }

  initFilterForm(): void {
    this.filterForm = this.fb.group({
      brands: this.fb.array([]),
      categories: this.fb.array([]),
      sortOrder: ['default' as SortOrder]
    });
  }

  get brandsFormArray(): FormArray {
    return this.filterForm.get('brands') as FormArray;
  }

  get categoriesFormArray(): FormArray {
    return this.filterForm.get('categories') as FormArray;
  }

  loadMasterDataAndHandleRouteParams(): void {
    this.isLoading = true;
    combineLatest([
      this.productService.getProducts(),
      this.categorySubcategoryService.getCategories(),
      this.route.queryParams
    ]).pipe(
      takeUntil(this.destroy$)
    ).subscribe(([products, categories, queryParams]) => {
      this.allProductsMasterList = [...products];
      this.availableCategoriesForFilter = [...categories];
      this.rebuildCategoryFilters(this.availableCategoriesForFilter);
      this.rebuildBrandFilters(this.allProductsMasterList);
      this.handleRouteParamsAndUpdateFilters(queryParams);

      this.isLoading = false;
    });
  }

  handleRouteParamsAndUpdateFilters(queryParams: any): void {
    const searchQuery = queryParams['search'];
    const categoryQueryIdFromUrl = queryParams['category'];
    const subcategoryQueryIdFromUrl = queryParams['subcategory'];

    this.activeSearchTerm = searchQuery || null;
    this.activeCategoryName = null;
    this.activeSubcategoryName = null;

    this.filterForm.get('sortOrder')?.setValue('default' as SortOrder, { emitEvent: false });

    let tempProducts = [...this.allProductsMasterList];

    if (this.activeSearchTerm) {
      this.catalogTitle = `Resultados para: "${this.activeSearchTerm}"`;
      const lcSearchTerm = this.activeSearchTerm.toLowerCase();
      tempProducts = tempProducts.filter(p =>
        p.nombre.toLowerCase().includes(lcSearchTerm) ||
        p.descripcion.toLowerCase().includes(lcSearchTerm) ||
        p.marca.toLowerCase().includes(lcSearchTerm) ||
        p.categoria.toLowerCase().includes(lcSearchTerm) ||
        p.subcategoria.toLowerCase().includes(lcSearchTerm)
      );
      this.categoriesFormArray.controls.forEach(catCtrl => {
        catCtrl.get('selected')?.setValue(false, { emitEvent: false });
        (catCtrl.get('subcategories') as FormArray).controls.forEach(subCtrl => subCtrl.get('selected')?.setValue(false, { emitEvent: false }));
      });
      this.brandsFormArray.controls.forEach(brandCtrl => brandCtrl.get('selected')?.setValue(false, { emitEvent: false }));

    } else if (categoryQueryIdFromUrl) {
      const cat = this.availableCategoriesForFilter.find(c => c.id === categoryQueryIdFromUrl);
      if (cat) {
        this.activeCategoryName = cat.name;
        this.catalogTitle = `Categoría: ${cat.name}`;
        tempProducts = tempProducts.filter(p => this.getCategoryIdByName(p.categoria) === categoryQueryIdFromUrl);
        const categoryControl = this.categoriesFormArray.controls.find(c => c.value.id === categoryQueryIdFromUrl) as FormGroup;
        if (categoryControl) {
          categoryControl.get('selected')?.setValue(true, { emitEvent: false });
        }

        if (subcategoryQueryIdFromUrl) {
          const subcat = cat.subcategories?.find(s => s.id === subcategoryQueryIdFromUrl);
          if (subcat && categoryControl) {
            this.activeSubcategoryName = subcat.name;
            this.catalogTitle += ` / ${subcat.name}`;
            tempProducts = tempProducts.filter(p => this.getSubcategoryIdByName(p.subcategoria, p.categoria) === subcategoryQueryIdFromUrl);
            const subcategoriesArray = categoryControl.get('subcategories') as FormArray;
            const subcategoryControl = subcategoriesArray.controls.find(sc => sc.value.id === subcategoryQueryIdFromUrl) as FormGroup;
            if (subcategoryControl) {
              subcategoryControl.get('selected')?.setValue(true, { emitEvent: false });
            }
          }
        }
      }
    } else {
      this.catalogTitle = 'Catálogo de Productos';
      this.categoriesFormArray.controls.forEach(catCtrl => {
        catCtrl.get('selected')?.setValue(false, { emitEvent: false });
        (catCtrl.get('subcategories') as FormArray).controls.forEach(subCtrl => subCtrl.get('selected')?.setValue(false, { emitEvent: false }));
      });
      this.brandsFormArray.controls.forEach(brandCtrl => brandCtrl.get('selected')?.setValue(false, { emitEvent: false }));
    }

    this.productsFilteredByUrlParams = [...tempProducts];
    this.rebuildBrandFilters(this.productsFilteredByUrlParams, false);
    this.applySideBarFiltersAndSort(true);
  }


  rebuildCategoryFilters(allAvailableCats: ApiCategory[]): void {
    this.categoriesFormArray.clear({ emitEvent: false });
    allAvailableCats.forEach(category => {
      const subcategoryControls = (category.subcategories || []).map(sub =>
        this.fb.group({
            id: sub.id,
            name: sub.name,
            selected: false,
            categoryId: category.id
        })
      );
      this.categoriesFormArray.push(this.fb.group({
        id: category.id,
        name: category.name,
        selected: false,
        subcategories: this.fb.array(subcategoryControls)
      }), { emitEvent: false });
    });
  }

  rebuildBrandFilters(baseProductsForBrands: ApiProduct[], _keepSelectionIfNoUrlSearch = true): void {
    this.brandsFormArray.clear({ emitEvent: false });
    const uniqueBrands = [...new Set(baseProductsForBrands.map(p => p.marca))].sort();
    uniqueBrands.forEach(brand => {
      this.brandsFormArray.push(this.fb.group({
        name: brand,
        selected: false
      }), { emitEvent: false });
    });
  }

  setupFilterFormChangesSubscription(): void {
    this.filterForm.valueChanges.pipe(
      debounceTime(350),
      takeUntil(this.destroy$),
      tap(values => this.currentSortOrder = values.sortOrder as SortOrder)
    ).subscribe((values) => {
      if (!this.activeSearchTerm && !this.activeCategoryName && !this.activeSubcategoryName) {
         this.router.navigate([], {
           relativeTo: this.route,
           queryParams: this.getFilterQueryParams(values),
           queryParamsHandling: 'merge'
         });
      }
      this.applySideBarFiltersAndSort(true);
    });
  }

  getFilterQueryParams(formValues: any): any {
    const params: any = {};
    const selectedBrands = formValues.brands.filter((b: BrandFilter) => b.selected).map((b: BrandFilter) => b.name);
    if (selectedBrands.length > 0) params.brands = selectedBrands.join(',');

    const selectedCategoryIds: string[] = [];
    const selectedSubcategoryIds: string[] = [];

    formValues.categories.forEach((catCtrl: any) => {
        if (catCtrl.selected && !catCtrl.subcategories.some((sub:any) => sub.selected)) {
            selectedCategoryIds.push(catCtrl.id);
        }
        if (catCtrl.subcategories) {
            const selectedSubs = catCtrl.subcategories.filter((sub: any) => sub.selected).map((sub: any) => sub.id);
            selectedSubcategoryIds.push(...selectedSubs);
        }
    });

    if (selectedSubcategoryIds.length > 0) {
        params.subcategory = selectedSubcategoryIds.join(',');
        const firstSub = formValues.categories
            .flatMap((c:any) => c.subcategories)
            .find((s:any)=> s.id === selectedSubcategoryIds[0]);
        if(firstSub) params.category = firstSub.categoryId;

    } else if (selectedCategoryIds.length > 0) {
        params.category = selectedCategoryIds.join(',');
    }
    return params;
  }

  applySideBarFiltersAndSort(resetPage: boolean = true): void {
    let tempProducts = [...this.productsFilteredByUrlParams];
    const formValues = this.filterForm.getRawValue();

    const selectedBrands = formValues.brands.filter((b: BrandFilter) => b.selected).map((b: BrandFilter) => b.name);
    const selectedCategoryIdsFromForm: string[] = [];
    const selectedSubcategoryIdsFromForm: string[] = [];

    formValues.categories.forEach((catCtrl: any) => {
        if (catCtrl.selected && !catCtrl.subcategories.some((sub:any) => sub.selected)) {
            selectedCategoryIdsFromForm.push(catCtrl.id);
        }
        if (catCtrl.subcategories) {
            const selectedSubs = catCtrl.subcategories.filter((sub: any) => sub.selected).map((sub: any) => sub.id);
            selectedSubcategoryIdsFromForm.push(...selectedSubs);
        }
    });
    if (selectedBrands.length > 0) {
      tempProducts = tempProducts.filter(p => selectedBrands.includes(p.marca));
    }
    if (selectedSubcategoryIdsFromForm.length > 0) {
        tempProducts = tempProducts.filter(p => {
            const subcategoryId = this.getSubcategoryIdByName(p.subcategoria, p.categoria);
            return subcategoryId !== undefined && selectedSubcategoryIdsFromForm.includes(subcategoryId);
        });
    } else if (selectedCategoryIdsFromForm.length > 0) {
        if (!this.activeSubcategoryName) {
            tempProducts = tempProducts.filter(p => {
                const categoryId = this.getCategoryIdByName(p.categoria);
                return categoryId !== undefined && selectedCategoryIdsFromForm.includes(categoryId);
            });
        }
    }

    if (!this.activeSearchTerm && (selectedCategoryIdsFromForm.length > 0 || selectedSubcategoryIdsFromForm.length > 0)) {
        this.rebuildBrandFilters(tempProducts, true);
    } else if (!this.activeSearchTerm && selectedBrands.length === 0 && selectedCategoryIdsFromForm.length === 0 && selectedSubcategoryIdsFromForm.length === 0) {
        this.rebuildBrandFilters(this.productsFilteredByUrlParams, false);
    }
    switch (this.currentSortOrder) {
      case 'priceAsc':
        tempProducts.sort((a, b) => a.precio.precio_actual - b.precio.precio_actual);
        break;
      case 'priceDesc':
        tempProducts.sort((a, b) => b.precio.precio_actual - a.precio.precio_actual);
        break;
      case 'nameAsc':
        tempProducts.sort((a,b) => a.nombre.localeCompare(b.nombre));
        break;
      case 'nameDesc':
        tempProducts.sort((a,b) => b.nombre.localeCompare(a.nombre));
        break;
    }
    this.productsToDisplay = tempProducts;
    this.totalPages = Math.ceil(this.productsToDisplay.length / this.itemsPerPage);

    if (resetPage) {
        this.currentPage = 1;
    } else {
        this.currentPage = Math.max(1, Math.min(this.currentPage, this.totalPages || 1));
    }
    this.updatePaginatedProducts();
  }

  getCategoryIdByName(name: string): string | undefined {
      const category = this.availableCategoriesForFilter.find(c => c.name === name);
      return category?.id;
  }

  getSubcategoryIdByName(subName: string, catName: string): string | undefined {
      const category = this.availableCategoriesForFilter.find(c => c.name === catName);
      const subcategory = category?.subcategories?.find(s => s.name === subName);
      return subcategory?.id;
  }

  updatePaginatedProducts(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedProducts = this.productsToDisplay.slice(startIndex, endIndex);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.applySideBarFiltersAndSort(false);
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.applySideBarFiltersAndSort(false);
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.applySideBarFiltersAndSort(false);
    }
  }

  getPages(): number[] {
    const pages = [];
    let startPage = Math.max(1, this.currentPage - 2);
    let endPage = Math.min(this.totalPages, this.currentPage + 2);

    if (this.totalPages <= 5) {
        startPage = 1;
        endPage = this.totalPages;
    } else {
        if (this.currentPage <= 3) {
            endPage = 5;
        } else if (this.currentPage > this.totalPages - 3) {
            startPage = this.totalPages - 4;
        }
    }
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  }

  limpiarFiltros(): void {
    this.activeSearchTerm = null;
    this.activeCategoryName = null;
    this.activeSubcategoryName = null;
    this.catalogTitle = 'Catálogo de Productos';

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
    });
  }

  toggleSortDropdown(): void {
    this.showSortDropdown = !this.showSortDropdown;
  }

  selectSortOrder(orderValue: string): void {
    this.filterForm.get('sortOrder')?.setValue(orderValue as SortOrder);
    this.showSortDropdown = false;
  }

  getSubcategoryControls(categoryIndex: number): FormArray {
    const categoryGroup = this.categoriesFormArray.at(categoryIndex) as FormGroup;
    return categoryGroup.get('subcategories') as FormArray;
  }

  onCategorySelectionChange(categoryControl: AbstractControl, categoryIndex: number): void {
    const control = categoryControl as FormGroup;
    const isSelected = control.get('selected')?.value;
    const subcategoryArray = this.getSubcategoryControls(categoryIndex);

    if (!isSelected) {
      subcategoryArray.controls.forEach(subCtrl => {
        if (subCtrl.get('selected')?.value) {
            subCtrl.get('selected')?.setValue(false, { emitEvent: true });
        }
      });
    }
  }
}
