import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, AbstractControl, FormControl } from '@angular/forms';
import { Subject, combineLatest, distinctUntilChanged, Subscription, forkJoin, of, Observable } from 'rxjs';
import { takeUntil, debounceTime, tap, switchMap, map, catchError } from 'rxjs/operators';
import { ProductService } from '../../services/product.service';
import { ApiProduct } from '../../services/product.interfaces';
import { CategorySubcategoryService, Category as ApiCategory } from '../../services/category.service';
import { CurrencyService, SupportedCurrency } from '../../services/Currency.Service';
import { CartService, CartItem, ProductForCart } from '../../services/cart.service';
import { Branch } from '../../services/branch.service';
import { SelectedBranchService } from '../../services/selected-branch.service';
import { InventoryService, InventoryItem } from '../../services/inventory.service';
import { PromotionsService } from '../../services/promotions.service';
import { Promotion } from '../../services/promotions.interfaces';
import { BranchSelectorModalComponent } from '../../features/shared/components/branch-selector-modal/branch-selector-modal.component';
import { AuthService } from '../../services/auth.service';
interface BrandFilter {
  name: string;
  selected: boolean;
}

interface ProductWithPromotion extends ApiProduct {
  has_promotion: boolean;
  promotion_info?: {
    promotion_id: number;
    promotion_code: string;
    promotion_name: string;
    original_price: number;
    promotional_price: number;
    discount_amount: number;
    discount_percentage: number;
    discount_type: 'percentage' | 'fixed_amount';
    original_price_usd?: number;
    promotional_price_usd?: number;
  };
}

type SortOrder = 'default' | 'priceAsc' | 'priceDesc' | 'nameAsc' | 'nameDesc';

