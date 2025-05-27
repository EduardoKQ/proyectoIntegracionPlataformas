import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit, Renderer2, inject, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription, Subject, interval, fromEvent, of, combineLatest, Observable } from 'rxjs';
import { takeUntil, debounceTime, switchMap, tap, map, catchError, distinctUntilChanged } from 'rxjs/operators';
import { ProductService } from '../../services/product.service';
import { InventoryService, InventoryItem } from '../../services/inventory.service';
import { ApiProduct } from '../../services/product.interfaces';
import { ProductForCart } from '../../services/cart.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CurrencyService, SupportedCurrency } from '../../services/Currency.Service';
import { CartService } from '../../services/cart.service';
import { SelectedBranchService } from '../../services/selected-branch.service';
import { Branch } from '../../services/branch.service';
import { BranchSelectorModalComponent } from '../../features/shared/components/branch-selector-modal/branch-selector-modal.component';
import { AuthService } from '../../services/auth.service';

interface ProductLoadingResult {
  product: ApiProduct | null;
  inventory: InventoryItem | null;
  error: string | null;
}

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    BranchSelectorModalComponent
  ],
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.scss']
})
export class ProductDetailComponent implements OnInit, OnDestroy, AfterViewInit {
  product: ApiProduct | null = null;
  productInventory: InventoryItem[] = [];
  totalStockGeneral: number = 0;
  stockInSelectedBranch: number = 0;

  isLoading: boolean = true;
  isLoadingStock: boolean = false;
  errorMessage: string | null = null;
  infoMessage: string | null = null;
  selectedQuantity: number = 1;

  private destroy$ = new Subject<void>();
  featuredProducts: ApiProduct[] = [];
  currentFeaturedProductsSlideIndex = 0;
  productsPerSlide = 4;
  private maxSimilarProductsToShow = 8;
  private featuredProductsIntervalId?: Subscription;
  @ViewChild('productsCarouselContainer') featuredWrapperRef!: ElementRef<HTMLDivElement>;
  @ViewChild('featuredProductsInnerContainer') featuredInnerContainerRef!: ElementRef<HTMLDivElement>;
  private windowResizeSubscription?: Subscription;
  public currentSelectedCurrency: SupportedCurrency = 'CLP';
  private currencySubscription!: Subscription;
  private currencyService = inject(CurrencyService);
  private cartService = inject(CartService);
  private selectedBranchService = inject(SelectedBranchService);
  public currentSelectedBranchForCart: Branch | null = null;
  private authService = inject(AuthService);

  showBranchModal: boolean = false;
  private pendingAddToCartOperation: { product: ApiProduct, quantity: number } | null = null;

