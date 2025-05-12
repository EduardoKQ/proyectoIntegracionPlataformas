import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit, Renderer2 } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { ProductService } from '../../services/product.service';
import { ApiProduct } from '../../services/product.interfaces';
import { Subscription, interval, Subject, fromEvent } from 'rxjs';
import { takeUntil, debounceTime } from 'rxjs/operators';

interface CarouselSlideItem {
  imageSrc: string;
  imageAlt: string;
  routePath: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy, AfterViewInit {

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
    { nombre: 'Herramientas', imagen: 'assets/image-store/cat1.png',  ruta: 'cat-herr-man' },
    { nombre: 'Materiales', imagen: 'assets/image-store/cat2.png',  ruta: 'cat-mat-bas' },
    { nombre: 'Seguridad', imagen: 'assets/image-store/cat3.png',  ruta: 'cat-equ-seg' },
    { nombre: 'Medicion', imagen: 'assets/image-store/cat4.png',  ruta: 'cat-equ-med' }
  ];
  featuredProducts: ApiProduct[] = [];
  currentFeaturedProductsSlideIndex = 0;
  private featuredProductsIntervalId?: Subscription;
  productsPerSlide = 5;
  private destroy$ = new Subject<void>();

  @ViewChild('productsCarouselContainer') featuredWrapperRef!: ElementRef<HTMLDivElement>;
  @ViewChild('featuredProductsInnerContainer') featuredInnerContainerRef!: ElementRef<HTMLDivElement>;

  private windowResizeSubscription?: Subscription;

  constructor(
    private router: Router,
    private authService: AuthService,
    private productService: ProductService,
    private renderer: Renderer2
  ) {}

  ngOnInit(): void {
    this.startAutoAdvance();
    this.loadProductsForFeaturedCarousel();
  }

  ngAfterViewInit(): void {
    if (this.featuredProducts.length > 0) {
      this.updateFeaturedCarouselPosition();
      this.startFeaturedProductsAutoplay();
    }

    this.windowResizeSubscription = fromEvent(window, 'resize')
      .pipe(debounceTime(250), takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.featuredProducts.length > 0 && this.featuredWrapperRef && this.featuredInnerContainerRef) {
          this.updateFeaturedCarouselPosition();
        }
      });
  }

  ngOnDestroy(): void {
    this.clearAutoAdvance();
    if (this.featuredProductsIntervalId) {
      this.featuredProductsIntervalId.unsubscribe();
    }
    if (this.windowResizeSubscription) {
        this.windowResizeSubscription.unsubscribe();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  private startAutoAdvance(): void {
    this.clearAutoAdvance();
    if (this.slides && this.slides.length > 1) {
      this.autoSlideIntervalId = setInterval(() => this.advanceToNextSlide(), 5000);
    }
  }
  private clearAutoAdvance(): void {
    if (this.autoSlideIntervalId) clearInterval(this.autoSlideIntervalId);
  }
  private advanceToNextSlide(): void {
    if (!this.slides || this.slides.length === 0) return;
    this.currentIndex = (this.currentIndex + 1) % this.slides.length;
  }
  previousSlide(): void {
    if (!this.slides || this.slides.length === 0) return;
    this.currentIndex = (this.currentIndex - 1 + this.slides.length) % this.slides.length;
    this.startAutoAdvance();
  }
  nextSlide(): void {
    if (!this.slides || this.slides.length === 0) return;
    this.advanceToNextSlide();
    this.startAutoAdvance();
  }
  goToSlide(slideIndex: number): void {
    if (!this.slides || this.slides.length === 0) return;
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
  openStory(storyId: number): void { this.router.navigate(['/story', storyId]); }

  loadProductsForFeaturedCarousel(): void {
    this.productService.getProducts()
      .pipe(takeUntil(this.destroy$))
      .subscribe(products => {
        if (products && products.length > 0) {
          const totalFeatured = Math.min(products.length, 15);
          this.featuredProducts = this.getRandomProducts(products, totalFeatured);
        }
        if (this.featuredWrapperRef && this.featuredInnerContainerRef && this.featuredProducts.length > 0) {
          this.currentFeaturedProductsSlideIndex = 0;
          this.updateFeaturedCarouselPosition();
          this.startFeaturedProductsAutoplay();
        }
      });
  }

  getRandomProducts(products: ApiProduct[], count: number): ApiProduct[] {
    const shuffled = [...products].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
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
    if (!this.featuredInnerContainerRef || !this.featuredWrapperRef) {
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
    const totalSlides = Math.ceil(this.featuredProducts.length / this.productsPerSlide);
    if (totalSlides > 1) {
      this.featuredProductsIntervalId = interval(7000)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.nextFeaturedProductsSlide(true);
        });
    }
  }

  nextFeaturedProductsSlide(isAuto: boolean = false): void {
    const totalSlides = Math.ceil(this.featuredProducts.length / this.productsPerSlide);
    if (totalSlides <= 1) return;
    this.currentFeaturedProductsSlideIndex = (this.currentFeaturedProductsSlideIndex + 1) % totalSlides;
    this.updateFeaturedCarouselPosition();
    if (!isAuto) this.resetFeaturedProductsInterval();
  }

  prevFeaturedProductsSlide(isAuto: boolean = false): void {
    const totalSlides = Math.ceil(this.featuredProducts.length / this.productsPerSlide);
    if (totalSlides <= 1) return;
    this.currentFeaturedProductsSlideIndex = (this.currentFeaturedProductsSlideIndex - 1 + totalSlides) % totalSlides;
    this.updateFeaturedCarouselPosition();
    if (!isAuto) this.resetFeaturedProductsInterval();
  }

  goToFeaturedProductsSlide(index: number): void {
    const totalSlides = Math.ceil(this.featuredProducts.length / this.productsPerSlide);
    if (index >= 0 && index < totalSlides) {
      this.currentFeaturedProductsSlideIndex = index;
      this.updateFeaturedCarouselPosition();
      this.resetFeaturedProductsInterval();
    }
  }

  resetFeaturedProductsInterval(): void {
    this.startFeaturedProductsAutoplay();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  navigateToCarouselItem(path: string): void {
    this.router.navigate([path]);
  }
}
