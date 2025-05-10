import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink, ParamMap } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { Observable, Subject, forkJoin, of, throwError } from 'rxjs';
import { takeUntil, finalize, switchMap, catchError, tap, map, filter } from 'rxjs/operators';

import { ProductService } from '../../services/product.service';
import { CategorySubcategoryService, Category, SubcategoryFromCategoryDetail } from '../../services/category.service';
import { BranchService, Branch } from '../../services/branch.service';
import { InventoryService, InventoryItem, UpdateStockResponse } from '../../services/inventory.service';
import { ApiProduct, UpdateProductPayload } from '../../services/product.interfaces';

interface UserMessage {
  text: string | null;
  type: 'success' | 'error' | 'warning' | 'info' | null;
}

interface FullProductDataForPut {
  codigo_producto: string;
  nombre: string;
  precio: number;
  marca: string;
  codigo_marca: string;
  categoria: string;
  subcategoria: string;
  imageUrl: string;
  descripcion: string;
  current_price_date: string;
}

@Component({
  selector: 'app-product-edit',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './product-edit.component.html',
  styleUrls: ['./product-edit.component.scss']
})
export class ProductEditComponent implements OnInit, OnDestroy {
  productForm!: FormGroup;
  allCategories: Category[] = [];
  filteredSubcategories: SubcategoryFromCategoryDetail[] = [];
  branches: Branch[] = [];

  productName = '';
  private currentProductCode: string | null = null;
  private originalApiProductData: ApiProduct | null = null;
  private originalStockData: InventoryItem[] = [];

