import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { RouterLink } from '@angular/router';

import { Product } from '../../../models/product.model';
import { ProductService } from '../../services/product.service';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink
  ],
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.scss']
})
export class ProductListComponent implements OnInit {
  private productService = inject(ProductService);
  public products$!: Observable<Product[]>;
  public errorOcurred = false;

  ngOnInit(): void {
    this.products$ = this.productService.getProducts()
      .pipe(
        catchError(error => {
          console.error('ERROR al obtener productos:', error);
          this.errorOcurred = true;
          return of([]);
        })
      );
  }
}
