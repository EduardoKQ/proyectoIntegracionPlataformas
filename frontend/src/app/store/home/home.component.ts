import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit, Renderer2, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription, interval, Subject, fromEvent } from 'rxjs';
import { takeUntil, debounceTime } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { ProductService } from '../../services/product.service';
import { ApiProduct } from '../../services/product.interfaces';
import { CurrencyService, SupportedCurrency } from '../../services/Currency.Service';
import { CartService, CartItem, ProductForCart } from '../../services/cart.service';
import { Branch } from '../../services/branch.service';
import { SelectedBranchService } from '../../services/selected-branch.service';
import { InventoryService } from '../../services/inventory.service';
import { BranchSelectorModalComponent } from '../../features/shared/components/branch-selector-modal/branch-selector-modal.component';

interface CarouselSlideItem {
  imageSrc: string;
  imageAlt: string;
  routePath: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    BranchSelectorModalComponent
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy, AfterViewInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private productService = inject(ProductService);
  private renderer = inject(Renderer2);
  private currencyService = inject(CurrencyService);
  private cartService = inject(CartService);
  private selectedBranchService = inject(SelectedBranchService);
  private inventoryService = inject(InventoryService);

  slides: CarouselSlideItem[] = [
    { imageSrc: 'assets/image-store/ban.png', imageAlt: 'imagen 1', routePath: '/catalogo' },
    { imageSrc: 'assets/image-store/carrousel-2.png', imageAlt: 'Imagen 2', routePath: '/catalogo' },
    { imageSrc: 'assets/image-store/las_mejores1.1.png', imageAlt: 'Imagen 3', routePath: '/catalogo' }
  ];
  currentIndex: number = 0;
  private autoSlideIntervalId: any = null;

  stories = [
    { id: 1, backgroundImage: 'assets/images/histo1.png', badgeImage: 'assets/images/histoP.png', title: 'Ofertas Especiales', hoverText: 'Ver Promociones' },
    { id: 2, backgroundImage: 'assets/images/histo2.png', badgeImage: 'assets/images/histoM.png', title: 'Nuestras Marcas', hoverText: 'Ver Marcas' }
  ];

  categorias = [
    { nombre: 'Herramientas', imagen: 'assets/image-store/cat1.png', ruta: 'cat-herr-man' },
    { nombre: 'Materiales', imagen: 'assets/image-store/cat2.png', ruta: 'cat-mat-bas' },
    { nombre: 'Seguridad', imagen: 'assets/image-store/cat3.png', ruta: 'cat-equ-seg' },
    { nombre: 'Medicion', imagen: 'assets/image-store/cat4.png', ruta: 'cat-equ-med' }
  ];

  featuredProducts: ApiProduct[] = [];
  currentFeaturedProductsSlideIndex = 0;
  private featuredProductsIntervalId?: Subscription;
  productsPerSlide = 5;
  private destroy$ = new Subject<void>();

  @ViewChild('productsCarouselContainer') featuredWrapperRef!: ElementRef<HTMLDivElement>;
  @ViewChild('featuredProductsInnerContainer') featuredInnerContainerRef!: ElementRef<HTMLDivElement>;

  private windowResizeSubscription?: Subscription;
  public currentSelectedCurrency: SupportedCurrency = 'CLP';
  private currencySubscription!: Subscription;
  cartItems: CartItem[] = [];
  private cartSubscription!: Subscription;

  currentSelectedBranch: Branch | null = null;
  private selectedBranchSubscription!: Subscription;
  showBranchModal = false;
  private productToAddAfterBranchSelection: ApiProduct | null = null;
  productStockMap: Map<string, number> = new Map();

  constructor() {}