  isSaving = false;
  isLoadingData = true;
  userMessage: UserMessage = { text: null, type: null };

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private productService: ProductService,
    private categorySubcategoryService: CategorySubcategoryService,
    private branchService: BranchService,
    private inventoryService: InventoryService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadInitialDataAndProduct();
  }

  get currentStocksFormArray(): FormArray {
    return this.productForm.get('currentStocks') as FormArray;
  }

  initForm(): void {
    this.productForm = this.fb.group({
      codigo_producto: [{ value: '', disabled: true }, Validators.required],
      nombre: ['', Validators.required],
      precio: [{value: null, disabled: true}, [Validators.required, Validators.min(0)]],
      current_price_date: [{ value: '', disabled: true }],
      marca: ['', Validators.required],
      codigo_marca: ['', Validators.required],
      categoria: [{value: '', disabled: true}, Validators.required],
      subcategoria: [{value: '', disabled: true}, Validators.required],
      descripcion: ['', Validators.required],
      imageUrl: ['',],
      currentStocks: this.fb.array([])
    });
  }

  loadInitialDataAndProduct(): void {
    this.isLoadingData = true;
    this.userMessage = { text: null, type: null };
    this.route.paramMap.pipe(
      takeUntil(this.destroy$),
      filter((params: ParamMap) => params.has('codigo')),
      map((params: ParamMap) => params.get('codigo')!),
      tap((productCode: string) => this.currentProductCode = productCode),
      switchMap(productCode =>
        forkJoin({
          product: this.productService.getProductByCode(productCode),
          inventory: this.inventoryService.getInventory(),
          categories: this.categorySubcategoryService.getCategories(),
          branches: this.branchService.getBranches()
        })
      )
    ).subscribe({
      next: ({ product, inventory, categories, branches }) => {
        this.allCategories = categories || [];
        this.branches = branches || [];
        if (product) {
          this.originalApiProductData = { ...product };
          this.productName = product.nombre;
          this.originalStockData = inventory
            .filter(item => item.product_code === this.currentProductCode)
            .map(item => ({ ...item }));
          this.populateForm(product, this.originalStockData);
        } else {
          this.userMessage = { text: `Producto con código ${this.currentProductCode} no encontrado.`, type: 'error' };
          this.router.navigate(['/product/list']);
        }
        this.isLoadingData = false;
      },
      error: (err: any) => {
        this.userMessage = { text: `Error al cargar datos: ${err.message || 'Error desconocido.'}`, type: 'error' };
        this.isLoadingData = false;
      }
    });
  }

  populateForm(product: ApiProduct, productInventory: InventoryItem[]): void {
    this.productForm.patchValue({
      codigo_producto: product.codigo_producto,
      nombre: product.nombre,
      precio: product.precio.precio_actual,
      current_price_date: product.precio.fecha_precio,
      marca: product.marca,
      codigo_marca: product.codigo_marca,
      categoria: product.categoria,
      subcategoria: product.subcategoria,
      descripcion: product.descripcion,
      imageUrl: product.imageUrl
    });
    this.populateStockFormArray(productInventory);
    this.productForm.markAsPristine();
    this.currentStocksFormArray.markAsPristine();
  }

  populateStockFormArray(productInventory: InventoryItem[]): void {
    const stockFormGroups = this.branches.map(branch => {
      const inventoryItem = productInventory.find(item => item.branch_code === branch.branch_code);
      return this.fb.group({
        branch_code: [branch.branch_code],
        branch_name: [branch.name],
        quantity: [inventoryItem ? inventoryItem.quantity : 0, [Validators.min(0), Validators.pattern(/^[0-9]*$/)]]
      });
    });
    this.productForm.setControl('currentStocks', this.fb.array(stockFormGroups));
  }

  isProductDataDirty(): boolean {
    if (!this.originalApiProductData) return false;
    const formValues = this.productForm.getRawValue();
    const editableFields: (keyof FullProductDataForPut)[] = ['nombre', 'marca', 'codigo_marca', 'descripcion', 'imageUrl'];

    return editableFields.some(fieldKey => {
        const formValue = formValues[fieldKey] === null || formValues[fieldKey] === undefined ? "" : formValues[fieldKey];
        const originalValue = (this.originalApiProductData as any)[fieldKey] === null || (this.originalApiProductData as any)[fieldKey] === undefined ? "" : (this.originalApiProductData as any)[fieldKey];
        return formValue !== originalValue;
    });
  }


  onSubmit(): void {
    this.userMessage = { text: null, type: null };
    const productDataChanged = this.isProductDataDirty();
    const stockDataChanged = this.currentStocksFormArray.dirty;

    if (!productDataChanged && !stockDataChanged) {
        this.userMessage = { text: 'No se han realizado cambios en el formulario.', type: 'info' };
        return;
    }

    let formIsValid = true;
    Object.keys(this.productForm.controls).forEach(key => {
      const control = this.productForm.get(key);
      if (control?.enabled && control.invalid) {
        formIsValid = false;
        control.markAsTouched();
      }
    });
     if (this.currentStocksFormArray.enabled && this.currentStocksFormArray.invalid){
        formIsValid = false;
        this.currentStocksFormArray.markAllAsTouched();
    }

    if (!formIsValid) {
      this.userMessage = { text: 'Por favor, corrige los errores en los campos editables.', type: 'error' };
      return;
    }

    this.isSaving = true;
    const formValues = this.productForm.getRawValue();
    const productCodeForUpdate = this.currentProductCode!;

    const fullProductPayloadForPut: FullProductDataForPut = {
      codigo_producto: formValues.codigo_producto,
      nombre: formValues.nombre,
      precio: this.originalApiProductData!.precio.precio_actual,
      marca: formValues.marca,
      codigo_marca: formValues.codigo_marca,
      categoria: this.originalApiProductData!.categoria,
      subcategoria: this.originalApiProductData!.subcategoria,
      imageUrl: formValues.imageUrl || '',
      descripcion: formValues.descripcion || '',
      current_price_date: this.originalApiProductData!.precio.fecha_precio
    };

    let updateProductObs: Observable<ApiProduct | null>;
    if (productDataChanged) {
        console.log("Payload para actualizar PRODUCTO:", fullProductPayloadForPut);
        updateProductObs = this.productService.updateProduct(productCodeForUpdate, fullProductPayloadForPut as UpdateProductPayload).pipe(
            catchError(error => {
                if (error.status === 500 && error.error?.error?.includes("'dict' object has no attribute 'current_price'")) {
                    this.userMessage = { text: 'Cambios principales del producto guardados. El servidor tuvo un problema al confirmar todos los detalles.', type: 'warning' };
                    return of(null);
                }
                return throwError(() => error);
            })
        );
    } else {
        updateProductObs = of(this.originalApiProductData);
    }

    const stockUpdatesObservables: Observable<UpdateStockResponse>[] = [];
    if (stockDataChanged) {
        const currentStocksValue = this.currentStocksFormArray.getRawValue() as { branch_code: string, quantity: string | number }[];
        currentStocksValue.forEach((formStockItem) => {
            const stockControlGroup = this.productForm.get(['currentStocks', currentStocksValue.indexOf(formStockItem)]);
            if (stockControlGroup?.get('quantity')?.dirty) {
                 const originalBranchStock = this.originalStockData.find(os => os.branch_code === formStockItem.branch_code);
                 const originalQuantity = originalBranchStock ? originalBranchStock.quantity : 0;
                 const currentQuantity = Number(formStockItem.quantity) || 0;
                 if (currentQuantity !== originalQuantity) {
                    stockUpdatesObservables.push(
                        this.inventoryService.updateInventoryItem(formStockItem.branch_code, productCodeForUpdate, currentQuantity)
                    );
                }
            }
        });
    }

    let allOperations$: Observable<ApiProduct | null> = updateProductObs;

    if (stockUpdatesObservables.length > 0) {
        allOperations$ = updateProductObs.pipe(
            switchMap((productUpdateResponse: ApiProduct | null) => {
                const productStateAfterAttemptedUpdate = productUpdateResponse || this.originalApiProductData;
                return forkJoin(stockUpdatesObservables).pipe(
                    map(() => productStateAfterAttemptedUpdate),
                    catchError(stockError => {
                        let existingMessage = this.userMessage.text || '';
                        if (productDataChanged && productUpdateResponse === null && this.userMessage.type === 'warning') {
                           existingMessage = this.userMessage.text + ` Además, hubo un error guardando el stock: ${stockError.message || 'Error desconocido.'}`;
                        } else if (productDataChanged && productUpdateResponse){
                           existingMessage = `Datos del producto actualizados, pero hubo un error guardando el stock: ${stockError.message || 'Error desconocido.'}`;
                        } else {
                           existingMessage = `Hubo un error guardando el stock: ${stockError.message || 'Error desconocido.'}`;
                        }
                        this.userMessage = { text: existingMessage, type: 'error' };
                        return of(productStateAfterAttemptedUpdate);
                    })
                );
            })
        );
    }

    allOperations$.pipe(
        takeUntil(this.destroy$),
        finalize(() => {
            this.isSaving = false;
            if (this.currentProductCode) {
                this.productService.getProductByCode(this.currentProductCode).pipe(takeUntil(this.destroy$)).subscribe(freshProduct => {
                    if (freshProduct) {
                        this.originalApiProductData = {...freshProduct};
                        this.productName = freshProduct.nombre;
                        this.populateForm(freshProduct, this.originalStockData);
                    }
                });
                this.inventoryService.getInventory().pipe(takeUntil(this.destroy$)).subscribe(inv => {
                    this.originalStockData = inv.filter(i => i.product_code === this.currentProductCode).map(i => ({...i}));
                    this.populateStockFormArray(this.originalStockData);
                });
            }
        })
    ).subscribe({
        next: (resultAfterAllOps: ApiProduct | null) => {
            if (this.userMessage.type === 'error' || this.userMessage.type === 'warning') {
            } else if (productDataChanged || stockDataChanged) {
                 let finalMessage = `Producto "${resultAfterAllOps?.nombre || this.productName}"`;
                 if (productDataChanged && stockUpdatesObservables.length > 0) {
                    finalMessage += " y su stock han sido actualizados.";
                 } else if (productDataChanged) {
                    finalMessage += " actualizado.";
                 } else if (stockUpdatesObservables.length > 0) {
                    finalMessage += ": Stock actualizado.";
                 }
                 this.userMessage = { text: finalMessage, type: 'success' };
            } else if (!this.userMessage.text) {
                 this.userMessage = { text: 'No se detectaron cambios para guardar.', type: 'info'};
            }

            this.productForm.markAsPristine();
            this.currentStocksFormArray.markAsPristine();

            if (resultAfterAllOps) {
                 this.originalApiProductData = {...resultAfterAllOps};
            }
        },
        error: (err: any) => {
            if (this.userMessage.type !== 'warning') {
              this.userMessage = { text: `Error al actualizar producto: ${err.message || 'Error desconocido.'}`, type: 'error' };
            }
             if (this.currentProductCode) {
                this.productService.getProductByCode(this.currentProductCode).subscribe(freshProduct => {
                    if (freshProduct) this.populateForm(freshProduct, this.originalStockData);
                });
            }
        }
    });
  }

  onCancel(): void {
    this.router.navigate(['/product/list']);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
