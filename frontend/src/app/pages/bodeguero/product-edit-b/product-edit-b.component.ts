import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, ReactiveFormsModule, AbstractControl } from '@angular/forms';
import { Router, ActivatedRoute, ParamMap } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Observable, Subject, forkJoin, of, throwError } from 'rxjs';
import { takeUntil, finalize, switchMap, catchError, tap, map, filter } from 'rxjs/operators';
import { ProductService } from '../../../services/product.service';
import { CategorySubcategoryService } from '../../../services/category.service';
import { BranchService } from '../../../services/branch.service';
import { InventoryService } from '../../../services/inventory.service';
import { AuthService } from '../../../services/auth.service';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-product-edit-b',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './product-edit-b.component.html',
  styleUrls: ['./product-edit-b.component.scss']
})
export class ProductEditComponentB implements OnInit, OnDestroy {
  productForm!: FormGroup;
  allCategories: any[] = [];
  filteredSubcategories: any[] = [];
  allBranchesSystem: any[] = [];
  productName = '';
  private currentProductCode: string | null = null;
  private originalApiProductData: any | null = null;
  private originalStockData: { branch_code: string, quantity: number }[] = [];

  isSaving = false;
  isLoadingData = true;
  isDeleting = false;
  userMessage: { text: string | null, type: string | null } = { text: null, type: null };

  currentUserRole: string | null = null;
  bodegueroBranchCode: string | null = null;
  bodegueroBranchName: string | null = null;

  private destroy$ = new Subject<void>();
  private userApiUrl = 'http://localhost:8100/api/user';

  constructor(
    private fb: FormBuilder,
    private productService: ProductService,
    private categorySubcategoryService: CategorySubcategoryService,
    private branchService: BranchService,
    private inventoryService: InventoryService,
    private authService: AuthService,
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadUserDataAndFetchWorkerDetailsIfNeeded();
  }

  loadUserDataAndFetchWorkerDetailsIfNeeded(): void {
    this.isLoadingData = true;
    this.userMessage = {text: null, type: null};
    this.currentUserRole = this.authService.getCurrentUserRole();
    if (this.currentUserRole === 'bodeguero') {
      this.http.get<any>(`${this.userApiUrl}/me`)
        .pipe(
          takeUntil(this.destroy$),
          catchError(err => {
            let errorMessage = 'Error desconocido al obtener detalles del bodeguero.';
            if (err.status === 401 || err.status === 403) {
              errorMessage = 'No autorizado o sesión inválida. Por favor, inicie sesión de nuevo.';
            } else if (err.error && err.error.message) {
              errorMessage = err.error.message;
            } else if (err.message) {
              errorMessage = err.message;
            }
            this.userMessage = { text: `Error al obtener detalles del bodeguero: ${errorMessage}`, type: 'error' };
            this.isLoadingData = false;
            this.productForm.disable();
            return throwError(() => new Error('Failed to fetch worker details for bodeguero'));
          })
        )
        .subscribe(workerDetails => {
          if (workerDetails && workerDetails.branch && workerDetails.branch.branch_code) {
            this.bodegueroBranchCode = workerDetails.branch.branch_code;
            this.bodegueroBranchName = workerDetails.branch.name || this.bodegueroBranchCode;
            this.loadInitialProductData();
          } else {
            this.userMessage = { text: 'No se pudo obtener la información de la sucursal del bodeguero. Verifique la respuesta del backend.', type: 'error' };
            this.isLoadingData = false;
            this.productForm.disable();
          }
        });
    } else if (this.currentUserRole) {
      this.loadInitialProductData();
    } else {
      this.userMessage = { text: 'No se pudo determinar el rol del usuario. Verifique la sesión.', type: 'error' };
      this.isLoadingData = false;
      this.productForm.disable();
    }
  }

