import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ValidatorFn, AbstractControl, ValidationErrors, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { AuthService, RegisterCredentials, RegisterResponse} from '../../services/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
  standalone: true,
  imports: [
    ReactiveFormsModule, CommonModule
  ],
})
export class RegisterComponent implements OnInit {
  registerForm!: FormGroup;
  isLoading = false;
  isProcessingSuccess = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.initForm();
  }

  matchPasswordValidator(): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      const password = group.get('password')?.value;
      const confirmPassword = group.get('confirmPassword')?.value;
      return password && confirmPassword && password !== confirmPassword ? { passwordMismatch: true } : null;
    };
  }

  initForm(): void {
    const emailPattern = "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$";
    this.registerForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.pattern(emailPattern)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      receiveOffers: [true]
    }, {
      validators: this.matchPasswordValidator()
    });
  }

  onSubmit(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.registerForm.markAllAsTouched();
    if (this.registerForm.invalid) { return; }

    this.isLoading = true;
    this.isProcessingSuccess = false;

    const payload: RegisterCredentials = {
      email: this.registerForm.get('email')?.value,
      password: this.registerForm.get('password')?.value,
      receive_offers: this.registerForm.get('receiveOffers')?.value
    };

    this.authService.registerClient(payload)
      .pipe(
        finalize(() => {
             this.isLoading = false;
        })
      )
      .subscribe({
        next: (response: RegisterResponse) => {
          if (response.status === 'success') {
            this.isProcessingSuccess = true;
            this.successMessage = response.message || '¡Registro completado con éxito!';
            this.registerForm.disable();

            setTimeout(() => {
               this.isProcessingSuccess = false;
               this.router.navigate(['/login']);
            }, 3000);

          } else {
            this.errorMessage = response.message || 'Ocurrió un error inesperado.';
          }
        },
        error: (errorResponse: HttpErrorResponse) => {
           let messageForUser = 'No se pudo completar el registro. Intente más tarde.';
           let backendErrorDetail = '';
           if (errorResponse.error) { if (typeof errorResponse.error === 'object') { if (errorResponse.error.email && Array.isArray(errorResponse.error.email))
            { backendErrorDetail = errorResponse.error.email.join('. '); } else if (errorResponse.error.password && Array.isArray(errorResponse.error.password))
              { backendErrorDetail = `Contraseña: ${errorResponse.error.password.join('. ')}`; } else { backendErrorDetail = errorResponse.error.detail ||
              errorResponse.error.error || errorResponse.error.message || (errorResponse.error.non_field_errors ? errorResponse.error.non_field_errors.join(' ') : '');}}
              else if (typeof errorResponse.error === 'string') { backendErrorDetail = errorResponse.error; } } if (!backendErrorDetail && errorResponse.statusText)
              { backendErrorDetail = errorResponse.statusText; }
           const lowerCaseErrorDetail = backendErrorDetail.toLowerCase();
           if (lowerCaseErrorDetail.includes('user already exists')) { messageForUser = 'Este correo electrónico ya está registrado.'; } else if (lowerCaseErrorDetail.includes('enter a valid email address')) { messageForUser = 'Ingrese una dirección de correo electrónico válida.'; } else if (backendErrorDetail) { messageForUser = `Error: ${backendErrorDetail}`; } else { messageForUser = 'Error de conexión o respuesta inválida del servidor.'; }
           this.errorMessage = messageForUser;
        }
      });
  }
}
