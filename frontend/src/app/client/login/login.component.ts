import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { AuthService, AuthResponse, LoginCredentials, UserData } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [
    ReactiveFormsModule, CommonModule
  ],
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  isLoading = false;
  errorMessage = '';

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.initForm();
  }

  initForm(): void {
    this.loginForm = this.formBuilder.group({
      email: ['', [
        Validators.required,
        Validators.email
      ]],
      password: ['', [Validators.required]],
    });
  }

  onSubmit(): void {
    this.errorMessage = '';
    this.loginForm.markAllAsTouched();
    if (this.loginForm.invalid) { return; }

    this.isLoading = true;
    const credentials: LoginCredentials = {
      email: this.loginForm.get('email')?.value,
      password: this.loginForm.get('password')?.value
    };

    this.authService.login(credentials)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (response: AuthResponse) => {
          if (response.status === 'success' && response.tokens && response.user_data) {
            this.navigateToRoleBasedDashboard(response.user_data);
          } else {
            this.errorMessage = response.message || 'Respuesta inesperada del servidor.';
          }
        },
        error: (errorResponse: HttpErrorResponse) => {
          let messageForUser = 'No se pudo iniciar sesión. Intente más tarde.';
          let backendErrorDetail = '';
          if (errorResponse.error) {
            if (typeof errorResponse.error === 'object') {
                backendErrorDetail = errorResponse.error.detail
                || errorResponse.error.error
                || errorResponse.error.message
                || (errorResponse.error.non_field_errors ? errorResponse.error.non_field_errors.join(' ') : JSON.stringify(errorResponse.error));
            } else if (typeof errorResponse.error === 'string') {
                backendErrorDetail = errorResponse.error;
            }
          }
          if (!backendErrorDetail && errorResponse.statusText) {
            backendErrorDetail = errorResponse.statusText;
          }

          const lowerCaseErrorDetail = backendErrorDetail?.toLowerCase() || '';

          if (lowerCaseErrorDetail.includes('invalid credentials') || errorResponse.status === 401) {
            messageForUser = 'Correo electrónico o contraseña incorrectos.';
          } else if (backendErrorDetail) {
            messageForUser = `Error: ${backendErrorDetail}`;
          }
          this.errorMessage = messageForUser;
          console.error('Error en login:', errorResponse);
        }
      });
  }
  private navigateToRoleBasedDashboard(userData: UserData): void {
    const userRole = userData.role;

    if (!userRole) {
      console.error('Login: Rol de usuario no definido después del login. Redirigiendo a /.');
      this.router.navigate(['/']);
      return;
    }

    let targetPath: string;

    switch (userRole) {
      case 'administrador_tienda':
        targetPath = '/product';
        break;
      case 'bodeguero':
        targetPath = '/product-bodeguero';
        break;
      case 'cliente':
        targetPath = '/home';
        break;
      default:
        console.warn(`Login: Rol '${userRole}' no tiene una redirección de dashboard específica. Redirigiendo a /home.`);
        targetPath = '/home';
        break;
    }
    this.router.navigate([targetPath]);
  }
}
