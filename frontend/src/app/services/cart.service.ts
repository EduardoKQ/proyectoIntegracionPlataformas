import { Injectable, inject, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, of, Subscription, forkJoin } from 'rxjs';
import { map, switchMap, take, tap, catchError } from 'rxjs/operators';
import { Branch } from './branch.service';
import { SelectedBranchService } from './selected-branch.service';
import { InventoryService, InventoryItem } from './inventory.service';

export interface ProductForCart {
  codigo_producto: string;
  nombre: string;
  precio: {
    precio_actual: number;
  };
  imageUrl?: string;
}

export interface CartItem {
  product_code: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
  branch_code: string;
  branch_name: string;
}

@Injectable({
  providedIn: 'root'
})
export class CartService implements OnDestroy {
  private inventoryService = inject(InventoryService);
  private selectedBranchService = inject(SelectedBranchService);

  private cartItemsSubject: BehaviorSubject<CartItem[]> = new BehaviorSubject<CartItem[]>([]);
  public cartItems$: Observable<CartItem[]> = this.cartItemsSubject.asObservable();

  private currentBranch: Branch | null = null;
  private branchSubscription!: Subscription;

  private readonly cartStorageKey = 'CarritoDeCompra';

  constructor() {
    this.loadCartFromLocalStorage();

    this.branchSubscription = this.selectedBranchService.selectedBranch$.subscribe(branch => {
      const previousBranchCode = this.currentBranch?.branch_code;
      this.currentBranch = branch;

      if (branch) {
        if (this.cartItemsSubject.value.length > 0) {
          this.revalidateCartForNewBranch(branch);
        } else {
        }
      } else {
        if (this.cartItemsSubject.value.length > 0) {
        } else {
        }
      }
    });
  }

  private loadCartFromLocalStorage(): void {
    const storedCart = localStorage.getItem(this.cartStorageKey);
    if (storedCart) {
      try {
        const items = JSON.parse(storedCart) as CartItem[];
        this.cartItemsSubject.next(items);
      } catch (e) {
        localStorage.removeItem(this.cartStorageKey);
      }
    } else {
    }
  }

  private saveCartToLocalStorage(): void {
    try {
      const cartToSave = this.cartItemsSubject.value;
      localStorage.setItem(this.cartStorageKey, JSON.stringify(cartToSave));
    } catch (e) {
    }
  }

  private revalidateCartForNewBranch(newBranch: Branch): void {
    const currentCartInMemory = [...this.cartItemsSubject.value];

    if (currentCartInMemory.length === 0) {
      return;
    }

    const stockChecks$: Observable<InventoryItem | null>[] = currentCartInMemory.map(item =>
      this.inventoryService.getProductStockInBranch(newBranch.branch_code, item.product_code)
        .pipe(
          tap(stockData => {}),
          catchError(err => {
            return of(null);
          })
        )
    );

    if (stockChecks$.length === 0) {
        return;
    }

    forkJoin(stockChecks$).subscribe(inventoryResults => {
      const updatedCart: CartItem[] = [];
      currentCartInMemory.forEach((item, index) => {
        const stockInfo = inventoryResults[index];
        const stockAvailable = stockInfo ? stockInfo.quantity : 0;

        if (stockAvailable > 0) {
          const newQuantity = Math.min(item.quantity, stockAvailable);
          if (newQuantity > 0) {
            updatedCart.push({
              ...item,
              quantity: newQuantity,
              branch_code: newBranch.branch_code,
              branch_name: newBranch.name
            });
          } else {
          }
        } else {
        }
      });

      this.cartItemsSubject.next(updatedCart);
      this.saveCartToLocalStorage();
    });
  }

