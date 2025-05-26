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
import { StoryViewComponent } from './store/components/story-view/story-view.component';
import { ProductDetailComponent } from './store/product-detail/product-detail.component';
import { CartComponent } from './store/components/cart/cart.component';
import { PaymentMethodComponent } from './store/components/payment-method/payment-method.component';
import { PaymentResultComponent } from './store/components/payment-result/payment-result.component';
// Bodeguero
import { ProductListComponentB } from './pages/bodeguero/product-list-b/product-list-b.component';
import { ProductEditComponentB } from './pages/bodeguero/product-edit-b/product-edit-b.component';
import { OrdenesBodegaComponent } from './pages/bodeguero/ordenes-bodega/ordenes-bodega.component';
//Vendedor
import { ProListComponent } from './pages/vendedor/pro-list/pro-list.component';
import { OrdenesCompraComponent } from './pages/vendedor/ordenes-compra/ordenes-compra.component';
//Contador
import { OrdenesPagoComponent } from './pages/contador/ordenes-pago/ordenes-pago.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [rolesGuard] },
  { path: 'register', component: RegisterComponent, canActivate: [rolesGuard] },
  { path: 'catalogo', component: CatalogoComponent, data: { showStoreHeader: true, showSidebar: false, showFooter: true } },
  { path: 'home', component: HomeComponent, data: { showStoreHeader: true, showSidebar: false, showFooter: true } },
  {
    path: 'producto/:codigo_producto',
    component: ProductDetailComponent,
    data: { showStoreHeader: true, showSidebar: false, showFooter: true }
  },
  { path: 'story/:id', component: StoryViewComponent },
  { path: 'cart', component: CartComponent, data: { showStoreHeader: true, showSidebar: false, showFooter: true } },
  { path: 'payment-method', component: PaymentMethodComponent, data: { showStoreHeader: true, showSidebar: false, showFooter: true } },
  { path: 'payment-result', component: PaymentResultComponent },
  { path: '', redirectTo: 'home', pathMatch: 'full' },

  //1 Administrador
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

  //2 Bodeguero
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
      { path: 'editB/:codigo', component: ProductEditComponentB },
      { path: 'ordenesB', component: OrdenesBodegaComponent }
    ]
  },

  //3 Vendedor
  {
    path: 'product-vendedor',
    canActivate: [rolesGuard],
    data: {
      roles: ['vendedor'],
      showSidebar: true
    },
    children: [
      { path: '', redirectTo: 'proList', pathMatch: 'full' },
      { path: 'proList', component: ProListComponent },
      { path: 'ordenesCompra', component: OrdenesCompraComponent }
    ]
  },

  //4 Contador
  {
    path: 'product-contador',
    canActivate: [rolesGuard],
    data: {
      roles: ['contador'],
      showSidebar: true
    },
    children: [
      { path: '', redirectTo: 'ordenesPago', pathMatch: 'full' },
      { path: 'ordenesPago', component: OrdenesPagoComponent }
    ]
  }
];
