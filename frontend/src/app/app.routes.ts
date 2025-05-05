import { Routes } from '@angular/router';
import { ProductAddComponent } from './pages/product-add/product-add.component';
import { ProductListComponent } from './pages/product-list/product-list.component';
import { CategoriesComponent} from './pages/categories/categories.component';
import { ProductComponent } from './pages/product/product.component';
import { OrdersComponent } from './pages/orders/orders.component';
import { ProductEditComponent } from './pages/product-edit/product-edit.component';
import { LoginComponent } from './client/login/login.component';
import { RegisterComponent } from './client/register/register.component';
import { HomeComponent } from './store/home/home.component';
import { rolesGuard } from './guards/rol.guard';
import { StoryViewComponent } from './store/components/story-view/story-view.component';

///Roles con acceso al inventario
const PRODUCT_ACCESS_ROLES = ['vendedor', 'bodeguero', 'contador', 'administrador_tienda'];

export const routes: Routes = [

  { path: 'login', component: LoginComponent,canActivate: [rolesGuard] },
  { path: 'register', component: RegisterComponent,canActivate: [rolesGuard] },
  { path: 'home', component: HomeComponent},
  { path: 'story/:id', component: StoryViewComponent },
  { path : '', redirectTo: 'home', pathMatch: 'full' },

  {
    path: 'product',
    canActivate: [rolesGuard],
    data: {
      roles: PRODUCT_ACCESS_ROLES,
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
];
