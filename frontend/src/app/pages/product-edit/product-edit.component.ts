import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProductService } from '../../services/product.service';
import { Product } from '../../../models/product.model';
import { Observable, of, switchMap, tap } from 'rxjs';

@Component({
  selector: 'app-product-edit',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink
  ],
  templateUrl: './product-edit.component.html',
  styleUrls: ['./product-edit.component.scss']
})
export class ProductEditComponent implements OnInit {

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);
  private fb = inject(FormBuilder);

  productCodigo: string | null = null;
  productForm!: FormGroup;
  isLoading = true;
  productNotFound = false;

  ngOnInit(): void {
    this.initializeForm();

    this.productCodigo = this.route.snapshot.paramMap.get('codigo');

    if (this.productCodigo) {
      this.productService.getProductByCodigo(this.productCodigo)
        .pipe(
            tap(product => {
                if (product) {
                    this.productForm.patchValue(product);
                    this.productNotFound = false;
                } else {
                    this.productNotFound = true;
                }
                this.isLoading = false;
            })
        ).subscribe();
    } else {
      console.error("No se proporcionó código de producto en la URL");
      this.isLoading = false;
      this.productNotFound = true;
    }
  }

  initializeForm(): void {
    this.productForm = this.fb.group({
      id: [null],
      codigo_producto: [{ value: null, disabled: true }],
      nombre: ['', Validators.required],
      precio: [null, [Validators.required, Validators.min(0)]],
      stock: [null, [Validators.required, Validators.min(0)]],
      marca: [''],
      codigoM: [''],
      categoria: [''],
      subcategoria: [''],
      imageUrl: [''],
      descripcion: ['']
    });
  }

  saveProduct(): void {
    if (this.productForm.invalid) {
      console.warn('Formulario inválido');
      this.productForm.markAllAsTouched();
      return;
    }

    const updatedProductData = this.productForm.getRawValue();

    this.productService.updateProduct(updatedProductData).subscribe({
      next: (response) => {
        console.log('Producto actualizado (simulado):', response);
        this.router.navigate(['/product']);
      },
      error: (err) => console.error('Error al actualizar (simulado):', err)
    });
  }

  cancel(): void {
    this.router.navigate(['/product']);
  }
}
