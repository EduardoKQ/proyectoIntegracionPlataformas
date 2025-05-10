import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Router } from '@angular/router';
import { Observable, Subject, forkJoin, of } from 'rxjs';
import { catchError, map, tap, takeUntil, finalize } from 'rxjs/operators';

import { ProductService } from '../../services/product.service';
import { InventoryService } from '../../services/inventory.service';
import { ApiProduct } from '../../services/product.interfaces';

export interface DisplayProductInList extends ApiProduct {
  stock_total: number;
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
      inventoryItems: this.inventoryService.getInventory()
    }).pipe(
      takeUntil(this.destroy$),
      map(data => {
        const { apiProducts, inventoryItems } = data;

        if (!Array.isArray(apiProducts) || !Array.isArray(inventoryItems)) {
          throw new Error('Datos inválidos recibidos del servidor.');
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
                stock_total: 0
            } as DisplayProductInList;
          }
          const totalStock = inventoryItems
            .filter(item => item && item.product_code === product.codigo_producto)
            .reduce((sum, currentItem) => sum + (currentItem.quantity || 0), 0);
          return {
            ...product,
            stock_total: totalStock
          } as DisplayProductInList;
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
