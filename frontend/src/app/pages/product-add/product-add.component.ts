import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { ProductService } from '../../services/product.service';
import { CategorySubcategoryService, Category, SubcategoryFromCategoryDetail } from '../../services/category.service';
import { BranchService, Branch } from '../../services/branch.service';
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
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadInitialData();
    this.initForm();
    this.setupCategoryChangeSubscription();
  }

  loadInitialData(): void {
    this.isLoadingUIData = true;
    Promise.all([
      this.categorySubcategoryService.getCategories().toPromise(),
      this.branchService.getBranches().toPromise(),
      this.productService.getProducts().toPromise()
    ])
    .then(([categories, branches, products]) => {
      this.allCategories = categories || [];
      this.branches = branches || [];
      if (products) {
        products.forEach(p => this.existingProductCodes.add(p.codigo_producto));
      }
      this.buildInitialStocksFormArray();
      this.isLoadingUIData = false;
    })
    .catch(error => {
      console.error('Error cargando datos iniciales:', error);
      this.userMessage = { text: 'Error al cargar datos necesarios. ' + (error?.message || 'Error desconocido.'), type: 'error' };
      this.isLoadingUIData = false;
    });
  }

  initForm(): void {
    this.productForm = this.fb.group({
      codigo_producto: ['', [Validators.required, this.productCodeValidator.bind(this)]],
      nombre: ['', Validators.required],
      precio: [null, [Validators.required, Validators.min(0),]],
      marca: ['', Validators.required],
      codigo_marca: ['', Validators.required],
      categoria: ['', Validators.required],
      subcategoria: ['', Validators.required],
      descripcion: [''],
      imageUrl: [''],
      initialStocks: this.fb.array([])
    });
  }

  buildInitialStocksFormArray(): void {
    const stockControls = this.branches.map(branch =>
      this.fb.group({
        branch_code: [branch.branch_code],
        branch_name: [branch.name],
        quantity: [{ value: 0, disabled: true }, [Validators.min(0), Validators.pattern(/^[0-9]*$/)]]
      })
    );
    this.productForm.setControl('initialStocks', this.fb.array(stockControls));
  }

  get initialStocksFormArray(): FormArray {
    return this.productForm.get('initialStocks') as FormArray;
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
          this.filteredSubcategories = [];
          if (categoryName) {
            const selectedCategory = this.allCategories.find(cat => cat.name === categoryName);
            if (selectedCategory && selectedCategory.subcategories) {
              this.filteredSubcategories = selectedCategory.subcategories;
            }
          }
        });
    }
  }

  generateProductCode(): void {
    this.isGeneratingCode = true;
    setTimeout(() => {
      let newCode: string;
      let attempts = 0;
      const MAX_ATTEMPTS = 100;
      do {
        newCode = Math.floor(1000 + Math.random() * 9000).toString();
        attempts++;
      } while (this.existingProductCodes.has(newCode) && attempts < MAX_ATTEMPTS);

      if (this.existingProductCodes.has(newCode) && attempts >= MAX_ATTEMPTS) {
         this.userMessage = { text: 'No se pudo generar un código único automáticamente. Inténtelo manualmente o verifique los existentes.', type: 'error' };
      } else {
        this.productForm.get('codigo_producto')?.setValue(newCode);
        this.productForm.get('codigo_producto')?.markAsDirty();
        this.productForm.get('codigo_producto')?.updateValueAndValidity();
      }
      this.isGeneratingCode = false;
    }, 300);
  }

  productCodeValidator(control: FormControl): { [key: string]: boolean } | null {
    if (this.productForm && this.productForm.get('codigo_producto')?.dirty && this.existingProductCodes && this.existingProductCodes.has(control.value)) {
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
    const formValues = this.productForm.value;

    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const currentDateForPayload = `${year}-${month}-${day}`;

    const payload: CreateProductPayload = {
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

    console.log('Payload a enviar (sin stock inicial):', payload);

    this.productService.createProduct(payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isSaving = false)
      )
      .subscribe({
        next: (newProduct: ApiProduct) => {
          console.log('RESPUESTA EXITOSA - Producto creado:', newProduct);
          this.userMessage = { text: `Producto "${newProduct.nombre}" creado exitosamente (stock inicial no gestionado desde este formulario).`, type: 'success' };
          this.existingProductCodes.add(newProduct.codigo_producto);
          this.productForm.reset({
             categoria: '',
             subcategoria: ''
          });
          const stocksArray = this.productForm.get('initialStocks') as FormArray;
          stocksArray.controls.forEach(control => {
            (control as FormGroup).get('quantity')?.setValue(0);
          });
          this.productForm.markAsPristine();
        },
        error: (error: any) => {
          console.error('ERROR AL CREAR PRODUCTO:', error);
          this.userMessage = { text: `Error al crear el producto: ${error.message || 'Error desconocido.'}`, type: 'error' };
          if (error.message && (error.message.toLowerCase().includes('código de producto ya existe') || error.message.toLowerCase().includes('product code already exists'))) {
             this.productForm.get('codigo_producto')?.setErrors({ productCodeExists: true });
          }
          if (error.error && typeof error.error === 'object') {
            Object.keys(error.error).forEach(key => {
              const control = this.productForm.get(key);
              if (control) {
                control.setErrors({ backendError: Array.isArray(error.error[key]) ? error.error[key].join('. ') : error.error[key] });
              }
            });
            if (this.userMessage.text === `Error al crear el producto: ${error.message || 'Error desconocido.'}`) {
                 this.userMessage.text = 'Error de validación del servidor. Revisa los campos marcados.';
            }
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