  loadInitialProductData(): void {
    this.isLoadingData = true;
    this.route.paramMap.pipe(
      takeUntil(this.destroy$),
      filter((params: ParamMap) => params.has('codigo')),
      map((params: ParamMap) => params.get('codigo')!),
      tap((productCode: string) => this.currentProductCode = productCode),
      switchMap(productCode =>
        forkJoin({
          product: this.productService.getProductByCode(productCode).pipe(catchError(() => of(null))),
          inventory: this.inventoryService.getInventory().pipe(catchError(() => of([]))),
          categories: this.categorySubcategoryService.getCategories().pipe(catchError(() => of([]))),
          branches: this.branchService.getBranches().pipe(catchError(() => of([])))
        })
      )
    ).subscribe({
      next: ({ product, inventory, categories, branches }) => {
        this.allCategories = categories || [];
        this.allBranchesSystem = branches || [];

        if (product && this.currentProductCode) {
          this.originalApiProductData = JSON.parse(JSON.stringify(product));
          this.productName = product.nombre;
          this.originalStockData = (inventory || [])
            .filter((item: any) => item.product_code === this.currentProductCode)
            .map((item: any) => ({ branch_code: item.branch_code, quantity: Number(item.quantity) }));

          this.populateForm(product, this.originalStockData);
          if (this.currentUserRole !== 'bodeguero') {
            this.enableRelevantControls();
          }
          this.setupCategoryChangeSubscription();
        } else if (this.currentProductCode) {
          this.userMessage = { text: `Producto con código ${this.currentProductCode} no encontrado o error al cargar.`, type: 'error' };
        }
        this.isLoadingData = false;
      },
      error: (err: any) => {
        this.userMessage = { text: `Error crítico al cargar datos iniciales: ${err.message || 'Error desconocido.'}`, type: 'error' };
        this.isLoadingData = false;
      }
    });
  }

  get currentStocksFormArray(): FormArray {
    return this.productForm.get('currentStocks') as FormArray;
  }

