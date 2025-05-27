import { Component, OnInit } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter, map, mergeMap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
import { HeaderComponent } from './shared/components/header/header.component';
import { CartService } from './services/cart.service';
import { LoginRequiredModalComponent } from './client/login-required-modal/login-required-modal.component';
import { FooterComponent } from './shared/components/footer/footer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    SidebarComponent,
    HeaderComponent,
    LoginRequiredModalComponent,
    FooterComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'frontend';
  showSidebar: boolean = false;
  showStoreHeader: boolean = false;
  showFooter: boolean = false;
  showLoginModal$: Observable<boolean>;
  isSidebarCollapsed: boolean = false;

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private cartService: CartService
  ) {
    this.showLoginModal$ = this.cartService.showLoginModal$;
  }

  ngOnInit() {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => {
        let route = this.activatedRoute;
        while (route.firstChild) {
          route = route.firstChild;
        }
        return route;
      }),
      filter((route) => route.outlet === 'primary'),
      mergeMap((route) => route.data)
    ).subscribe((data) => {
      this.showSidebar = data?.['showSidebar'] === true;
      this.showStoreHeader = data?.['showStoreHeader'] === true;
      this.showFooter = data?.['showFooter'] === true;
    });
  }

  onSidebarToggle(collapsed: boolean): void {
    this.isSidebarCollapsed = collapsed;
  }
}
