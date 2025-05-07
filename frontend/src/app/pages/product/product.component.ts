import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ProductService, ApiProduct } from '../../services/product.service';
import { InventoryService } from '../../services/inventory.service';

export interface DisplayProduct extends ApiProduct {
  stock_total: number;
}

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product.component.html',
  styleUrls: ['./product.component.scss']
})
export class ProductComponent implements OnInit {

  private productService = inject(ProductService);
  private inventoryService = inject(InventoryService);

  public productsWithStock$!: Observable<DisplayProduct[]>;
  public errorOcurred = false;
  public errorMessage: string | null = null;

  ngOnInit(): void {
    this.loadProductsWithStock();
  }

  loadProductsWithStock(): void {
    this.errorOcurred = false;
    this.errorMessage = null;
    console.log('[ProductComponent] loadProductsWithStock: Iniciando carga...');

    this.productsWithStock$ = forkJoin({
      products: this.productService.getProducts(),
      inventory: this.inventoryService.getInventory()
    }).pipe(
      map(data => {
        console.log('[ProductComponent] map: Data recibida por forkJoin:', data);
        const products = Array.isArray(data.products) ? data.products : [];
        const inventory = Array.isArray(data.inventory) ? data.inventory : [];

        return products.map(product => {
          if (!product || typeof product.codigo_producto === 'undefined') {
            console.warn('[ProductComponent] map: Producto inválido encontrado:', product);
            return { ...product, stock_total: 0 };
          }
          const totalStock = inventory
            .filter(item => item && item.product_code === product.codigo_producto)
            .reduce((sum, currentItem) => sum + (currentItem.quantity || 0), 0);
          return {
            ...product,
            stock_total: totalStock
          };
        });
      }),
      tap(dataWithStock => {
        console.log('[ProductComponent] tap: Productos con stock procesados:', dataWithStock.length);
        if (!dataWithStock || dataWithStock.length === 0) {
          console.log('[ProductComponent] tap: No se encontraron productos procesados o la lista está vacía.');
        }
      }),
      catchError(error => {
        console.error('[ProductComponent] CATCHERROR: Error al cargar productos con stock:', error);
        this.errorOcurred = true;
        this.errorMessage = error.message || 'Ocurrió un error desconocido al combinar productos y stock.';
        return of([]);
      })
    );
  }
}
