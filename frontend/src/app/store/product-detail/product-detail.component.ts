import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit, Renderer2 } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription, Subject, interval, fromEvent } from 'rxjs';
import { takeUntil, debounceTime } from 'rxjs/operators';
import { ProductService } from '../../services/product.service';
import { InventoryService } from '../../services/inventory.service';
import { ApiProduct } from '../../services/product.interfaces';
import { InventoryItem } from '../../services/inventory.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface EnrichedInventoryItem extends InventoryItem {
}

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule
  ],
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.scss']
})
export class ProductDetailComponent implements OnInit, OnDestroy, AfterViewInit {
  product: ApiProduct | null = null;
  productInventory: EnrichedInventoryItem[] = [];
  totalStock: number = 0;
  isLoading: boolean = true;
  errorMessage: string | null = null;
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

  constructor(
    private route: ActivatedRoute,
    private productService: ProductService,
    private inventoryService: InventoryService,
    private renderer: Renderer2
  ) { }

  ngOnInit(): void {
    this.route.paramMap
    .pipe(takeUntil(this.destroy$))
    .subscribe(params => {
      const productCode = params.get('codigo_producto');
      this.featuredProducts = [];
      this.currentFeaturedProductsSlideIndex = 0;
      if (this.featuredProductsIntervalId) {
        this.featuredProductsIntervalId.unsubscribe();
      }
      if (productCode) {
        this.loadProductDetails(productCode);
      } else {
        this.isLoading = false;
        this.errorMessage = 'No se especificó un código de producto.';
        console.error('Error: No product code found in route parameters.');
      }
    });
  }