  addToCart(product: ProductForCart, quantity: number, branchCodeFromComponent: string, branchNameFromComponent: string): void {
    if (!this.currentBranch) {
      alert('Por favor, selecciona una sucursal primero para agregar productos al carrito.');
      return;
    }
    if (this.currentBranch.branch_code !== branchCodeFromComponent) {
    }

    const activeBranchCode = this.currentBranch.branch_code;
    const activeBranchName = this.currentBranch.name;

    const currentCart = [...this.cartItemsSubject.value];
    const existingItemIndex = currentCart.findIndex(item =>
      item.product_code === product.codigo_producto && item.branch_code === activeBranchCode
    );

    const productPrice = product.precio.precio_actual;
    if (typeof productPrice !== 'number' || isNaN(productPrice)) {
      return;
    }

    this.inventoryService.getProductStockInBranch(activeBranchCode, product.codigo_producto).subscribe({
      next: stockItem => {
        const stockAvailable = stockItem ? stockItem.quantity : 0;
        let finalQuantityInCart: number;

        if (existingItemIndex > -1) {
          finalQuantityInCart = currentCart[existingItemIndex].quantity + quantity;
        } else {
          finalQuantityInCart = quantity;
        }

        if (stockAvailable >= finalQuantityInCart) {
          if (existingItemIndex > -1) {
            currentCart[existingItemIndex].quantity = finalQuantityInCart;
          } else {
            const newItem: CartItem = {
              product_code: product.codigo_producto,
              name: product.nombre,
              price: productPrice,
              quantity: finalQuantityInCart,
              image_url: product.imageUrl,
              branch_code: activeBranchCode,
              branch_name: activeBranchName
            };
            currentCart.push(newItem);
          }
          this.cartItemsSubject.next(currentCart);
          this.saveCartToLocalStorage();
        } else {
          alert(`No hay suficiente stock para ${product.nombre} en ${activeBranchName}. Disponible: ${stockAvailable}, Solicitado (total): ${finalQuantityInCart}.`);
        }
      },
      error: err => {
        alert(`Error al verificar stock para ${product.nombre} al añadir al carrito. Intente nuevamente.`);
      }
    });
  }

  updateQuantity(productCode: string, branchCodeFromItem: string, newQuantity: number): void {
    if (!this.currentBranch) {
      alert('Error: No hay una sucursal activa para actualizar la cantidad.');
      return;
    }
    const activeBranchCode = this.currentBranch.branch_code;

    if (newQuantity < 0) {
        return;
    }

    const currentCart = [...this.cartItemsSubject.value];
    const itemToUpdateIndex = currentCart.findIndex(item =>
      item.product_code === productCode && item.branch_code === branchCodeFromItem
    );

    if (itemToUpdateIndex > -1) {
      const itemBeingUpdated = currentCart[itemToUpdateIndex];
      if (newQuantity === 0) {
        currentCart.splice(itemToUpdateIndex, 1);
        this.cartItemsSubject.next(currentCart);
        this.saveCartToLocalStorage();
      } else {
        this.inventoryService.getProductStockInBranch(itemBeingUpdated.branch_code, productCode).subscribe({
          next: stockItem => {
            const stockAvailable = stockItem ? stockItem.quantity : 0;
            if (stockAvailable >= newQuantity) {
              currentCart[itemToUpdateIndex].quantity = newQuantity;
            } else {
              currentCart[itemToUpdateIndex].quantity = stockAvailable;
              if (stockAvailable > 0) {
                alert(`Cantidad ajustada al stock máximo disponible (${stockAvailable}) para ${itemBeingUpdated.name} en ${itemBeingUpdated.branch_name}.`);
              } else {
                alert(`Producto ${itemBeingUpdated.name} sin stock en ${itemBeingUpdated.branch_name}. Se eliminó del carrito.`);
                currentCart.splice(itemToUpdateIndex, 1);
              }
            }
            this.cartItemsSubject.next(currentCart);
            this.saveCartToLocalStorage();
          },
          error: err => {
            alert(`Error al verificar stock para actualizar cantidad de ${productCode}. Intente nuevamente.`);
          }
        });
      }
    } else {
    }
  }

  removeFromCart(productCode: string, branchCodeOfItem: string): void {
    const initialCartLength = this.cartItemsSubject.value.length;
    const updatedCart = this.cartItemsSubject.value.filter(item =>
      !(item.product_code === productCode && item.branch_code === branchCodeOfItem)
    );

    if (updatedCart.length < initialCartLength) {
        this.cartItemsSubject.next(updatedCart);
        this.saveCartToLocalStorage();
    } else {
    }
  }

  clearCart(): void {
    this.cartItemsSubject.next([]);
    this.saveCartToLocalStorage();
  }

  getTotalItems(): Observable<number> {
    return this.cartItems$.pipe(map(items => items.reduce((total, item) => total + item.quantity, 0)));
  }

  getTotalPrice(): Observable<number> {
    return this.cartItems$.pipe(
        map(items => {
          return items.reduce((total, item) => {
            if (typeof item.price === 'number' && typeof item.quantity === 'number') {
                return total + (item.price * item.quantity);
            }
            return total;
          }, 0);
        })
    );
  }

  getCurrentCartItems(): CartItem[] {
    return [...this.cartItemsSubject.value];
  }

  ngOnDestroy(): void {
    this.branchSubscription?.unsubscribe();
  }
}
