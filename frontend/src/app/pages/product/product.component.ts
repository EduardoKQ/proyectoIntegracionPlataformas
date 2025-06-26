import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Router } from '@angular/router';
import { Observable, Subject, forkJoin, of } from 'rxjs';
import { catchError, map, tap, takeUntil, finalize } from 'rxjs/operators';

import { ProductService } from '../../services/product.service';
import { InventoryService } from '../../services/inventory.service';
import { PromotionsService } from '../../services/promotions.service';
import { ApiProduct } from '../../services/product.interfaces';
import { Promotion } from '../../services/promotions.interfaces';

export interface DisplayProductInList extends ApiProduct {
  stock_total: number;
  has_promotion: boolean;
  promotion_info?: {
    promotion_id: number;
    promotion_code: string;
    promotion_name: string;
    original_price: number;
    promotional_price: number;
    discount_amount: number;
    discount_percentage: number;
    discount_type: 'percentage' | 'fixed_amount';
  };
}

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  templateUrl: './product.component.html',
  styleUrls: ['./product.component.scss']
})
export class ProductComponent implements OnInit, OnDestroy {
  private productService = inject(ProductService);
  private inventoryService = inject(InventoryService);
  private promotionsService = inject(PromotionsService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  public productsWithStock$!: Observable<DisplayProductInList[]>;
  public isLoading = true;
  public errorMessage: string | null = null;

  public showDeleteConfirmation = false;
  public productToDelete: { code: string, name: string } | null = null;

  ngOnInit(): void {
    this.loadProductsWithStock();
  }

  loadProductsWithStock(): void {
    this.isLoading = false;
    this.errorMessage = null;

    this.productsWithStock$ = forkJoin({
      apiProducts: this.productService.getProducts(),
      inventoryItems: this.inventoryService.getInventory(),
      activePromotions: this.promotionsService.getPromotionsWithDetails()
    }).pipe(
      takeUntil(this.destroy$),
      map(data => {
        const { apiProducts, inventoryItems, activePromotions } = data;

        if (!Array.isArray(apiProducts) || !Array.isArray(inventoryItems)) {
          throw new Error('Datos inválidos recibidos del servidor.');
        }
        const promotionsByProduct = new Map<string, Promotion>();
        const promotionsByCategory = new Map<string, Promotion>();
        const promotionsBySubcategory = new Map<string, Promotion>();

        if (Array.isArray(activePromotions)) {
          for (const promotion of activePromotions) {
            if (!this.promotionsService.isPromotionActive(promotion)) {
              continue;
            }
            if (promotion.products && Array.isArray(promotion.products)) {
              for (const product of promotion.products) {
                if (product.product_code) {
                  promotionsByProduct.set(product.product_code, promotion);
                }
              }
            }
            if (promotion.categories && Array.isArray(promotion.categories)) {
              for (const category of promotion.categories) {
                if (category.name) {
                  promotionsByCategory.set(category.name, promotion);
                }
              }
            }
            if (promotion.subcategories && Array.isArray(promotion.subcategories)) {
              for (const subcategory of promotion.subcategories) {
                if (subcategory.name) {
                  promotionsBySubcategory.set(subcategory.name, promotion);
                }
              }
            }
          }
        }

        return apiProducts.map(product => {
          if (!product || typeof product.codigo_producto === 'undefined') {
            return {
                ...product,
                nombre: product?.nombre || 'Producto Desconocido',
                descripcion: product?.descripcion || 'N/A',
                marca: product?.marca || 'N/A',
                categoria: product?.categoria || 'N/A',
                subcategoria: product?.subcategoria || 'N/A',
                precio: product?.precio || { precio_actual: 0, fecha_precio: '' },
                codigo_producto: product?.codigo_producto || 'N/A',
                codigo_marca: product?.codigo_marca || 'N/A',
                imageUrl: product?.imageUrl || '',
                stock_total: 0,
                has_promotion: false
            } as DisplayProductInList;
          }

          const totalStock = inventoryItems
            .filter(item => item && item.product_code === product.codigo_producto)
            .reduce((sum, currentItem) => sum + (currentItem.quantity || 0), 0);
          let applicablePromotion: Promotion | undefined;
          if (promotionsByProduct.has(product.codigo_producto)) {
            applicablePromotion = promotionsByProduct.get(product.codigo_producto);
          }
          else if (product.subcategoria && promotionsBySubcategory.has(product.subcategoria)) {
            applicablePromotion = promotionsBySubcategory.get(product.subcategoria);
          }
          else if (product.categoria && promotionsByCategory.has(product.categoria)) {
            applicablePromotion = promotionsByCategory.get(product.categoria);
          }
          let productWithStock: DisplayProductInList = {
            ...product,
            stock_total: totalStock,
            has_promotion: false
          };
          if (applicablePromotion) {
            const originalPrice = product.precio.precio_actual;
            const promotionalPrice = this.promotionsService.calculateDiscountedPrice(
              originalPrice,
              applicablePromotion.discount_type,
              applicablePromotion.discount_value
            );
            const discountPercentage = this.promotionsService.calculateDiscountPercentage(
              originalPrice,
              promotionalPrice
            );

            productWithStock.has_promotion = true;
            productWithStock.promotion_info = {
              promotion_id: applicablePromotion.id,
              promotion_code: applicablePromotion.promotion_code,
              promotion_name: applicablePromotion.name,
              original_price: originalPrice,
              promotional_price: promotionalPrice,
              discount_amount: originalPrice - promotionalPrice,
              discount_percentage: discountPercentage,
              discount_type: applicablePromotion.discount_type
            };
          }

          return productWithStock;
        });
      }),
      tap(() => this.isLoading = false),
      catchError(error => {
        this.isLoading = false;
        this.errorMessage = error.message || 'Ocurrió un error al cargar los productos.';
        return of([]);
      })
    );
  }

  refreshProducts(): void {
    this.loadProductsWithStock();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
