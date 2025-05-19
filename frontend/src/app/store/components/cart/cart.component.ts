import { Component, OnInit, OnDestroy, LOCALE_ID, inject } from '@angular/core';
import { CommonModule, registerLocaleData } from '@angular/common';
import localeCl from '@angular/common/locales/es-CL';
import { CartService, CartItem } from '../../../services/cart.service';
import { InventoryService } from '../../../services/inventory.service';
import { Branch, BranchService } from '../../../services/branch.service';
import { SelectedBranchService } from '../../../services/selected-branch.service';
import { CurrencyService, SupportedCurrency } from '../../../services/Currency.Service';
import { Observable, Subscription, tap, take, of } from 'rxjs';
import { Router } from '@angular/router';
import { AddressModalComponent, DeliveryAddress, ModalSelectionType } from '../../../features/shared/components/address-modal/address-modal.component';

registerLocaleData(localeCl);

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [
    CommonModule,
    AddressModalComponent
  ],
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss'],
  providers: [{ provide: LOCALE_ID, useValue: 'es-CL' }]
})
export class CartComponent implements OnInit, OnDestroy {
  private cartService = inject(CartService);
  private inventoryService = inject(InventoryService);
  private selectedBranchService = inject(SelectedBranchService);
  private branchService = inject(BranchService);
  private currencyService = inject(CurrencyService);
  private router = inject(Router);

  cartItems$: Observable<CartItem[]>;
  totalPrice$: Observable<number>;
  totalItems$: Observable<number>;

  currentSelectedBranch: Branch | null = null;
  currentSelectedCurrency: SupportedCurrency = 'CLP';
  selectedLocale: string = 'es-CL';

  private branchSubscription!: Subscription;
  private currencySubscription!: Subscription;
  private productStockMap: Map<string, number> = new Map();

  showAddressModal = false;
  currentDeliveryAddress: DeliveryAddress | null = null;
  deliveryMode: 'pickup' | 'delivery' = 'pickup';
  addressModalInitialMode: ModalSelectionType = 'delivery';
  availableBranchesForModal$: Observable<Branch[]> = of([]);


  constructor() {
    this.cartItems$ = this.cartService.cartItems$.pipe(
      tap(items => {
        if (this.currentSelectedBranch && this.deliveryMode === 'pickup') {
          this.updateStockForCartItems(items, this.currentSelectedBranch.branch_code);
        }
      })
    );
    this.totalPrice$ = this.cartService.getTotalPrice();
    this.totalItems$ = this.cartService.getTotalItems();
  }

  ngOnInit(): void {
    this.availableBranchesForModal$ = this.branchService.getBranches();

    this.branchSubscription = this.selectedBranchService.selectedBranch$.subscribe(branch => {
      this.currentSelectedBranch = branch;
      if (branch && this.deliveryMode === 'pickup') {
        this.cartItems$.pipe(
          take(1)
        ).subscribe((items: CartItem[]) => {
            if (items) {
                this.updateStockForCartItems(items, branch.branch_code);
            }
        });
      } else if (!branch && this.deliveryMode === 'pickup') {
        this.productStockMap.clear();
      }
    });

    this.currencySubscription = this.currencyService.selectedCurrency$.subscribe(currency => {
      this.currentSelectedCurrency = currency;
      this.selectedLocale = currency === 'USD' ? 'en-US' : 'es-CL';
    });
  }

  ngOnDestroy(): void {
    this.branchSubscription?.unsubscribe();
    this.currencySubscription?.unsubscribe();
  }

  updateStockForCartItems(items: CartItem[], branchCode: string): void {
    items.forEach(item => {
      if (!this.productStockMap.has(item.product_code)) {
        this.inventoryService.getProductStockInBranch(branchCode, item.product_code)
          .subscribe({
            next: (inventoryItem) => {
              this.productStockMap.set(item.product_code, inventoryItem?.quantity ?? 0);
            },
            error: () => this.productStockMap.set(item.product_code, 0)
          });
      }
    });
  }

 getProductMaxStock(productCode: string): number {
    if (this.deliveryMode === 'delivery') {
        return Infinity;
    }
    return this.productStockMap.get(productCode) ?? 0;
  }

  isStockMaxedOut(productCode: string, currentQuantity: number): boolean {
    if (this.deliveryMode === 'delivery') {
        return false;
    }
    const maxStock = this.getProductMaxStock(productCode);
    if (this.productStockMap.has(productCode) && maxStock === 0) return true;
    if (!this.productStockMap.has(productCode)) return false;
    return currentQuantity >= maxStock;
  }


  removeFromCart(productCode: string, branchCode: string): void {
    this.cartService.removeFromCart(productCode, branchCode);
  }

  updateQuantityFromInput(event: any, item: CartItem): void {
    const inputElement = event.target as HTMLInputElement;
    let newQuantity = parseInt(inputElement.value, 10);

    if (isNaN(newQuantity) || newQuantity < 1) {
      newQuantity = 1;
      inputElement.value = '1';
    }

    const maxStock = this.getProductMaxStock(item.product_code);
    if (this.deliveryMode === 'pickup' && this.currentSelectedBranch && maxStock > 0 && newQuantity > maxStock) {
      newQuantity = maxStock;
      inputElement.value = maxStock.toString();
    }

    if (newQuantity > 0) {
      this.cartService.updateQuantity(item.product_code, item.branch_code, newQuantity);
    } else {
      this.cartService.updateQuantity(item.product_code, item.branch_code, 1);
    }
  }

  incrementQuantity(item: CartItem): void {
    const maxStock = this.getProductMaxStock(item.product_code);
     if (this.deliveryMode === 'delivery' || !this.currentSelectedBranch || (maxStock === 0 && !this.productStockMap.has(item.product_code)) || item.quantity < maxStock) {
        this.cartService.updateQuantity(item.product_code, item.branch_code, item.quantity + 1);
    }
  }

  decrementQuantity(item: CartItem): void {
    if (item.quantity > 1) {
      this.cartService.updateQuantity(item.product_code, item.branch_code, item.quantity - 1);
    }
  }

  clearCart(): void {
    this.cartService.clearCart();
  }

  proceedToCheckout(): void {
    this.router.navigate(['/checkout']);
  }

  goToProducts(): void {
    this.router.navigate(['/catalogo']);
  }

  openDeliveryModal(mode: ModalSelectionType): void {
    this.addressModalInitialMode = mode;
    this.showAddressModal = true;
  }

  handleCloseAddressModal(): void {
    this.showAddressModal = false;
  }

  handleAddressSubmitted(address: DeliveryAddress): void {
    this.currentDeliveryAddress = address;
    this.deliveryMode = 'delivery';
    this.showAddressModal = false;
  }

  handlePickupBranchSelected(branch: Branch): void {
    this.selectedBranchService.setSelectedBranch(branch);
    this.deliveryMode = 'pickup';
    this.currentDeliveryAddress = null;
    this.showAddressModal = false;
  }
}