  ngAfterViewInit(): void {
    this.setupSimilarProductsCarousel();

    this.windowResizeSubscription = fromEvent(window, 'resize')
      .pipe(
        debounceTime(250),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        if (this.featuredProducts.length > 0 && this.featuredWrapperRef && this.featuredInnerContainerRef) {
          this.updateFeaturedCarouselPosition();
        }
      });
  }

  loadProductDetails(productCode: string): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.product = null;
    this.productInventory = [];
    this.totalStock = 0;
    this.selectedQuantity = 1;

    this.productService.getProductByCode(productCode)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (productData) => {
        this.product = productData;
        this.loadInventoryForProduct(productCode);
        if (this.product && this.product.categoria) {
          this.loadSimilarProductsByCategory(this.product.categoria, productCode);
        } else {
          this.featuredProducts = [];
          this.setupSimilarProductsCarousel();
        }
      },
      error: (err) => {
        this.errorMessage = `Error al cargar el producto: ${err.message || 'Error desconocido'}`;
        console.error('Error fetching product by code:', err);
        this.isLoading = false;
      }
    });
  }

  loadInventoryForProduct(productCode: string): void {
    this.inventoryService.getInventory()
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (allInventory) => {
        const productSpecificInventory = allInventory.filter(item => item.product_code === productCode);
        this.productInventory = productSpecificInventory;
        this.calculateTotalStock();
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = `Error al cargar el inventario: ${err.message || 'Error desconocido'}.`;
        console.error('Error fetching inventory:', err);
        this.productInventory = [];
        this.totalStock = 0;
        this.isLoading = false;
      }
    });
  }

  calculateTotalStock(): void {
    this.totalStock = this.productInventory.reduce((sum, item) => sum + item.quantity, 0);
    if (this.totalStock === 0) {
      this.selectedQuantity = 0;
    } else if (this.selectedQuantity > this.totalStock) {
      this.selectedQuantity = this.totalStock;
    }
    if (this.selectedQuantity < 1 && this.totalStock > 0) {
        this.selectedQuantity = 1;
    }
  }

  decreaseQuantity(): void {
    if (this.selectedQuantity > 1) {
      this.selectedQuantity--;
    }
  }

  increaseQuantity(): void {
    if (this.selectedQuantity < this.totalStock) {
      this.selectedQuantity++;
    }
  }

  onQuantityChange(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    let value = parseInt(inputElement.value, 10);
    if (isNaN(value) || value < 1) {
      value = 1;
    }
    this.selectedQuantity = value;
    inputElement.value = this.selectedQuantity.toString();
  }

  addToCart(): void {
    if (!this.product) return;
    if (this.selectedQuantity <= 0) return;
    if (this.selectedQuantity > this.totalStock) return;
    console.log(`Añadiendo ${this.selectedQuantity} de ${this.product.nombre} al carro.`);
  }

  loadSimilarProductsByCategory(category: string, currentProductCode: string): void {
    this.productService.getProducts()
      .pipe(takeUntil(this.destroy$))
      .subscribe(allProducts => {
        const similarInCategory = allProducts.filter(p =>
          p.categoria === category &&
          p.codigo_producto !== currentProductCode
        );
        if (similarInCategory.length > 0) {
          this.featuredProducts = this.getRandomProducts(similarInCategory, this.maxSimilarProductsToShow);
        } else {
          this.featuredProducts = [];
        }
        this.currentFeaturedProductsSlideIndex = 0;
        this.setupSimilarProductsCarousel();
      });
  }
  setupSimilarProductsCarousel(): void {

    if (this.featuredWrapperRef && this.featuredInnerContainerRef) {
      if (this.featuredProducts.length > 0) {
        this.updateFeaturedCarouselPosition();
        this.startFeaturedProductsAutoplay();
      } else {
        if (this.featuredInnerContainerRef.nativeElement) {
            this.renderer.setStyle(this.featuredInnerContainerRef.nativeElement, 'transform', `translateX(0px)`);
        }
        if (this.featuredProductsIntervalId) {
            this.featuredProductsIntervalId.unsubscribe();
        }
      }
    } else if (this.featuredProducts.length > 0) {
    }
  }

  getRandomProducts(products: ApiProduct[], count: number): ApiProduct[] {
    const shuffled = [...products].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(shuffled.length, count));
  }

  getFeaturedProductSlides(): ApiProduct[][] {
    const slidesArray: ApiProduct[][] = [];
    if (!this.featuredProducts || this.featuredProducts.length === 0) {
      return slidesArray;
    }
    for (let i = 0; i < this.featuredProducts.length; i += this.productsPerSlide) {
      slidesArray.push(this.featuredProducts.slice(i, i + this.productsPerSlide));
    }
    return slidesArray;
  }

  updateFeaturedCarouselPosition(): void {
    if (!this.featuredInnerContainerRef?.nativeElement || !this.featuredWrapperRef?.nativeElement) {
      return;
    }
    const slideWidth = this.featuredWrapperRef.nativeElement.offsetWidth;
    const newTransformValue = -(this.currentFeaturedProductsSlideIndex * slideWidth);
    this.renderer.setStyle(this.featuredInnerContainerRef.nativeElement, 'transform', `translateX(${newTransformValue}px)`);
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
    this.updateFeaturedCarouselPosition();
    if (!isAuto) {
      this.resetFeaturedProductsInterval();
    }
  }

  prevFeaturedProductsSlide(isAuto: boolean = false): void {
    const totalSlides = this.getFeaturedProductSlides().length;
    if (totalSlides <= 1) return;

    this.currentFeaturedProductsSlideIndex = (this.currentFeaturedProductsSlideIndex - 1 + totalSlides) % totalSlides;
    this.updateFeaturedCarouselPosition();
    if (!isAuto) {
        this.resetFeaturedProductsInterval();
    }
  }

  goToFeaturedProductsSlide(index: number): void {
    const totalSlides = this.getFeaturedProductSlides().length;
    if (index >= 0 && index < totalSlides) {
      this.currentFeaturedProductsSlideIndex = index;
      this.updateFeaturedCarouselPosition();
      this.resetFeaturedProductsInterval();
    }
  }

  resetFeaturedProductsInterval(): void {
    this.startFeaturedProductsAutoplay();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.featuredProductsIntervalId) {
        this.featuredProductsIntervalId.unsubscribe();
    }
    if (this.windowResizeSubscription) {
        this.windowResizeSubscription.unsubscribe();
    }
  }
}
