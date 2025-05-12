import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, AbstractControl } from '@angular/forms';
import { Subject, combineLatest, distinctUntilChanged } from 'rxjs';
import { takeUntil, debounceTime, tap } from 'rxjs/operators';

import { ProductService } from '../../services/product.service';
import { ApiProduct } from '../../services/product.interfaces';
import { CategorySubcategoryService, Category as ApiCategory } from '../../services/category.service';

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
    this.loadMasterDataAndListenToRouteParams();
    this.setupFilterFormChangesSubscription();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get currentSortLabel(): string {
    return this.sortOptions.find(o => o.value === this.currentSortOrder)?.label || 'Ordenar';
  }

  initFilterForm(): void {
    this.filterForm = this.fb.group({
      brands: this.fb.array([]),
      categories: this.fb.array([]),
      sortOrder: ['default'as SortOrder]
    });
  }

  get brandsFormArray(): FormArray {
    return this.filterForm.get('brands') as FormArray;
  }

  get categoriesFormArray(): FormArray {
    return this.filterForm.get('categories') as FormArray;
  }

  loadMasterDataAndListenToRouteParams(): void {
    this.isLoading = true;
    combineLatest([
      this.productService.getProducts(),
      this.categorySubcategoryService.getCategories(),
    ]).pipe(
      takeUntil(this.destroy$)
    ).subscribe(([products, categories]) => {
      this.allProductsMasterList = [...products];
      this.availableCategoriesForFilter = [...categories];

      this.rebuildCategoryFilters(this.availableCategoriesForFilter);

      this.route.queryParams.pipe(
        takeUntil(this.destroy$)
      ).subscribe(queryParams => {
        this.handleRouteParamsAndUpdateForm(queryParams);
      });
    });
  }

  handleRouteParamsAndUpdateForm(queryParams: any): void {
    this.isLoading = true;

    const searchQuery = queryParams['search'] || null;
    const categoryIdsFromUrlString = queryParams['category'] || null;
    const categoryIdsFromUrlArray: string[] = categoryIdsFromUrlString ? Array.from(new Set(categoryIdsFromUrlString.split(','))) : [];

    const subcategoryIdsFromUrlString = queryParams['subcategory'] || null;
    const subcategoryIdsFromUrlArray: string[] = subcategoryIdsFromUrlString ? Array.from(new Set(subcategoryIdsFromUrlString.split(','))) : [];

    const brandsFromUrl = queryParams['brands'] ? queryParams['brands'].split(',') : [];

    this.activeSearchTerm = searchQuery;
    this.activeCategoryName = null;
    this.activeSubcategoryName = null;

    this.filterForm.get('sortOrder')?.setValue(queryParams['sortOrder'] || 'default' as SortOrder, { emitEvent: false });

    let tempProducts = [...this.allProductsMasterList];
    this.catalogTitle = 'Catálogo de Productos';

    this.categoriesFormArray.controls.forEach(catCtrl => {
        (catCtrl as FormGroup).get('selected')?.setValue(false, { emitEvent: false });
        const subcategoriesArray = (catCtrl as FormGroup).get('subcategories') as FormArray;
        if (subcategoriesArray) {
            subcategoriesArray.controls.forEach(subCtrl => {
                (subCtrl as FormGroup).get('selected')?.setValue(false, { emitEvent: false });
            });
        }
    });

    categoryIdsFromUrlArray.forEach(catId => {
        const categoryControl = this.categoriesFormArray.controls.find(c => c.value.id === catId) as FormGroup;
        categoryControl?.get('selected')?.setValue(true, { emitEvent: false });
    });
    subcategoryIdsFromUrlArray.forEach(subId => {
        for (const catCtrl of this.categoriesFormArray.controls) {
            const categoryGroup = catCtrl as FormGroup;
            const subcategoriesArray = categoryGroup.get('subcategories') as FormArray;
            const subcategoryControl = subcategoriesArray?.controls.find(sc => sc.value.id === subId) as FormGroup;
            if (subcategoryControl) {
                subcategoryControl.get('selected')?.setValue(true, { emitEvent: false });
            }
        }
    });

    if (searchQuery) {
      this.activeSearchTerm = searchQuery;
      this.catalogTitle = `Resultados para: "${searchQuery}"`;
      const lcSearchTerm = searchQuery.toLowerCase();
      tempProducts = tempProducts.filter(p =>
        p.nombre.toLowerCase().includes(lcSearchTerm) ||
        p.descripcion.toLowerCase().includes(lcSearchTerm) ||
        p.marca.toLowerCase().includes(lcSearchTerm) ||
        p.categoria.toLowerCase().includes(lcSearchTerm) ||
        p.subcategoria.toLowerCase().includes(lcSearchTerm)
      );
    } else if (categoryIdsFromUrlArray.length > 0 || subcategoryIdsFromUrlArray.length > 0) {
        const productsToShow = new Set<ApiProduct>();
        this.allProductsMasterList.forEach(product => {
            const productCatId = this.getCategoryIdByName(product.categoria);
            const productSubId = this.getSubcategoryIdByName(product.subcategoria, product.categoria);
            let matchesCriteria = false;

            if (productSubId && subcategoryIdsFromUrlArray.includes(productSubId)) {
                matchesCriteria = true;
            }

            if (!matchesCriteria && productCatId && categoryIdsFromUrlArray.includes(productCatId)) {
                const parentCatObject = this.availableCategoriesForFilter.find(c => c.id === productCatId);
                const subcategoriesOfThisParentInUrl = parentCatObject?.subcategories?.filter(s => subcategoryIdsFromUrlArray.includes(s.id)) || [];
                if (subcategoriesOfThisParentInUrl.length === 0) {
                    matchesCriteria = true;
                }
            }
            if (matchesCriteria) {
                productsToShow.add(product);
            }
        });
        tempProducts = Array.from(productsToShow);
        this.updateCatalogTitleAndActiveNames(categoryIdsFromUrlArray, subcategoryIdsFromUrlArray);
    } else {
        this.catalogTitle = 'Catálogo de Productos';
    }

    this.productsFilteredByUrlParams = [...tempProducts];
    this.rebuildBrandFilters(this.productsFilteredByUrlParams);

    if (brandsFromUrl.length > 0) {
      const availableBrandNamesInForm = this.brandsFormArray.controls.map(ctrl => ctrl.value.name);
      brandsFromUrl.forEach((brandNameFromUrl: string) => {
        if (availableBrandNamesInForm.includes(brandNameFromUrl)) {
          const brandControl = this.brandsFormArray.controls.find(ctrl => ctrl.value.name === brandNameFromUrl) as FormGroup;
          brandControl?.get('selected')?.setValue(true, { emitEvent: false });
        }
      });
    }

    this.applyAllFiltersAndSort(true);
    this.isLoading = false;
  }

  private updateCatalogTitleAndActiveNames(categoryIds: string[], subcategoryIds: string[]): void {
    const numSelectedCats = categoryIds.length;
    const numSelectedSubcats = subcategoryIds.length;

    this.activeCategoryName = null;
    this.activeSubcategoryName = null;

    if (numSelectedCats === 1 && numSelectedSubcats === 1) {
        const catId = categoryIds[0];
        const subId = subcategoryIds[0];
        const parentCat = this.availableCategoriesForFilter.find(c => c.id === catId);
        const subObj = parentCat?.subcategories?.find(s => s.id === subId);
        if (parentCat && subObj && this.getCategoryBySubcategoryId(subId)?.id === parentCat.id) {
            this.catalogTitle = `${parentCat.name} / ${subObj.name}`;
            this.activeCategoryName = parentCat.name;
            this.activeSubcategoryName = subObj.name;
            return;
        }
    }

    if (numSelectedCats > 0 && numSelectedSubcats > 0) {
        this.catalogTitle = "Filtros Combinados";
    } else if (numSelectedSubcats > 0) {
        if (numSelectedSubcats === 1) {
            const subId = subcategoryIds[0];
            const parentCat = this.getCategoryBySubcategoryId(subId);
            if (parentCat) {
                const subName = parentCat.subcategories?.find(s => s.id === subId)?.name;
                this.catalogTitle = `${parentCat.name} / ${subName || 'Subcategoría'}`;
                this.activeCategoryName = parentCat.name;
                this.activeSubcategoryName = subName || null;
            } else { this.catalogTitle = "Subcategoría"; }
        } else { this.catalogTitle = "Múltiples Subcategorías"; }
    } else if (numSelectedCats > 0) {
        if (numSelectedCats === 1) {
            const cat = this.availableCategoriesForFilter.find(c => c.id === categoryIds[0]);
            if (cat) {
                this.catalogTitle = `Categoría: ${cat.name}`;
                this.activeCategoryName = cat.name;
            }
        } else { this.catalogTitle = "Múltiples Categorías"; }
    } else {
        this.catalogTitle = 'Catálogo de Productos';
    }
  }

  private getCategoryBySubcategoryId(subId: string): ApiCategory | undefined {
      for (const cat of this.availableCategoriesForFilter) {
          if (cat.subcategories?.some(s => s.id === subId)) {
              return cat;
          }
      }
      return undefined;
  }

  rebuildCategoryFilters(allAvailableCats: ApiCategory[]): void {
    this.categoriesFormArray.clear({ emitEvent: false });
    allAvailableCats.forEach(category => {
      const subcategoryControls = (category.subcategories || []).map(sub =>
        this.fb.group({ id: sub.id, name: sub.name, selected: false, categoryId: category.id })
      );
      this.categoriesFormArray.push(this.fb.group({
        id: category.id, name: category.name, selected: false, subcategories: this.fb.array(subcategoryControls)
      }), { emitEvent: false });
    });
  }

  rebuildBrandFilters(baseProductsForBrands: ApiProduct[]): void {
    const uniqueBrands = [...new Set(baseProductsForBrands.map(p => p.marca.trim()).filter(b => b))].sort();
    this.brandsFormArray.clear({ emitEvent: false });

    uniqueBrands.forEach(brand => {
      this.brandsFormArray.push(this.fb.group({
        name: brand,
        selected: false
      }), { emitEvent: false });
    });
  }

  setupFilterFormChangesSubscription(): void {
  this.filterForm.valueChanges.pipe(
    debounceTime(400),
    takeUntil(this.destroy$),
    tap(values => { this.currentSortOrder = values.sortOrder as SortOrder; })
  ).subscribe(formValues => {
    if (this.isLoading) {
      return;
    }
    const newQueryParams = this.getFilterQueryParams(formValues);
    Object.keys(newQueryParams).forEach(key => {
      if (!newQueryParams[key] || newQueryParams[key].length === 0) {
        delete newQueryParams[key];
      }
    });

    const queryParamsToNavigate: any = {...this.route.snapshot.queryParams, ...newQueryParams};
    if (!newQueryParams['brands']) {
      delete queryParamsToNavigate['brands'];
    }
    if (!newQueryParams['category']) {
      delete queryParamsToNavigate['category'];
    }
    if (!newQueryParams['subcategory']) {
      delete queryParamsToNavigate['subcategory'];
    }

    const currentUrlParams = this.route.snapshot.queryParams;

    let paramsChanged = false;
    const newKeys = Object.keys(queryParamsToNavigate);
    const currentKeys = Object.keys(currentUrlParams);

    if (newKeys.length !== currentKeys.length) {
      paramsChanged = true;
    } else {
      for (const key of newKeys) {
        if (!currentKeys.includes(key) || String(queryParamsToNavigate[key]) !== String(currentUrlParams[key])) {
          paramsChanged = true;
          break;
        }
      }
    }

    if (paramsChanged) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: queryParamsToNavigate,
      });
    }
    this.applyAllFiltersAndSort();
  });
}

  getFilterQueryParams(formValues: any): any {
  const params: any = {};
  const selectedBrands = formValues.brands.filter((b: BrandFilter) => b.selected).map((b: BrandFilter) => b.name);
  if (selectedBrands.length > 0) {
    params.brands = selectedBrands.join(',');
  }

  const activeCategoryIds: string[] = [];
  const activeSubcategoryIds: string[] = [];

  formValues.categories.forEach((categoryGroup: any) => {
    if (categoryGroup.selected) {
      activeCategoryIds.push(categoryGroup.id);
    }
    if (categoryGroup.subcategories) {
      const selectedSubs = (categoryGroup.subcategories as any[])
        .filter(sub => sub.selected)
        .map(sub => sub.id);
      activeSubcategoryIds.push(...selectedSubs);
    }
  });

  const uniqueSubcategoryIds = [...new Set(activeSubcategoryIds)];
  const uniqueCategoryIds = [...new Set(activeCategoryIds)];

  if (uniqueSubcategoryIds.length > 0) {
    params.subcategory = uniqueSubcategoryIds.join(',');
  }
  if (uniqueCategoryIds.length > 0) {
    params.category = uniqueCategoryIds.join(',');
  }

  if (formValues.sortOrder && formValues.sortOrder !== 'default') {
    params.sortOrder = formValues.sortOrder;
  }

  Object.keys(params).forEach(key => {
    if (!params[key] || params[key].length === 0) {
      delete params[key];
    }
  });

  return params;
}

  applyAllFiltersAndSort(resetPage: boolean = true): void {
    let tempProducts = [...this.productsFilteredByUrlParams];
    const formValues = this.filterForm.getRawValue();

    const selectedBrandsFromForm = formValues.brands.filter((b: BrandFilter) => b.selected).map((b: BrandFilter) => b.name);
    if (selectedBrandsFromForm.length > 0) {
      tempProducts = tempProducts.filter(p => selectedBrandsFromForm.includes(p.marca));
    }

    switch (this.currentSortOrder) {
      case 'priceAsc': tempProducts.sort((a, b) => a.precio.precio_actual - b.precio.precio_actual); break;
      case 'priceDesc': tempProducts.sort((a, b) => b.precio.precio_actual - a.precio.precio_actual); break;
      case 'nameAsc': tempProducts.sort((a,b) => a.nombre.localeCompare(b.nombre)); break;
      case 'nameDesc': tempProducts.sort((a,b) => b.nombre.localeCompare(a.nombre)); break;
    }

    this.productsToDisplay = tempProducts;
    this.totalPages = Math.ceil(this.productsToDisplay.length / this.itemsPerPage);
    this.currentPage = resetPage ? 1 : Math.max(1, Math.min(this.currentPage, this.totalPages || 1));
    this.updatePaginatedProducts();
  }

  getCategoryIdByName(name: string): string | undefined {
    return this.availableCategoriesForFilter.find(c => c.name === name)?.id;
  }

  getSubcategoryIdByName(subName: string, catName: string): string | undefined {
    const category = this.availableCategoriesForFilter.find(c => c.name === catName);
    return category?.subcategories?.find(s => s.name === subName)?.id;
  }

  updatePaginatedProducts(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.paginatedProducts = this.productsToDisplay.slice(startIndex, startIndex + this.itemsPerPage);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.applyAllFiltersAndSort(false);
    }
  }
  nextPage(): void { if (this.currentPage < this.totalPages) { this.currentPage++; this.applyAllFiltersAndSort(false); }}
  previousPage(): void { if (this.currentPage > 1) { this.currentPage--; this.applyAllFiltersAndSort(false); }}

  getPages(): number[] {
    const pages = []; let startPage = Math.max(1, this.currentPage - 2); let endPage = Math.min(this.totalPages, this.currentPage + 2);
    if (this.totalPages <= 5) { startPage = 1; endPage = this.totalPages; }
    else { if (this.currentPage <= 3) endPage = 5; else if (this.currentPage > this.totalPages - 3) startPage = this.totalPages - 4; }
    for (let i = startPage; i <= endPage; i++) pages.push(i);
    return pages;
  }

  limpiarFiltros(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  toggleSortDropdown(): void { this.showSortDropdown = !this.showSortDropdown; }
  selectSortOrder(orderValue: string): void {
    this.filterForm.get('sortOrder')?.setValue(orderValue as SortOrder);
    this.showSortDropdown = false;
  }

  getSubcategoryControls(categoryIndex: number): FormArray {
    const categoryGroup = this.categoriesFormArray.at(categoryIndex) as FormGroup;
    return categoryGroup.get('subcategories') as FormArray;
  }

  onCategorySelectionChange(categoryControl: AbstractControl, categoryIndex: number): void {
  }

  onSubcategorySelectionChange(subcategoryControl: AbstractControl, categoryIndex: number): void {
  }
}
