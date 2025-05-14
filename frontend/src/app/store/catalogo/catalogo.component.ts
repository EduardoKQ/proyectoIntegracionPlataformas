import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, AbstractControl, FormControl } from '@angular/forms';
import { Subject, combineLatest, distinctUntilChanged, Subscription } from 'rxjs';
import { takeUntil, debounceTime, tap } from 'rxjs/operators';
import { ProductService } from '../../services/product.service';
import { ApiProduct } from '../../services/product.interfaces';
import { CategorySubcategoryService, Category as ApiCategory } from '../../services/category.service';
import { CurrencyService, SupportedCurrency } from '../../services/Currency.Service';

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

  public currentSelectedCurrency: SupportedCurrency = 'CLP';
  private currencySubscription!: Subscription;
  private currencyService = inject(CurrencyService);


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
    this.currencySubscription = this.currencyService.selectedCurrency$
      .pipe(takeUntil(this.destroy$))
      .subscribe(currency => {
        this.currentSelectedCurrency = currency;
        if (this.currentSortOrder === 'priceAsc' || this.currentSortOrder === 'priceDesc') {
           if (!this.isLoading) {
            this.applyAllFiltersAndSort(false);
           }
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.currencySubscription?.unsubscribe();
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
        if (categoryControl) {
            categoryControl.get('selected')?.setValue(true, { emitEvent: false });
        }
    });
    subcategoryIdsFromUrlArray.forEach(subId => {
        for (const catCtrl of this.categoriesFormArray.controls) {
            const categoryGroup = catCtrl as FormGroup;
            const subcategoriesArray = categoryGroup.get('subcategories') as FormArray;
            const subcategoryControl = subcategoriesArray?.controls.find(sc => sc.value.id === subId) as FormGroup;
            if (subcategoryControl) {
                subcategoryControl.get('selected')?.setValue(true, { emitEvent: false });
                categoryGroup.get('selected')?.setValue(true, { emitEvent: false });
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
                const hasSelectedSubcategoriesWithinThisParent = parentCatObject?.subcategories?.some(s => subcategoryIdsFromUrlArray.includes(s.id));
                if (!hasSelectedSubcategoriesWithinThisParent || (productSubId && subcategoryIdsFromUrlArray.includes(productSubId))) {
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
    const selectedCatNames = categoryIds
        .map(id => this.availableCategoriesForFilter.find(c => c.id === id)?.name)
        .filter((name): name is string => name !== undefined);
    const selectedSubcatNames: { catName: string, subName: string }[] = [];
    subcategoryIds.forEach(subId => {
        const parentCat = this.getCategoryBySubcategoryId(subId);
        if (parentCat) {
            const subObj = parentCat.subcategories?.find(s => s.id === subId);
            if (subObj) {
                selectedSubcatNames.push({ catName: parentCat.name, subName: subObj.name });
            }
        }
    });
    const numSelectedCats = selectedCatNames.length;
    const numSelectedSubcats = selectedSubcatNames.length;
    this.activeSearchTerm = null;
    this.activeCategoryName = null;
    this.activeSubcategoryName = null;
    if (numSelectedSubcats > 0) {
        const displayNames: string[] = [];
        selectedSubcatNames.forEach(item => {
            const parentCatIsSelected = selectedCatNames.includes(item.catName);
            if (parentCatIsSelected && numSelectedCats === 1) {
                displayNames.push(`${item.catName} / ${item.subName}`);
            } else if (!parentCatIsSelected){
                displayNames.push(`${item.catName} / ${item.subName}`);
            }
        });
          selectedCatNames.forEach(catName => {
            const category = this.availableCategoriesForFilter.find(c => c.name === catName);
              const hasAnySubcatSelectedInUrl = category?.subcategories?.some(s => subcategoryIds.includes(s.id));
              if (!hasAnySubcatSelectedInUrl) {
                  displayNames.push(catName);
              }
          });
        const uniqueDisplayNames = [...new Set(displayNames)];
        if (uniqueDisplayNames.length > 0) {
              this.catalogTitle = uniqueDisplayNames.join(', ');
              if (uniqueDisplayNames.length === 1) {
                  const parts = uniqueDisplayNames[0].split(' / ');
                  this.activeCategoryName = parts[0] || null;
                  this.activeSubcategoryName = parts[1] || null;
              } else {
                  this.activeCategoryName = null;
                  this.activeSubcategoryName = null;
              }
        } else {
              if(numSelectedSubcats === 1) {
                  this.catalogTitle = `${selectedSubcatNames[0].catName} / ${selectedSubcatNames[0].subName}`;
                  this.activeCategoryName = selectedSubcatNames[0].catName;
                  this.activeSubcategoryName = selectedSubcatNames[0].subName;
              } else {
                  this.catalogTitle = "Múltiples Subcategorías";
                  this.activeCategoryName = null;
                  this.activeSubcategoryName = null;
              }
        }
    } else if (numSelectedCats > 0) {
        if (numSelectedCats === 1) {
            this.catalogTitle = `Categoría: ${selectedCatNames[0]}`;
            this.activeCategoryName = selectedCatNames[0];
            this.activeSubcategoryName = null;
        } else {
            this.catalogTitle = `Múltiples Categorías: ${selectedCatNames.join(', ')}`;
            this.activeCategoryName = null;
            this.activeSubcategoryName = null;
        }
    } else {
        this.catalogTitle = 'Catálogo de Productos';
        this.activeCategoryName = null;
        this.activeSubcategoryName = null;
    }
      if (this.activeSearchTerm) {
          this.catalogTitle = `Resultados para: "${this.activeSearchTerm}"` + (this.catalogTitle !== 'Catálogo de Productos' ? ` en ${this.catalogTitle}` : '');
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
    distinctUntilChanged((prev, curr) => {
        const prevSelectedBrands = prev.brands.filter((b: BrandFilter) => b.selected).map((b: BrandFilter) => b.name).join(',');
        const currSelectedBrands = curr.brands.filter((b: BrandFilter) => b.selected).map((b: BrandFilter) => b.name).join(',');
        const prevSelectedCatSubs = prev.categories.map((cat: any) => {
            const selectedSubs = (cat.subcategories || []).filter((sub: any) => sub.selected).map((sub: any) => sub.id).join(',');
            return `${cat.id}:${cat.selected ? 'T' : 'F'}:${selectedSubs}`;
        }).join(';');
          const currSelectedCatSubs = curr.categories.map((cat: any) => {
            const selectedSubs = (cat.subcategories || []).filter((sub: any) => sub.selected).map((sub: any) => sub.id).join(',');
            return `${cat.id}:${cat.selected ? 'T' : 'F'}:${selectedSubs}`;
        }).join(';');
        return prevSelectedBrands === currSelectedBrands &&
                prevSelectedCatSubs === currSelectedCatSubs &&
                prev.sortOrder === curr.sortOrder;
    }),
    tap(values => { this.currentSortOrder = values.sortOrder as SortOrder; }),
    takeUntil(this.destroy$)
  ).subscribe(formValues => {
    if (this.isLoading) {
      return;
    }
    const newQueryParams = this.getFilterQueryParams(formValues);
    Object.keys(newQueryParams).forEach(key => {
      if (newQueryParams[key] === undefined || newQueryParams[key] === null || newQueryParams[key].length === 0) {
        delete newQueryParams[key];
      }
    });
      const currentUrlParams = this.route.snapshot.queryParams;
      const mergedQueryParams: any = {};
      Object.keys(currentUrlParams).forEach(key => {
          if (!['brands', 'category', 'subcategory', 'sortOrder'].includes(key)) {
              mergedQueryParams[key] = currentUrlParams[key];
          }
      });
    if (currentUrlParams['search']) {
        mergedQueryParams.search = currentUrlParams['search'];
    }


    Object.assign(mergedQueryParams, newQueryParams);

    let paramsChanged = false;
    const finalNewKeys = Object.keys(mergedQueryParams);
    const finalCurrentKeys = Object.keys(currentUrlParams);
    if (finalNewKeys.length !== finalCurrentKeys.filter(k => mergedQueryParams.hasOwnProperty(k) || currentUrlParams[k] !== undefined).length) {
      paramsChanged = true;
    } else {
      for (const key of finalNewKeys) {
        const newVal = mergedQueryParams[key] === undefined || mergedQueryParams[key] === null ? '' : String(mergedQueryParams[key]);
        const currentVal = currentUrlParams[key] === undefined || currentUrlParams[key] === null ? '' : String(currentUrlParams[key]);
        if (newVal !== currentVal) {
            paramsChanged = true;
            break;
        }
      }
      if (!paramsChanged) {
          for (const key of finalCurrentKeys) {
              if (['brands', 'category', 'subcategory', 'sortOrder'].includes(key) && !mergedQueryParams.hasOwnProperty(key)) {
                  paramsChanged = true;
                  break;
              }
          }
      }
    }

    if (paramsChanged) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: mergedQueryParams,
      });
    } else {
        this.applyAllFiltersAndSort(true);
    }
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
        const selectedSubsOfThisCat = (categoryGroup.subcategories as any[])
            .filter(sub => sub.selected)
            .map(sub => sub.id);

      if (categoryGroup.selected && selectedSubsOfThisCat.length === 0) {
          activeCategoryIds.push(categoryGroup.id);
      }
      if (categoryGroup.subcategories) {
        activeSubcategoryIds.push(...selectedSubsOfThisCat);
      }
    });
    if (activeCategoryIds.length > 0) {
        params.category = activeCategoryIds.join(',');
    }
    if (activeSubcategoryIds.length > 0) {
      params.subcategory = activeSubcategoryIds.join(',');
    }
    if (formValues.sortOrder && formValues.sortOrder !== 'default') {
      params.sortOrder = formValues.sortOrder;
    }
    return params;
}
  applyAllFiltersAndSort(resetPage: boolean = true): void {
    let tempProducts = [...this.productsFilteredByUrlParams];
    const formValues = this.filterForm.getRawValue();

    const selectedBrandsFromForm = formValues.brands.filter((b: BrandFilter) => b.selected).map((b: BrandFilter) => b.name);
    if (selectedBrandsFromForm.length > 0) {
      tempProducts = tempProducts.filter(p => selectedBrandsFromForm.includes(p.marca));
    }
    const selectedCategoryIdsFromForm: string[] = [];
    const selectedSubcategoryIdsFromForm: string[] = [];
    formValues.categories.forEach((catGroup: any) => {
        const subcategoriesFromForm = (catGroup.subcategories as any[]).filter(sub => sub.selected).map(sub => sub.id);
        if (subcategoriesFromForm.length > 0) {
            selectedSubcategoryIdsFromForm.push(...subcategoriesFromForm);
        } else if (catGroup.selected) {
            selectedCategoryIdsFromForm.push(catGroup.id);
        }
    });

    if (selectedSubcategoryIdsFromForm.length > 0) {
        tempProducts = tempProducts.filter(p => {
            const productSubId = this.getSubcategoryIdByName(p.subcategoria, p.categoria);
            return productSubId && selectedSubcategoryIdsFromForm.includes(productSubId);
        });
    } else if (selectedCategoryIdsFromForm.length > 0) {
        tempProducts = tempProducts.filter(p => {
            const productCatId = this.getCategoryIdByName(p.categoria);
            return productCatId && selectedCategoryIdsFromForm.includes(productCatId);
        });
    }
    const sortOrder = formValues.sortOrder as SortOrder;
    switch (sortOrder) {
      case 'priceAsc':
        tempProducts.sort((a, b) => {
          const priceA = this.currentSelectedCurrency === 'USD' ? (a.precio.precio_dolares ?? Infinity) : a.precio.precio_actual;
          const priceB = this.currentSelectedCurrency === 'USD' ? (b.precio.precio_dolares ?? Infinity) : b.precio.precio_actual;
          return priceA - priceB;
        });
        break;
      case 'priceDesc':
        tempProducts.sort((a, b) => {
          const priceA = this.currentSelectedCurrency === 'USD' ? (a.precio.precio_dolares ?? -Infinity) : a.precio.precio_actual;
          const priceB = this.currentSelectedCurrency === 'USD' ? (b.precio.precio_dolares ?? -Infinity) : b.precio.precio_actual;
          return priceB - priceA;
        });
        break;
      case 'nameAsc': tempProducts.sort((a,b) => a.nombre.localeCompare(b.nombre)); break;
      case 'nameDesc': tempProducts.sort((a,b) => b.nombre.localeCompare(a.nombre)); break;
        case 'default':
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
    return this.availableCategoriesForFilter.find(c => c.name === name)?.id;
  }

  getSubcategoryIdByName(subName: string | undefined, catName: string): string | undefined {
    if (!subName) return undefined;
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
    this.filterForm.patchValue({
        brands: this.brandsFormArray.controls.map(c => ({ name: c.value.name, selected: false })),
        categories: this.categoriesFormArray.controls.map(c => ({
            id: c.value.id,
            name: c.value.name,
            selected: false,
            subcategories: (c.value.subcategories || []).map((sc: any) => ({ id: sc.id, name: sc.name, selected: false, categoryId: c.value.id }))
        })),
        sortOrder: 'default'
    }, { emitEvent: false });
    this.currentSortOrder = 'default';
    const currentParams = this.route.snapshot.queryParams;
    const paramsToKeep: any = {};
    if (currentParams['search']) {
        paramsToKeep.search = currentParams['search'];
    }
    this.router.navigate([], {
        relativeTo: this.route,
        queryParams: paramsToKeep
    });
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
      const categoryGroup = categoryControl as FormGroup;
      const isSelected = categoryGroup.get('selected')?.value;
      const subcategoriesArray = categoryGroup.get('subcategories') as FormArray;

      if (!isSelected && subcategoriesArray) {
          subcategoriesArray.controls.forEach(subCtrl => {
              (subCtrl as FormGroup).get('selected')?.setValue(false, { emitEvent: true });
          });
      }
  }

  onSubcategorySelectionChange(subcategoryControl: AbstractControl, categoryIndex: number): void {
      const subcategoryGroup = subcategoryControl as FormGroup;
      const isSelected = subcategoryGroup.get('selected')?.value;
      const categoryGroup = this.categoriesFormArray.at(categoryIndex) as FormGroup;
      const categorySelectedControl = categoryGroup.get('selected') as FormControl;
      const subcategoriesArray = categoryGroup.get('subcategories') as FormArray;

      if (isSelected && !categorySelectedControl.value) {
          categorySelectedControl.setValue(true, { emitEvent: true });
      } else if (!isSelected) {
          const anyOtherSubSelected = subcategoriesArray.controls
            .filter(subCtrl => subCtrl !== subcategoryControl)
            .some(subCtrl => (subCtrl as FormGroup).get('selected')?.value);

          if (!anyOtherSubSelected && categorySelectedControl.value) {
              categorySelectedControl.setValue(false, { emitEvent: true });
          }
      }
  }
  addToCart(product: ApiProduct): void {
    console.log('Añadir al carrito (desde catálogo):', product.nombre, product.codigo_producto);
  }
}
