import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import { catchError, tap, takeUntil, finalize, map } from 'rxjs/operators';
import { PromotionsService } from '../../services/promotions.service';
import { Promotion, CreatePromotionRequest } from '../../services/promotions.interfaces';

interface ProcessedPromotion extends Promotion {
  statusText?: string;
  statusClass?: string;
  isActive?: boolean;
  daysRemaining?: number;
  daysRemainingText?: string;
  progress?: number;
  discountDisplay?: string;
  applicableItemsText?: string;
}

@Component({
  selector: 'app-promotions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './promotions.component.html',
  styleUrls: ['./promotions.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PromotionsComponent implements OnInit, OnDestroy {
  private promotionService = inject(PromotionsService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  public promotions$!: Observable<ProcessedPromotion[]>;
  public isLoading = true;
  public errorMessage: string | null = null;

  public showDeleteConfirmation = false;
  public promotionToDelete: { id: string, name: string } | null = null;

  ngOnInit(): void {
    this.loadPromotions();
  }

  loadPromotions(): void {
    this.isLoading = false;
    this.errorMessage = null;

    this.promotions$ = this.promotionService.getPromotions().pipe(
      takeUntil(this.destroy$),
      map((promotions: Promotion[]) => {
        return promotions.map(promotion => this.processPromotion(promotion));
      }),
      tap((promotions: ProcessedPromotion[]) => {
        if (promotions.length > 0) {
        }
        this.isLoading = false;
      }),
      catchError((error: any) => {
        this.isLoading = false;
        this.errorMessage = error.message || 'Ocurrió un error al cargar las promociones.';
        return of([] as ProcessedPromotion[]);
      }),
      finalize(() => {
        this.isLoading = false;
      })
    );
  }

  private processPromotion(promotion: Promotion): ProcessedPromotion {
    const now = new Date();
    const startDate = new Date(promotion.start_date);
    const endDate = new Date(promotion.end_date);

    let statusText = 'Inactiva';
    let isActive = false;

    if (promotion.status === 'active') {
      if (now < startDate) {
        statusText = 'Programada';
      } else if (now > endDate) {
        statusText = 'Expirada';
      } else {
        statusText = 'Activa';
        isActive = true;
      }
    }

    let daysRemaining = 0;
    let daysRemainingText = '';

    if (isActive) {
      const diffTime = endDate.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

      if (daysRemaining === 0) {
        daysRemainingText = 'Último día';
      } else if (daysRemaining === 1) {
        daysRemainingText = '1 día restante';
      } else {
        daysRemainingText = `${daysRemaining} días restantes`;
      }
    }

    let progress = 0;
    if (isActive) {
      const totalDuration = endDate.getTime() - startDate.getTime();
      const elapsed = now.getTime() - startDate.getTime();
      progress = Math.round((elapsed / totalDuration) * 10000) / 100;
      progress = Math.min(Math.max(progress, 0), 100);
    }
    const discountDisplay = promotion.discount_type === 'percentage'
      ? `${promotion.discount_value}% OFF`
      : `$${promotion.discount_value.toLocaleString('es-CL')} OFF`;

    const products = promotion.products?.length || 0;
    const categories = promotion.categories?.length || 0;
    const subcategories = promotion.subcategories?.length || 0;

    const parts: string[] = [];
    if (products > 0) parts.push(`${products} producto${products !== 1 ? 's' : ''}`);
    if (categories > 0) parts.push(`${categories} categoría${categories !== 1 ? 's' : ''}`);
    if (subcategories > 0) parts.push(`${subcategories} subcategoría${subcategories !== 1 ? 's' : ''}`);

    const applicableItemsText = parts.length === 0 ? 'Sin restricciones' : parts.join(', ');

    return {
      ...promotion,
      statusText,
      statusClass: this.getStatusClassFromText(statusText),
      isActive,
      daysRemaining,
      daysRemainingText,
      progress,
      discountDisplay,
      applicableItemsText
    };
  }

  private getStatusClassFromText(statusText: string): string {
    switch (statusText) {
      case 'Activa': return 'status-active';
      case 'Programada': return 'status-scheduled';
      case 'Expirada': return 'status-expired';
      case 'Inactiva': return 'status-inactive';
      default: return 'status-inactive';
    }
  }

  getDiscountDisplay(promotion: ProcessedPromotion): string {
    return promotion.discountDisplay || '';
  }

  getDateDisplay(dateString: string): string {
    if (!dateString) return 'Fecha no disponible';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getStatusText(promotion: ProcessedPromotion): string {
    return promotion.statusText || 'Inactiva';
  }

  getStatusClass(promotion: ProcessedPromotion): string {
    return promotion.statusClass || 'status-inactive';
  }

  isPromotionActive(promotion: ProcessedPromotion): boolean {
    return promotion.isActive || false;
  }

  getDaysRemaining(promotion: ProcessedPromotion): number {
    return promotion.daysRemaining || 0;
  }

  getDaysRemainingText(promotion: ProcessedPromotion): string {
    return promotion.daysRemainingText || '';
  }

  calculateProgress(promotion: ProcessedPromotion): number {
    return promotion.progress || 0;
  }

  getApplicableItemsText(promotion: ProcessedPromotion): string {
    return promotion.applicableItemsText || 'Sin restricciones';
  }

  getActivePromotionsCount(promotions: ProcessedPromotion[]): number {
    return promotions.filter(p => p.statusText === 'Activa').length;
  }

  getScheduledPromotionsCount(promotions: ProcessedPromotion[]): number {
    return promotions.filter(p => p.statusText === 'Programada').length;
  }

  getExpiredPromotionsCount(promotions: ProcessedPromotion[]): number {
    return promotions.filter(p => p.statusText === 'Expirada').length;
  }

  getInactivePromotionsCount(promotions: ProcessedPromotion[]): number {
    return promotions.filter(p => p.statusText === 'Inactiva').length;
  }

  createPromotion(): void {
  this.router.navigate(['/product/promotions-create']);
  }

  editPromotion(promotion: ProcessedPromotion): void {
    this.router.navigate(['/product/promotions-edit', promotion.promotion_code]);
  }

  viewPromotion(promotion: ProcessedPromotion): void {
    this.router.navigate(['/product/promotions-view', promotion.promotion_code]);
  }

  confirmDeletePromotion(promotion: ProcessedPromotion): void {
    this.promotionToDelete = {
      id: promotion.promotion_code,
      name: promotion.name
    };
    this.showDeleteConfirmation = true;
  }

  cancelDelete(): void {
    this.showDeleteConfirmation = false;
    this.promotionToDelete = null;
  }

  deletePromotion(): void {
    if (!this.promotionToDelete) return;

    this.promotionService.deletePromotion(Number(this.promotionToDelete.id))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.cancelDelete();
          this.refreshPromotions();
        },
        error: (error: any) => {
          this.errorMessage = 'Error al eliminar la promoción. Inténtalo de nuevo.';
          this.cancelDelete();
        }
      });
  }

  togglePromotionStatus(promotion: ProcessedPromotion): void {
    const newStatus = promotion.status === 'active' ? 'inactive' : 'active';

    const updatedPromotion: Partial<CreatePromotionRequest> = {
      promotion_code: promotion.promotion_code,
      name: promotion.name,
      description: promotion.description,
      discount_type: promotion.discount_type,
      discount_value: promotion.discount_value,
      start_date: promotion.start_date,
      end_date: promotion.end_date,
      status: newStatus,
      product_codes: promotion.products?.map(p => p.product_code) || [],
      category_codes: promotion.categories?.map(c => c.category_code) || [],
      subcategory_codes: promotion.subcategories?.map(s => s.subcategory_code) || []
    };

    this.promotionService.updatePromotion(Number(promotion.promotion_code), updatedPromotion)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.refreshPromotions();
        },
        error: (error: any) => {
          this.errorMessage = 'Error al cambiar el estado de la promoción.';
        }
      });
  }

  hasValidProducts(promotion: ProcessedPromotion): boolean {
    return !!(promotion.products && promotion.products.length > 0);
  }

  getProductsCount(promotion: ProcessedPromotion): number {
    return promotion.products ? promotion.products.length : 0;
  }

  getCategoriesCount(promotion: ProcessedPromotion): number {
    return promotion.categories ? promotion.categories.length : 0;
  }

  getSubcategoriesCount(promotion: ProcessedPromotion): number {
    return promotion.subcategories ? promotion.subcategories.length : 0;
  }

  getTotalApplicableItems(promotion: ProcessedPromotion): number {
    return this.getProductsCount(promotion) + this.getCategoriesCount(promotion) + this.getSubcategoriesCount(promotion);
  }

  refreshPromotions(): void {
    this.loadPromotions();
  }

  trackByPromotionId(index: number, promotion: ProcessedPromotion): string {
    return promotion.promotion_code;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