  constructor(
    private route: ActivatedRoute,
    private productService: ProductService,
    private inventoryService: InventoryService,
    private renderer: Renderer2,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.currencySubscription = this.currencyService.selectedCurrency$
      .pipe(takeUntil(this.destroy$))
      .subscribe(currency => {
        this.currentSelectedCurrency = currency;
      });

    combineLatest([
      this.route.paramMap.pipe(distinctUntilChanged((prev, curr) => prev.get('codigo_producto') === curr.get('codigo_producto'))),
      this.selectedBranchService.selectedBranch$.pipe(distinctUntilChanged((prev, curr) => prev?.branch_code === curr?.branch_code))
    ])
    .pipe(
      tap(([params, branch]) => {
        this.isLoading = true;
        this.currentSelectedBranchForCart = branch;
      }),
      switchMap(([params, branch]): Observable<ProductLoadingResult> => {
        const productCode = params.get('codigo_producto');
        if (!productCode) {
          return of({ product: null, inventory: null, error: 'No se especificó un código de producto.' });
        }

        if (this.product && this.product.codigo_producto === productCode && branch) {
            this.isLoadingStock = true;
            return this.inventoryService.getProductStockInBranch(branch.branch_code, productCode).pipe(
                map((inventoryItem: InventoryItem | null) => ({ product: this.product, inventory: inventoryItem, error: null })),
                catchError(err => {
                    return of({ product: this.product, inventory: null, error: `Error al cargar stock para ${branch.name}: ${err.message}` });
                })
            );
        }

        this.product = null;
        this.productInventory = [];
        this.totalStockGeneral = 0;
        this.stockInSelectedBranch = 0;
        this.selectedQuantity = 1;

        return this.productService.getProductByCode(productCode).pipe(
          switchMap((productData: ApiProduct | null): Observable<ProductLoadingResult> => {
            if (!productData) {
              return of({ product: null, inventory: null, error: `Producto con código ${productCode} no encontrado.` });
            }
            this.product = productData;
            this.loadGeneralInventoryForProduct(productCode);

            if (this.product.categoria) {
                this.loadSimilarProductsByCategory(this.product.categoria, productCode);
            } else {
                this.featuredProducts = [];
                this.setupSimilarProductsCarousel();
            }

            if (this.currentSelectedBranchForCart && this.product) {
              this.isLoadingStock = true;
              return this.inventoryService.getProductStockInBranch(this.currentSelectedBranchForCart.branch_code, productCode).pipe(
                map((inventoryItem: InventoryItem | null) => ({ product: productData, inventory: inventoryItem, error: null })),
                catchError(err => {
                  return of({ product: productData, inventory: null, error: `Error al cargar stock: ${err.message}` })
                })
              );
            } else {
              return of({ product: productData, inventory: null, error: null });
            }
          }),
          catchError(err => {
            return of({ product: null, inventory: null, error: `Error al cargar el producto: ${err.message}` })
          })
        );
      }),
      takeUntil(this.destroy$)
    )
    .subscribe((result: ProductLoadingResult) => {
      this.isLoading = false;
      this.isLoadingStock = false;
      this.product = result.product;

      if (result.error && !this.product) {
        this.errorMessage = result.error;
        this.stockInSelectedBranch = 0;
      } else if (this.product && !this.currentSelectedBranchForCart) {
        this.infoMessage = "Por favor, selecciona una sucursal para ver la disponibilidad y agregar al carrito.";
        this.stockInSelectedBranch = 0;
      } else if (this.product && this.currentSelectedBranchForCart) {
        if (result.inventory) {
          this.stockInSelectedBranch = result.inventory.quantity > 0 ? result.inventory.quantity : 0;
          if (this.stockInSelectedBranch === 0) {
            this.infoMessage = `Producto no disponible en ${this.currentSelectedBranchForCart.name}.`;
          } else {
            this.infoMessage = null;
          }
        } else {
          this.stockInSelectedBranch = 0;
          const specificError = result.error && (result.error.includes("404") || result.error.toLowerCase().includes("no encontrado"))
            ? `Este producto no está registrado en la sucursal ${this.currentSelectedBranchForCart.name}.`
            : `No se pudo verificar el stock en ${this.currentSelectedBranchForCart.name}.`;
          this.infoMessage = specificError;
        }
      }
      this.updateSelectedQuantityBasedOnStock();
      this.cdr.detectChanges();
    });
  }

