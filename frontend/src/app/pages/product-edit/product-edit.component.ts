import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, ParamMap } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Observable, Subject, forkJoin, of } from 'rxjs';
import { takeUntil, finalize, switchMap, catchError, tap, map, filter, delay } from 'rxjs/operators';
import { ProductService } from '../../services/product.service';
import { CategorySubcategoryService, Category, SubcategoryFromCategoryDetail } from '../../services/category.service';
import { BranchService, Branch } from '../../services/branch.service';
import { InventoryService, UpdateStockResponse } from '../../services/inventory.service';
import { ApiProduct, UpdateProductPayload } from '../../services/product.interfaces';

interface UserMessage {
  text: string | null;
  type: 'success' | 'error' | 'warning' | 'info' | null;
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
  private originalStockData: { branch_code: string, quantity: number }[] = [];

  isSaving = false;
  isLoadingData = true;
  isDeleting = false;
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
    this.setupCategoryChangeSubscription();
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

  loadInitialDataAndProduct(): void {
    this.isLoadingData = true;
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
        if (product && this.currentProductCode) {
          this.originalApiProductData = JSON.parse(JSON.stringify(product));
          this.productName = product.nombre;
          this.originalStockData = inventory
            .filter(item => item.product_code === this.currentProductCode)
            .map(item => ({ branch_code: item.branch_code, quantity: item.quantity }));
          this.populateForm(product, this.originalStockData);
          this.enableRelevantControls();
        } else {
          this.userMessage = { text: `Producto con código ${this.currentProductCode} no encontrado.`, type: 'error' };
          this.router.navigate(['/product/list']);
        }
        this.isLoadingData = false;
      },
      error: (err: any) => {
        this.userMessage = { text: `Error al cargar datos: ${err.message || 'Error desconocido.'}`, type: 'error' };
        this.isLoadingData = false;
        this.router.navigate(['/product/list']);
      }
    });
  }

  enableRelevantControls(): void {
    this.productForm.get('nombre')?.enable();
    this.productForm.get('precio')?.enable();
    this.productForm.get('marca')?.enable();
    this.productForm.get('codigo_marca')?.enable();
    this.productForm.get('categoria')?.enable();
    this.productForm.get('descripcion')?.enable();
    this.productForm.get('imageUrl')?.enable();
  }

  populateForm(product: ApiProduct, productStock: { branch_code: string, quantity: number }[]): void {
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
    this.populateStockFormArray(productStock);
    this.productForm.markAsPristine();
  }

  updateFilteredSubcategories(categoryName: string, subcategoryNameToSet?: string): void {
    const subcategoriaControl = this.productForm.get('subcategoria');
    this.filteredSubcategories = [];
    if (categoryName) {
      const selectedCategory = this.allCategories.find(cat => cat.name === categoryName);
      if (selectedCategory && selectedCategory.subcategories && selectedCategory.subcategories.length > 0) {
        this.filteredSubcategories = selectedCategory.subcategories;
        subcategoriaControl?.enable();
        if (subcategoryNameToSet) {
           subcategoriaControl?.setValue(subcategoryNameToSet);
        }
      } else {
        subcategoriaControl?.disable();
      }
    } else {
      subcategoriaControl?.disable();
    }
  }

  setupCategoryChangeSubscription(): void {
    const categoriaControl = this.productForm.get('categoria');
    if (categoriaControl) {
      categoriaControl.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe((categoryName: string) => {
          const subcategoriaControl = this.productForm.get('subcategoria');
          if (categoriaControl.dirty) {
             subcategoriaControl?.reset('');
          }
          this.updateFilteredSubcategories(categoryName);
        });
    }
  }

  populateStockFormArray(productStock: { branch_code: string, quantity: number }[]): void {
    this.currentStocksFormArray.clear();
    this.branches.forEach(branch => {
      const inventoryItem = productStock.find(item => item.branch_code === branch.branch_code);
      this.currentStocksFormArray.push(
        this.fb.group({
          branch_code: [branch.branch_code],
          branch_name: [branch.name],
          quantity: [inventoryItem ? inventoryItem.quantity : 0, [Validators.required, Validators.min(0), Validators.pattern(/^[0-9]*$/)]]
        })
      );
    });
    this.currentStocksFormArray.markAsPristine();
  }

  isProductDataReallyDirty(): boolean {
    if (!this.originalApiProductData || !this.productForm.enabled) return false;
    const formValues = this.productForm.getRawValue();
    const fieldsToCompare: (keyof UpdateProductPayload)[] = [
      'nombre', 'precio', 'marca', 'codigo_marca',
      'categoria', 'subcategoria', 'descripcion', 'imageUrl'
    ];
    for (const key of fieldsToCompare) {
      let formValue = formValues[key];
      let originalValue;
      if (key === 'precio' && this.originalApiProductData.precio) {
        originalValue = this.originalApiProductData.precio.precio_actual;
        formValue = parseFloat(formValue);
      } else {
        originalValue = (this.originalApiProductData as any)[key];
      }
      formValue = (formValue === null || formValue === undefined) ? '' : formValue;
      originalValue = (originalValue === null || originalValue === undefined) ? '' : originalValue;
      if (String(formValue).trim() !== String(originalValue).trim()) {
        return true;
      }
    }
    return false;
  }

  onSubmit(): void {
    this.userMessage = { text: null, type: null };
    const productDataActuallyChanged = this.isProductDataReallyDirty();
    const stockDataActuallyChanged = this.currentStocksFormArray.dirty;

    if (!productDataActuallyChanged && !stockDataActuallyChanged) {
      this.userMessage = { text: 'No se han realizado cambios en el formulario.', type: 'info' };
      return;
    }

    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      this.userMessage = { text: 'Por favor, corrige los errores en el formulario.', type: 'error' };
      return;
    }

    this.isSaving = true;
    const formValues = this.productForm.getRawValue();
    const productCodeForUpdate = this.currentProductCode!;

    let productUpdatePayload: UpdateProductPayload = {};
    if (productDataActuallyChanged) {
        productUpdatePayload = {
            nombre: formValues.nombre !== this.originalApiProductData?.nombre ? formValues.nombre : undefined,
            precio: parseFloat(formValues.precio) !== this.originalApiProductData?.precio.precio_actual ? parseFloat(formValues.precio) : undefined,
            marca: formValues.marca !== this.originalApiProductData?.marca ? formValues.marca : undefined,
            codigo_marca: formValues.codigo_marca !== this.originalApiProductData?.codigo_marca ? formValues.codigo_marca : undefined,
            categoria: formValues.categoria !== this.originalApiProductData?.categoria ? formValues.categoria : undefined,
            subcategoria: formValues.subcategoria !== this.originalApiProductData?.subcategoria ? formValues.subcategoria : undefined,
            descripcion: formValues.descripcion !== this.originalApiProductData?.descripcion ? formValues.descripcion : undefined,
            imageUrl: formValues.imageUrl !== this.originalApiProductData?.imageUrl ? formValues.imageUrl : undefined,
        };
        productUpdatePayload = Object.fromEntries(Object.entries(productUpdatePayload).filter(([_, v]) => v !== undefined)) as UpdateProductPayload;
    }

    let updateProductObs: Observable<ApiProduct | null>;
    if (Object.keys(productUpdatePayload).length > 0) {
      updateProductObs = this.productService.updateProduct(productCodeForUpdate, productUpdatePayload);
    } else {
      updateProductObs = of(this.originalApiProductData);
    }

    const stockUpdateObservables: Observable<UpdateStockResponse>[] = [];
    if (stockDataActuallyChanged) {
      formValues.currentStocks.forEach((formStockItem: { branch_code: string; quantity: string | number }, index: number) => {
        const originalStockItem = this.originalStockData.find(os => os.branch_code === formStockItem.branch_code);
        const originalQuantity = originalStockItem ? originalStockItem.quantity : 0;
        const currentQuantity = Number(formStockItem.quantity);
        if (this.currentStocksFormArray.controls[index].dirty && currentQuantity !== originalQuantity) {
          stockUpdateObservables.push(
            this.inventoryService.updateInventoryItem(formStockItem.branch_code, productCodeForUpdate, currentQuantity).pipe(
              map(response => ({
                ...response,
                branch_code: formStockItem.branch_code,
                product_code: productCodeForUpdate,
                error: false
              })),
              catchError(err => of({
                message: '',
                error: true,
                branch_code: formStockItem.branch_code,
                product_code: productCodeForUpdate,
                errorMessage: err.message || `Error al actualizar stock para ${formStockItem.branch_code}.`
              }))
            )
          );
        }
      });
    }

    updateProductObs.pipe(
      switchMap((updatedProductResponse: ApiProduct | null) => {
        const productAfterAttemptedUpdate = updatedProductResponse || this.originalApiProductData;
        if (stockUpdateObservables.length > 0) {
          return forkJoin(stockUpdateObservables).pipe(
            map(stockResults => ({ productAfterAttemptedUpdate, stockResults }))
          );
        }
        return of({ productAfterAttemptedUpdate, stockResults: [] });
      }),
      tap(({ productAfterAttemptedUpdate, stockResults }) => {
        const failedStockUpdates = stockResults.filter(res => res.error === true);
        if (failedStockUpdates.length > 0) {
          const errorMessages = failedStockUpdates.map(fu => `Sucursal ${fu.branch_code}: ${fu.errorMessage}`).join('; ');
          this.userMessage = { text: `Datos del producto "${productAfterAttemptedUpdate?.nombre || this.productName}" guardados, pero con errores al actualizar stock: ${errorMessages}`, type: 'warning' };
        } else if (Object.keys(productUpdatePayload).length > 0 || stockUpdateObservables.length > 0) {
          let successMessage = `Producto "${productAfterAttemptedUpdate?.nombre || this.productName}" actualizado exitosamente`;
          if (stockUpdateObservables.length > 0 && Object.keys(productUpdatePayload).length > 0) {
            successMessage += " y su stock también.";
          } else if (stockUpdateObservables.length > 0) {
            successMessage = `Stock del producto "${productAfterAttemptedUpdate?.nombre || this.productName}" actualizado exitosamente.`;
          } else {
            successMessage += ".";
          }
          this.userMessage = { text: successMessage, type: 'success' };
        } else {
            this.userMessage = { text: 'No se realizaron cambios detectables para guardar.', type: 'info' };
        }
      }),
      delay(this.userMessage.type === 'success' || this.userMessage.type === 'warning' ? 2500 : 0),
      takeUntil(this.destroy$),
      finalize(() => {
        this.isSaving = false;
        if (this.currentProductCode) {
            this.loadInitialDataAndProduct();
        }
      })
    ).subscribe({
      next: () => {
      },
      error: (err: any) => {
        this.userMessage = { text: `Error al actualizar el producto: ${err.message || 'Error desconocido.'}`, type: 'error' };
        this.isLoadingData = false;
      }
    });
  }

  onDeleteProduct(): void {
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
          setTimeout(() => this.router.navigate(['/product/list']), 2000);
        },
        error: (err: any) => {
          this.userMessage = { text: `Error al eliminar el producto: ${err.message || 'Error desconocido.'}`, type: 'error' };
        }
      });
    }
  }

  onCancel(): void {
    if (this.productForm.dirty || this.currentStocksFormArray.dirty) {
        if(confirm('Tienes cambios sin guardar. ¿Estás seguro de que quieres cancelar?')) {
            this.router.navigate(['/product/list']);
        }
    } else {
        this.router.navigate(['/product/list']);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
