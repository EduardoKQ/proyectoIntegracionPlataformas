import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ElementRef, Renderer2 } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription, interval, takeWhile, tap } from 'rxjs';

interface StoryContent {
  header: string;
  images: string[];
  logo?: string;
}

@Component({
  selector: 'app-story-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './story-view.component.html',
  styleUrls: ['./story-view.component.scss']
})
export class StoryViewComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private elementRef = inject(ElementRef);
  private renderer = inject(Renderer2);

  private storyData: { [key: string]: StoryContent } = {
    '1': {
      header: 'Ofertas Especiales',
      images: [
        'assets/images/histo1.png',
        'assets/images/histo1.1.png'
      ],
      logo: 'assets/images/histoP.png'
    },
    '2': {
      header: 'Nuestras Marcas',
      images: [
        'assets/images/histo2.png',
        'assets/images/histo2.2.png'
      ],
      logo: 'assets/images/histoM.png'
    }
  };

  imageSources: string[] = [];
  headerText: string = 'Historia';
  logoSrc: string = 'assets/images/histoP.png';

  currentImageIndex = 0;
  currentProgress = 0;
  isPaused = false;
  isLoading = true;
  storyNotFound = false;

  private timerSubscription: Subscription | null = null;
  private readonly DURATION_PER_IMAGE = 5000;

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const storyId = params.get('id');
      this.isLoading = true;
      this.storyNotFound = false;
      this.resetStoryState();

      if (storyId && this.storyData[storyId]) {
        const currentStory = this.storyData[storyId];
        this.imageSources = currentStory.images;
        this.headerText = currentStory.header;
        this.logoSrc = currentStory.logo || 'assets/images/histoP.png';

        if (this.imageSources.length > 0) {
          this.setHostBackgroundImage(this.imageSources[0]);
          this.isLoading = false;
          this.startTimer();
        } else {
          this.clearHostBackgroundImage();
          this.isLoading = false;
        }
      } else {
        this.isLoading = false;
        this.storyNotFound = true;
        this.clearHostBackgroundImage();
      }
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.stopTimer();
    this.clearHostBackgroundImage();
  }

  private setHostBackgroundImage(imageUrl: string | null): void {
    const hostElement = this.elementRef.nativeElement;
    if (imageUrl) {
      const cssImageUrl = `url('${imageUrl}')`;
      this.renderer.setStyle(hostElement, '--story-bg-image', cssImageUrl);
    } else {
      this.clearHostBackgroundImage();
    }
  }

  private clearHostBackgroundImage(): void {
    const hostElement = this.elementRef.nativeElement;
    this.renderer.removeStyle(hostElement, '--story-bg-image');
  }

  private resetStoryState(): void {
    this.stopTimer();
    this.currentImageIndex = 0;
    this.currentProgress = 0;
    this.isPaused = false;
    this.imageSources = [];
    this.headerText = 'Historia';
    this.logoSrc = 'assets/images/histoP.png';
  }

  private startTimer(): void {
    this.stopTimer();
    if (this.isPaused || this.imageSources.length === 0) return;

    if (this.imageSources.length > 0) {
        this.setHostBackgroundImage(this.imageSources[this.currentImageIndex]);
    }

    this.currentProgress = 0;
    const intervalTime = 50;
    const steps = this.DURATION_PER_IMAGE / intervalTime;

    this.timerSubscription = interval(intervalTime).pipe(
      takeWhile(() => this.currentProgress < 100 && !this.isPaused),
      tap(() => {
        this.currentProgress += (100 / steps);
        this.cdr.detectChanges();
      })
    ).subscribe({
         complete: () => {
             if (!this.isPaused) {
                  this.goToNextImage(true);
             }
         }
    });
  }

  private stopTimer(): void {
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
      this.timerSubscription = null;
    }
  }

  togglePause(): void {
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.stopTimer();
    } else {
        if (this.currentProgress >= 100) {
             if (this.currentImageIndex < this.imageSources.length - 1) {
                 if(this.currentProgress < 100) {
                     this.startTimer();
                 } else {
                     this.goToNextImage();
                 }
             }
        } else {
           this.startTimer();
        }
    }
    this.cdr.detectChanges();
  }

  goToNextImage(fromTimer: boolean = false): void {
    if (this.currentImageIndex < this.imageSources.length - 1) {
      this.currentImageIndex++;
      this.currentProgress = 0;
      this.setHostBackgroundImage(this.getCurrentImageSrc());
      if (!this.isPaused) {
        this.startTimer();
      }
    } else {
      if (fromTimer || !this.isPaused) {
           this.closeStory();
      } else {
          this.currentProgress = 100;
      }
    }
    this.cdr.detectChanges();
  }

  goToPreviousImage(): void {
      if (this.currentImageIndex > 0) {
        this.currentImageIndex--;
        this.currentProgress = 0;
        this.setHostBackgroundImage(this.getCurrentImageSrc());
        if (!this.isPaused) {
            this.startTimer();
        }
      }
      this.cdr.detectChanges();
  }

  clickNext(): void {
      if (!this.isPaused) {
          this.stopTimer();
          this.goToNextImage();
      } else {
          if (this.currentImageIndex < this.imageSources.length - 1) {
              this.currentImageIndex++;
              this.currentProgress = 0;
              this.setHostBackgroundImage(this.getCurrentImageSrc());
          }
      }
      this.cdr.detectChanges();
  }

  clickPrevious(): void {
      if (!this.isPaused) {
          this.stopTimer();
          this.goToPreviousImage();
      } else {
          if (this.currentImageIndex > 0) {
              this.currentImageIndex--;
              this.currentProgress = 0;
              this.setHostBackgroundImage(this.getCurrentImageSrc());
          }
      }
      this.cdr.detectChanges();
  }

  getCurrentImageSrc(): string | null {
    if (this.isLoading || this.storyNotFound || this.imageSources.length === 0 || this.currentImageIndex >= this.imageSources.length) {
         return null;
    }
    return this.imageSources[this.currentImageIndex];
  }

  closeStory(): void {
    this.stopTimer();
    this.router.navigate(['/home']);
  }
}
