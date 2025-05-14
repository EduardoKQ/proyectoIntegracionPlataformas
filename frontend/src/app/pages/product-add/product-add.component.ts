import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject, forkJoin, of, Observable } from 'rxjs';
import { takeUntil, finalize, switchMap, catchError, tap, map } from 'rxjs/operators';
import { ProductService } from '../../services/product.service';
import { CategorySubcategoryService, Category, SubcategoryFromCategoryDetail } from '../../services/category.service';
import { BranchService, Branch } from '../../services/branch.service';
import { InventoryService, UpdateStockResponse } from '../../services/inventory.service';
import { CreateProductPayload, ApiProduct } from '../../services/product.interfaces';

interface UserMessage {
  text: string | null;
  type: 'success' | 'error' | null;
}

@Component({
  selector: 'app-product-add',
  templateUrl: './product-add.component.html',
  styleUrls: ['./product-add.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule
  ]
})
export class ProductAddComponent implements OnInit, OnDestroy {
  productForm!: FormGroup;
  allCategories: Category[] = [];
  filteredSubcategories: SubcategoryFromCategoryDetail[] = [];
  branches: Branch[] = [];
  isSaving = false;
  isGeneratingCode = false;
  isLoadingUIData = true;
  userMessage: UserMessage = { text: null, type: null };

