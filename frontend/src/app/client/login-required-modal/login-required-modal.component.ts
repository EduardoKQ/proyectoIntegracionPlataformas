import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login-required-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login-required-modal.component.html',
  styleUrls: ['./login-required-modal.component.scss']
})
export class LoginRequiredModalComponent {

  constructor(
    private cartService: CartService,
    private router: Router
  ) { }

  goToLogin(): void {
    this.cartService.closeLoginModal();
    this.router.navigate(['login']);
  }

  close(): void {
    this.cartService.closeLoginModal();
  }
}
