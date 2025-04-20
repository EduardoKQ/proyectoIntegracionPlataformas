import { Routes } from '@angular/router';
import { ProductAddComponent } from './pages/product-add/product-add.component';
import { ProductListComponent } from './pages/product-list/product-list.component';
import { CategoriesComponent} from './pages/categories/categories.component';
import { ProductComponent } from './pages/product/product.component';
import { OrdersComponent } from './pages/orders/orders.component';
import { ProductEditComponent } from './pages/product-edit/product-edit.component';

export const routes: Routes = [

  { path: 'product-list', component: ProductListComponent },
  { path: 'product-add', component: ProductAddComponent },
  { path: 'categories', component: CategoriesComponent },
  { path: 'product', component: ProductComponent },
  { path: 'orders', component: OrdersComponent },
  { path: 'products/edit/:codigo', component: ProductEditComponent },
  { path : '', redirectTo: 'product', pathMatch: 'full' },
];


