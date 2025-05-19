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
      if (branch && previousBranchCode && branch.branch_code !== previousBranchCode) {
        this.revalidateCartForNewBranch(branch);
      } else if (branch && !previousBranchCode && this.cartItemsSubject.value.length > 0) {
        this.revalidateCartForNewBranch(branch);
      } else if (!branch && this.cartItemsSubject.value.length > 0) {
        console.warn('CartService: No hay sucursal seleccionada, vaciando carrito.');
        this.clearCartLocalOnly();
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
        console.error('Error al cargar carrito desde localStorage:', e);
        localStorage.removeItem(this.cartStorageKey);
      }
    }
  }

  private saveCartToLocalStorage(): void {
    try {
      localStorage.setItem(this.cartStorageKey, JSON.stringify(this.cartItemsSubject.value));
    } catch (e) {
      console.error('Error al guardar carrito en localStorage:', e);
    }
  }

  private clearCartLocalOnly(): void {
    this.cartItemsSubject.next([]);
  }


  private revalidateCartForNewBranch(newBranch: Branch): void {
    const currentCart = [...this.cartItemsSubject.value];
    if (currentCart.length === 0) {
      this.saveCartToLocalStorage();
      return;
    }

    const stockChecks$: Observable<InventoryItem | null>[] = currentCart.map(item =>
      this.inventoryService.getProductStockInBranch(newBranch.branch_code, item.product_code)
        .pipe(
          catchError(err => {
            console.warn(`Error obteniendo stock para ${item.product_code} en ${newBranch.name}, se asumirá 0.`, err);
            return of(null);
          })
        )
    );

    forkJoin(stockChecks$).subscribe(inventoryResults => {
      const updatedCart: CartItem[] = [];
      currentCart.forEach((item, index) => {
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
             console.log(`Producto ${item.name} con cantidad 0 después de revalidación en ${newBranch.name}, no se añade.`);
          }
        } else {
          console.log(`Producto ${item.name} eliminado del carrito por no tener stock en ${newBranch.name}`);
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
      console.warn('La sucursal del componente no coincide con la sucursal activa del servicio. Usando la sucursal activa.');
    }

    const activeBranchCode = this.currentBranch.branch_code;
    const activeBranchName = this.currentBranch.name;

    const currentCart = [...this.cartItemsSubject.value];
    const existingItemIndex = currentCart.findIndex(item =>
      item.product_code === product.codigo_producto && item.branch_code === activeBranchCode
    );

    const productPrice = product.precio.precio_actual;
    if (typeof productPrice !== 'number' || isNaN(productPrice)) {
      console.error('Precio del producto no es un número válido al agregar:', product);
      return;
    }

    this.inventoryService.getProductStockInBranch(activeBranchCode, product.codigo_producto).subscribe({
      next: stockItem => {
        const stockAvailable = stockItem ? stockItem.quantity : 0;
        let quantityToAdd = quantity;
        let finalQuantityInCart: number;

        if (existingItemIndex > -1) {
          finalQuantityInCart = currentCart[existingItemIndex].quantity + quantityToAdd;
        } else {
          finalQuantityInCart = quantityToAdd;
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
          alert(`No hay suficiente stock para ${product.nombre} en ${activeBranchName}. Disponible: ${stockAvailable}, En carrito ya hay: ${existingItemIndex > -1 ? currentCart[existingItemIndex].quantity : 0}.`);
        }
      },
      error: err => {
        alert(`Error al verificar stock para ${product.nombre}. Intente nuevamente.`);
        console.error(err);
      }
    });
  }

  updateQuantity(productCode: string, branchCodeFromComponent: string, newQuantity: number): void {
    if (!this.currentBranch) {
      alert('Error: No hay una sucursal activa para actualizar la cantidad.');
      return;
    }
     if (this.currentBranch.branch_code !== branchCodeFromComponent) {
      console.warn('La sucursal del componente no coincide con la sucursal activa del servicio. Usando la sucursal activa para la actualización.');
    }

    const activeBranchCode = this.currentBranch.branch_code;

    if (newQuantity < 0) return;

    const currentCart = [...this.cartItemsSubject.value];
    const itemToUpdateIndex = currentCart.findIndex(item =>
      item.product_code === productCode && item.branch_code === activeBranchCode
    );

    if (itemToUpdateIndex > -1) {
      if (newQuantity === 0) {
        const updatedCart = currentCart.filter((_, index) => index !== itemToUpdateIndex);
        this.cartItemsSubject.next(updatedCart);
        this.saveCartToLocalStorage();
      } else {
        this.inventoryService.getProductStockInBranch(activeBranchCode, productCode).subscribe({
          next: stockItem => {
            const stockAvailable = stockItem ? stockItem.quantity : 0;
            if (stockAvailable >= newQuantity) {
              currentCart[itemToUpdateIndex].quantity = newQuantity;
              this.cartItemsSubject.next(currentCart);
              this.saveCartToLocalStorage();
            } else {
              currentCart[itemToUpdateIndex].quantity = stockAvailable;
              this.cartItemsSubject.next(currentCart);
              this.saveCartToLocalStorage();
              if (stockAvailable > 0) {
                alert(`Cantidad ajustada al stock máximo disponible (${stockAvailable}) para el producto en ${this.currentBranch?.name}.`);
              } else {
                 const updatedCart = currentCart.filter((item) => item.product_code !== productCode || item.branch_code !== activeBranchCode );
                 this.cartItemsSubject.next(updatedCart);
                 this.saveCartToLocalStorage();
                 alert(`Producto sin stock en ${this.currentBranch?.name}. Se eliminó del carrito.`);
              }
            }
          },
          error: err => {
            alert(`Error al verificar stock para ${productCode}. Intente nuevamente.`);
            console.error(err);
          }
        });
      }
    }
  }

  removeFromCart(productCode: string, branchCodeFromComponent: string): void {
    if (!this.currentBranch) { return; }
    const activeBranchCode = this.currentBranch.branch_code;
     if (activeBranchCode !== branchCodeFromComponent) {
      console.warn('Intento de eliminar de sucursal no activa. Operación cancelada o usar sucursal activa.');
    }

    const updatedCart = this.cartItemsSubject.value.filter(item =>
      !(item.product_code === productCode && item.branch_code === activeBranchCode)
    );
    this.cartItemsSubject.next(updatedCart);
    this.saveCartToLocalStorage();
  }

  clearCart(): void {
    this.cartItemsSubject.next([]);
    this.saveCartToLocalStorage();
  }

  getTotalItems(): Observable<number> {
    return this.cartItems$.pipe(map(items => items.reduce((total, item) => total + item.quantity, 0)));
  }

  getTotalPrice(): Observable<number> {
    return this.cartItems$.pipe(map(items => items.reduce((total, item) => total + (item.price * item.quantity), 0)));
  }

  getCurrentCartItems(): CartItem[] {
    return this.cartItemsSubject.value;
  }

  ngOnDestroy(): void {
    this.branchSubscription?.unsubscribe();
  }
}
