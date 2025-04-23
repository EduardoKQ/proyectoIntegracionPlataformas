import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    NgIf,RouterLink,RouterLinkActive
  ],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit, OnDestroy {

  isCollapsed: boolean = false;
  isSmallScreen: boolean = false;
  private screenWidthBreakpoint: number = 768;

  @Output() collapsedStateChanged = new EventEmitter<boolean>();

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.checkScreenSize(window.innerWidth);
  }

  private checkScreenSize(width: number): void {
    this.isSmallScreen = width < this.screenWidthBreakpoint;
    if (!this.isSmallScreen && this.isCollapsed && width >= this.screenWidthBreakpoint) {
    }
  }

  toggleSidebar() {
    this.isCollapsed = !this.isCollapsed;
    this.collapsedStateChanged.emit(this.isCollapsed);
  }

  collapseSidebar(): void {
    if (this.isSmallScreen) {
       this.isCollapsed = true;
    }
  }

  goToStore(): void {
    this.router.navigate(['/login']).then(() => {
      window.location.reload();
    });
  }

  logout(): void {
  }

  ngOnDestroy(): void {
  }
}
