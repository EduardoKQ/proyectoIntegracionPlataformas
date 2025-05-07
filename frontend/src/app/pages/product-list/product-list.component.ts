import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { ProductService, ApiProduct } from '../../services/product.service';
import { InventoryService, InventoryItem } from '../../services/inventory.service';

export interface DisplayProductInList extends ApiProduct {
  stock_total: number;
}

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.scss']
})
export class ProductListComponent implements OnInit {

  private productService = inject(ProductService);
  private inventoryService = inject(InventoryService);

  public products$!: Observable<DisplayProductInList[]>;
  public errorOcurred = false;
  public errorMessage: string | null = null;

  ngOnInit(): void {
    this.loadProductsWithStock();
  }

  loadProductsWithStock(): void {
    this.errorOcurred = false;
    this.errorMessage = null;
    console.log('[ProductListComponent] loadProductsWithStock: Iniciando carga...');

    this.products$ = forkJoin({
      products: this.productService.getProducts(),
      inventory: this.inventoryService.getInventory()
    }).pipe(
      map(data => {
        const { products, inventory } = data;
        console.log('[ProductListComponent] map: Productos base recibidos:', products);
        console.log('[ProductListComponent] map: Inventario completo recibido:', inventory);

        if (!Array.isArray(products) || !Array.isArray(inventory)) {
            console.error('[ProductListComponent] map: products o inventory no es un array', { products, inventory });
            throw new Error('Datos inválidos recibidos para procesar stock.');
        }

        return products.map(product => {
          if (!product || typeof product.codigo_producto === 'undefined') {
            console.warn('[ProductListComponent] map: Producto inválido encontrado:', product);
            return { ...product, stock_total: 0 } as DisplayProductInList;
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
        console.log('[ProductListComponent] tap: Productos con stock procesados:', dataWithStock.length);
        if (!dataWithStock || dataWithStock.length === 0) {
          console.log('[ProductListComponent] tap: No se encontraron productos procesados o la lista está vacía.');
        }
      }),
      catchError(error => {
        console.error('[ProductListComponent] CATCHERROR: Error al cargar productos con stock:', error);
        this.errorOcurred = true;
        this.errorMessage = error.message || 'Ocurrió un error desconocido al combinar productos y stock.';
        return of([]);
      })
    );
  }
}
