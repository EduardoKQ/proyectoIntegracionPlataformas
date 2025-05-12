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
  private currentStoryId: string | null = null;

  private timerSubscription: Subscription | null = null;
  private readonly DURATION_PER_IMAGE = 5000;
  private readonly STORAGE_KEY_PREFIX = 'story_state_';
  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const storyId = params.get('id');
      this.currentStoryId = storyId;
      this.isLoading = true;
      this.storyNotFound = false;
      this.resetStoryState(false);

      if (storyId && this.storyData[storyId]) {
        const currentStory = this.storyData[storyId];
        this.imageSources = currentStory.images;
        this.headerText = currentStory.header;
        this.logoSrc = currentStory.logo || 'assets/images/histoP.png';
        this.restoreState();

        if (this.imageSources.length > 0) {
          this.setHostBackgroundImage(this.getCurrentImageSrc());
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
    this.clearState();
    this.clearHostBackgroundImage();
  }

  private getStateKey(): string | null {
    return this.currentStoryId ? `${this.STORAGE_KEY_PREFIX}${this.currentStoryId}` : null;
  }

  private saveState(): void {
    const key = this.getStateKey();
    if (key) {
      localStorage.setItem(key, JSON.stringify({
        currentImageIndex: this.currentImageIndex,
        currentProgress: this.currentProgress
      }));
    }
  }

  private restoreState(): void {
    const key = this.getStateKey();
    if (key) {
      const storedState = localStorage.getItem(key);
      if (storedState) {
        try {
          const state = JSON.parse(storedState);
          this.currentImageIndex = state.currentImageIndex || 0;
          this.currentProgress = state.currentProgress || 0;
        } catch (error) {
          console.error('Error al parsear el estado de la historia:', error);
          this.clearState();
        }
      }
    }
  }

  private clearState(): void {
    const key = this.getStateKey();
    if (key) {
      localStorage.removeItem(key);
    }
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

  private resetStoryState(fullReset: boolean = true): void {
    this.stopTimer();
    if (fullReset) {
      this.currentImageIndex = 0;
      this.currentProgress = 0;
    }
    this.isPaused = false;
    if (fullReset) {
      this.imageSources = [];
      this.headerText = 'Historia';
      this.logoSrc = 'assets/images/histoP.png';
    }
  }

  private startTimer(): void {
    this.stopTimer();
    if (this.isPaused || this.imageSources.length === 0) return;

    if (this.imageSources.length > 0) {
      this.setHostBackgroundImage(this.imageSources[this.currentImageIndex]);
    }

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
      this.saveState();
    } else {
      if (this.currentProgress >= 100) {
        if (this.currentImageIndex < this.imageSources.length - 1) {
          if (this.currentProgress < 100) {
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
    this.saveState();
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
    this.saveState();
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
        this.saveState();
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
        this.saveState();
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
    this.clearState();
    this.router.navigate(['/home']);
  }
}
