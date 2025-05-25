import { Injectable, inject, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, of, Subscription, forkJoin, combineLatest } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { Branch } from './branch.service';
import { SelectedBranchService } from './selected-branch.service';
import { InventoryService, InventoryItem } from './inventory.service';
import { DeliveryAddress } from '../features/shared/components/address-modal/address-modal.component';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';

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

export interface CartState {
    items: CartItem[];
    deliveryMode: 'pickup' | 'delivery';
    deliveryAddress: DeliveryAddress | null;
    shippingCost: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class CartService implements OnDestroy {
  private inventoryService = inject(InventoryService);
  private selectedBranchService = inject(SelectedBranchService);
  private authService = inject(AuthService);
  private router = inject(Router);

  private cartItemsSubject = new BehaviorSubject<CartItem[]>([]);
  public cartItems$: Observable<CartItem[]> = this.cartItemsSubject.asObservable();

  private deliveryModeSubject = new BehaviorSubject<'pickup' | 'delivery'>('pickup');
  public deliveryMode$: Observable<'pickup' | 'delivery'> = this.deliveryModeSubject.asObservable();

  private deliveryAddressSubject = new BehaviorSubject<DeliveryAddress | null>(null);
  public deliveryAddress$: Observable<DeliveryAddress | null> = this.deliveryAddressSubject.asObservable();

  private shippingCostSubject = new BehaviorSubject<number | null>(null);
  public shippingCost$: Observable<number | null> = this.shippingCostSubject.asObservable();

  private currentBranch: Branch | null = null;
  private branchSubscription!: Subscription;

  private readonly cartItemsStorageKey = 'CarritoItems';
  private readonly shippingInfoStorageKey = 'CarritoShippingInfo';

  constructor() {
    this.loadCartFromLocalStorage();

    this.branchSubscription = this.selectedBranchService.selectedBranch$.subscribe(branch => {
      this.currentBranch = branch;
      if (branch) {
        if (this.cartItemsSubject.value.length > 0 && this.deliveryModeSubject.value === 'pickup') {
            this.revalidateCartForNewBranch(branch);
        }
      }
    });
  }

  private loadCartFromLocalStorage(): void {
    const storedItems = localStorage.getItem(this.cartItemsStorageKey);
    if (storedItems) {
      try { this.cartItemsSubject.next(JSON.parse(storedItems)); }
      catch (e) { localStorage.removeItem(this.cartItemsStorageKey); }
    }
    const storedShipping = localStorage.getItem(this.shippingInfoStorageKey);
    if (storedShipping) {
      try {
        const { mode, address, cost } = JSON.parse(storedShipping);
        this.deliveryModeSubject.next(mode || 'pickup');
        this.deliveryAddressSubject.next(address || null);
        this.shippingCostSubject.next(cost || null);
      } catch (e) { localStorage.removeItem(this.shippingInfoStorageKey); }
    }
  }

  private saveCartToLocalStorage(): void {
    localStorage.setItem(this.cartItemsStorageKey, JSON.stringify(this.cartItemsSubject.value));
    const shippingInfo = {
        mode: this.deliveryModeSubject.value,
        address: this.deliveryAddressSubject.value,
        cost: this.shippingCostSubject.value
    };
    localStorage.setItem(this.shippingInfoStorageKey, JSON.stringify(shippingInfo));
  }

  public setDeliveryMode(mode: 'pickup' | 'delivery'): void {
    if (this.deliveryModeSubject.value !== mode) {
        this.deliveryModeSubject.next(mode);
        if (mode === 'pickup') {
            this.deliveryAddressSubject.next(null);
            this.shippingCostSubject.next(null);
        }
        this.saveCartToLocalStorage();
    }
  }

  public setDeliveryAddress(address: DeliveryAddress | null): void {
    this.deliveryAddressSubject.next(address);
    this.shippingCostSubject.next(null);
    this.saveCartToLocalStorage();
  }

  public setShippingCost(cost: number | null): void {
    this.shippingCostSubject.next(cost);
    this.saveCartToLocalStorage();
  }

  private revalidateCartForNewBranch(newBranch: Branch): void {
    const currentCartInMemory = [...this.cartItemsSubject.value];
    if (currentCartInMemory.length === 0) return;
    const stockChecks$: Observable<InventoryItem | null>[] = currentCartInMemory.map(item =>
        this.inventoryService.getProductStockInBranch(newBranch.branch_code, item.product_code)
            .pipe(catchError(() => of(null)))
    );
    forkJoin(stockChecks$).subscribe(inventoryResults => {
        const updatedCart: CartItem[] = [];
        currentCartInMemory.forEach((item, index) => {
            const stockInfo = inventoryResults[index];
            const stockAvailable = stockInfo ? stockInfo.quantity : 0;
            if (stockAvailable > 0) {
                const newQuantity = Math.min(item.quantity, stockAvailable);
                updatedCart.push({ ...item, quantity: newQuantity, branch_code: newBranch.branch_code, branch_name: newBranch.name });
            }
        });
        this.cartItemsSubject.next(updatedCart);
        this.saveCartToLocalStorage();
    });
  }

  addToCart(product: ProductForCart, quantity: number, branchCodeFromComponent: string, branchNameFromComponent: string): void {
    if (!this.authService.isLoggedIn()) {
      alert('Debes iniciar sesión para agregar productos al carrito.');
      this.router.navigate(['/login']);
      return;
    }

    if (!this.currentBranch && this.deliveryModeSubject.value === 'pickup') {
      alert('Por favor, selecciona una sucursal primero para agregar productos al carrito para retiro.');
      return;
    }

    let activeBranchCode: string;
    let activeBranchName: string;

    if (this.deliveryModeSubject.value === 'pickup' && this.currentBranch) {
        activeBranchCode = this.currentBranch.branch_code;
        activeBranchName = this.currentBranch.name;
    } else if (this.deliveryModeSubject.value === 'delivery') {
        activeBranchCode = branchCodeFromComponent;
        activeBranchName = branchNameFromComponent;
    } else {
        alert('Error al determinar la sucursal de operación.');
        return;
    }

    const currentCart = [...this.cartItemsSubject.value];
    const existingItemIndex = currentCart.findIndex(item =>
      item.product_code === product.codigo_producto && item.branch_code === activeBranchCode
    );

    const productPrice = product.precio.precio_actual;
    if (typeof productPrice !== 'number' || isNaN(productPrice)) {
        console.error("Precio de producto inválido:", product);
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
        alert(`Error al verificar stock para ${product.nombre}. Intente nuevamente.`);
        console.error("Error verificando stock en addToCart:", err);
      }
    });
  }

  updateQuantity(productCode: string, branchCodeFromItem: string, newQuantity: number): void {
    if (!this.authService.isLoggedIn()) {
        alert('Debes iniciar sesión para modificar tu carrito.');
        this.loadCartFromLocalStorage();
        return;
    }
    const currentCart = [...this.cartItemsSubject.value];
    const itemIndex = currentCart.findIndex(item => item.product_code === productCode && item.branch_code === branchCodeFromItem);

    if (itemIndex > -1) {
        if (newQuantity <= 0) {
            currentCart.splice(itemIndex, 1);
        } else {
            const itemToUpdate = currentCart[itemIndex];
            const stockBranch = this.deliveryModeSubject.value === 'pickup' ? itemToUpdate.branch_code : branchCodeFromItem;

            this.inventoryService.getProductStockInBranch(stockBranch, productCode).subscribe({
                next: stockInfo => {
                    const stockAvailable = stockInfo?.quantity ?? 0;
                    if (this.deliveryModeSubject.value === 'pickup' && newQuantity > stockAvailable) {
                        alert(`Cantidad ajustada al stock máximo disponible (${stockAvailable}) para ${itemToUpdate.name}.`);
                        currentCart[itemIndex].quantity = stockAvailable;
                        if(stockAvailable === 0) currentCart.splice(itemIndex, 1);
                    } else {
                        currentCart[itemIndex].quantity = newQuantity;
                    }
                    this.cartItemsSubject.next([...currentCart]);
                    this.saveCartToLocalStorage();
                },
                error: () => {
                     alert('Error al verificar stock al actualizar cantidad.');
                }
            });
            return;
        }
        this.cartItemsSubject.next([...currentCart]);
        this.saveCartToLocalStorage();
    }
  }

  removeFromCart(productCode: string, branchCodeOfItem: string): void {
    if (!this.authService.isLoggedIn()) {
        alert('Debes iniciar sesión para modificar tu carrito.');
        return;
    }
    const updatedCart = this.cartItemsSubject.value.filter(item =>
        !(item.product_code === productCode && item.branch_code === branchCodeOfItem)
    );
    this.cartItemsSubject.next(updatedCart);
    this.saveCartToLocalStorage();
  }

  clearCart(): void {
    this.cartItemsSubject.next([]);
    this.deliveryModeSubject.next('pickup');
    this.deliveryAddressSubject.next(null);
    this.shippingCostSubject.next(null);
    this.saveCartToLocalStorage();
    localStorage.removeItem(this.cartItemsStorageKey);
    localStorage.removeItem(this.shippingInfoStorageKey);
  }

  getTotalItems(): Observable<number> {
    return this.cartItems$.pipe(map(items => items.reduce((total, item) => total + item.quantity, 0)));
  }

  getProductSubtotal(): Observable<number> {
    return this.cartItems$.pipe(
      map(items => items.reduce((total, item) => total + (item.price * item.quantity), 0))
    );
  }

  getGrandTotal(): Observable<number> {
      return combineLatest([
          this.getProductSubtotal(),
          this.shippingCost$
      ]).pipe(
          map(([subtotal, shipping]) => subtotal + (shipping || 0))
      );
  }

  getCurrentCartItems(): CartItem[] { return [...this.cartItemsSubject.value]; }
  getCurrentProductSubtotal(): number {
      return this.cartItemsSubject.value.reduce((total, item) => total + (item.price * item.quantity), 0);
  }
  getCurrentShippingCost(): number | null { return this.shippingCostSubject.value; }
  getCurrentDeliveryAddress(): DeliveryAddress | null { return this.deliveryAddressSubject.value; }
  getCurrentDeliveryMode(): 'pickup' | 'delivery' { return this.deliveryModeSubject.value; }

  public getCurrentSelectedBranch(): Branch | null {
    return this.currentBranch;
  }

  ngOnDestroy(): void {
    this.branchSubscription?.unsubscribe();
  }
}