@Component({
  selector: 'app-catalogo',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    BranchSelectorModalComponent
  ],
  templateUrl: './catalogo.component.html',
  styleUrls: ['./catalogo.component.scss']
})
export class CatalogoComponent implements OnInit, OnDestroy {
  private productService = inject(ProductService);
  private categorySubcategoryService = inject(CategorySubcategoryService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private currencyService = inject(CurrencyService);
  private cartService = inject(CartService);
  private selectedBranchService = inject(SelectedBranchService);
  private inventoryService = inject(InventoryService);
  private promotionsService = inject(PromotionsService);
  private authService = inject(AuthService);

  private destroy$ = new Subject<void>();
  public currentSelectedCurrency: SupportedCurrency = 'CLP';
  private currencySubscription!: Subscription;
  private cartSubscription!: Subscription;
  private selectedBranchSubscription!: Subscription;

  allProductsMasterList: ProductWithPromotion[] = [];
  productsFilteredByUrlParams: ProductWithPromotion[] = [];
  productsToDisplay: ProductWithPromotion[] = [];
  paginatedProducts: ProductWithPromotion[] = [];

  isLoading = true;
  catalogTitle = 'Catálogo de Productos';
  activeSearchTerm: string | null = null;
  activeCategoryName: string | null = null;
  activeSubcategoryName: string | null = null;

  filterForm!: FormGroup;
  availableCategoriesForFilter: ApiCategory[] = [];
  public currentlySelectedCategoryForDisplay: FormGroup | null = null;

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

  cartItems: CartItem[] = [];
  currentSelectedBranch: Branch | null = null;
  showBranchModal = false;
  productToAddAfterBranchSelection: ProductWithPromotion | null = null;
  productStockMap: Map<string, number> = new Map();

  constructor() {}

  ngOnInit(): void {
    this.initFilterForm();
    this.loadMasterDataAndListenToRouteParams();
    this.setupFilterFormChangesSubscription();

    this.currencySubscription = this.currencyService.selectedCurrency$
      .pipe(takeUntil(this.destroy$))
      .subscribe(currency => {
        this.currentSelectedCurrency = currency;
        if (!this.isLoading && (this.currentSortOrder === 'priceAsc' || this.currentSortOrder === 'priceDesc')) {
          this.applyAllFiltersAndSort(false);
        }
      });

    this.cartSubscription = this.cartService.cartItems$
      .pipe(takeUntil(this.destroy$))
      .subscribe(items => {
        this.cartItems = items;
      });

    this.selectedBranchSubscription = this.selectedBranchService.selectedBranch$
      .pipe(takeUntil(this.destroy$))
      .subscribe(branch => {
        const previousBranchCode = this.currentSelectedBranch?.branch_code;
        this.currentSelectedBranch = branch;
        if (branch) {
          if (previousBranchCode !== branch.branch_code) {
            this.productStockMap.clear();
          }
          this.updateProductStockForVisibleItems();
        } else {
          this.productStockMap.clear();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.currencySubscription?.unsubscribe();
    this.cartSubscription?.unsubscribe();
    this.selectedBranchSubscription?.unsubscribe();
  }

  get currentSortLabel(): string {
    return this.sortOptions.find(o => o.value === this.currentSortOrder)?.label || 'Ordenar';
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

  loadMasterDataAndListenToRouteParams(): void {
    this.isLoading = true;
    combineLatest([
      this.productService.getProducts(),
      this.categorySubcategoryService.getCategories(),
    ]).pipe(
      switchMap(([products, categories]) => {
        this.availableCategoriesForFilter = [...categories];
        this.rebuildCategoryFilters(this.availableCategoriesForFilter);

        if (products && products.length > 0) {
          const processedProducts = products.map(product =>
            this.processProductWithPromotions(product)
          );
          return forkJoin(processedProducts).pipe(
            map(productsWithPromotions => ({ productsWithPromotions, categories }))
          );
        } else {
          return of({ productsWithPromotions: [], categories });
        }
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: ({ productsWithPromotions }) => {
        this.allProductsMasterList = [...productsWithPromotions];
        this.route.queryParams.pipe(
          takeUntil(this.destroy$)
        ).subscribe(queryParams => {
          this.handleRouteParamsAndUpdateForm(queryParams);
        });
      },
      error: (error) => {
        console.error('Error loading catalog data with promotions:', error);
        this.allProductsMasterList = [];
        this.isLoading = false;
      }
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
    this.catalogTitle = 'Catálogo de Productos';
    this.currentlySelectedCategoryForDisplay = null;

    this.categoriesFormArray.controls.forEach(catCtrl => {
      (catCtrl as FormGroup).get('selected')?.setValue(false, { emitEvent: false });
      const subcategoriesArray = (catCtrl as FormGroup).get('subcategories') as FormArray;
      if (subcategoriesArray) {
        subcategoriesArray.controls.forEach(subCtrl => {
          (subCtrl as FormGroup).get('selected')?.setValue(false, { emitEvent: false });
        });
      }
    });

    let targetCategoryForDisplay: FormGroup | null = null;

    if (categoryIdsFromUrlArray.length > 0) {
      const targetCatId = categoryIdsFromUrlArray[0];
      const categoryControl = this.categoriesFormArray.controls.find(c => c.value.id === targetCatId) as FormGroup;
      if (categoryControl) {
        categoryControl.get('selected')?.setValue(true, { emitEvent: false });
        targetCategoryForDisplay = categoryControl;
        if (subcategoryIdsFromUrlArray.length > 0) {
          const subcategoriesOfThisCategory = (categoryControl.get('subcategories') as FormArray)?.controls;
          subcategoryIdsFromUrlArray.forEach(subIdFromUrl => {
            const subCtrl = subcategoriesOfThisCategory?.find(sc => sc.value.id === subIdFromUrl);
            if (subCtrl) {
              (subCtrl as FormGroup).get('selected')?.setValue(true, { emitEvent: false });
            }
          });
        }
      }
    } else if (subcategoryIdsFromUrlArray.length > 0) {
      const firstSubId = subcategoryIdsFromUrlArray[0];
      for (const catCtrl of this.categoriesFormArray.controls) {
        const categoryGroup = catCtrl as FormGroup;
        const subcategoriesArray = categoryGroup.get('subcategories') as FormArray;
        const subcategoryControl = subcategoriesArray?.controls.find(sc => sc.value.id === firstSubId) as FormGroup;
        if (subcategoryControl) {
          categoryGroup.get('selected')?.setValue(true, { emitEvent: false });
          subcategoryControl.get('selected')?.setValue(true, { emitEvent: false });
          targetCategoryForDisplay = categoryGroup;
          const otherSubIdsForThisParent = subcategoryIdsFromUrlArray.slice(1);
          otherSubIdsForThisParent.forEach(subIdFromUrl => {
            const otherSubCtrl = subcategoriesArray?.controls.find(sc => sc.value.id === subIdFromUrl);
            if (otherSubCtrl) {
              (otherSubCtrl as FormGroup).get('selected')?.setValue(true, { emitEvent: false });
            }
          });
          break;
        }
      }
    }
    this.currentlySelectedCategoryForDisplay = targetCategoryForDisplay;

    let tempProducts: ProductWithPromotion[] = [...this.allProductsMasterList];
    if (searchQuery) {
      this.activeSearchTerm = searchQuery;
      this.catalogTitle = `Resultados para: "${searchQuery}"`;
      const lcSearchTerm = searchQuery.toLowerCase();
      tempProducts = tempProducts.filter(p =>
        p.nombre.toLowerCase().includes(lcSearchTerm) ||
        (p.descripcion && p.descripcion.toLowerCase().includes(lcSearchTerm)) ||
        p.marca.toLowerCase().includes(lcSearchTerm) ||
        p.categoria.toLowerCase().includes(lcSearchTerm) ||
        (p.subcategoria && p.subcategoria.toLowerCase().includes(lcSearchTerm))
      );
    } else if (targetCategoryForDisplay || subcategoryIdsFromUrlArray.length > 0) {
      const activeCatIdsInForm = targetCategoryForDisplay ? [targetCategoryForDisplay.value.id] : [];
      const activeSubIdsInForm = subcategoryIdsFromUrlArray.filter(subId => {
        if (!targetCategoryForDisplay) return false;
        const subcategoriesArray = (targetCategoryForDisplay.get('subcategories') as FormArray);
        return subcategoriesArray?.controls.some(sc => sc.value.id === subId && sc.value.selected);
      });

      const productsToShow = new Set<ProductWithPromotion>();
      this.allProductsMasterList.forEach(product => {
        const productCatId = this.getCategoryIdByName(product.categoria);
        const productSubId = this.getSubcategoryIdByName(product.subcategoria, product.categoria);
        let matchesCriteria = false;
        if (activeSubIdsInForm.length > 0) {
          if (productSubId && activeSubIdsInForm.includes(productSubId)) {
            matchesCriteria = true;
          }
        } else if (activeCatIdsInForm.length > 0) {
          if (productCatId && activeCatIdsInForm.includes(productCatId)) {
            matchesCriteria = true;
          }
        }
        if (matchesCriteria) {
          productsToShow.add(product);
        }
      });
      tempProducts = Array.from(productsToShow);
      this.updateCatalogTitleAndActiveNames(activeCatIdsInForm, activeSubIdsInForm);
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
    this.activeSearchTerm = this.route.snapshot.queryParams['search'] || null;
    this.activeCategoryName = null;
    this.activeSubcategoryName = null;

    if (numSelectedSubcats > 0) {
      const displayNames: string[] = [];
      selectedSubcatNames.forEach(item => {
        displayNames.push(`${item.catName} / ${item.subName}`);
      });
      selectedCatNames.forEach(catName => {
        const category = this.availableCategoriesForFilter.find(c => c.name === catName);
        const hasAnySubcatSelectedInUrlForThisCat = category?.subcategories?.some(s => subcategoryIds.includes(s.id));
        if (!hasAnySubcatSelectedInUrlForThisCat) {
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
        }
      } else {
        this.catalogTitle = "Selección Específica";
      }
    } else if (numSelectedCats > 0) {
      if (numSelectedCats === 1) {
        this.catalogTitle = `Categoría: ${selectedCatNames[0]}`;
        this.activeCategoryName = selectedCatNames[0];
      } else {
        this.catalogTitle = `Múltiples Categorías: ${selectedCatNames.join(', ')}`;
      }
    } else {
      this.catalogTitle = 'Catálogo de Productos';
    }

    if (this.activeSearchTerm && this.catalogTitle === 'Catálogo de Productos') {
      this.catalogTitle = `Resultados para: "${this.activeSearchTerm}"`;
    } else if (this.activeSearchTerm) {
      this.catalogTitle = `Resultados para: "${this.activeSearchTerm}" en ${this.catalogTitle}`;
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
      debounceTime(100),
      distinctUntilChanged((prev, curr) => {
        return JSON.stringify(prev) === JSON.stringify(curr);
      }),
      tap(values => {
        this.currentSortOrder = values.sortOrder as SortOrder;
      }),
      takeUntil(this.destroy$)
    ).subscribe(formValues => {
      console.log('Form values changed:', formValues);

      if (this.isLoading) {
        console.log('Skipping filter update - still loading');
        return;
      }

      const newQueryParams = this.getFilterQueryParams(formValues);
      console.log('Generated query params:', newQueryParams);

      Object.keys(newQueryParams).forEach(key => {
        if (newQueryParams[key] === undefined || newQueryParams[key] === null || newQueryParams[key].length === 0) {
          delete newQueryParams[key];
        }
      });

      const currentUrlParams = this.route.snapshot.queryParams;
      const mergedQueryParams: any = {};

      if (currentUrlParams['search']) {
        mergedQueryParams.search = currentUrlParams['search'];
      }
      Object.assign(mergedQueryParams, newQueryParams);

      let paramsChanged = false;
      const mergedKeys = Object.keys(mergedQueryParams);
      const currentActiveFilterKeys = Object.keys(currentUrlParams)
        .filter(k => ['brands', 'category', 'subcategory', 'sortOrder', 'search'].includes(k) && currentUrlParams[k] !== null && currentUrlParams[k] !== undefined);

      if (mergedKeys.length !== currentActiveFilterKeys.length) {
        paramsChanged = true;
      } else {
        for (const key of mergedKeys) {
          if (String(mergedQueryParams[key]) !== String(currentUrlParams[key])) {
            paramsChanged = true;
            break;
          }
        }
      }

      if (!paramsChanged) {
        for (const key of currentActiveFilterKeys) {
          if (!mergedQueryParams.hasOwnProperty(key) && ['brands', 'category', 'subcategory', 'sortOrder'].includes(key)) {
            paramsChanged = true;
            break;
          }
        }
      }

      console.log('Params changed:', paramsChanged, 'Current:', currentUrlParams, 'New:', mergedQueryParams);

      if (paramsChanged) {
        console.log('Navigating with new params:', mergedQueryParams);
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: mergedQueryParams,
        });
      } else if (!this.isLoading && this.allProductsMasterList.length > 0) {
        console.log('Applying filters directly without navigation');
        const currencySensitiveSort = this.currentSortOrder === 'priceAsc' || this.currentSortOrder === 'priceDesc';
        if (!currencySensitiveSort) {
          this.applyAllFiltersAndSort(false);
        }
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
      if (categoryGroup.selected) {
        const selectedSubsOfThisCat = (categoryGroup.subcategories as any[])
          .filter(sub => sub.selected)
          .map(sub => sub.id);
        if (selectedSubsOfThisCat.length === 0) {
          activeCategoryIds.push(categoryGroup.id);
        } else {
          activeSubcategoryIds.push(...selectedSubsOfThisCat);
        }
      }
    });

    if (activeCategoryIds.length > 0) {
      params.category = activeCategoryIds.join(',');
    }

    if (activeSubcategoryIds.length > 0) {
      params.subcategory = activeSubcategoryIds.join(',');
      const parentIdsOfSelectedSubcats = new Set<string>();
      activeSubcategoryIds.forEach(subId => {
        const parent = this.getCategoryBySubcategoryId(subId);
        if (parent) parentIdsOfSelectedSubcats.add(parent.id);
      });

      if (parentIdsOfSelectedSubcats.size > 0) {
        const existingCatIds = params.category ? params.category.split(',') : [];
        parentIdsOfSelectedSubcats.forEach(id => {
          if (!existingCatIds.includes(id)) existingCatIds.push(id);
        });
        if (existingCatIds.length > 0) {
          params.category = existingCatIds.join(',');
        } else {
          delete params.category;
        }
      }
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
      if (catGroup.selected) {
        const subcategoriesFromForm = (catGroup.subcategories as any[]).filter(sub => sub.selected).map(sub => sub.id);
        if (subcategoriesFromForm.length > 0) {
          selectedSubcategoryIdsFromForm.push(...subcategoriesFromForm);
        } else {
          selectedCategoryIdsFromForm.push(catGroup.id);
        }
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
          const priceA = this.currentSelectedCurrency === 'USD' ? (a.precio?.precio_dolares ?? Infinity) : (a.precio?.precio_actual ?? Infinity);
          const priceB = this.currentSelectedCurrency === 'USD' ? (b.precio?.precio_dolares ?? Infinity) : (b.precio?.precio_actual ?? Infinity);
          return priceA - priceB;
        });
        break;
      case 'priceDesc':
        tempProducts.sort((a, b) => {
          const priceA = this.currentSelectedCurrency === 'USD' ? (a.precio?.precio_dolares ?? -Infinity) : (a.precio?.precio_actual ?? -Infinity);
          const priceB = this.currentSelectedCurrency === 'USD' ? (b.precio?.precio_dolares ?? -Infinity) : (b.precio?.precio_actual ?? -Infinity);
          return priceB - priceA;
        });
        break;
      case 'nameAsc':
        tempProducts.sort((a, b) => a.nombre.localeCompare(b.nombre));
        break;
      case 'nameDesc':
        tempProducts.sort((a, b) => b.nombre.localeCompare(a.nombre));
        break;
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
    this.updateProductStockForVisibleItems();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.applyAllFiltersAndSort(false);
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.applyAllFiltersAndSort(false);
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.applyAllFiltersAndSort(false);
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
    this.filterForm.patchValue({
      brands: this.brandsFormArray.controls.map(c => ({ name: c.value.name, selected: false })),
      categories: this.categoriesFormArray.controls.map(c => ({
        id: c.value.id,
        name: c.value.name,
        selected: false,
        subcategories: (c.value.subcategories || []).map((sc: any) => ({
          id: sc.id,
          name: sc.name,
          selected: false,
          categoryId: c.value.id
        }))
      })),
      sortOrder: 'default'
    }, { emitEvent: false });
    this.currentSortOrder = 'default';
    this.currentlySelectedCategoryForDisplay = null;

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
    console.log('onCategorySelectionChange called:', categoryIndex, categoryControl.value);

    const currentCategoryGroup = categoryControl as FormGroup;
    const selectedControl = currentCategoryGroup.get('selected');

    if (!selectedControl) return;

    const isCurrentlySelected = selectedControl.value;
    console.log('Category selected state:', isCurrentlySelected);

    if (isCurrentlySelected) {
      this.currentlySelectedCategoryForDisplay = currentCategoryGroup;

      this.categoriesFormArray.controls.forEach((ctrl, i) => {
        if (i !== categoryIndex) {
          const otherCategoryGroup = ctrl as FormGroup;
          const otherSelectedControl = otherCategoryGroup.get('selected');

          if (otherSelectedControl && otherSelectedControl.value) {
            otherSelectedControl.setValue(false, { emitEvent: false });
          }

          const otherSubcategoriesArray = otherCategoryGroup.get('subcategories') as FormArray;
          if (otherSubcategoriesArray) {
            otherSubcategoriesArray.controls.forEach(subCtrl => {
              const subcategoryFormGroup = subCtrl as FormGroup;
              const subSelectedControl = subcategoryFormGroup.get('selected');
              if (subSelectedControl && subSelectedControl.value) {
                subSelectedControl.setValue(false, { emitEvent: false });
              }
            });
          }
        }
      });
    } else {
      this.currentlySelectedCategoryForDisplay = null;

      const subcategoriesArray = currentCategoryGroup.get('subcategories') as FormArray;
      if (subcategoriesArray) {
        subcategoriesArray.controls.forEach(subCtrl => {
          const subcategoryFormGroup = subCtrl as FormGroup;
          const subSelectedControl = subcategoryFormGroup.get('selected');
          if (subSelectedControl && subSelectedControl.value) {
            subSelectedControl.setValue(false, { emitEvent: false });
          }
        });
      }
    }

    this.filterForm.markAsDirty();
    this.filterForm.updateValueAndValidity();

    this.debugFilterState();
  }
  onSubcategorySelectionChange(subcategoryControl: AbstractControl, categoryIndex: number): void {
    const subcategoryGroup = subcategoryControl as FormGroup;
    const subcategorySelectedControl = subcategoryGroup.get('selected');
    const categoryGroup = this.categoriesFormArray.at(categoryIndex) as FormGroup;
    const categorySelectedControl = categoryGroup.get('selected') as FormControl;
    const subcategoriesArray = categoryGroup.get('subcategories') as FormArray;

    if (!subcategorySelectedControl || !categorySelectedControl) return;

    const isSelected = subcategorySelectedControl.value;

    if (isSelected) {
      if (!categorySelectedControl.value) {
        categorySelectedControl.setValue(true, { emitEvent: false });
        this.currentlySelectedCategoryForDisplay = categoryGroup;

        this.categoriesFormArray.controls.forEach((ctrl, i) => {
          if (i !== categoryIndex) {
            const otherCategoryGroup = ctrl as FormGroup;
            const otherSelectedControl = otherCategoryGroup.get('selected');

            if (otherSelectedControl && otherSelectedControl.value) {
              otherSelectedControl.setValue(false, { emitEvent: false });
            }

            const otherSubcategoriesArray = otherCategoryGroup.get('subcategories') as FormArray;
            if (otherSubcategoriesArray) {
              otherSubcategoriesArray.controls.forEach(subCtrl => {
                const subcatFormGroup = subCtrl as FormGroup;
                const subSelectedControl = subcatFormGroup.get('selected');
                if (subSelectedControl && subSelectedControl.value) {
                  subSelectedControl.setValue(false, { emitEvent: false });
                }
              });
            }
          }
        });
      }
    } else {
      const anyOtherSubSelected = subcategoriesArray.controls
        .filter(subCtrl => subCtrl !== subcategoryControl)
        .some(subCtrl => {
          const subGroup = subCtrl as FormGroup;
          const subSelectedControl = subGroup.get('selected');
          return subSelectedControl && subSelectedControl.value;
        });

      if (!anyOtherSubSelected && categorySelectedControl.value) {
        categorySelectedControl.setValue(false, { emitEvent: false });
        this.currentlySelectedCategoryForDisplay = null;
      }
    }

    this.filterForm.markAsDirty();
    this.filterForm.updateValueAndValidity();
  }

  private debugFilterState(): void {
    console.log('=== DEBUG FILTER STATE ===');
    console.log('currentlySelectedCategoryForDisplay:', this.currentlySelectedCategoryForDisplay?.value);
    console.log('categoriesFormArray values:', this.categoriesFormArray.value);
    console.log('filterForm valid:', this.filterForm.valid);
    console.log('filterForm dirty:', this.filterForm.dirty);
    console.log('productsToDisplay length:', this.productsToDisplay.length);
    console.log('==============================');
  }

  private updateProductStockForVisibleItems(): void {
    if (!this.currentSelectedBranch || this.paginatedProducts.length === 0) {
      return;
    }
    const branchCode = this.currentSelectedBranch.branch_code;
    this.paginatedProducts.forEach(p => {
      if (!this.productStockMap.has(p.codigo_producto)) {
        this.inventoryService.getProductStockInBranch(branchCode, p.codigo_producto)
          .subscribe(
            item => { this.productStockMap.set(p.codigo_producto, item.quantity); },
            err => {
              this.productStockMap.set(p.codigo_producto, 0);
            }
          );
      }
    });
  }

  getProductMaxStock(productCode: string): number {
    return this.productStockMap.get(productCode) ?? 0;
  }

  isStockMaxedOut(productCode: string): boolean {
    if (!this.currentSelectedBranch) return false;
    const currentInCart = this.getQuantityInCart(productCode);
    const maxStock = this.productStockMap.get(productCode);
    if (maxStock === undefined) return false;
    return currentInCart >= maxStock;
  }

  handleBranchSelectedFromModal(selectedBranch: Branch): void {
    this.showBranchModal = false;
    if (this.productToAddAfterBranchSelection && this.currentSelectedBranch) {
      this.proceedToAddToCart(this.productToAddAfterBranchSelection, this.currentSelectedBranch);
      this.productToAddAfterBranchSelection = null;
    }
  }

  handleModalClosed(): void {
    this.showBranchModal = false;
    this.productToAddAfterBranchSelection = null;
  }

  getQuantityInCart(productCode: string): number {
    if (!this.currentSelectedBranch) {
      return 0;
    }
    const item = this.cartItems.find(cartItem =>
      cartItem.product_code === productCode && cartItem.branch_code === this.currentSelectedBranch!.branch_code
    );
    return item ? item.quantity : 0;
  }

  addToCart(product: ProductWithPromotion): void {
    if (!this.currentSelectedBranch) {
      this.productToAddAfterBranchSelection = product;
      this.showBranchModal = true;
      return;
    }
    this.proceedToAddToCart(product, this.currentSelectedBranch);
  }

  private proceedToAddToCart(product: ProductWithPromotion, branch: Branch): void {
    const quantityDesired = 1;
    this.inventoryService.getProductStockInBranch(branch.branch_code, product.codigo_producto)
      .subscribe({
        next: (inventoryItem) => {
          this.productStockMap.set(product.codigo_producto, inventoryItem ? inventoryItem.quantity : 0);
          const quantityAlreadyInCart = this.getQuantityInCart(product.codigo_producto);
          const totalQuantityAfterAdd = quantityAlreadyInCart + quantityDesired;
          if (inventoryItem && inventoryItem.quantity >= totalQuantityAfterAdd) {
            const productForCart: ProductForCart = {
              codigo_producto: product.codigo_producto,
              nombre: product.nombre,
              precio: {
                precio_actual: product.precio.precio_actual,
                precio_dolares: product.precio.precio_dolares
              },
              imageUrl: product.imageUrl,
              has_promotion: product.has_promotion,
              promotion_info: product.promotion_info
            };

            this.cartService.addToCart(
              productForCart,
              quantityDesired,
              branch.branch_code,
              branch.name
            );
          } else {
            const stockAvailableToShow = inventoryItem ? inventoryItem.quantity : 0;
            console.warn(`Stock insuficiente para ${product.nombre} en ${branch.name}. Disponible: ${stockAvailableToShow}, En carrito: ${quantityAlreadyInCart}.`);
          }
        },
        error: (err) => {
          this.productStockMap.set(product.codigo_producto, 0);
          console.error(`Error al verificar stock para ${product.nombre} en ${branch.name}. El producto podría no estar disponible en esta sucursal.`, err);
        }
      });
  }

  updateQuantityFromCatalog(productCode: string, newQuantity: number): void {
    if (!this.currentSelectedBranch) {
      console.warn("Intento de actualizar cantidad sin sucursal seleccionada.");
      return;
    }
    const branch = this.currentSelectedBranch;
    if (newQuantity < 0) return;

    if (newQuantity === 0) {
      this.cartService.updateQuantity(productCode, branch.branch_code, 0);
      return;
    }

    this.inventoryService.getProductStockInBranch(branch.branch_code, productCode)
      .subscribe({
        next: (inventoryItem) => {
          this.productStockMap.set(productCode, inventoryItem ? inventoryItem.quantity : 0);
          const stockAvailable = inventoryItem ? inventoryItem.quantity : 0;
          if (stockAvailable >= newQuantity) {
            this.cartService.updateQuantity(productCode, branch.branch_code, newQuantity);
          } else {
            console.warn(`Se intentó actualizar a ${newQuantity} pero solo hay ${stockAvailable} en stock para ${productCode} en ${branch.name}.`);
          }
        },
        error: (err) => {
          this.productStockMap.set(productCode, 0);
          console.error(`Error al verificar stock para actualizar la cantidad de ${productCode}. Intente nuevamente.`, err);
        }
      });
  }

  private processProductWithPromotions(product: ApiProduct): Observable<ProductWithPromotion> {
    return this.promotionsService.getPromotionsWithDetails().pipe(
      map(activePromotions => {
        const promotionsByProduct = new Map<string, Promotion>();
        const promotionsByCategory = new Map<string, Promotion>();
        const promotionsBySubcategory = new Map<string, Promotion>();

        if (Array.isArray(activePromotions)) {
          for (const promotion of activePromotions) {
            if (!this.promotionsService.isPromotionActive(promotion)) {
              continue;
            }

            if (promotion.products && Array.isArray(promotion.products)) {
              for (const promotionProduct of promotion.products) {
                if (promotionProduct.product_code) {
                  promotionsByProduct.set(promotionProduct.product_code, promotion);
                }
              }
            }
            if (promotion.categories && Array.isArray(promotion.categories)) {
              for (const category of promotion.categories) {
                if (category.name) {
                  promotionsByCategory.set(category.name, promotion);
                }
              }
            }
            if (promotion.subcategories && Array.isArray(promotion.subcategories)) {
              for (const subcategory of promotion.subcategories) {
                if (subcategory.name) {
                  promotionsBySubcategory.set(subcategory.name, promotion);
                }
              }
            }
          }
        }

        let applicablePromotion: Promotion | undefined;
        if (promotionsByProduct.has(product.codigo_producto)) {
          applicablePromotion = promotionsByProduct.get(product.codigo_producto);
        }
        else if (product.subcategoria && promotionsBySubcategory.has(product.subcategoria)) {
          applicablePromotion = promotionsBySubcategory.get(product.subcategoria);
        }
        else if (product.categoria && promotionsByCategory.has(product.categoria)) {
          applicablePromotion = promotionsByCategory.get(product.categoria);
        }

        let productWithPromotion: ProductWithPromotion = {
          ...product,
          has_promotion: false
        };

        if (applicablePromotion) {
          const originalPrice = product.precio.precio_actual;
          const promotionalPrice = this.promotionsService.calculateDiscountedPrice(
            originalPrice,
            applicablePromotion.discount_type,
            applicablePromotion.discount_value
          );
          const discountPercentage = this.promotionsService.calculateDiscountPercentage(
            originalPrice,
            promotionalPrice
          );

          let originalPriceUsd: number | undefined;
          let promotionalPriceUsd: number | undefined;

          if (product.precio.precio_dolares != null) {
            originalPriceUsd = product.precio.precio_dolares;
            promotionalPriceUsd = this.promotionsService.calculateDiscountedPrice(
              originalPriceUsd,
              applicablePromotion.discount_type,
              applicablePromotion.discount_value
            );
          }

          productWithPromotion.has_promotion = true;
          productWithPromotion.promotion_info = {
            promotion_id: applicablePromotion.id,
            promotion_code: applicablePromotion.promotion_code,
            promotion_name: applicablePromotion.name,
            original_price: originalPrice,
            promotional_price: promotionalPrice,
            discount_amount: originalPrice - promotionalPrice,
            discount_percentage: discountPercentage,
            discount_type: applicablePromotion.discount_type,
            original_price_usd: originalPriceUsd,
            promotional_price_usd: promotionalPriceUsd
          };
        }

        return productWithPromotion;
      }),
      catchError(error => {
        console.error('Error al procesar promociones:', error);
        return of({
          ...product,
          has_promotion: false
        } as ProductWithPromotion);
      })
    );
  }

  hasPromotion(product: ProductWithPromotion): boolean {
    return product.has_promotion || false;
  }

  getCurrentPrice(product: ProductWithPromotion): number | null {
    if (!product?.precio) return null;

    if (this.hasPromotion(product) && product.promotion_info) {
      if (this.currentSelectedCurrency === 'USD') {
        return product.promotion_info.promotional_price_usd || product.promotion_info.promotional_price;
      } else {
        return product.promotion_info.promotional_price;
      }
    }

    if (this.currentSelectedCurrency === 'USD') {
      return product.precio.precio_dolares || null;
    } else {
      return product.precio.precio_actual;
    }
  }

  getOriginalPrice(product: ProductWithPromotion): number | null {
    if (!product?.precio || !this.hasPromotion(product) || !product.promotion_info) {
      return null;
    }

    if (this.currentSelectedCurrency === 'USD') {
      return product.promotion_info.original_price_usd || product.promotion_info.original_price;
    } else {
      return product.promotion_info.original_price;
    }
  }

  getDiscountPercentage(product: ProductWithPromotion): number {
    if (!this.hasPromotion(product) || !product.promotion_info) {
      return 0;
    }
    return Math.round(product.promotion_info.discount_percentage);
  }

  getPromotionName(product: ProductWithPromotion): string {
    if (!this.hasPromotion(product) || !product.promotion_info) {
      return '';
    }
    return product.promotion_info.promotion_name;
  }
}