  ngAfterViewInit(): void {
    this.windowResizeSubscription = fromEvent(window, 'resize')
      .pipe(debounceTime(250), takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.featuredProducts.length > 0 && this.featuredWrapperRef && this.featuredInnerContainerRef) {
          this.updateFeaturedCarouselPosition(false);
        }
      });
  }

  public loadGeneralInventoryForProduct(productCode: string): void {
    this.inventoryService.getInventory()
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (allInventory) => {
        this.productInventory = allInventory.filter(item => item.product_code === productCode);
        this.calculateGeneralTotalStock();
      },
      error: (err) => {
        this.productInventory = [];
        this.totalStockGeneral = 0;
      }
    });
  }

  public calculateGeneralTotalStock(): void {
    this.totalStockGeneral = this.productInventory.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }

  public updateSelectedQuantityBasedOnStock(): void {
    if (this.stockInSelectedBranch === 0) {
      this.selectedQuantity = 0;
    } else {
        if (this.selectedQuantity === 0 && this.stockInSelectedBranch > 0) {
            this.selectedQuantity = 1;
        } else if (this.selectedQuantity > this.stockInSelectedBranch) {
            this.selectedQuantity = this.stockInSelectedBranch;
        } else if (this.selectedQuantity < 1 && this.stockInSelectedBranch > 0) {
            this.selectedQuantity = 1;
        }
    }
  }

  public decreaseQuantity(): void {
    if (this.selectedQuantity > 1) {
      this.selectedQuantity--;
    }
  }

  public increaseQuantity(): void {
    if (this.stockInSelectedBranch > 0 && this.selectedQuantity < this.stockInSelectedBranch) {
      this.selectedQuantity++;
    }
  }

  public onQuantityChange(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    let value = parseInt(inputElement.value, 10);

    if (isNaN(value) || value < 0 ) {
      value = 0;
    }

    if (this.stockInSelectedBranch > 0) {
        if (value < 1) value = 1;
        if (value > this.stockInSelectedBranch) {
          value = this.stockInSelectedBranch;
        }
    } else {
        value = 0;
    }
    this.selectedQuantity = value;
    this.cdr.detectChanges();
  }

  public addToCart(): void {
    this.errorMessage = null;
    this.infoMessage = null;

    if (!this.authService.isLoggedIn()) {
      this.cartService.openLoginModal();
      return;
    }

    if (!this.product) {
        this.errorMessage = 'Error: No hay producto seleccionado.';
        return;
    }

    if (!this.currentSelectedBranchForCart) {
        this.pendingAddToCartOperation = { product: this.product, quantity: this.selectedQuantity };
        this.showBranchModal = true;
        return;
    }
    this.executeAddToCart();
  }

  private executeAddToCart(): void {
    if (!this.product || !this.currentSelectedBranchForCart) {
        this.errorMessage = 'Error interno: Falta información del producto o sucursal.';
        this.pendingAddToCartOperation = null;
        return;
    }

    if (this.selectedQuantity <= 0) {
        this.infoMessage = 'Por favor, selecciona una cantidad mayor a cero.';
        if(this.stockInSelectedBranch > 0) this.selectedQuantity = 1;
        this.cdr.detectChanges();
        return;
    }

    if (this.stockInSelectedBranch === 0 || this.selectedQuantity > this.stockInSelectedBranch) {
        this.infoMessage = `No hay suficiente stock (${this.stockInSelectedBranch}) en ${this.currentSelectedBranchForCart.name} para la cantidad seleccionada.`;
        this.cdr.detectChanges();
        return;
    }

    if (!this.product.precio || typeof this.product.precio.precio_actual !== 'number') {
        this.errorMessage = 'Error: Este producto no tiene un precio válido.';
        this.pendingAddToCartOperation = null;
        return;
    }

    const productToAdd: ProductForCart = {
        codigo_producto: this.product.codigo_producto,
        nombre: this.product.nombre,
        precio: {
            precio_actual: this.product.precio.precio_actual
        },
        imageUrl: this.product.imageUrl
    };

    this.cartService.addToCart(
        productToAdd,
        this.selectedQuantity,
        this.currentSelectedBranchForCart.branch_code,
        this.currentSelectedBranchForCart.name
    );

    if (this.authService.isLoggedIn()) {
        this.infoMessage = `${this.product.nombre} (x${this.selectedQuantity}) añadido al carrito para la sucursal ${this.currentSelectedBranchForCart.name}.`;
        this.pendingAddToCartOperation = null;

        setTimeout(() => {
            this.infoMessage = null;
            this.cdr.detectChanges();
        }, 3000);
    }
  }

  public handleBranchSelectedFromModal(selectedBranch: Branch): void {
    this.showBranchModal = false;
    this.selectedBranchService.setSelectedBranch(selectedBranch);

    Promise.resolve().then(() => {
        if (this.pendingAddToCartOperation && this.product && this.currentSelectedBranchForCart) {
            if (this.product.codigo_producto === this.pendingAddToCartOperation.product.codigo_producto) {
                if (this.authService.isLoggedIn()) {
                     this.executeAddToCart();
                } else {
                    this.cartService.openLoginModal();
                    this.pendingAddToCartOperation = null;
                }
            } else {
                this.pendingAddToCartOperation = null;
                this.infoMessage = "El producto ha cambiado. Por favor, intenta agregar al carrito de nuevo.";
            }
        } else if (this.pendingAddToCartOperation) {
            console.warn('Sucursal seleccionada, pero el contexto no está completamente listo para la operación pendiente del carrito.');
            this.infoMessage = "Hubo un problema al seleccionar la sucursal. Intenta de nuevo.";
            this.pendingAddToCartOperation = null;
        }
        this.cdr.detectChanges();
    });
  }

  public handleModalClosed(): void {
    this.showBranchModal = false;
    if (this.pendingAddToCartOperation && !this.currentSelectedBranchForCart && this.authService.isLoggedIn()) {
        this.infoMessage = 'Debes seleccionar una sucursal para poder agregar productos al carrito.';
    }
    if (!this.showBranchModal && this.pendingAddToCartOperation && this.authService.isLoggedIn()) {
        this.pendingAddToCartOperation = null;
    }
    this.cdr.detectChanges();
  }

  public loadProductDetails(productCode: string): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.infoMessage = null;
    this.product = null;
    this.productInventory = [];
    this.totalStockGeneral = 0;
    this.stockInSelectedBranch = 0;
    this.selectedQuantity = 1;

    this.productService.getProductByCode(productCode)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (productData) => {
        this.product = productData;
        if (this.product) {
          this.loadGeneralInventoryForProduct(productCode);
          if (this.product.categoria) {
            this.loadSimilarProductsByCategory(this.product.categoria, productCode);
          } else {
            this.featuredProducts = [];
            this.setupSimilarProductsCarousel();
          }
          if (this.currentSelectedBranchForCart) {
            this.isLoadingStock = true;
            this.inventoryService.getProductStockInBranch(this.currentSelectedBranchForCart.branch_code, productCode)
              .pipe(takeUntil(this.destroy$))
              .subscribe(inv => {
                this.stockInSelectedBranch = inv ? inv.quantity : 0;
                this.updateSelectedQuantityBasedOnStock();
                this.isLoadingStock = false;
                this.isLoading = false;
                this.cdr.detectChanges();
              }, err => {
                this.stockInSelectedBranch = 0;
                this.updateSelectedQuantityBasedOnStock();
                this.isLoadingStock = false;
                this.isLoading = false;
                this.infoMessage = `No se pudo verificar el stock en ${this.currentSelectedBranchForCart?.name || 'la sucursal seleccionada'}.`;
                this.cdr.detectChanges();
              });
          } else {
            this.isLoading = false;
            this.infoMessage = "Selecciona una sucursal para ver disponibilidad.";
          }
        } else {
            this.errorMessage = `Producto con código ${productCode} no encontrado.`;
            this.isLoading = false;
            this.featuredProducts = [];
            this.setupSimilarProductsCarousel();
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = `Error al cargar el producto: ${err.message || 'Error desconocido'}`;
        this.isLoading = false;
        this.featuredProducts = [];
        this.setupSimilarProductsCarousel();
        this.cdr.detectChanges();
      }
    });
  }

  public loadSimilarProductsByCategory(category: string, currentProductCode: string): void {
    this.productService.getProducts()
      .pipe(takeUntil(this.destroy$))
      .subscribe(allProducts => {
        const similarInCategory = allProducts.filter(p =>
          p.categoria === category &&
          p.codigo_producto !== currentProductCode
        );
        this.featuredProducts = this.getRandomProducts(similarInCategory, this.maxSimilarProductsToShow);
        this.currentFeaturedProductsSlideIndex = 0;
        this.setupSimilarProductsCarousel();
        this.cdr.detectChanges();
      });
  }

  public setupSimilarProductsCarousel(): void {
    if (this.featuredProductsIntervalId) {
      this.featuredProductsIntervalId.unsubscribe();
      this.featuredProductsIntervalId = undefined;
    }
    if (this.featuredProducts.length > 0) {
        Promise.resolve().then(() => {
            if (this.featuredWrapperRef && this.featuredInnerContainerRef) {
                this.updateFeaturedCarouselPosition();
                this.startFeaturedProductsAutoplay();
            }
        });
    } else if (this.featuredInnerContainerRef?.nativeElement) {
        this.renderer.setStyle(this.featuredInnerContainerRef.nativeElement, 'transform', `translateX(0px)`);
    }
  }

  public getRandomProducts(products: ApiProduct[], count: number): ApiProduct[] {
    const shuffled = [...products].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(shuffled.length, count));
  }

  public getFeaturedProductSlides(): ApiProduct[][] {
    const slidesArray: ApiProduct[][] = [];
    if (!this.featuredProducts || this.featuredProducts.length === 0) {
      return slidesArray;
    }
    for (let i = 0; i < this.featuredProducts.length; i += this.productsPerSlide) {
      slidesArray.push(this.featuredProducts.slice(i, i + this.productsPerSlide));
    }
    return slidesArray;
  }

  public updateFeaturedCarouselPosition(resetAutoplay: boolean = true): void {
    if (!this.featuredInnerContainerRef?.nativeElement || !this.featuredWrapperRef?.nativeElement) {
      return;
    }
    const containerWidth = this.featuredWrapperRef.nativeElement.offsetWidth;
    const newTransformValue = -(this.currentFeaturedProductsSlideIndex * containerWidth);
    this.renderer.setStyle(this.featuredInnerContainerRef.nativeElement, 'transform', `translateX(${newTransformValue}px)`);

    if (resetAutoplay) {
        this.resetFeaturedProductsInterval();
    }
  }

  public startFeaturedProductsAutoplay(): void {
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

  public nextFeaturedProductsSlide(isAuto: boolean = false): void {
    const totalSlides = this.getFeaturedProductSlides().length;
    if (totalSlides <= 1 && this.featuredProducts.length <= this.productsPerSlide) return;
    this.currentFeaturedProductsSlideIndex = (this.currentFeaturedProductsSlideIndex + 1) % Math.max(1, totalSlides);
    this.updateFeaturedCarouselPosition(!isAuto);
  }

  public prevFeaturedProductsSlide(isAuto: boolean = false): void {
    const totalSlides = this.getFeaturedProductSlides().length;
    if (totalSlides <= 1 && this.featuredProducts.length <= this.productsPerSlide) return;
    this.currentFeaturedProductsSlideIndex = (this.currentFeaturedProductsSlideIndex - 1 + Math.max(1, totalSlides)) % Math.max(1, totalSlides);
    this.updateFeaturedCarouselPosition(!isAuto);
  }

  public goToFeaturedProductsSlide(index: number): void {
    const totalSlides = this.getFeaturedProductSlides().length;
    if (index >= 0 && index < totalSlides) {
      this.currentFeaturedProductsSlideIndex = index;
      this.updateFeaturedCarouselPosition();
    }
  }

  public resetFeaturedProductsInterval(): void {
    this.startFeaturedProductsAutoplay();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.featuredProductsIntervalId?.unsubscribe();
    this.windowResizeSubscription?.unsubscribe();
    this.currencySubscription?.unsubscribe();
  }
}