  private existingProductCodes: Set<string> = new Set();
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private productService: ProductService,
    private categorySubcategoryService: CategorySubcategoryService,
    private branchService: BranchService,
    private inventoryService: InventoryService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadInitialData();
    this.setupCategoryChangeSubscription();
  }

  loadInitialData(): void {
    this.isLoadingUIData = true;
    forkJoin({
      categories: this.categorySubcategoryService.getCategories(),
      branches: this.branchService.getBranches(),
      products: this.productService.getProducts()
    }).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.isLoadingUIData = false)
    ).subscribe({
      next: (data) => {
        this.allCategories = data.categories || [];
        this.branches = data.branches || [];
        if (data.products) {
          data.products.forEach(p => this.existingProductCodes.add(p.codigo_producto));
        }
        this.buildInitialStocksFormArray();
      },
      error: (error) => {
        console.error('Error cargando datos iniciales:', error);
        this.userMessage = { text: 'Error al cargar datos necesarios. ' + (error?.message || 'Error desconocido.'), type: 'error' };
      }
    });
  }

  initForm(): void {
    this.productForm = this.fb.group({
      codigo_producto: ['', [Validators.required, this.productCodeValidator.bind(this)]],
      nombre: ['', Validators.required],
      precio: [null, [Validators.required, Validators.min(0.01)]],
      marca: ['', Validators.required],
      codigo_marca: ['', Validators.required],
      categoria: ['', Validators.required],
      subcategoria: [{ value: '', disabled: true }, Validators.required],
      descripcion: [''],
      imageUrl: ['',],
      initialStocks: this.fb.array([])
    });
  }

  buildInitialStocksFormArray(): void {
    const stockControls = this.branches.map(branch =>
      this.fb.group({
        branch_code: [branch.branch_code],
        branch_name: [branch.name],
        quantity: [0, [Validators.required, Validators.min(0), Validators.pattern(/^[0-9]*$/)]]
      })
    );
    this.productForm.setControl('initialStocks', this.fb.array(stockControls));
  }

  get initialStocksFormArray(): FormArray {
    return this.productForm.get('initialStocks') as FormArray;
  }

  setupCategoryChangeSubscription(): void {
    const categoriaControl = this.productForm.get('categoria');
    const subcategoriaControl = this.productForm.get('subcategoria');

    if (categoriaControl && subcategoriaControl) {
      categoriaControl.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe((categoryName: string) => {
          subcategoriaControl.reset('');
          this.filteredSubcategories = [];
          if (categoryName) {
            const selectedCategory = this.allCategories.find(cat => cat.name === categoryName);
            if (selectedCategory && selectedCategory.subcategories && selectedCategory.subcategories.length > 0) {
              this.filteredSubcategories = selectedCategory.subcategories;
              subcategoriaControl.enable();
            } else {
              subcategoriaControl.disable();
            }
          } else {
            subcategoriaControl.disable();
          }
        });
    }
  }

  generateProductCode(): void {
    this.isGeneratingCode = true;
    setTimeout(() => {
      let newCode: string;
      let attempts = 0;
      const MAX_ATTEMPTS = 1000;
      do {
        newCode = Math.floor(10000 + Math.random() * 90000).toString();
        attempts++;
      } while (this.existingProductCodes.has(newCode) && attempts < MAX_ATTEMPTS);

      if (this.existingProductCodes.has(newCode) && attempts >= MAX_ATTEMPTS) {
          this.userMessage = { text: 'No se pudo generar un código único automáticamente. Inténtelo manualmente.', type: 'error' };
      } else {
        this.productForm.get('codigo_producto')?.setValue(newCode);
        this.productForm.get('codigo_producto')?.markAsDirty();
        this.productForm.get('codigo_producto')?.updateValueAndValidity();
      }
      this.isGeneratingCode = false;
    }, 300);
  }

  productCodeValidator(control: FormControl): { [key: string]: boolean } | null {
    if (control.pristine || !control.dirty) {
        return null;
    }
    if (this.existingProductCodes && this.existingProductCodes.has(control.value)) {
      return { productCodeExists: true };
    }
    return null;
  }

  onSubmit(): void {
    this.userMessage = { text: null, type: null };
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      this.userMessage = { text: 'Por favor, corrige los errores en el formulario.', type: 'error' };
      return;
    }

    this.isSaving = true;
    const formValues = this.productForm.getRawValue();

    const productPayload: CreateProductPayload = {
      codigo_producto: formValues.codigo_producto,
      nombre: formValues.nombre,
      precio: parseFloat(formValues.precio),
      marca: formValues.marca,
      codigo_marca: formValues.codigo_marca,
      categoria: formValues.categoria,
      subcategoria: formValues.subcategoria,
      descripcion: formValues.descripcion || '',
      imageUrl: formValues.imageUrl || '',
    };

    this.productService.createProduct(productPayload).pipe(
      switchMap((newProduct: ApiProduct) => {
        console.log('Producto creado exitosamente:', newProduct);
        this.existingProductCodes.add(newProduct.codigo_producto);
        this.userMessage = { text: `Producto "${newProduct.nombre}" creado. Actualizando stock...`, type: 'success' };

        const stockUpdateObservables: Observable<UpdateStockResponse>[] = [];
        formValues.initialStocks.forEach((stockItem: { branch_code: string, quantity: number }) => {
          if (stockItem.quantity > 0) {
            stockUpdateObservables.push(
              this.inventoryService.updateInventoryItem(stockItem.branch_code, newProduct.codigo_producto, stockItem.quantity).pipe(
                map((response: UpdateStockResponse) => ({
                  ...response,
                  branch_code: stockItem.branch_code,
                  product_code: newProduct.codigo_producto,
                  error: false
                } as UpdateStockResponse)),
                catchError(err => {
                  return of({
                    message: '',
                    error: true,
                    branch_code: stockItem.branch_code,
                    product_code: newProduct.codigo_producto,
                    errorMessage: err.message || `Error al actualizar stock para ${stockItem.branch_code}.`
                  } as UpdateStockResponse);
                })
              )
            );
          }
        });

        if (stockUpdateObservables.length > 0) {
          return forkJoin(stockUpdateObservables).pipe(
            switchMap((results: UpdateStockResponse[]) => {
              const failedUpdates = results.filter(res => res.error === true);
              if (failedUpdates.length > 0) {
                const errorMessages = failedUpdates.map(fu => `Sucursal ${fu.branch_code}: ${fu.errorMessage}`).join('; ');
                this.userMessage = { text: `Producto "${newProduct.nombre}" creado, pero con errores al actualizar stock: ${errorMessages}`, type: 'error' };
              } else {
                this.userMessage = { text: `Producto "${newProduct.nombre}" creado exitosamente.`, type: 'success' };
              }
              return of(newProduct);
            })
          );
        } else {
          this.userMessage = { text: `Producto "${newProduct.nombre}" creado exitosamente (sin stock inicial para asignar).`, type: 'success' };
          return of(newProduct);
        }
      }),
      takeUntil(this.destroy$),
      finalize(() => this.isSaving = false)
    ).subscribe({
      next: (finalProduct: ApiProduct) => {
        console.log('Proceso de creación completado para:', finalProduct.nombre);
        if (this.userMessage.type === 'success') {
            this.productForm.reset({
              codigo_producto: '',
              nombre: '',
              precio: null,
              marca: '',
              codigo_marca: '',
              categoria: '',
              subcategoria: { value: '', disabled: true },
              descripcion: '',
              imageUrl: ''
            });
            this.buildInitialStocksFormArray();
            this.productForm.markAsPristine();
            this.productForm.markAsUntouched();
        }
      },
      error: (error: any) => {
        console.error('Error en el proceso de creación (flujo principal):', error);
        if (!this.userMessage.text || this.userMessage.type !== 'error') {
             this.userMessage = { text: `Error al crear el producto: ${error.message || 'Error desconocido.'}`, type: 'error' };
        }
        if (error.error && typeof error.error === 'object') {
            Object.keys(error.error).forEach(key => {
              const control = this.productForm.get(key);
              if (control && !control.hasError('backendError')) {
                const errorMsg = Array.isArray(error.error[key]) ? error.error[key].join('. ') : error.error[key];
                control.setErrors({ backendError: errorMsg });
                control.markAsTouched();
              }
            });
            if (this.userMessage.text && (this.userMessage.text.includes('Error al crear el producto') || this.userMessage.text.includes('Error desconocido'))) {
                if (!Object.keys(error.error).some(key => this.productForm.get(key))) {
                  this.userMessage.text = `Error del servidor: ${error.error.detail || error.error.error || JSON.stringify(error.error)}`;
                } else {
                  this.userMessage.text = 'Error de validación del servidor. Revisa los campos marcados.';
                }
            }
        } else if (error.message && error.message.toLowerCase().includes('product code already exists')) {
            this.productForm.get('codigo_producto')?.setErrors({ productCodeExists: true });
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
