import { Component, OnInit, ElementRef, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';

interface CategoryGroup {
  title: string;
  subcategories: Subcategory[];
}

interface Subcategory {
  title: string;
  link: string;
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private elementRef = inject(ElementRef);

  showCategoriesMenu = false;
  showDropdown = false;
  searchQuery = '';

  categoryGroups: CategoryGroup[] = [
    { title: 'Herramientas Manuales', subcategories: [{ title: 'Herramientas Manuales', link: '#' }, { title: 'Destornilladores', link: '#' }] },
    { title: 'Materiales Básicos', subcategories: [{ title: 'Cemento', link: '#' }, { title: 'Pintura', link: '#' }] },
  ];
  hoveredCategory: string | null = null;
  currentSubcategories: Subcategory[] = [];

  userName: string | null = null;
  isAdminUser: boolean = false;
  isUserLoggedIn: boolean = false;

  private readonly ADMIN_TIENDA_ROLES = ['vendedor', 'bodeguero', 'contador', 'administrador_tienda'];

  ngOnInit(): void {
    this.updateLoginState();
  }

  updateLoginState(): void {
    this.isUserLoggedIn = this.authService.isLoggedIn();
    if (this.isUserLoggedIn) {
      const user = this.authService.getUserData();
      this.userName = user ? (user.email.split('@')[0]) : 'Usuario';
      this.isAdminUser = user && user.role ? this.ADMIN_TIENDA_ROLES.includes(user.role) : false;
    } else {
      this.userName = null;
      this.isAdminUser = false;
    }
  }

  toggleCategoriesMenu(): void {
    this.showCategoriesMenu = !this.showCategoriesMenu;
    if (!this.showCategoriesMenu) {
      this.hoveredCategory = null;
      this.currentSubcategories = [];
    }
  }

  closeCategoriesMenu(): void {
    this.showCategoriesMenu = false;
    this.hoveredCategory = null;
    this.currentSubcategories = [];
  }

  hoverCategory(categoryTitle: string): void {
    this.hoveredCategory = categoryTitle;
    const group = this.categoryGroups.find(g => g.title === categoryTitle);
    this.currentSubcategories = group ? group.subcategories : [];
  }

  search(): void {
    if (this.searchQuery.trim()) {
      console.log('Buscando:', this.searchQuery);
      this.searchQuery = '';
    }
  }

  toggleUserDropdown(): void {
    this.showDropdown = !this.showDropdown;
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
    this.showDropdown = false;
    this.showCategoriesMenu = false;
  }

  goToInventory(): void {
    this.navigateTo('/product/list');
  }

  logout(): void {
    this.authService.logout();
    this.updateLoginState();
    this.showDropdown = false;
    this.router.navigate(['/home']);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const accountMenuElement = this.elementRef.nativeElement.querySelector('.account-menu');
    const categoriesMenuButtonElement = this.elementRef.nativeElement.querySelector('.categories-btn');
    const categoriesDropdownElement = this.elementRef.nativeElement.querySelector('.categories-dropdown');

    if (this.showDropdown && accountMenuElement && !accountMenuElement.contains(event.target as Node)) {
      this.showDropdown = false;
    }

    if (this.showCategoriesMenu &&
        categoriesMenuButtonElement && !categoriesMenuButtonElement.contains(event.target as Node) &&
        categoriesDropdownElement && !categoriesDropdownElement.contains(event.target as Node)) {
        this.closeCategoriesMenu();
    }
  }
}
