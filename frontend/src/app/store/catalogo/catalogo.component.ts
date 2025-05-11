import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, FormControl, ReactiveFormsModule, AbstractControl } from '@angular/forms';
import { Subject, combineLatest, Observable } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, map, startWith, tap } from 'rxjs/operators';

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

      this.handleRouteParamsAndInitialFilter(queryParams);
      this.isLoading = false;
    });
  }

  handleRouteParamsAndInitialFilter(queryParams: any): void {
    const searchQuery = queryParams['search'];
    const categoryQueryId = queryParams['category'];
    const subcategoryQueryId = queryParams['subcategory'];

    this.activeSearchTerm = searchQuery || null;
    this.activeCategoryName = null;
    this.activeSubcategoryName = null;

    this.filterForm.get('sortOrder')?.setValue('default' as SortOrder, { emitEvent: false });

    let tempProducts = [...this.allProductsMasterList];

    if (this.activeSearchTerm) {
      const lcSearchTerm = this.activeSearchTerm.toLowerCase();
      this.catalogTitle = `Resultados para: "${this.activeSearchTerm}"`;
      tempProducts = tempProducts.filter(p =>
        p.nombre.toLowerCase().includes(lcSearchTerm) ||
        p.descripcion.toLowerCase().includes(lcSearchTerm) ||
        p.marca.toLowerCase().includes(lcSearchTerm) ||
        p.categoria.toLowerCase().includes(lcSearchTerm) ||
        p.subcategoria.toLowerCase().includes(lcSearchTerm)
      );
    } else if (categoryQueryId) {
      const cat = this.availableCategoriesForFilter.find(c => c.id === categoryQueryId);
      if (cat) {
        this.activeCategoryName = cat.name;
        this.catalogTitle = `Categoría: ${cat.name}`;
        tempProducts = tempProducts.filter(p => this.getCategoryIdByName(p.categoria) === categoryQueryId);

        if (subcategoryQueryId) {
          const subcat = cat.subcategories?.find(s => s.id === subcategoryQueryId);
          if (subcat) {
            this.activeSubcategoryName = subcat.name;
            this.catalogTitle += ` / ${subcat.name}`;
            tempProducts = tempProducts.filter(p => this.getSubcategoryIdByName(p.subcategoria, p.categoria) === subcategoryQueryId);
          }
        }
      }
    } else {
      this.catalogTitle = 'Catálogo de Productos';
    }
    this.productsFilteredByUrlParams = [...tempProducts];

    this.rebuildCategoryFilters(this.availableCategoriesForFilter, categoryQueryId, subcategoryQueryId);
    this.rebuildBrandFilters(this.productsFilteredByUrlParams);
    this.applySideBarFiltersAndSort();
  }

  rebuildCategoryFilters(allAvailableCats: ApiCategory[], activeCategoryId?: string, activeSubcategoryId?: string): void {
    const currentSelectedCategories = this.filterForm.getRawValue().categories;
    this.categoriesFormArray.clear();
    allAvailableCats.forEach(category => {
      const previouslySelectedCat = currentSelectedCategories.find((c: any) => c.id === category.id);

      const subcategoryControls = (category.subcategories || []).map(sub => {
        const previouslySelectedSub = previouslySelectedCat?.subcategories?.find((s: any) => s.id === sub.id);
        return this.fb.group({
            id: sub.id,
            name: sub.name,
            selected: activeSubcategoryId === sub.id && activeCategoryId === category.id ? true : (previouslySelectedSub?.selected || false),
            categoryId: category.id
          });
        }
      );

      this.categoriesFormArray.push(this.fb.group({
        id: category.id,
        name: category.name,
        selected: activeCategoryId === category.id && !activeSubcategoryId ? true : (previouslySelectedCat?.selected || false),
        subcategories: this.fb.array(subcategoryControls)
      }), { emitEvent: false });
    });
  }

  rebuildBrandFilters(baseProductsForBrands: ApiProduct[]): void {
    const currentSelectedBrands = this.filterForm.getRawValue().brands.filter((b: BrandFilter) => b.selected).map((b: BrandFilter) => b.name);
    this.brandsFormArray.clear();
    const uniqueBrands = [...new Set(baseProductsForBrands.map(p => p.marca))].sort();
    uniqueBrands.forEach(brand => {
      this.brandsFormArray.push(this.fb.group({
        name: brand,
        selected: currentSelectedBrands.includes(brand)
      }), { emitEvent: false });
    });
  }

  setupFilterFormChangesSubscription(): void {
    this.filterForm.valueChanges.pipe(
      debounceTime(350),
      takeUntil(this.destroy$),
      tap(values => this.currentSortOrder = values.sortOrder as SortOrder)
    ).subscribe(() => {
      this.applySideBarFiltersAndSort();
    });
  }

  applySideBarFiltersAndSort(): void {
    let tempProducts = [...this.productsFilteredByUrlParams];
    const formValues = this.filterForm.getRawValue();

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

    if (selectedSubcategoryIdsFromForm.length > 0) {
        tempProducts = tempProducts.filter(p => {
            const subcategoryId = this.getSubcategoryIdByName(p.subcategoria, p.categoria);
            return subcategoryId !== undefined && selectedSubcategoryIdsFromForm.includes(subcategoryId);
        });
    } else if (selectedCategoryIdsFromForm.length > 0) {
        tempProducts = tempProducts.filter(p => {
            const categoryId = this.getCategoryIdByName(p.categoria);
            return categoryId !== undefined && selectedCategoryIdsFromForm.includes(categoryId);
        });
    }

    this.rebuildBrandFilters(tempProducts);

    const updatedFormValues = this.filterForm.getRawValue();
    const selectedBrands = updatedFormValues.brands.filter((b: BrandFilter) => b.selected).map((b: BrandFilter) => b.name);

    if (selectedBrands.length > 0) {
      tempProducts = tempProducts.filter(p => selectedBrands.includes(p.marca));
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
    this.currentPage = 1;
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
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedProducts();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePaginatedProducts();
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePaginatedProducts();
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
    }).then(() => {
        this.productsFilteredByUrlParams = [...this.allProductsMasterList];
        this.filterForm.get('sortOrder')?.setValue('default' as SortOrder, { emitEvent: false });
        this.rebuildCategoryFilters(this.availableCategoriesForFilter);
        this.rebuildBrandFilters(this.productsFilteredByUrlParams);
        this.applySideBarFiltersAndSort();
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
            subCtrl.get('selected')?.setValue(false, { emitEvent: false });
        }
      });
    }
  }
}
