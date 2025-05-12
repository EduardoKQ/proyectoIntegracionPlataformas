import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { ProductService } from '../../services/product.service';
import { InventoryService } from '../../services/inventory.service';
import { BranchService } from '../../services/branch.service';
import { ApiProduct } from '../../services/product.interfaces';
import { InventoryItem } from '../../services/inventory.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface EnrichedInventoryItem extends InventoryItem {
}

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule
  ],
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.scss']
})
export class ProductDetailComponent implements OnInit, OnDestroy {
  product: ApiProduct | null = null;
  productInventory: EnrichedInventoryItem[] = [];
  totalStock: number = 0;
  isLoading: boolean = true;
  errorMessage: string | null = null;
  selectedQuantity: number = 1;

  private routeSubscription: Subscription | undefined;
  private productSubscription: Subscription | undefined;
  private inventorySubscription: Subscription | undefined;

  constructor(
    private route: ActivatedRoute,
    private productService: ProductService,
    private inventoryService: InventoryService,
    private branchService: BranchService
  ) { }

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.subscribe(params => {
      const productCode = params.get('codigo_producto');
      if (productCode) {
        this.loadProductDetails(productCode);
      } else {
        this.isLoading = false;
        this.errorMessage = 'No se especificó un código de producto.';
        console.error('Error: No product code found in route parameters.');
      }
    });
  }

  loadProductDetails(productCode: string): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.product = null;
    this.productInventory = [];
    this.totalStock = 0;
    this.selectedQuantity = 1;


    this.productSubscription = this.productService.getProductByCode(productCode).subscribe({
      next: (productData) => {
        this.product = productData;
        this.loadInventoryForProduct(productCode);
      },
      error: (err) => {
        this.errorMessage = `Error al cargar el producto: ${err.message || 'Error desconocido'}`;
        console.error('Error fetching product by code:', err);
        this.isLoading = false;
      }
    });
  }

  loadInventoryForProduct(productCode: string): void {
    this.inventorySubscription = this.inventoryService.getInventory().subscribe({
      next: (allInventory) => {
        const productSpecificInventory = allInventory.filter(item => item.product_code === productCode);
        this.productInventory = productSpecificInventory;
        this.calculateTotalStock();
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = `Error al cargar el inventario: ${err.message || 'Error desconocido'}. Los detalles del producto aún podrían mostrarse.`;
        console.error('Error fetching inventory:', err);
        this.productInventory = [];
        this.totalStock = 0;
        this.isLoading = false;
      }
    });
  }

  calculateTotalStock(): void {
    this.totalStock = this.productInventory.reduce((sum, item) => sum + item.quantity, 0);
    if (this.totalStock === 0) {
      this.selectedQuantity = 0;
    } else if (this.selectedQuantity > this.totalStock) {
      this.selectedQuantity = this.totalStock;
    }
    if (this.selectedQuantity < 1 && this.totalStock > 0) {
        this.selectedQuantity = 1;
    }
  }

  decreaseQuantity(): void {
    if (this.selectedQuantity > 1) {
      this.selectedQuantity--;
    }
  }

  increaseQuantity(): void {
    if (this.selectedQuantity < this.totalStock) {
      this.selectedQuantity++;
    }
  }

  onQuantityChange(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    let value = parseInt(inputElement.value, 10);

    if (isNaN(value) || value < 1) {
      value = 1;
    }
    this.selectedQuantity = value;
    inputElement.value = this.selectedQuantity.toString();
  }

  addToCart(): void {
    if (!this.product) {
      console.error('No hay producto seleccionado para añadir al carro.');
      return;
    }
    if (this.selectedQuantity <= 0) {
        console.warn('Debe seleccionar al menos 1 unidad.');
        return;
    }
    if (this.selectedQuantity > this.totalStock) {
        console.warn('No hay suficiente stock disponible.');
        return;
    }
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.productSubscription?.unsubscribe();
    this.inventorySubscription?.unsubscribe();
  }
}
