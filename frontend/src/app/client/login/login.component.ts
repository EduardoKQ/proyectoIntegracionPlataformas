import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { AuthService, AuthResponse, LoginCredentials, StoredUser } from '../../services/auth.service'; // Ajusta la ruta

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
            this.authService.storeTokens(response.tokens.access, response.tokens.refresh);
            this.authService.storeUserData(response.user_data as StoredUser);

            const userRole = response.user_data.role;

            if (userRole === 'cliente') {
              this.router.navigate(['/home']);
            } else if (userRole) {
              this.router.navigate(['/product']);
            } else {
              this.router.navigate(['/']);
            }
          } else {
            this.errorMessage = response.message || 'Respuesta inesperada.';
          }
        },
        error: (errorResponse: HttpErrorResponse) => {
          let messageForUser = 'No se pudo iniciar sesión. Intente más tarde.';
          let backendErrorDetail = '';
          if (errorResponse.error) { if (typeof errorResponse.error === 'object') { backendErrorDetail = errorResponse.error.detail
          || errorResponse.error.error || errorResponse.error.message ||
          (errorResponse.error.non_field_errors ? errorResponse.error.non_field_errors.join(' ') : ''); }
          else if (typeof errorResponse.error === 'string') { backendErrorDetail = errorResponse.error; } }
          if (!backendErrorDetail && errorResponse.statusText) { backendErrorDetail = errorResponse.statusText; }
          const lowerCaseErrorDetail = backendErrorDetail.toLowerCase();
          if (lowerCaseErrorDetail.includes('invalid credentials')) {
            messageForUser = 'Correo electrónico o contraseña incorrectos.';
          }
          this.errorMessage = messageForUser;
       }
      });
  }
}
