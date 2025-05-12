import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';

interface CarouselSlideItem {
  imageSrc: string;
  imageAlt: string;
  routePath: string;
}

@Component({
  selector: 'app-home',
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {

  slides: CarouselSlideItem[] = [
    {
      imageSrc: 'assets/image-store/ban.png',
      imageAlt: 'imagen 1',
      routePath: '/catalogo'
    },
    {
      imageSrc: 'assets/image-store/carrousel-2.png',
      imageAlt: 'Imagen 2',
      routePath: '/catalogo'
    },
    {
      imageSrc: 'assets/image-store/las_mejores1.1.png',
      imageAlt: 'Imagen 3',
      routePath: '/catalogo'
    }
  ];
  currentIndex: number = 0;
  private autoSlideIntervalId: any = null;

  stories = [
    {
      id: 1,
      backgroundImage: 'assets/images/histo1.png',
      badgeImage: 'assets/images/histoP.png',
      title: 'Ofertas Especiales',
      hoverText: 'Ver Promociones'
    },
    {
      id: 2,
      backgroundImage: 'assets/images/histo2.png',
      badgeImage: 'assets/images/histoM.png',
      title: 'Nuestras Marcas',
      hoverText: 'Ver Marcas'
    }
  ];

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.startAutoAdvance();
  }

  ngOnDestroy(): void {
    this.clearAutoAdvance();
  }

  private startAutoAdvance(): void {
    this.clearAutoAdvance();
    if (this.slides && this.slides.length > 1) {
      this.autoSlideIntervalId = setInterval(() => {
        this.advanceToNextSlide();
      }, 5000);
    }
  }

  private clearAutoAdvance(): void {
    if (this.autoSlideIntervalId) {
      clearInterval(this.autoSlideIntervalId);
      this.autoSlideIntervalId = null;
    }
  }

  private advanceToNextSlide(): void {
    if (!this.slides || this.slides.length === 0) return;
    const isLastSlide = this.currentIndex === this.slides.length - 1;
    this.currentIndex = isLastSlide ? 0 : this.currentIndex + 1;
  }

  previousSlide(): void {
    if (!this.slides || this.slides.length === 0) return;
    const isFirstSlide = this.currentIndex === 0;
    this.currentIndex = isFirstSlide ? this.slides.length - 1 : this.currentIndex - 1;
    this.startAutoAdvance();
  }

  nextSlide(): void {
    if (!this.slides || this.slides.length === 0) return;
    const isLastSlide = this.currentIndex === this.slides.length - 1;
    this.currentIndex = isLastSlide ? 0 : this.currentIndex + 1;
    this.startAutoAdvance();
  }

  goToSlide(slideIndex: number): void {
    if (!this.slides || this.slides.length === 0) return;
    this.currentIndex = slideIndex;
    this.startAutoAdvance();
  }

  getCurrentSlideUrl(): string {
    if (!this.slides || this.slides.length === 0) {
      return '';
    }
    return this.slides[this.currentIndex].imageSrc;
  }

  getCurrentSlideAlt(): string {
    if (!this.slides || this.slides.length === 0) {
      return '';
    }
    return this.slides[this.currentIndex].imageAlt;
  }

  navigateToCurrentSlideRoute(): void {
    if (!this.slides || this.slides.length === 0) {
      return;
    }
    const path = this.slides[this.currentIndex].routePath;
    this.router.navigate([path]);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  openStory(storyId: number): void {
    this.router.navigate(['/story', storyId]);
  }

  navigateToCarouselItem(path: string): void {
    this.router.navigate([path]);
  }
}
