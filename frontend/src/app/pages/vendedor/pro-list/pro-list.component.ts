import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Observable, Subject, forkJoin, of, EMPTY } from 'rxjs';
import { catchError, map, takeUntil, switchMap, finalize } from 'rxjs/operators';
import { ProductService } from '../../../services/product.service';
import { InventoryService } from '../../../services/inventory.service';
import { AuthService } from '../../../services/auth.service';
import { HttpClient } from '@angular/common/http';


@Component({
  selector: 'app-pro-list',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  templateUrl: './pro-list.component.html',
  styleUrl: './pro-list.component.scss'
})
export class ProListComponent implements OnInit, OnDestroy {
 private productService = inject(ProductService);
  private inventoryService = inject(InventoryService);
  private authService = inject(AuthService);
  private http = inject(HttpClient);
  private destroy$ = new Subject<void>();
  private userApiUrl = 'http://localhost:8100/api/user';
  public productsWithStock$!: Observable<any[]>;
  public isLoading = true;
  public errorMessage: string | null = null;
  public currentUserRole: string | null = null;
  private vendedorBranchCode: string | null = null;
  public vendedorBranchName: string | null = null;

  ngOnInit(): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.currentUserRole = this.authService.getCurrentUserRole();

    this.getUserDetailsAndLoadProducts().pipe(
      takeUntil(this.destroy$)
    ).subscribe(
      () => {},
      (errorMsgFromPipeline) => {
        this.errorMessage = errorMsgFromPipeline;
        this.isLoading = false;
        this.productsWithStock$ = of([]);
    });
  }

  private getUserDetailsAndLoadProducts(): Observable<any[]> {
    if (this.currentUserRole === 'vendedor') {
      return this.http.get<any>(`${this.userApiUrl}/me`).pipe(
        takeUntil(this.destroy$),
        map(workerDetails => {
          if (workerDetails && workerDetails.branch && workerDetails.branch.branch_code) {
            this.vendedorBranchCode = workerDetails.branch.branch_code;
            this.vendedorBranchName = workerDetails.branch.name || this.vendedorBranchCode;
            return true;
          } else {
            this.errorMessage = 'Vendedor sin sucursal asignada o datos incompletos.';
            this.vendedorBranchName = null;
            throw new Error(this.errorMessage);
          }
        }),
        switchMap(() => this.fetchProductsAndInventory()),
        catchError(err => {
          this.errorMessage = this.errorMessage || err.message || 'Error al obtener detalles del Vendedor.';
          this.isLoading = false;
          this.productsWithStock$ = of([]);
          this.vendedorBranchName = null;
          return EMPTY;
        })
      );
    } else if (this.currentUserRole) {
      this.vendedorBranchCode = null;
      this.vendedorBranchName = null;
      return this.fetchProductsAndInventory();
    } else {
      this.errorMessage = 'No se pudo determinar el rol del usuario.';
      this.isLoading = false;
      this.productsWithStock$ = of([]);
      this.vendedorBranchName = null;
      return EMPTY;
    }
  }

  private fetchProductsAndInventory(): Observable<any[]> {
    this.isLoading = true;
    this.errorMessage = null;

    this.productsWithStock$ = forkJoin({
      apiProducts: this.productService.getProducts(),
      inventoryItems: this.inventoryService.getInventory()
    }).pipe(
      map(data => {
        const { apiProducts, inventoryItems } = data as { apiProducts: any[], inventoryItems: any[] };

        if (!Array.isArray(apiProducts) || !Array.isArray(inventoryItems)) {
          console.error('[ProductListComponent] map: apiProducts o inventoryItems no es un array', { apiProducts, inventoryItems });
          throw new Error('Datos inválidos recibidos del servidor (productos o inventario).');
        }

        let processedProducts = apiProducts.map(product => {
          if (!product || typeof product.codigo_producto === 'undefined') {
            return {
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
            };
          }

          let stockForThisProduct = 0;
          if (this.currentUserRole === 'Vendedor' && this.vendedorBranchCode) {
            stockForThisProduct = inventoryItems
              .filter(item => item && item.product_code === product.codigo_producto && item.branch_code === this.vendedorBranchCode)
              .reduce((sum, currentItem) => sum + (Number(currentItem.quantity) || 0), 0);
          } else if (this.currentUserRole) {
            stockForThisProduct = inventoryItems
              .filter(item => item && item.product_code === product.codigo_producto)
              .reduce((sum, currentItem) => sum + (Number(currentItem.quantity) || 0), 0);
          }

          return {
            ...product,
            stock_total: stockForThisProduct
          };
        });

        if (this.currentUserRole === 'Vendedor' && this.vendedorBranchCode) {
          const branchCode = this.vendedorBranchCode;
          processedProducts = processedProducts.filter(p =>
            inventoryItems.some(invItem => invItem.product_code === p.codigo_producto && invItem.branch_code === branchCode)
          );
        }
        return processedProducts;
      }),
      catchError(error => {
        this.errorMessage = error.message || 'Ocurrió un error al cargar los productos.';
        return of([]);
      }),
      finalize(() => {
        this.isLoading = false;
      })
    );
    return this.productsWithStock$;
  }

  refreshProducts(): void {
    this.ngOnInit();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
