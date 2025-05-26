import { Component, OnInit, OnDestroy, LOCALE_ID, inject } from '@angular/core';
import { CommonModule, registerLocaleData } from '@angular/common';
import localeCl from '@angular/common/locales/es-CL';
import { CartService, CartItem } from '../../../services/cart.service';
import { InventoryService } from '../../../services/inventory.service';
import { Branch, BranchService } from '../../../services/branch.service';
import { SelectedBranchService } from '../../../services/selected-branch.service';
import { CurrencyService, SupportedCurrency } from '../../../services/Currency.Service';
import { ShippingService } from '../../../services/shipping.service';
import { Observable, Subscription, of, firstValueFrom } from 'rxjs';
import { tap, take } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AddressModalComponent, DeliveryAddress, ModalSelectionType } from '../../../features/shared/components/address-modal/address-modal.component';

registerLocaleData(localeCl);

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, AddressModalComponent],
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
  private shippingService = inject(ShippingService);
  private router = inject(Router);
  cartItems$: Observable<CartItem[]>;
  productSubtotalPrice$: Observable<number>;
  grandTotalPrice$: Observable<number>;
  totalItems$: Observable<number>;
  deliveryMode$: Observable<'pickup' | 'delivery'>;
  currentDeliveryAddress$: Observable<DeliveryAddress | null>;
  shippingCost$: Observable<number | null>;
  currentSelectedBranch: Branch | null = null;
  currentSelectedCurrency: SupportedCurrency = 'CLP';
  selectedLocale: string = 'es-CL';
  availableBranchesForModal$: Observable<Branch[]> = of([]);
  isCalculatingShipping = false;
  shippingCalculationError: string | null = null;

  private branchSubscription!: Subscription;
  private currencySubscription!: Subscription;
  private productStockMap: Map<string, number> = new Map();

  showAddressModal = false;
  addressModalInitialMode: ModalSelectionType = 'delivery';

  constructor() {
    this.cartItems$ = this.cartService.cartItems$;
    this.productSubtotalPrice$ = this.cartService.getProductSubtotal();
    this.grandTotalPrice$ = this.cartService.getGrandTotal();
    this.totalItems$ = this.cartService.getTotalItems();
    this.deliveryMode$ = this.cartService.deliveryMode$;
    this.currentDeliveryAddress$ = this.cartService.deliveryAddress$;
    this.shippingCost$ = this.cartService.shippingCost$;
  }

  ngOnInit(): void {
    this.availableBranchesForModal$ = this.branchService.getBranches();
    this.branchSubscription = this.selectedBranchService.selectedBranch$.subscribe(branch => {
      this.currentSelectedBranch = branch;
      this.deliveryMode$.pipe(take(1)).subscribe(mode => {
         if (mode === 'delivery' && this.currentSelectedBranch) {
            this.triggerShippingCalculation();
         } else if (mode === 'pickup' && branch) {
            this.cartItems$.pipe(take(1))
              .subscribe(items => this.updateStockForCartItems(items, branch.branch_code));
         }
      });
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

  getProductMaxStock(productCode: string): number {
    if (this.cartService.getCurrentDeliveryMode() === 'delivery') return Infinity;
    return this.productStockMap.get(productCode) ?? 0;
  }

  isStockMaxedOut(productCode: string, currentQuantity: number): boolean {
    if (this.cartService.getCurrentDeliveryMode() === 'delivery') return false;
    const maxStock = this.getProductMaxStock(productCode);
    return this.productStockMap.has(productCode) && maxStock === 0 || currentQuantity >= maxStock;
  }

  updateStockForCartItems(items: CartItem[], branchCode: string): void {
       items.forEach(item => {
           this.inventoryService.getProductStockInBranch(branchCode, item.product_code)
               .subscribe({
                   next: (inventoryItem) => this.productStockMap.set(item.product_code, inventoryItem?.quantity ?? 0),
                   error: () => this.productStockMap.set(item.product_code, 0)
               });
       });
  }

  removeFromCart(productCode: string, branchCode: string): void {
    this.cartService.removeFromCart(productCode, branchCode);
  }

  updateQuantityFromInput(event: any, item: CartItem): void {
      const inputElement = event.target as HTMLInputElement;
      let newQuantity = parseInt(inputElement.value, 10);
      if (isNaN(newQuantity) || newQuantity < 1) newQuantity = 1;

      const maxStock = this.getProductMaxStock(item.product_code);
      if (this.cartService.getCurrentDeliveryMode() === 'pickup' && this.currentSelectedBranch && maxStock > 0 && newQuantity > maxStock) {
          newQuantity = maxStock;
      }
      inputElement.value = newQuantity.toString();
      this.cartService.updateQuantity(item.product_code, item.branch_code, newQuantity);
  }

  incrementQuantity(item: CartItem): void {
      const maxStock = this.getProductMaxStock(item.product_code);
      if (this.cartService.getCurrentDeliveryMode() === 'delivery' || !this.currentSelectedBranch || item.quantity < maxStock) {
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

  openDeliveryModal(mode: ModalSelectionType): void {
    this.addressModalInitialMode = mode;
    this.showAddressModal = true;
  }

  handleCloseAddressModal(): void {
    this.showAddressModal = false;
  }

  handleAddressSubmitted(address: DeliveryAddress): void {
    this.cartService.setDeliveryMode('delivery');
    this.cartService.setDeliveryAddress(address);
    this.showAddressModal = false;
    this.triggerShippingCalculation();
  }

  handlePickupBranchSelected(branch: Branch): void {
    this.cartService.setDeliveryMode('pickup');
    this.selectedBranchService.setSelectedBranch(branch);
    this.showAddressModal = false;
  }

  async triggerShippingCalculation(): Promise<void> {
    const mode = this.cartService.getCurrentDeliveryMode();
    const address = this.cartService.getCurrentDeliveryAddress();

    if (mode !== 'delivery' || !address?.fullAddress) {
      this.cartService.setShippingCost(null);
      this.shippingCalculationError = null;
      return;
    }

    const originBranchCode = this.currentSelectedBranch?.branch_code || 'san';

    this.isCalculatingShipping = true;
    this.shippingCalculationError = null;
    this.cartService.setShippingCost(null);

    try {
      const response = await firstValueFrom(
        this.shippingService.calculateShipping(address.fullAddress, originBranchCode)
      );
      if (response && response.cost !== undefined) {
        this.cartService.setShippingCost(response.cost);
      } else {
        throw new Error('Respuesta inválida del servicio');
      }
    } catch (err) {
      console.error('Error al calcular envío:', err);
      this.shippingCalculationError = 'No se pudo calcular el costo. Revisa la dirección.';
      this.cartService.setShippingCost(null);
    } finally {
      this.isCalculatingShipping = false;
    }
  }

  goToProducts(): void {
    this.router.navigate(['/catalogo']);
  }

  proceedToCheckout(): void {
    const currentItems = this.cartService.getCurrentCartItems();
    const currentMode = this.cartService.getCurrentDeliveryMode();
    const currentAddress = this.cartService.getCurrentDeliveryAddress();
    const currentShippingCost = this.cartService.getCurrentShippingCost();
    if (!currentItems || currentItems.length === 0) { alert("Tu carrito está vacío."); return; }
    if (currentMode === 'pickup' && !this.currentSelectedBranch) { alert('Selecciona una sucursal.'); return; }
    if (currentMode === 'delivery' && !currentAddress) { alert('Ingresa una dirección.'); return; }
    if (currentMode === 'delivery' && currentShippingCost === null && !this.isCalculatingShipping) { alert('Verifica la dirección para calcular el envío.'); return; }
    this.router.navigate(['/payment-method']);
  }
}