  ngOnInit(): void {
    this.startAutoAdvance();
    this.loadProductsForFeaturedCarousel();

    this.currencySubscription = this.currencyService.selectedCurrency$
      .pipe(takeUntil(this.destroy$))
      .subscribe(currency => {
        this.currentSelectedCurrency = currency;
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
          this.updateProductStockForFeaturedView();
        } else {
          this.productStockMap.clear();
        }
      });
  }

  ngAfterViewInit(): void {
    this.productsPerSlide = this.calculateProductsPerScreen();
    this.updateFeaturedCarouselPosition(false);
    this.startFeaturedProductsAutoplay();

    this.windowResizeSubscription = fromEvent(window, 'resize')
      .pipe(debounceTime(250), takeUntil(this.destroy$))
      .subscribe(() => {
        const previousProductsPerScreen = this.productsPerSlide;
        this.productsPerSlide = this.calculateProductsPerScreen();
        if (this.productsPerSlide !== previousProductsPerScreen && this.featuredProducts.length > 0) {
          this.currentFeaturedProductsSlideIndex = 0;
          this.updateFeaturedCarouselPosition(true);
        } else if (this.featuredProducts.length > 0) {
          this.updateFeaturedCarouselPosition(true);
        }
      });
  }

  ngOnDestroy(): void {
    this.clearAutoAdvance();
    this.featuredProductsIntervalId?.unsubscribe();
    this.windowResizeSubscription?.unsubscribe();
    this.currencySubscription?.unsubscribe();
    this.cartSubscription?.unsubscribe();
    this.selectedBranchSubscription?.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateProductStockForFeaturedView(): void {
    if (!this.currentSelectedBranch || this.featuredProducts.length === 0) {
      return;
    }
    const branchCode = this.currentSelectedBranch.branch_code;
    this.featuredProducts.forEach(p => {
      if (!this.productStockMap.has(p.codigo_producto)) {
        this.inventoryService.getProductStockInBranch(branchCode, p.codigo_producto)
          .subscribe(
            item => { this.productStockMap.set(p.codigo_producto, item.quantity); },
            err => {
              this.productStockMap.set(p.codigo_producto, 0);
              console.error(`Error obteniendo stock para ${p.codigo_producto} en ${branchCode}`, err);
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
      this.proceedToAddToCartHome(this.productToAddAfterBranchSelection, this.currentSelectedBranch);
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

  addToCartFromHome(product: ApiProduct): void {
    if (!this.authService.isLoggedIn()) {
      this.cartService.openLoginModal();
      return;
    }

    if (!this.currentSelectedBranch) {
      this.productToAddAfterBranchSelection = product;
      this.showBranchModal = true;
      return;
    }
    this.proceedToAddToCartHome(product, this.currentSelectedBranch);
  }

  private proceedToAddToCartHome(product: ApiProduct, branch: Branch): void {
    const quantityDesired = 1;
    this.inventoryService.getProductStockInBranch(branch.branch_code, product.codigo_producto)
      .subscribe({
        next: (inventoryItem) => {
          this.productStockMap.set(product.codigo_producto, inventoryItem ? inventoryItem.quantity : 0);
          const quantityAlreadyInCart = this.getQuantityInCart(product.codigo_producto);
          const totalQuantityAfterAdd = quantityAlreadyInCart + quantityDesired;
          if (inventoryItem && inventoryItem.quantity >= totalQuantityAfterAdd) {
            this.cartService.addToCart(
              product as ProductForCart,
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
          console.error(`Error al verificar stock para ${product.nombre} en ${branch.name}.`, err);
        }
      });
  }

  updateQuantityFromHome(productCode: string, newQuantity: number): void {
    if (!this.authService.isLoggedIn()) {
        this.cartService.openLoginModal();
        return;
    }

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
          console.error(`Error al verificar stock para actualizar la cantidad de ${productCode}.`, err);
        }
      });
  }

  private startAutoAdvance(): void {
    if (this.autoSlideIntervalId) {
      clearInterval(this.autoSlideIntervalId);
    }
    if (this.slides && this.slides.length > 1) {
      this.autoSlideIntervalId = setInterval(() => this.advanceToNextSlide(), 5000);
    }
  }

  private clearAutoAdvance(): void {
    if (this.autoSlideIntervalId) {
      clearInterval(this.autoSlideIntervalId);
    }
  }

  private advanceToNextSlide(): void {
    if (!this.slides || this.slides.length === 0) {
      return;
    }
    this.currentIndex = (this.currentIndex + 1) % this.slides.length;
  }

  previousSlide(): void {
    if (!this.slides || this.slides.length === 0) {
      return;
    }
    this.currentIndex = (this.currentIndex - 1 + this.slides.length) % this.slides.length;
    this.startAutoAdvance();
  }

  nextSlide(): void {
    if (!this.slides || this.slides.length === 0) {
      return;
    }
    this.advanceToNextSlide();
    this.startAutoAdvance();
  }

  goToSlide(slideIndex: number): void {
    if (!this.slides || this.slides.length === 0) {
      return;
    }
    this.currentIndex = slideIndex;
    this.startAutoAdvance();
  }

  getCurrentSlideUrl(): string {
    return this.slides.length > 0 ? this.slides[this.currentIndex]?.imageSrc : 'assets/images/placeholder-banner.png';
  }

  getCurrentSlideAlt(): string {
    return this.slides.length > 0 ? this.slides[this.currentIndex]?.imageAlt : 'Banner image';
  }

  navigateToCurrentSlideRoute(): void {
    if (this.slides.length > 0 && this.slides[this.currentIndex]?.routePath) {
      this.router.navigate([this.slides[this.currentIndex].routePath]);
    }
  }

  openStory(storyId: number): void {
    this.router.navigate(['/story', storyId]);
  }

  loadProductsForFeaturedCarousel(): void {
    this.productService.getProducts()
      .pipe(takeUntil(this.destroy$))
      .subscribe(products => {
        if (products && products.length > 0) {
          const totalFeatured = Math.min(products.length, 15);
          this.featuredProducts = this.getRandomProducts(products, totalFeatured);
          this.productsPerSlide = this.calculateProductsPerScreen();
          this.updateProductStockForFeaturedView();
        } else {
          this.featuredProducts = [];
        }
        Promise.resolve().then(() => {
          if (this.featuredProducts.length > 0 && this.featuredWrapperRef && this.featuredInnerContainerRef) {
            this.currentFeaturedProductsSlideIndex = 0;
            this.updateFeaturedCarouselPosition(false);
            this.startFeaturedProductsAutoplay();
          } else if (this.featuredProductsIntervalId) {
            this.featuredProductsIntervalId.unsubscribe();
            this.featuredProductsIntervalId = undefined;
            if (this.featuredInnerContainerRef?.nativeElement) {
              this.renderer.setStyle(this.featuredInnerContainerRef.nativeElement, 'transform', 'translateX(0px)');
            }
          }
        });
      });
  }

  getRandomProducts(products: ApiProduct[], count: number): ApiProduct[] {
    const shuffled = [...products].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  getFeaturedProductSlides(): ApiProduct[][] {
    const slidesArray: ApiProduct[][] = [];
    if (!this.featuredProducts || this.featuredProducts.length === 0 || this.productsPerSlide <= 0) {
      return slidesArray;
    }
    for (let i = 0; i < this.featuredProducts.length; i += this.productsPerSlide) {
      slidesArray.push(this.featuredProducts.slice(i, i + this.productsPerSlide));
    }
    return slidesArray;
  }

  updateFeaturedCarouselPosition(resetAutoplay: boolean = true): void {
    if (!this.featuredInnerContainerRef?.nativeElement || !this.featuredWrapperRef?.nativeElement) {
      return;
    }
    const totalSlides = this.getFeaturedProductSlides().length;
    if (totalSlides === 0) {
      this.currentFeaturedProductsSlideIndex = 0;
    } else if (this.currentFeaturedProductsSlideIndex >= totalSlides) {
      this.currentFeaturedProductsSlideIndex = totalSlides - 1;
    } else if (this.currentFeaturedProductsSlideIndex < 0) {
      this.currentFeaturedProductsSlideIndex = 0;
    }
    const cardElement = this.featuredInnerContainerRef.nativeElement.querySelector('.product-card-featured');
    if (!cardElement) {
      console.warn('Featured product card element not found for width calculation.');
      return;
    }
    const cardWidth = (cardElement as HTMLElement).offsetWidth;
    const gap = parseFloat(getComputedStyle(this.featuredInnerContainerRef.nativeElement).gap || '0');
    const totalCardWidthWithGap = cardWidth + gap;
    const productsPerScreen = this.calculateProductsPerScreen();
    if (productsPerScreen <= 0) return;

    const translationDistance = this.currentFeaturedProductsSlideIndex * productsPerScreen * totalCardWidthWithGap;
    this.renderer.setStyle(this.featuredInnerContainerRef.nativeElement, 'transform', `translateX(-${translationDistance}px)`);
    if (resetAutoplay) {
      this.resetFeaturedProductsInterval();
    }
  }

  startFeaturedProductsAutoplay(): void {
    if (this.featuredProductsIntervalId) {
      this.featuredProductsIntervalId.unsubscribe();
    }
    const totalSlides = this.getFeaturedProductSlides().length;
    if (totalSlides > 1) {
      this.featuredProductsIntervalId = interval(7000)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.nextFeaturedProductsSlide(true);
        });
    }
  }

  nextFeaturedProductsSlide(isAuto: boolean = false): void {
    const totalSlides = this.getFeaturedProductSlides().length;
    if (totalSlides <= 1) return;
    this.currentFeaturedProductsSlideIndex = (this.currentFeaturedProductsSlideIndex + 1) % totalSlides;
    this.updateFeaturedCarouselPosition(!isAuto);
  }

  prevFeaturedProductsSlide(isAuto: boolean = false): void {
    const totalSlides = this.getFeaturedProductSlides().length;
    if (totalSlides <= 1) return;
    this.currentFeaturedProductsSlideIndex = (this.currentFeaturedProductsSlideIndex - 1 + totalSlides) % totalSlides;
    this.updateFeaturedCarouselPosition(!isAuto);
  }

  goToFeaturedProductsSlide(index: number): void {
    const totalSlides = this.getFeaturedProductSlides().length;
    if (index >= 0 && index < totalSlides) {
      this.currentFeaturedProductsSlideIndex = index;
      this.updateFeaturedCarouselPosition();
    }
  }

  resetFeaturedProductsInterval(): void {
    this.startFeaturedProductsAutoplay();
  }

  calculateProductsPerScreen(): number {
    if (!this.featuredWrapperRef?.nativeElement || !this.featuredInnerContainerRef?.nativeElement) {
      return 5;
    }
    const containerWidth = this.featuredWrapperRef.nativeElement.offsetWidth;
    const cardElement = this.featuredInnerContainerRef.nativeElement.querySelector('.product-card-featured');
    if (!cardElement) {
      const fallbackCardWidth = 220;
      const fallbackGap = 16;
      return Math.max(1, Math.floor(containerWidth / (fallbackCardWidth + fallbackGap)));
    }
    const cardWidth = (cardElement as HTMLElement).offsetWidth;
    const gap = parseFloat(getComputedStyle(this.featuredInnerContainerRef.nativeElement).gap || '0');
    if (cardWidth <= 0) {
      return 5;
    }
    const products = Math.max(1, Math.floor(containerWidth / (cardWidth + gap)));
    return products;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  navigateToCarouselItem(path: string): void {
    this.router.navigate([path]);
  }
}
