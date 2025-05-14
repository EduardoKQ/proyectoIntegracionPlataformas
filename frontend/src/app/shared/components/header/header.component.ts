import { Component, OnInit, OnDestroy, ElementRef, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { CategorySubcategoryService, Category as ApiCategory, SubcategoryFromCategoryDetail as ApiSubcategory } from '../../../services/category.service';
import { ProductService } from '../../../services/product.service';
import { ApiProduct } from '../../../services/product.interfaces';
import { Subject, of, Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, takeUntil, filter, tap, map, finalize } from 'rxjs/operators';

import { CurrencyService, SupportedCurrency } from '../../../services/Currency.Service';
interface DisplayCategory {
  id: string;
  title: string;
  subcategories: DisplaySubcategory[];
}

interface DisplaySubcategory {
  id: string;
  title: string;
  linkParams: { queryParams: { category: string, subcategory?: string } };
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private elementRef = inject(ElementRef);
  private categorySubcategoryService = inject(CategorySubcategoryService);
  private productService = inject(ProductService);
  public currencyService = inject(CurrencyService);

  private destroy$ = new Subject<void>();

  showCategoriesMenu = false;
  allDisplayCategories: DisplayCategory[] = [];
  hoveredCategory: DisplayCategory | null = null;
  currentSubcategories: DisplaySubcategory[] = [];

  searchQuery = '';
  searchResults: ApiProduct[] = [];
  showSearchResults = false;
  isLoadingSearch = false;
  private searchSubject = new Subject<string>();

  showDropdown = false;
  userName: string | null = null;
  isAdminUser: boolean = false;
  isUserLoggedIn: boolean = false;
  private readonly ADMIN_TIENDA_ROLES = ['vendedor', 'bodeguero', 'contador', 'administrador_tienda', 'superuser'];

  constructor() {
  }

  ngOnInit(): void {
    this.updateLoginState();
    this.loadCategories();
    this.setupSearch();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  updateLoginState(): void {
    this.isUserLoggedIn = this.authService.isLoggedIn();
    if (this.isUserLoggedIn) {
      const user = this.authService.getUserData();
      this.userName = user ? (user.email.split('@')[0]) : 'Usuario';
      this.isAdminUser = user && user.role ? this.ADMIN_TIENDA_ROLES.includes(user.role) : false;
    } else {
      this.userName = null;
      this.isAdminUser = false;
    }
  }

  loadCategories(): void {
    this.categorySubcategoryService.getCategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (apiCategories: ApiCategory[]) => {
          this.allDisplayCategories = apiCategories.map(apiCat => ({
            id: apiCat.id,
            title: apiCat.name,
            subcategories: (apiCat.subcategories || []).map(apiSubcat => ({
              id: apiSubcat.id,
              title: apiSubcat.name,
              linkParams: { queryParams: { category: apiCat.id, subcategory: apiSubcat.id } }
            }))
          }));
        },
        error: (err) => console.error('Error al cargar categorías:', err)
      });
  }

  toggleCategoriesMenu(): void {
    this.showCategoriesMenu = !this.showCategoriesMenu;
    if (!this.showCategoriesMenu) {
      this.hoveredCategory = null;
      this.currentSubcategories = [];
    }
  }

  closeCategoriesMenu(): void {
    this.showCategoriesMenu = false;
    this.hoveredCategory = null;
    this.currentSubcategories = [];
  }

  hoverCategory(category: DisplayCategory): void {
    this.hoveredCategory = category;
    this.currentSubcategories = category ? category.subcategories : [];
  }

  onSearchInputChange(): void {
    const query = this.searchQuery.trim();
    if (query.length > 1) {
      this.isLoadingSearch = true;
      this.showSearchResults = true;
      this.searchSubject.next(query);
    } else if (query.length <= 1 && this.showSearchResults) {
      this.searchResults = [];
      this.showSearchResults = false;
      this.isLoadingSearch = false;
    }
  }

  performSearchNavigation(): void {
    const trimmedQuery = this.searchQuery.trim();
    if (trimmedQuery) {
      this.router.navigate(['/catalogo'], { queryParams: { search: trimmedQuery } });
    } else {
      this.router.navigate(['/catalogo']);
    }
    this.clearSearchAfterNavigation();
  }

  clearSearchAfterNavigation(): void {
    this.showSearchResults = false;
    this.isLoadingSearch = false;
  }

  setupSearch(): void {
    this.searchSubject.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      filter(query => query.length > 1),
      switchMap((query: string): Observable<ApiProduct[]> => {
        this.isLoadingSearch = true;
        return this.productService.getProducts().pipe(
          map((products: ApiProduct[]) =>
            products.filter((product: ApiProduct) =>
              product.nombre.toLowerCase().includes(query.toLowerCase()) ||
              (product.marca && product.marca.toLowerCase().includes(query.toLowerCase())) ||
              (product.descripcion && product.descripcion.toLowerCase().includes(query.toLowerCase())) ||
              product.codigo_producto.toLowerCase().includes(query.toLowerCase())
            ).slice(0, 10)
          ),
          catchError((): Observable<ApiProduct[]> => {
            this.isLoadingSearch = false;
            return of([]);
          }),
          finalize(() => {
          })
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe((results: ApiProduct[]) => {
      this.searchResults = results;
      this.isLoadingSearch = false;
      this.showSearchResults = true;
    });
  }

  selectSearchResult(product: ApiProduct): void {
    this.router.navigate(['/store/product-detail', product.codigo_producto]);
    this.clearSearch();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchResults = [];
    this.showSearchResults = false;
    this.isLoadingSearch = false;
  }

  toggleUserDropdown(): void {
    this.showDropdown = !this.showDropdown;
  }

  navigateTo(route: string, queryParams?: object): void {
    if (queryParams) {
      this.router.navigate([route], { queryParams });
    } else {
      this.router.navigate([route]);
    }
    this.showDropdown = false;
    this.closeCategoriesMenu();
  }

  navigateToCategory(params: { queryParams: { category: string, subcategory?: string } }): void {
    this.router.navigate(['/catalogo'], params);
    this.closeCategoriesMenu();
  }

  goToAdminDashboard(): void {
    const userRole = this.authService.getCurrentUserRole();
    if (!userRole) {
      console.error('goToAdminDashboard: No se pudo determinar el rol del usuario. Redirigiendo a /login.');
      this.router.navigate(['/login']);
      this.showDropdown = false;
      return;
    }

    let targetPath: string;
    switch (userRole) {
      case 'administrador_tienda':
        targetPath = '/product';
        break;
      case 'bodeguero':
        targetPath = '/product-bodeguero';
        break;
      case 'cliente':
        targetPath = '/user/profile';
        break;
      default:
        console.warn(`goToAdminDashboard: Rol '${userRole}' no tiene una redirección de dashboard específica. Redirigiendo a /home.`);
        targetPath = '/home';
        break;
    }
    this.router.navigate([targetPath]);
    this.showDropdown = false;
  }

  logout(): void {
    this.authService.logout();
    this.updateLoginState();
    this.showDropdown = false;
    this.router.navigate(['/home']);
  }

  changeCurrency(currency: SupportedCurrency): void {
    this.currencyService.setSelectedCurrency(currency);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node;
    const accountMenuButton = this.elementRef.nativeElement.querySelector('.account-menu');
    const dropdownMenuElement = this.elementRef.nativeElement.querySelector('.dropdown-menu');
    if (this.showDropdown && accountMenuButton && !accountMenuButton.contains(target) && dropdownMenuElement && !dropdownMenuElement.contains(target)) {
      this.showDropdown = false;
    }
    const categoriesMenuButtonElement = this.elementRef.nativeElement.querySelector('.categories-btn');
    const categoriesDropdownElement = this.elementRef.nativeElement.querySelector('.categories-dropdown');
    if (this.showCategoriesMenu && categoriesMenuButtonElement && !categoriesMenuButtonElement.contains(target) && categoriesDropdownElement && !categoriesDropdownElement.contains(target)) {
      this.closeCategoriesMenu();
    }
    const searchBarContainer = this.elementRef.nativeElement.querySelector('.search-bar-container');
    if (this.showSearchResults && searchBarContainer && !searchBarContainer.contains(target)) {
      this.clearSearch();
    }
  }
}