  initForm(): void {
    this.productForm = this.fb.group({
      codigo_producto: [{ value: '', disabled: true }, Validators.required],
      nombre: [{ value: '', disabled: true }, Validators.required],
      precio: [{ value: null, disabled: true }, [Validators.required, Validators.min(0.01)]],
      current_price_date: [{ value: '', disabled: true }],
      marca: [{ value: '', disabled: true }, Validators.required],
      codigo_marca: [{ value: '', disabled: true }, Validators.required],
      categoria: [{ value: '', disabled: true }, Validators.required],
      subcategoria: [{ value: '', disabled: true }, Validators.required],
      descripcion: [{ value: '', disabled: true }, Validators.required],
      imageUrl: [{ value: '', disabled: true }, [Validators.pattern(/^(ftp|http|https):\/\/[^ "]+$/)]],
      currentStocks: this.fb.array([])
    });
  }

  enableRelevantControls(): void {
    if (this.currentUserRole === 'bodeguero') {
      this.productForm.get('subcategoria')?.disable();
      return;
    }
    this.productForm.get('nombre')?.enable();
    this.productForm.get('precio')?.enable();
    this.productForm.get('marca')?.enable();
    this.productForm.get('codigo_marca')?.enable();
    this.productForm.get('categoria')?.enable();
    this.productForm.get('descripcion')?.enable();
    this.productForm.get('imageUrl')?.enable();
  }
  populateForm(product: any, productStock: { branch_code: string, quantity: number }[]): void {
    this.productForm.patchValue({
      codigo_producto: product.codigo_producto,
      nombre: product.nombre,
      precio: product.precio.precio_actual,
      current_price_date: product.precio.fecha_precio,
      marca: product.marca,
      codigo_marca: product.codigo_marca,
      categoria: product.categoria,
      descripcion: product.descripcion,
      imageUrl: product.imageUrl
    });

    this.updateFilteredSubcategories(product.categoria, product.subcategoria);
    if (this.currentUserRole === 'bodeguero') {
        this.productForm.get('subcategoria')?.setValue(product.subcategoria, { emitEvent: false });
        this.productForm.get('subcategoria')?.disable();
    }

    this.populateStockFormArray(productStock);
    this.productForm.markAsPristine();
    this.currentStocksFormArray.markAsPristine();
  }

  updateFilteredSubcategories(categoryName: string, subcategoryNameToSet?: string): void {
    const subcategoriaControl = this.productForm.get('subcategoria');
    this.filteredSubcategories = [];
    if (categoryName && this.allCategories.length > 0) {
      const selectedCategory = this.allCategories.find(cat => cat.name === categoryName);
      if (selectedCategory && selectedCategory.subcategories && selectedCategory.subcategories.length > 0) {
        this.filteredSubcategories = selectedCategory.subcategories;
        if (this.currentUserRole !== 'bodeguero') {
            subcategoriaControl?.enable();
        } else {
            subcategoriaControl?.disable();
        }
        if (subcategoryNameToSet) {
            subcategoriaControl?.setValue(subcategoryNameToSet);
        }
      } else {
        subcategoriaControl?.setValue('');
        subcategoriaControl?.disable();
      }
    } else {
      subcategoriaControl?.setValue('');
      subcategoriaControl?.disable();
    }
  }
  setupCategoryChangeSubscription(): void {
    const categoriaControl = this.productForm.get('categoria');
    if (categoriaControl) {
      categoriaControl.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe((categoryName: string) => {
          if (categoriaControl.enabled) {
            const subcategoriaControl = this.productForm.get('subcategoria');
            if (categoriaControl.dirty) {
                subcategoriaControl?.reset('');
            }
            this.updateFilteredSubcategories(categoryName);
          } else {
            this.updateFilteredSubcategories(categoryName, this.productForm.get('subcategoria')?.value);
          }
        });
    }
  }

  populateStockFormArray(productStock: { branch_code: string, quantity: number }[]): void {
    this.currentStocksFormArray.clear();

    if (this.currentUserRole === 'bodeguero' && this.bodegueroBranchCode) {
      const inventoryItem = productStock.find(item => item.branch_code === this.bodegueroBranchCode);
      const branchDisplayName = this.bodegueroBranchName || this.bodegueroBranchCode;

      this.currentStocksFormArray.push(
        this.fb.group({
          branch_code: [{ value: this.bodegueroBranchCode, disabled: true }],
          branch_name: [{ value: branchDisplayName, disabled: true }],
          quantity: [inventoryItem ? Number(inventoryItem.quantity) : 0, [Validators.required, Validators.min(0), Validators.pattern(/^[0-9]*$/)]]
        })
      );
    } else if (this.currentUserRole !== 'bodeguero') {
      if (this.allBranchesSystem && this.allBranchesSystem.length > 0) {
        this.allBranchesSystem.forEach(branch => {
          const inventoryItem = productStock.find(item => item.branch_code === branch.branch_code);
          this.currentStocksFormArray.push(
            this.fb.group({
              branch_code: [{ value: branch.branch_code, disabled: true }],
              branch_name: [{ value: branch.name, disabled: true }],
              quantity: [inventoryItem ? Number(inventoryItem.quantity) : 0, [Validators.required, Validators.min(0), Validators.pattern(/^[0-9]*$/)]]
            })
          );
        });
      } else if (!this.isLoadingData && this.currentStocksFormArray.length === 0) {
      }
    }
    if (this.currentUserRole === 'bodeguero' && !this.bodegueroBranchCode && !this.isLoadingData && this.currentStocksFormArray.length === 0) {
        if (!this.userMessage.text) {
            this.userMessage = { text: 'No se pudo determinar tu sucursal para mostrar el stock o no hay stock registrado.', type: 'error' };
        }
    }
    this.currentStocksFormArray.markAsPristine();
  }

  isProductDataReallyDirty(): boolean {
    if (this.currentUserRole === 'bodeguero') {
      return false;
    }
    if (!this.originalApiProductData || !this.productForm.enabled) return false;
    const formValues = this.productForm.getRawValue();

    const fieldsToCompare: string[] = [
      'nombre', 'precio', 'marca', 'codigo_marca',
      'categoria', 'subcategoria', 'descripcion', 'imageUrl'
    ];

    for (const key of fieldsToCompare) {
      const control = this.productForm.get(key);
      if (control && control.enabled) {
        let formValue = formValues[key];
        let originalValue;
        if (key === 'precio' && this.originalApiProductData.precio) {
          originalValue = this.originalApiProductData.precio.precio_actual;
          formValue = parseFloat(formValue);
        } else {
          originalValue = (this.originalApiProductData as any)[key];
        }
        formValue = (formValue === null || formValue === undefined) ? '' : String(formValue);
        originalValue = (originalValue === null || originalValue === undefined) ? '' : String(originalValue);

        if (formValue.trim() !== originalValue.trim()) {
          return true;
        }
      }
    }
    return false;
  }

  get isSaveDisabled(): boolean {
    if (this.isSaving || this.isLoadingData || this.isDeleting) {
      return true;
    }

    if (this.currentUserRole === 'bodeguero') {
      if (!this.currentStocksFormArray || !this.currentStocksFormArray.controls) {
          return true;
      }
      const bodegueroStockControl = this.currentStocksFormArray.controls.find(
        (c: AbstractControl) => c.get('branch_code')?.value === this.bodegueroBranchCode && c.enabled
      );
      return !bodegueroStockControl || !bodegueroStockControl.dirty || bodegueroStockControl.invalid;
    } else {
      return (!this.productForm.dirty && !this.currentStocksFormArray.dirty) || this.productForm.invalid;
    }
  }

  onSubmit(): void {
    this.userMessage = { text: null, type: null };
    const productDataActuallyChanged = this.isProductDataReallyDirty();
    let relevantStockChanged = false;

    if (this.currentUserRole === 'bodeguero') {
        const bodegueroControl = this.currentStocksFormArray.controls.find(
            c => c.get('branch_code')?.value === this.bodegueroBranchCode && c.enabled
        );
        if (bodegueroControl) {
            relevantStockChanged = bodegueroControl.dirty;
        }
    } else {
        relevantStockChanged = this.currentStocksFormArray.dirty;
    }

    if (!productDataActuallyChanged && !relevantStockChanged && this.currentUserRole !== 'bodeguero') {
      this.userMessage = { text: 'No se han realizado cambios en el formulario.', type: 'info' };
      return;
    }
    if (this.currentUserRole === 'bodeguero' && !relevantStockChanged) {
        this.userMessage = { text: 'No has modificado el stock de tu sucursal.', type: 'info' };
        return;
    }

    if (this.currentUserRole === 'bodeguero') {
      const bodegueroStockControl = this.currentStocksFormArray.controls.find(
        c => c.get('branch_code')?.value === this.bodegueroBranchCode && c.enabled
      );
      if (bodegueroStockControl && bodegueroStockControl.invalid) {
        bodegueroStockControl.markAllAsTouched();
        this.userMessage = { text: 'Por favor, corrige los errores en el stock de tu sucursal.', type: 'error' };
        return;
      }
      if (!bodegueroStockControl && this.currentUserRole === 'bodeguero') {
          this.userMessage = { text: 'No se encontró el control de stock para tu sucursal.', type: 'error'};
          return;
      }
    } else {
      if (this.productForm.invalid) {
        this.productForm.markAllAsTouched();
        this.userMessage = { text: 'Por favor, corrige los errores en el formulario.', type: 'error' };
        return;
      }
    }

    this.isSaving = true;
    const productCodeForUpdate = this.currentProductCode!;
    let productUpdatePayload: any = {};
    if (productDataActuallyChanged && this.currentUserRole !== 'bodeguero') {
      const formValuesForProduct = this.productForm.getRawValue();
        productUpdatePayload = {
            nombre: formValuesForProduct.nombre !== this.originalApiProductData?.nombre ? formValuesForProduct.nombre : undefined,
            precio: parseFloat(formValuesForProduct.precio) !== this.originalApiProductData?.precio?.precio_actual ? parseFloat(formValuesForProduct.precio) : undefined,
            marca: formValuesForProduct.marca !== this.originalApiProductData?.marca ? formValuesForProduct.marca : undefined,
            codigo_marca: formValuesForProduct.codigo_marca !== this.originalApiProductData?.codigo_marca ? formValuesForProduct.codigo_marca : undefined,
            categoria: formValuesForProduct.categoria !== this.originalApiProductData?.categoria ? formValuesForProduct.categoria : undefined,
            subcategoria: formValuesForProduct.subcategoria !== this.originalApiProductData?.subcategoria ? formValuesForProduct.subcategoria : undefined,
            descripcion: formValuesForProduct.descripcion !== this.originalApiProductData?.descripcion ? formValuesForProduct.descripcion : undefined,
            imageUrl: formValuesForProduct.imageUrl !== this.originalApiProductData?.imageUrl ? formValuesForProduct.imageUrl : undefined,
        };
        productUpdatePayload = Object.fromEntries(Object.entries(productUpdatePayload).filter(([_, v]) => v !== undefined));
    }

    let updateProductObs: Observable<any | null>;
    if (Object.keys(productUpdatePayload).length > 0 && this.currentUserRole !== 'bodeguero') {
      updateProductObs = this.productService.updateProduct(productCodeForUpdate, productUpdatePayload);
    } else {
      updateProductObs = of(this.originalApiProductData);
    }
    const stockUpdateObservables: Observable<any>[] = [];
    if (this.currentUserRole === 'bodeguero' && this.bodegueroBranchCode) {
        const bodegueroStockControlGroup = this.currentStocksFormArray.controls.find(
            (c: AbstractControl) => c.get('branch_code')?.value === this.bodegueroBranchCode && c.enabled
        );
        if (bodegueroStockControlGroup && bodegueroStockControlGroup.dirty && bodegueroStockControlGroup.valid) {
            const formStockItem = bodegueroStockControlGroup.value;
            const currentQuantity = Number(formStockItem.quantity);
            stockUpdateObservables.push(
                this.createStockUpdateObservable(this.bodegueroBranchCode, productCodeForUpdate, currentQuantity)
            );
        }
    } else if (this.currentUserRole !== 'bodeguero' && this.currentStocksFormArray.dirty) {
        this.currentStocksFormArray.controls.forEach((stockGroupControl) => {
            const quantityControl = stockGroupControl.get('quantity');
            if (stockGroupControl.dirty && stockGroupControl.valid && quantityControl && quantityControl.enabled) {
                const formStockItem = stockGroupControl.value;
                const originalStockItem = this.originalStockData.find(os => os.branch_code === formStockItem.branch_code);
                const originalQuantity = originalStockItem ? Number(originalStockItem.quantity) : 0;
                const currentQuantity = Number(formStockItem.quantity);

                if (currentQuantity !== originalQuantity) {
                    stockUpdateObservables.push(
                        this.createStockUpdateObservable(formStockItem.branch_code, productCodeForUpdate, currentQuantity)
                    );
                }
            }
        });
    }

    if (stockUpdateObservables.length === 0 && Object.keys(productUpdatePayload).length === 0 && !productDataActuallyChanged ) {
        this.userMessage = { text: 'No se detectaron cambios válidos para guardar.', type: 'info' };
        this.isSaving = false;
        return;
    }


    updateProductObs.pipe(
      switchMap((updatedProductResponse: any | null) => {
        const productAfterAttemptedUpdate = updatedProductResponse || this.originalApiProductData;
        if (stockUpdateObservables.length > 0) {
          return forkJoin(stockUpdateObservables).pipe(
            map(stockResults => ({ productAfterAttemptedUpdate, stockResults }))
          );
        }
        return of({ productAfterAttemptedUpdate, stockResults: [] });
      }),
      takeUntil(this.destroy$),
      finalize(() => {
        this.isSaving = false;
        if (this.currentProductCode) {
            this.loadUserDataAndFetchWorkerDetailsIfNeeded();
        }
      })
    ).subscribe({
      next: ({ productAfterAttemptedUpdate, stockResults }) => {
        const failedStockUpdates = stockResults.filter(res => (res as any).error === true);
        const successfulStockUpdatesCount = stockResults.length - failedStockUpdates.length;

        if (failedStockUpdates.length > 0) {
          const errorMessages = failedStockUpdates.map(fu => `Sucursal ${(fu as any).branch_code}: ${(fu as any).errorMessage || 'Error desconocido'}`).join('; ');
          let message = `Error al actualizar stock: ${errorMessages}`;
          if (this.currentUserRole !== 'bodeguero' && productDataActuallyChanged) {
              message = `Datos del producto "${productAfterAttemptedUpdate?.nombre || this.productName}" guardados, pero con errores al actualizar stock: ${errorMessages}`;
          }
          this.userMessage = { text: message, type: 'warning' };
        } else if (Object.keys(productUpdatePayload).length > 0 || successfulStockUpdatesCount > 0 || productDataActuallyChanged) {
          let successMessage = '';
          if (this.currentUserRole === 'bodeguero' && successfulStockUpdatesCount > 0) {
            successMessage = `Stock del producto "${productAfterAttemptedUpdate?.nombre || this.productName}" actualizado para tu sucursal.`;
          } else if (this.currentUserRole !== 'bodeguero') {
            const productName = productAfterAttemptedUpdate?.nombre || this.productName;
            if (productDataActuallyChanged && successfulStockUpdatesCount > 0) {
                successMessage = `Producto "${productName}" y su stock actualizados exitosamente.`;
            } else if (productDataActuallyChanged) {
                successMessage = `Producto "${productName}" actualizado exitosamente.`;
            } else if (successfulStockUpdatesCount > 0) {
                successMessage = `Stock del producto "${productName}" actualizado exitosamente.`;
            }
          }
          if(successMessage){
            this.userMessage = { text: successMessage, type: 'success' };
          } else {
            this.userMessage = { text: 'No se realizaron cambios detectables para guardar.', type: 'info' };
          }
        } else {
            this.userMessage = { text: 'No se realizaron cambios para guardar.', type: 'info' };
        }
      },
      error: (err: any) => {
        this.userMessage = { text: `Error al procesar la actualización: ${err.message || 'Error desconocido.'}`, type: 'error' };
      }
    });
  }

  private createStockUpdateObservable(branchCode: string, productCode: string, quantity: number): Observable<any> {
    return this.inventoryService.updateInventoryItem(branchCode, productCode, quantity).pipe(
      map(response => ({
        ...(response as any),
        branch_code: branchCode,
        product_code: productCode,
        error: false
      })),
      catchError(err => of({
        message: err.message || `Error al actualizar stock para ${branchCode}.`,
        error: true,
        branch_code: branchCode,
        product_code: productCode,
        errorMessage: err.message || `Error al actualizar stock para ${branchCode}.`
      }))
    );
  }

  onDeleteProduct(): void {
    if (this.currentUserRole === 'bodeguero') {
        this.userMessage = { text: 'Los bodegueros no tienen permiso para eliminar productos.', type: 'error'};
        return;
    }
    if (!this.currentProductCode) return;

    const confirmation = confirm(`¿Estás seguro de que deseas eliminar el producto "${this.productName}" (${this.currentProductCode})? Esta acción no se puede deshacer.`);
    if (confirmation) {
      this.isDeleting = true;
      this.productService.deleteProduct(this.currentProductCode).pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isDeleting = false;
        })
      ).subscribe({
        next: () => {
          this.userMessage = { text: `Producto "${this.productName}" eliminado exitosamente. Serás redirigido.`, type: 'success' };
          setTimeout(() => this.router.navigate(['/product-bodeguero/listB']), 2000);
        },
        error: (err: any) => {
          this.userMessage = { text: `Error al eliminar el producto: ${err.message || 'Error desconocido.'}`, type: 'error' };
        }
      });
    }
  }

  onCancel(): void {
    let formIsDirty = false;
    if (this.currentUserRole === 'bodeguero') {
        const bodegueroStockControl = this.currentStocksFormArray.controls.find(
            c => c.get('branch_code')?.value === this.bodegueroBranchCode && c.enabled
        );
        formIsDirty = bodegueroStockControl?.dirty || false;
    } else {
        formIsDirty = this.productForm.dirty || this.currentStocksFormArray.dirty;
    }
    if (formIsDirty) {
        if(confirm('Tienes cambios sin guardar. ¿Estás seguro de que quieres cancelar y perder los cambios?')) {
            this.router.navigate(['/product-bodeguero/listB']);
        }
    } else {
        this.router.navigate(['/product-bodeguero/listB']);
    }
  }
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
