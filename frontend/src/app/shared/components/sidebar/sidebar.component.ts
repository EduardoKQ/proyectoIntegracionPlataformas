import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NgIf } from '@angular/common';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    NgIf, RouterLink, RouterLinkActive
  ],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit, OnDestroy {

  isCollapsed: boolean = false;
  isSmallScreen: boolean = false;
  private screenWidthBreakpoint: number = 768;

  @Output() collapsedStateChanged = new EventEmitter<boolean>();

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.checkScreenSize(window.innerWidth);
  }

  ngOnDestroy(): void {
  }

  private checkScreenSize(width: number): void {
    this.isSmallScreen = width < this.screenWidthBreakpoint;
  }

  toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed;
    this.collapsedStateChanged.emit(this.isCollapsed);
  }

  collapseSidebar(): void {
    if (this.isSmallScreen && !this.isCollapsed) {
       this.isCollapsed = true;
       this.collapsedStateChanged.emit(this.isCollapsed);
    }
  }

  goToStore(): void {
    this.router.navigate(['/home']).then(() => {
       window.location.reload();
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

}
