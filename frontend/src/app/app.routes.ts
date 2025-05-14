import { Routes } from '@angular/router';
import { ProductAddComponent } from './pages/product-add/product-add.component';
import { ProductListComponent } from './pages/product-list/product-list.component';
import { CategoriesComponent } from './pages/categories/categories.component';
import { ProductComponent } from './pages/product/product.component';
import { OrdersComponent } from './pages/orders/orders.component';
import { ProductEditComponent } from './pages/product-edit/product-edit.component';
import { LoginComponent } from './client/login/login.component';
import { RegisterComponent } from './client/register/register.component';
import { HomeComponent } from './store/home/home.component';
import { rolesGuard } from './guards/rol.guard';
import { CatalogoComponent } from './store/catalogo/catalogo.component';
import { CatalogoMarcaComponent } from './store/catalogo-marca/catalogo-marca.component';
import { StoryViewComponent } from './store/components/story-view/story-view.component';
import { ProductDetailComponent } from './store/product-detail/product-detail.component';
import { ProductListComponentB } from './pages/bodeguero/product-list-b/product-list-b.component';
import { ProductEditComponentB } from './pages/bodeguero/product-edit-b/product-edit-b.component';

const PRODUCT_ACCESS_ROLES = ['vendedor', 'bodeguero', 'contador', 'administrador_tienda'];

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [rolesGuard] },
  { path: 'register', component: RegisterComponent, canActivate: [rolesGuard] },
  { path: 'catalogo', component: CatalogoComponent, data: { showStoreHeader: true } },
  { path: 'catalogo-marca', component: CatalogoMarcaComponent, data: { showStoreHeader: true } },
  { path: 'home', component: HomeComponent, data: { showStoreHeader: true } },
  { path: 'producto/:codigo_producto', component: ProductDetailComponent, data: { showStoreHeader: true } },
  { path: 'story/:id', component: StoryViewComponent },
  { path: '', redirectTo: 'home', pathMatch: 'full' },

  {
    path: 'product',
    canActivate: [rolesGuard],
    data: {
      roles: ['administrador_tienda'],
      showSidebar: true
    },
    children: [
      { path: '', component: ProductComponent, pathMatch: 'full' },
      { path: 'list', component: ProductListComponent },
      { path: 'add', component: ProductAddComponent },
      { path: 'categories', component: CategoriesComponent },
      { path: 'orders', component: OrdersComponent },
      { path: 'edit/:codigo', component: ProductEditComponent },
    ]
  },

  {
    path: 'product-bodeguero',
    canActivate: [rolesGuard],
    data: {
      roles: ['bodeguero'],
      showSidebar: true
    },
    children: [
      { path: '', redirectTo: 'listB', pathMatch: 'full' },
      { path: 'listB', component: ProductListComponentB },
      { path: 'editB/:codigo', component: ProductEditComponentB }
    ]
  }
];
